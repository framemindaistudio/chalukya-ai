"""
Sample 'CCTV' frames for the command-centre people counter: real, freely licensed photos of visitors
at the monuments (Wikimedia Commons), with person counts precomputed by the same detector the
server uses, so the panel also works with no server running.
"""
import io
import json
import re
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "web" / "public" / "img" / "cctv"; OUT.mkdir(parents=True, exist_ok=True)
S = requests.Session(); S.headers["User-Agent"] = "ChalukyaAI-student-project/0.1 (+https://github.com/framemindaistudio/chalukya-ai)"
CATS = ["Category:People at the Badami Cave Temples", "Category:People at the group of monuments at Aihole"]

cands = []
for cat in CATS:
    j = S.get("https://commons.wikimedia.org/w/api.php", params={"action": "query", "format": "json", "generator": "categorymembers", "gcmtitle": cat,
              "gcmtype": "file", "gcmlimit": 60, "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 960,
              "iiextmetadatafilter": "Artist|LicenseShortName"}, timeout=30).json()
    for p in j.get("query", {}).get("pages", {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        if ii.get("mime") == "image/jpeg" and ii.get("width", 0) > ii.get("height", 1):
            cands.append((cat, p["title"], ii))

frames = []
for i, (cat, title, ii) in enumerate(cands[:14]):
    im = Image.open(io.BytesIO(S.get(ii["thumburl"], timeout=60).content)).convert("RGB")
    im.thumbnail((960, 960))
    name = f"frame{i:02d}.jpg"; im.save(OUT / name, quality=84)
    meta = ii.get("extmetadata", {})
    r = requests.post("http://127.0.0.1:8300/api/crowd/count?capacity=40", files={"file": (name, open(OUT / name, "rb"), "image/jpeg")}, timeout=120).json()
    frames.append({"file": f"/img/cctv/{name}", "count": r["count"], "boxes": r["boxes"], "w": r["width"], "h": r["height"],
                   "site": "Badami caves" if "Badami" in cat else "Aihole", "title": title.replace("File:", ""),
                   "artist": re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()[:60], "license": meta.get("LicenseShortName", {}).get("value", "")})
    print(name, r["count"], flush=True)

frames.sort(key=lambda f: -f["count"])
(ROOT / "web" / "src" / "data" / "cctv.json").write_text(json.dumps(frames[:8], ensure_ascii=False, indent=1), encoding="utf8")
for f in OUT.glob("*.jpg"):
    if f"/img/cctv/{f.name}" not in {x["file"] for x in frames[:8]}: f.unlink()
print("kept", [(f["file"], f["count"]) for f in frames[:8]])
