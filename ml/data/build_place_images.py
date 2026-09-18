"""
Picks one representative, freely licensed photo per place for the app (with full credits).
Uses the Wikimedia dataset already downloaded where possible; fetches a single image for places
the dataset does not cover. Output: web/public/img/places/<id>.jpg + web/src/data/photo_credits.json
"""
import csv
import io
import json
import re
from pathlib import Path

import requests
from PIL import Image

ML = Path(__file__).parent.parent
RAW = ML / "vision" / "data" / "raw"
OUT = ML.parent / "web" / "public" / "img" / "places"; OUT.mkdir(parents=True, exist_ok=True)
S = requests.Session(); S.headers["User-Agent"] = "ChalukyaAI-student-project/0.1 (+https://github.com/framemindaistudio/chalukya-ai)"

FROM_DATASET = {  # place id -> dataset class
    "badami_caves": "badami_cave_exterior", "bhutanatha": "badami_bhutanatha", "pattadakal": "pattadakal_virupaksha",
    "aihole": "aihole_durga_temple", "aihole_ravanaphadi": "aihole_ravanaphadi",
}
FROM_COMMONS = {  # place id -> Commons category to take one landscape photo from
    "mahakuta": "Category:Mahakuta group of temples", "banashankari": "Category:Banashankari Amma Temple",
    "kudalasangama": "Category:Kudalasangama", "badami_fort": "Category:Badami Fort", "aihole_meguti": "Category:Meguti Jain temple",
    "ilkal": "Category:Ilkal saree", "almatti": "Category:Almatti Dam", "badami_museum": "Category:Archaeological Museum, Badami",
    "guledgudda": "Category:Guledgudda", "siddanakolla": "Category:Siddanakolla",
}
credits = {}
rows = list(csv.DictReader(open(ML / "vision" / "data" / "metadata.csv", encoding="utf-8")))


def save(im: Image.Image, pid: str):
    im = im.convert("RGB")
    w = 800; h = round(im.height * w / im.width)
    im.resize((w, h), Image.LANCZOS).save(OUT / f"{pid}.jpg", "JPEG", quality=82, optimize=True)


def score(r):  # prefer permissive licences and landscape photos
    lic = r["license"]
    return (0 if lic.startswith("CC0") or "Public domain" in lic else 1 if lic.startswith("CC BY 4") or lic.startswith("CC BY-SA 4") else 2)


for pid, cls in FROM_DATASET.items():
    cand = []
    for r in rows:
        if r["class"] != cls: continue
        im = Image.open(RAW / r["file"])
        if im.width / im.height < 1.25 or "panorama" in r["title"].lower(): continue
        cand.append((score(r), -im.width, r))
    cand.sort(key=lambda t: (t[0], t[1]))
    r = cand[min(2, len(cand) - 1)][2]  # skip the very first to avoid near-duplicates of the thumbnail used elsewhere
    save(Image.open(RAW / r["file"]), pid)
    credits[pid] = {"title": r["title"].replace("File:", ""), "artist": r["artist"] or r["uploader"], "license": r["license"], "page": r["page"]}
    print("dataset", pid, credits[pid]["license"])

API = "https://commons.wikimedia.org/w/api.php"
for pid, cat in FROM_COMMONS.items():
    try:
        j = S.get(API, params={"action": "query", "format": "json", "generator": "categorymembers", "gcmtitle": cat, "gcmtype": "file",
                               "gcmlimit": 40, "prop": "imageinfo", "iiprop": "url|size|extmetadata|mime", "iiurlwidth": 1000,
                               "iiextmetadatafilter": "Artist|LicenseShortName"}, timeout=30).json()
        pages = [p for p in j.get("query", {}).get("pages", {}).values() if p.get("imageinfo") and p["imageinfo"][0].get("mime") == "image/jpeg"]
        pages = [p for p in pages if p["imageinfo"][0]["width"] / max(1, p["imageinfo"][0]["height"]) > 1.2 and not re.search(r"map|plan|board|inscription", p["title"], re.I)]
        if not pages: print("none", pid); continue
        p = sorted(pages, key=lambda p: -p["imageinfo"][0]["width"])[0]
        ii = p["imageinfo"][0]; meta = ii.get("extmetadata", {})
        im = Image.open(io.BytesIO(S.get(ii["thumburl"], timeout=60).content))
        save(im, pid)
        credits[pid] = {"title": p["title"].replace("File:", ""), "artist": re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()[:80],
                        "license": meta.get("LicenseShortName", {}).get("value", ""), "page": ii.get("descriptionurl")}
        print("commons", pid, credits[pid]["license"])
    except Exception as e:
        print("fail", pid, e)

(ML.parent / "web" / "src" / "data" / "photo_credits.json").write_text(json.dumps(credits, ensure_ascii=False, indent=1), encoding="utf8")
print(len(credits), "photos")
