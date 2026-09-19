"""Real road and river geometry for the home-screen circuit map, saved for offline use.

Roads: OSRM driving routes on the OpenStreetMap network (Badami → Pattadakal → Aihole, plus the
short roads to Banashankari and Mahakuta). River: the Malaprabha from OpenStreetMap (Overpass).
Everything is projected to a small SVG canvas and simplified, so the phone draws it with no tiles.
Output: ml/data/circuit_map.json and web/src/data/circuit_map.json
"""
import json, math, time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent.parent.parent
UA = {"User-Agent": "ChalukyaAI-student-project/0.1 (+https://github.com/framemindaistudio/chalukya-ai)"}
kb = json.load(open(ROOT / "ml" / "kb" / "places.json", encoding="utf8"))
P = {p["id"]: (p["lat"], p["lng"]) for p in kb["places"]}
MAIN = [("badami_caves", "pattadakal"), ("pattadakal", "aihole")]
SIDE = [("badami_caves", "banashankari"), ("badami_caves", "mahakuta")]


def route(a, b):
    (la, lo), (lb, lob) = P[a], P[b]
    r = requests.get(f"https://router.project-osrm.org/route/v1/driving/{lo},{la};{lob},{lb}",
                     params={"overview": "full", "geometries": "geojson"}, headers=UA, timeout=60).json()
    rt = r["routes"][0]
    time.sleep(1)
    return [(c[1], c[0]) for c in rt["geometry"]["coordinates"]], rt["distance"] / 1000, rt["duration"] / 60


def river():
    q = '[out:json][timeout:60];way["waterway"="river"]["name"~"Malaprabha",i](15.84,75.58,16.08,75.95);out geom;'
    for url in ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"]:
        try:
            r = requests.post(url, data={"data": q}, headers=UA, timeout=90)
            if r.ok: return [[(g["lat"], g["lon"]) for g in w["geometry"]] for w in r.json()["elements"]]
        except requests.RequestException as e:
            print("overpass failed", url, e)
    raise SystemExit("no Overpass endpoint answered")


def rdp(pts, eps):
    if len(pts) < 3: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1; n = math.hypot(dx, dy) or 1e-9
    i, dmax = 0, 0.0
    for k in range(1, len(pts) - 1):
        d = abs(dy * pts[k][0] - dx * pts[k][1] + x2 * y1 - y2 * x1) / n
        if d > dmax: i, dmax = k, d
    if dmax <= eps: return [pts[0], pts[-1]]
    return rdp(pts[:i + 1], eps)[:-1] + rdp(pts[i:], eps)


RAW = ROOT / "ml" / "data" / "raw" / "circuit_raw.json"  # cached downloads: rebuild offline, be kind to the free servers
if RAW.exists():
    raw = json.loads(RAW.read_text(encoding="utf8"))
    roads = {k: (v[0], v[1], v[2]) for k, v in raw["roads"].items()}; rivers = raw["rivers"]
else:
    roads = {f"{a}>{b}": route(a, b) for a, b in MAIN + SIDE}
    rivers = river()
    RAW.parent.mkdir(parents=True, exist_ok=True)
    RAW.write_text(json.dumps({"roads": roads, "rivers": rivers}), encoding="utf8")

# Frame: every road point and site, padded; true north up, equirectangular at the mean latitude
lats = [la for g, _, _ in roads.values() for la, _ in g]; lngs = [lo for g, _, _ in roads.values() for _, lo in g]
lat0 = sum(lats) / len(lats); kx = math.cos(math.radians(lat0))
W, PAD_X, PAD_T, PAD_B = 340.0, 26.0, 30.0, 22.0
minx, maxx = min(lngs) * kx, max(lngs) * kx; miny, maxy = min(lats), max(lats)
s = (W - 2 * PAD_X) / (maxx - minx)
H = round((maxy - miny) * s + PAD_T + PAD_B)
proj = lambda la, lo: (round((lo * kx - minx) * s + PAD_X, 1), round((maxy - la) * s + PAD_T, 1))


def to_d(pts):
    return "M" + " L".join(f"{x} {y}" for x, y in pts)


def length(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def midpoint(pts, frac=0.5):
    half, acc = length(pts) * frac, 0.0
    for i in range(len(pts) - 1):
        seg = math.dist(pts[i], pts[i + 1])
        if acc + seg >= half:
            t = (half - acc) / seg
            return [round(pts[i][0] + t * (pts[i + 1][0] - pts[i][0]), 1), round(pts[i][1] + t * (pts[i + 1][1] - pts[i][1]), 1)]
        acc += seg
    return list(pts[-1])


out = {"source": "Roads: OSRM driving routes on OpenStreetMap. River: OpenStreetMap (Overpass). © OpenStreetMap contributors, ODbL.",
       "w": W, "h": H, "pxPerKm": round(s / 110.95, 3), "roads": [], "river": [], "sites": {}}
for key, (geom, km, mins) in roads.items():
    pts = rdp([proj(la, lo) for la, lo in geom], 0.5)
    a, b = key.split(">")
    # distance chip: on the long east-west stretch of the first leg, mid-way on the second
    out["roads"].append({"from": a, "to": b, "main": (a, b) in MAIN, "d": to_d(pts), "km": round(km, 1), "min": round(mins),
                         "mid": midpoint(pts, 0.72 if (a, b) == MAIN[0] else 0.5), "len": round(length(pts), 1)})
for w in rivers:
    pts = rdp([proj(la, lo) for la, lo in w], 0.7)
    inside = [p for p in pts if -40 <= p[0] <= W + 40 and -40 <= p[1] <= H + 40]
    if len(inside) >= 2: out["river"].append(to_d(pts))
for sid in {x for pair in MAIN + SIDE for x in pair}:
    out["sites"][sid] = list(proj(*P[sid]))
# The full circuit as one path, so a vehicle can drive it end to end
main_pts = []
for a, b in MAIN:
    main_pts += rdp([proj(la, lo) for la, lo in roads[f"{a}>{b}"][0]], 0.5)
out["circuit"] = to_d(main_pts)
for d in [ROOT / "ml" / "data" / "circuit_map.json", ROOT / "web" / "src" / "data" / "circuit_map.json"]:
    d.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
print(f"canvas {W}x{H}; roads", [(r['from'], r['to'], r['km'], r['min'], len(r['d'])) for r in out["roads"]], "river ways", len(out["river"]))
print("sites", out["sites"])
