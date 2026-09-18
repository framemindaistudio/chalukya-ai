"""
Chalukya AI server (FastAPI).

One process for the demo laptop:
  • serves the built web app (web/dist) so phones on the same Wi-Fi can open it
  • /api/ws          live alerts between tourists' phones and the command centre (WebSocket)
  • /api/iot         ESP32 parking / safety nodes post readings here; anomaly detection runs on them
  • /api/vision      sculpture recognition with a Grad-CAM heatmap ("why the AI thinks so")
  • /api/intent      server-grade multilingual intent model (char n-grams + lexicon + e5 embeddings)
  • /api/crowd/count people counting on a CCTV frame (COCO person detector)
  • /api/tts         offline Kannada / Hindi speech (Meta MMS-TTS), for phones without those voices
Every AI endpoint degrades gracefully: the web app already does the core work on the phone.

Run:  python -m server   (from the project root)   →  http://localhost:8300  (and https on :8443 if certs exist)
"""
from __future__ import annotations

import asyncio
import base64
import io
import json
import os
import time
from collections import defaultdict, deque
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
ML = ROOT / "ml"
DIST = ROOT / "web" / "dist"
DATA_DIR = ROOT / "server" / "data"; DATA_DIR.mkdir(exist_ok=True)
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

app = FastAPI(title="Chalukya AI", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── Live alerts ──────────────────────────────────────────────────────────────────────────────────
class Hub:
    def __init__(self):
        self.clients: set[WebSocket] = set()
        self.recent: deque = deque(maxlen=50)

    async def broadcast(self, msg: dict, skip: WebSocket | None = None):
        if msg.get("kind") == "alert": self.recent.append(msg)
        dead = []
        for ws in self.clients:
            if ws is skip: continue
            try: await ws.send_text(json.dumps(msg))
            except Exception: dead.append(ws)
        for d in dead: self.clients.discard(d)


hub = Hub()


@app.websocket("/api/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept(); hub.clients.add(ws)
    for m in list(hub.recent): await ws.send_text(json.dumps(m))
    try:
        while True:
            msg = json.loads(await ws.receive_text())
            await hub.broadcast(msg, skip=ws)
            if msg.get("kind") == "alert": log_event(msg["alert"])
    except (WebSocketDisconnect, Exception):
        hub.clients.discard(ws)


def log_event(ev: dict):
    with open(DATA_DIR / "events.jsonl", "a", encoding="utf8") as f: f.write(json.dumps(ev, ensure_ascii=False) + "\n")


@app.post("/api/alerts")
async def post_alert(alert: dict):
    log_event(alert)
    await hub.broadcast({"kind": "alert", "alert": alert})
    return {"ok": True}


@app.get("/api/health")
def health():
    return {"ok": True, "clients": len(hub.clients), "models": {k: v is not None for k, v in MODELS.items()}}


# ── IoT ingest + anomaly detection ───────────────────────────────────────────────────────────────
class Reading(BaseModel):
    node: str                         # e.g. "p_badami_caves" or "safety_caves"
    occupied: int | None = None       # parking: cars detected
    capacity: int | None = None
    slots: list[int] | None = None    # per-slot 0/1 from ultrasonic sensors
    temp_c: float | None = None
    humidity: float | None = None
    motion: int | None = None         # PIR events since last report
    battery: float | None = None


IOT_LAST: dict[str, dict] = {}
IOT_HIST: dict[str, deque] = defaultdict(lambda: deque(maxlen=36))


@app.post("/api/iot")
async def iot(r: Reading):
    d = r.model_dump(); d["at"] = time.time()
    if r.slots is not None and r.occupied is None: d["occupied"] = int(sum(r.slots))
    IOT_LAST[r.node] = d
    await hub.broadcast({"kind": "iot", "reading": d})
    # Anomaly detection: robust z-score of the reading against this node's recent history
    h = IOT_HIST[r.node]
    val = d.get("occupied") if d.get("occupied") is not None else d.get("temp_c")
    alerts = []
    if val is not None and len(h) >= 8:
        arr = np.array(h, dtype=float); med = np.median(arr); mad = np.median(np.abs(arr - med)) * 1.4826 + 1e-6
        z = (val - med) / mad
        if abs(z) > 4:
            alerts.append({"type": "sensor", "severity": "warn", "source": "iot", "title": f"Sensor anomaly on {r.node}: reading {val} vs usual {med:.0f}",
                           "detail": f"robust z = {z:.1f}; check the device", "id": f"iot-{r.node}-{int(time.time()//600)}", "at": int(time.time() * 1000)})
    if r.temp_c is not None and r.temp_c >= 40:
        alerts.append({"type": "heat", "severity": "warn", "source": "iot", "title": f"{r.node}: {r.temp_c:.0f}°C measured on site",
                       "id": f"heat-{r.node}-{int(time.time()//1800)}", "at": int(time.time() * 1000)})
    if val is not None: h.append(val)
    for a in alerts: await post_alert(a)
    return {"ok": True, "alerts": len(alerts)}


@app.get("/api/iot/latest")
def iot_latest(): return IOT_LAST


# ── Local business portal ────────────────────────────────────────────────────────────────────────
@app.post("/api/business")
def business(b: dict):
    b["submitted_at"] = time.time(); b["status"] = "pending_verification"
    with open(DATA_DIR / "business_submissions.jsonl", "a", encoding="utf8") as f: f.write(json.dumps(b, ensure_ascii=False) + "\n")
    return {"ok": True}


# ── Models (lazy) ────────────────────────────────────────────────────────────────────────────────
MODELS: dict[str, object | None] = {"vision": None, "intent": None, "detector": None, "tts": None}


def vision():
    if MODELS["vision"] is None:
        import timm, torch
        ck = torch.load(ML / "vision" / "out" / "efficientnet_b0" / "best.pt", map_location="cpu")
        m = timm.create_model(ck["model"], pretrained=False, num_classes=len(ck["classes"])); m.load_state_dict(ck["state"]); m.eval()
        cal = json.loads((ML / "vision" / "out" / "efficientnet_b0" / "calibration.json").read_text())
        MODELS["vision"] = (m, ck["classes"], ck["size"], cal)
    return MODELS["vision"]


@app.post("/api/vision/identify")
async def identify(file: UploadFile = File(...)):
    """Top-3 prediction + Grad-CAM heatmap over the photo (which carved regions drove the decision)."""
    import torch, torch.nn.functional as F
    from torchvision import transforms as T
    m, classes, size, cal = vision()
    im = Image.open(io.BytesIO(await file.read())).convert("RGB")
    tf = T.Compose([T.Resize(int(size * 1.14)), T.CenterCrop(size), T.ToTensor(), T.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225))])
    x = tf(im).unsqueeze(0).requires_grad_(False)
    feats = {}
    layer = m.conv_head
    h1 = layer.register_forward_hook(lambda mod, i, o: feats.__setitem__("a", o))
    h2 = layer.register_full_backward_hook(lambda mod, gi, go: feats.__setitem__("g", go[0]))
    logits = m(x); p = logits.softmax(1)[0]
    top = torch.topk(p, 3)
    m.zero_grad(); logits[0, top.indices[0]].backward()
    h1.remove(); h2.remove()
    w = feats["g"].mean(dim=(2, 3), keepdim=True)
    cam = F.relu((w * feats["a"]).sum(1, keepdim=True))
    cam = F.interpolate(cam, size=(size, size), mode="bilinear", align_corners=False)[0, 0].detach().numpy()
    cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
    base = T.Compose([T.Resize(int(size * 1.14)), T.CenterCrop(size)])(im)
    import matplotlib; matplotlib.use("Agg"); from matplotlib import cm
    heat = Image.fromarray((cm.inferno(cam)[:, :, :3] * 255).astype(np.uint8))
    blend = Image.blend(base, heat, 0.45)
    buf = io.BytesIO(); blend.save(buf, "JPEG", quality=85)
    probs = [(classes[i], float(v)) for v, i in zip(top.values.tolist(), top.indices.tolist())]
    confident = probs[0][1] >= cal["min_prob"] and probs[0][1] - probs[1][1] >= cal["min_margin"]
    return {"top": [{"id": c, "p": round(v, 4)} for c, v in probs], "confident": confident,
            "gradcam": "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()}


def intent_model():
    if MODELS["intent"] is None:
        import sys
        sys.path.insert(0, str(ML / "assistant"))
        from sentence_transformers import SentenceTransformer
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        from intents_data import expand, mask
        from lexicon import lex_counts
        rows = expand(); X = [r[0] for r in rows]; y = np.array([r[1] for r in rows])
        vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), sublinear_tf=True, max_features=4000)
        lr = LogisticRegression(C=12, max_iter=3000).fit(vec.fit_transform(X), y)
        emb = SentenceTransformer("intfloat/multilingual-e5-small")
        E = emb.encode(["query: " + t.replace("#", "place") for t in X], normalize_embeddings=True)
        lr2 = LogisticRegression(C=8, max_iter=3000).fit(E, y)
        MODELS["intent"] = (vec, lr, emb, lr2, mask, lex_counts, list(lr.classes_))
    return MODELS["intent"]


class Q(BaseModel):
    q: str


@app.post("/api/intent")
def intent(q: Q):
    vec, lr, emb, lr2, mask, lex_counts, classes = intent_model()
    t = mask(q.q)
    pa = lr.predict_proba(vec.transform([t]))[0]
    pd = lr2.predict_proba(emb.encode(["query: " + t.replace("#", "place")], normalize_embeddings=True))[0]
    c = np.array(lex_counts(t, classes), dtype=float)
    pb = np.exp(3 * (c - c.max())); pb = pb / pb.sum() if c.sum() else np.full(len(classes), 1 / len(classes))
    p = (pa + pb + pd) / 3
    order = np.argsort(-p)
    return {"intent": classes[order[0]], "confidence": float(p[order[0]]), "top": [{"intent": classes[i], "p": float(p[i])} for i in order[:3]], "model": "server-hybrid"}


def detector():
    if MODELS["detector"] is None:
        import torch
        from torchvision.models.detection import fasterrcnn_mobilenet_v3_large_fpn, FasterRCNN_MobileNet_V3_Large_FPN_Weights
        wts = FasterRCNN_MobileNet_V3_Large_FPN_Weights.DEFAULT
        m = fasterrcnn_mobilenet_v3_large_fpn(weights=wts, box_score_thresh=0.5).eval()
        MODELS["detector"] = (m, wts.transforms())
    return MODELS["detector"]


@app.post("/api/crowd/count")
async def crowd_count(file: UploadFile = File(...), capacity: int = 60):
    """CCTV people counting: COCO-pretrained Faster R-CNN (MobileNetV3), class 'person' only."""
    import torch
    m, tf = detector()
    im = Image.open(io.BytesIO(await file.read())).convert("RGB")
    im.thumbnail((960, 960))
    with torch.no_grad(): out = m([tf(im)])[0]
    keep = (out["labels"] == 1) & (out["scores"] >= 0.5)
    boxes = out["boxes"][keep].round().int().tolist()
    n = len(boxes)
    return {"count": n, "boxes": boxes, "width": im.width, "height": im.height, "density": round(n / max(1, capacity), 2),
            "level": "packed" if n >= capacity * 0.9 else "busy" if n >= capacity * 0.65 else "moderate" if n >= capacity * 0.35 else "low"}


class Say(BaseModel):
    text: str
    lang: str = "kn"


@app.post("/api/tts")
def tts(s: Say):
    """Offline speech for Kannada and Hindi using Meta's MMS-TTS (VITS) models."""
    import torch
    from transformers import AutoTokenizer, VitsModel
    code = {"kn": "kan", "hi": "hin", "en": "eng"}.get(s.lang, "kan")
    cache = MODELS["tts"] or {}
    if code not in cache:
        cache[code] = (AutoTokenizer.from_pretrained(f"facebook/mms-tts-{code}"), VitsModel.from_pretrained(f"facebook/mms-tts-{code}").eval())
        MODELS["tts"] = cache
    tok, model = cache[code]
    with torch.no_grad():
        wav = model(**tok(s.text[:600], return_tensors="pt")).waveform[0].numpy()
    import wave
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(model.config.sampling_rate)
        w.writeframes((np.clip(wav, -1, 1) * 32767).astype(np.int16).tobytes())
    return Response(buf.getvalue(), media_type="audio/wav")


# ── Web app ──────────────────────────────────────────────────────────────────────────────────────
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = DIST / path
        if path and f.is_file(): return FileResponse(f)
        return FileResponse(DIST / "index.html")
