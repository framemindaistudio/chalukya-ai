"""Road distance/time matrix between all places (OSRM public server), saved for offline use."""
import json, requests
from pathlib import Path
kb = json.load(open(Path(__file__).parent.parent / "kb" / "places.json", encoding="utf-8"))
pts = [(p["id"], p["lat"], p["lng"]) for p in kb["places"]]
pts.append(("badami_bus_stand", 15.9203, 75.6790))   # Badami town centre (approx.)
pts.append(("bagalkot_town", 16.1817, 75.6958))
coords = ";".join(f"{lng},{lat}" for _, lat, lng in pts)
r = requests.get(f"https://router.project-osrm.org/table/v1/driving/{coords}", params={"annotations": "distance,duration"},
                 headers={"User-Agent": "ChalukyaAI-student-project/0.1"}, timeout=60).json()
ids = [p[0] for p in pts]
out = {"source": "OSRM (OpenStreetMap road network), driving", "ids": ids,
       "km": [[round(d / 1000, 1) for d in row] for row in r["distances"]],
       "min": [[round(t / 60) for t in row] for row in r["durations"]],
       "coords": {i: [lat, lng] for i, lat, lng in pts}}
json.dump(out, open(Path(__file__).parent / "distances.json", "w"), indent=0)
i = ids.index("badami_caves")
for j, k in enumerate(ids): print(f"badami_caves -> {k:20s} {out['km'][i][j]:6.1f} km {out['min'][i][j]:4d} min")
