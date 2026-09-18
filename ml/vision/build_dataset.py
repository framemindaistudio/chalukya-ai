"""
Builds the Chalukyan heritage image dataset from Wikimedia Commons.

Every class is defined by one or more Commons categories. We store 500px thumbnails, plus a
metadata.csv with author, license and source URL for every image. Credits are a licence
requirement, and the uploader column is what makes a leakage-free, photographer-grouped
train/val/test split possible (see train.py).

    python build_dataset.py            # downloads into ml/vision/data/raw/<class>/
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).parent
RAW = ROOT / "data" / "raw"
API = "https://commons.wikimedia.org/w/api.php"
UA = "ChalukyaAI-student-project/0.1 (+https://github.com/framemindaistudio/chalukya-ai) python-requests"
THUMB_W = 500

S = requests.Session()
S.headers["User-Agent"] = UA

# class_id -> (list of Commons categories, recurse depth)
# Order matters: a file found in several classes is kept only in the FIRST class listed here
# (specific sculptures come before whole-monument classes).
CLASSES: dict[str, tuple[list[str], int]] = {
    # ── Badami cave temples: individual sculptures ──
    "badami_c1_nataraja":          (["Category:Nataraja relief in Badami cave temple 1"], 0),
    "badami_c1_ardhanarishvara":   (["Category:Ardhanarishvara relief in Badami cave temple 1"], 0),
    "badami_c1_harihara":          (["Category:Harihara relief in Badami cave temple 1"], 0),
    "badami_c1_mahishasuramardini":(["Category:Durga relief in Badami cave temple 1"], 0),
    "badami_c2_trivikrama":        (["Category:Trivikrama relief in Badami cave temple 2"], 0),
    "badami_c2_varaha":            (["Category:Varaha relief in Badami Cave Temple 2"], 0),
    "badami_c3_narasimha":         (["Category:Narasimha in Badami cave temple 3"], 0),
    "badami_c3_seated_vishnu":     (["Category:Seated Vishnu in Badami cave temple 3"], 0),
    "badami_c3_trivikrama":        (["Category:Trivikrama panel in Badami cave temple 3"], 0),
    "badami_c3_varaha":            (["Category:Varaha panel in Badami Cave Temple 3"], 0),
    "badami_c4_bahubali":          (["Category:Bahubali relief in Badami cave temple 4"], 0),
    "badami_c4_parshvanatha":      (["Category:Parshvanatha relief in Badami cave temple 4"], 0),
    "badami_ceiling_reliefs":      (["Category:Ceiling reliefs in the Badami cave temple 1",
                                     "Category:Ceiling reliefs in the Badami cave temple 2",
                                     "Category:Ceiling reliefs in the Badami cave temple 3"], 0),
    # ── Badami: monuments ──
    "badami_cave_exterior":        (["Category:Exterior of the Badami Cave Temples",
                                     "Category:Exterior of the Badami cave temple 1",
                                     "Category:Exterior of the Badami cave temple 2",
                                     "Category:Exterior of the Badami cave temple 3",
                                     "Category:Exterior of the Badami cave temple 4"], 0),
    "badami_bhutanatha":           (["Category:Bhutanatha group of temples, Badami",
                                     "Category:Agastya Lake"], 1),
    # ── Pattadakal ──
    "pattadakal_nandi":            (["Category:Nandi at the Virupaksha Temple, Pattadakal"], 0),
    "pattadakal_virupaksha":       (["Category:Virupaksha Temple, Pattadakal",
                                     "Category:Reliefs and sculptures at the Virupaksha Temple, Pattadakal",
                                     "Category:Entrance arch to the Virupaksha Temple, Pattadakal"], 2),
    "pattadakal_galaganatha":      (["Category:Galaganatha Temple, Pattadakal"], 0),
    "pattadakal_sangameshvara":    (["Category:Sangameshvara Temple"], 0),
    "pattadakal_mallikarjuna":     (["Category:Mallikarjuna Temple, Pattadakal"], 0),
    "pattadakal_jambulinga":       (["Category:Jambulinga Temple, Pattadakal"], 0),
    "pattadakal_kadasiddheshvara": (["Category:Kadasiddheshvara Temple, Pattadakal"], 0),
    "pattadakal_kashivishveshvara":(["Category:Kashivishveshvara Temple, Pattadakal"], 0),
    # ── Aihole ──
    "aihole_ravanaphadi":          (["Category:Ravana Phadi Cave, Aihole"], 2),
    "aihole_durga_temple":         (["Category:Durga Temple, Aihole"], 1),
}

# Sub-categories that must never be pulled in by recursion (they belong to another class or are noise)
EXCLUDE_SUBCATS = {
    "Category:Nandi at the Virupaksha Temple, Pattadakal",
    "Category:Reliefs and sculptures at the Ravana Phadi Cave (drawings)",
}

SKIP_TITLE = re.compile(r"(map|plan|drawing|sketch|diagram|board|inscription|\.svg$|\.pdf$|\.tif|\.gif$|\.webm$|\.ogv$|stereoscopic)", re.I)


def api(**params):
    params = {"action": "query", "format": "json", **params}
    for attempt in range(5):
        try:
            r = S.get(API, params=params, timeout=30)
            if r.status_code == 429:
                time.sleep(5 * (attempt + 1)); continue
            r.raise_for_status()
            return r.json()
        except requests.RequestException:
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"API failed: {params}")


def subcats(cat: str) -> list[str]:
    out, cont = [], {}
    while True:
        r = api(list="categorymembers", cmtitle=cat, cmtype="subcat", cmlimit=500, **cont)
        out += [m["title"] for m in r["query"]["categorymembers"]]
        if "continue" not in r: return out
        cont = r["continue"]


def files_in(cat: str) -> list[dict]:
    """Files directly in `cat`, with a 500px thumb URL, uploader and licence metadata."""
    out, cont = [], {}
    while True:
        r = api(generator="categorymembers", gcmtitle=cat, gcmtype="file", gcmlimit=200,
                prop="imageinfo", iiprop="url|user|size|mime|extmetadata|sha1",
                iiurlwidth=THUMB_W, iiextmetadatafilter="Artist|LicenseShortName|LicenseUrl", **cont)
        for p in r.get("query", {}).get("pages", {}).values():
            ii = (p.get("imageinfo") or [{}])[0]
            if not ii or ii.get("mime") not in ("image/jpeg", "image/png"): continue
            if SKIP_TITLE.search(p["title"]): continue
            if min(ii.get("width", 0), ii.get("height", 0)) < 300: continue
            meta = ii.get("extmetadata", {})
            artist = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()
            out.append({
                "title": p["title"], "thumb": ii.get("thumburl") or ii["url"], "page": ii.get("descriptionurl"),
                "uploader": ii.get("user", ""), "artist": artist[:120],
                "license": meta.get("LicenseShortName", {}).get("value", ""),
                "license_url": meta.get("LicenseUrl", {}).get("value", ""), "sha1": ii.get("sha1", ""),
            })
        if "continue" not in r: return out
        cont = r["continue"]


def collect(cats: list[str], depth: int) -> list[dict]:
    seen_cats, frontier, files = set(), list(cats), []
    for d in range(depth + 1):
        nxt = []
        for c in frontier:
            if c in seen_cats or c in EXCLUDE_SUBCATS and c not in cats: continue
            seen_cats.add(c)
            files += files_in(c)
            if d < depth: nxt += subcats(c)
        frontier = nxt
    return files


def download(item: dict, dest: Path) -> bool:
    if dest.exists(): return True
    for attempt in range(4):
        try:
            r = S.get(item["thumb"], timeout=60)
            if r.status_code == 429: time.sleep(4 * (attempt + 1)); continue
            r.raise_for_status()
            im = Image.open(io.BytesIO(r.content)).convert("RGB")
            dest.parent.mkdir(parents=True, exist_ok=True)
            im.save(dest, "JPEG", quality=90)
            return True
        except Exception:
            time.sleep(2 * (attempt + 1))
    return False


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[1:])
    claimed: dict[str, str] = {}      # sha1 -> class (first claim wins)
    plan: list[tuple[str, dict]] = []
    for cls, (cats, depth) in CLASSES.items():
        if only and cls not in only: continue
        items = collect(cats, depth)
        kept = 0
        for it in items:
            key = it["sha1"] or it["title"]
            if key in claimed: continue
            claimed[key] = cls
            plan.append((cls, it)); kept += 1
        print(f"{cls:32s} {kept:4d} images", flush=True)

    print(f"\nTotal to download: {len(plan)}", flush=True)
    rows, ok = [], 0
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {}
        for cls, it in plan:
            name = hashlib.md5(it["title"].encode()).hexdigest()[:12] + ".jpg"
            it = {**it, "class": cls, "file": f"{cls}/{name}"}
            futs[ex.submit(download, it, RAW / cls / name)] = it
        for i, f in enumerate(as_completed(futs), 1):
            it = futs[f]
            if f.result():
                rows.append(it); ok += 1
            if i % 100 == 0: print(f"  {i}/{len(plan)}", flush=True)

    rows.sort(key=lambda r: (r["class"], r["file"]))
    with open(ROOT / "data" / "metadata.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["file", "class", "title", "uploader", "artist", "license", "license_url", "page", "thumb", "sha1"])
        w.writeheader(); w.writerows(rows)
    counts = {}
    for r in rows: counts[r["class"]] = counts.get(r["class"], 0) + 1
    (ROOT / "data" / "counts.json").write_text(json.dumps(counts, indent=2))
    print(f"\nDownloaded {ok}/{len(plan)}. Metadata -> data/metadata.csv")


if __name__ == "__main__":
    main()
