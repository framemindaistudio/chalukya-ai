"""
Open-set calibration: when should the app say "not sure"?

Downloads a small out-of-distribution (OOD) set from Wikimedia Commons: temples that are NOT
Badami-Chalukyan (Hampi, Belur, Halebidu, Lakkundi) plus everyday scenes. Then it grid-searches a
rule "answer only if p1 >= a and p1 - p2 >= b" to keep answered accuracy high on in-distribution
photos while rejecting most OOD photos. Writes out/<model>/calibration.json and ood_report.json.
"""
import csv
import hashlib
import io
import json
import sys
import time
from pathlib import Path

import numpy as np
import requests
import timm
import torch
from PIL import Image

from train import DATA, Mem, transforms

ROOT = Path(__file__).parent
OOD = DATA / "ood"; OOD.mkdir(parents=True, exist_ok=True)
MODEL = sys.argv[1] if len(sys.argv) > 1 else "efficientnet_b0"
OUT = ROOT / "out" / MODEL
S = requests.Session(); S.headers["User-Agent"] = "ChalukyaAI-student-project/0.1 (+https://github.com/framemindaistudio/chalukya-ai)"
CATS = {"Category:Vittala Temple, Hampi": 18, "Category:Chennakeshava Temple, Belur": 18, "Category:Hoysaleswara Temple, Halebidu": 18,
        "Category:Brahma Jinalaya, Lakkundi": 10, "Category:Food of Karnataka": 14, "Category:Streets in Karnataka": 14, "Category:Mysore Palace": 12}


def fetch_ood():
    got = list(OOD.glob("*.jpg"))
    if len(got) >= 80: return got
    for cat, n in CATS.items():
        j = S.get("https://commons.wikimedia.org/w/api.php", params={"action": "query", "format": "json", "generator": "categorymembers", "gcmtitle": cat,
                  "gcmtype": "file", "gcmlimit": 60, "prop": "imageinfo", "iiprop": "url|mime", "iiurlwidth": 500}, timeout=30).json()
        pages = [p for p in j.get("query", {}).get("pages", {}).values() if p.get("imageinfo") and p["imageinfo"][0].get("mime") == "image/jpeg"][:n]
        for p in pages:
            f = OOD / (hashlib.md5(p["title"].encode()).hexdigest()[:12] + ".jpg")
            if f.exists(): continue
            try:
                im = Image.open(io.BytesIO(S.get(p["imageinfo"][0]["thumburl"], timeout=60).content)).convert("RGB"); im.save(f, quality=90)
            except Exception: pass
            time.sleep(0.2)
        print(cat, "done", flush=True)
    return list(OOD.glob("*.jpg"))


@torch.no_grad()
def probs(model, images, tf):
    out = []
    for i in range(0, len(images), 32):
        x = torch.stack([tf(im) for im in images[i:i + 32]])
        p = (model(x).softmax(1) + model(torch.flip(x, dims=[3])).softmax(1)) / 2
        out.append(p)
    return torch.cat(out).numpy()


def main():
    torch.set_num_threads(10)
    ck = torch.load(OUT / "best.pt", map_location="cpu")
    classes = ck["classes"]
    model = timm.create_model(ck["model"], pretrained=False, num_classes=len(classes)); model.load_state_dict(ck["state"]); model.eval()
    _, tf = transforms(ck["size"])
    rows = list(csv.DictReader(open(DATA / "splits.csv", encoding="utf-8")))
    val = [r for r in rows if r["split"] == "val"]
    Pv = probs(model, [Mem.img(r["file"]) for r in val], tf); yv = np.array([classes.index(r["class"]) for r in val])
    Pt, yt = np.load(OUT / "test_probs.npy"), np.load(OUT / "test_labels.npy")
    ood_files = fetch_ood()
    Po = probs(model, [Image.open(f).convert("RGB") for f in ood_files], tf)
    print("ood images:", len(ood_files))

    def stats(P, y, a, b):
        s = np.sort(P, 1); p1, p2 = s[:, -1], s[:, -2]
        ans = (p1 >= a) & (p1 - p2 >= b)
        acc = float((P.argmax(1)[ans] == y[ans]).mean()) if ans.any() else 0.0
        return float(ans.mean()), acc

    def reject(P, a, b):
        s = np.sort(P, 1); return float(1 - ((s[:, -1] >= a) & (s[:, -1] - s[:, -2] >= b)).mean())

    best = None
    for a in np.arange(0.25, 0.9, 0.025):
        for b in np.arange(0.0, 0.6, 0.025):
            cov, acc = stats(Pv, yv, a, b)
            rej = reject(Po, a, b)
            if acc < 0.95: continue
            score = cov + 0.8 * rej
            if best is None or score > best[0]: best = (score, a, b, cov, acc, rej)
    _, a, b, cov, acc, rej = best
    tcov, tacc = stats(Pt, yt, a, b)
    cal = {"min_prob": round(float(a), 3), "min_margin": round(float(b), 3)}
    report = {"rule": "answer if p1 >= min_prob and p1 - p2 >= min_margin, else show candidates", **cal,
              "val": {"answered": round(cov, 3), "accuracy_when_answered": round(acc, 3)},
              "test": {"answered": round(tcov, 3), "accuracy_when_answered": round(tacc, 3), "accuracy_all": round(float((Pt.argmax(1) == yt).mean()), 3)},
              "ood": {"n": len(ood_files), "rejected": round(rej, 3), "sources": list(CATS)}}
    (OUT / "calibration.json").write_text(json.dumps(cal))
    (OUT / "ood_report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
