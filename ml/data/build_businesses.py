"""
Builds businesses.json (stays + eateries) for the recommenders.

Names, locations and any OSM tags are REAL (© OpenStreetMap contributors).
Price, rating, amenities etc. are NOT public, so they are SIMULATED with a fixed seed, plus a few
honest inferences from the name (an "Udupi" hotel is almost always vegetarian; "Savji"/"Andhra" mess
serve non-veg). Every record says which fields are simulated so the app can label them. In production,
owners maintain their own listing through the Local Business Portal.
"""
import hashlib
import json
import math
import random
from pathlib import Path

HERE = Path(__file__).parent
osm = json.load(open(HERE / "raw" / "osm_bagalkot.json", encoding="utf8"))
TOWNS = {  # town centre coordinates, used to tag each business with its nearest town
    "Badami": (15.9203, 75.6790), "Banashankari": (15.8872, 75.7050), "Pattadakal": (15.9486, 75.8163),
    "Aihole": (16.0201, 75.8821), "Bagalkot": (16.1817, 75.6958), "Kudalasangama": (16.2036, 76.0600),
    "Ilkal": (15.9600, 76.1130), "Guledgudda": (16.0500, 75.7900), "Hungund": (16.0620, 76.0600), "Amingad": (16.0600, 75.9500),
}


def hkm(a, b):
    R = 6371; (la1, lo1), (la2, lo2) = a, b
    p = math.pi / 180
    x = math.sin((la2 - la1) * p / 2) ** 2 + math.cos(la1 * p) * math.cos(la2 * p) * math.sin((lo2 - lo1) * p / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def rng_for(name):  # same name -> same simulated attributes on every build
    return random.Random(int(hashlib.md5(name.encode()).hexdigest()[:8], 16))


def coord(e):
    return (e.get("lat") or e.get("center", {}).get("lat"), e.get("lon") or e.get("center", {}).get("lon"))


def nearest_town(ll):
    return min(TOWNS, key=lambda t: hkm(ll, TOWNS[t]))


stays, eats, seen = [], [], set()
for e in osm.get("stay", []):
    t = e.get("tags", {}); name = t.get("name", "").strip()
    if not name or any(k in name.lower() for k in ("college", "hostel", "womens n", "boys")): continue
    ll = coord(e); key = (name.lower(), round(ll[0], 2), round(ll[1], 2))
    if key in seen: continue
    seen.add(key); r = rng_for(name)
    low = any(k in name.lower() for k in ("lodge", "deluxe lodge", "guesshouse", "guest"))
    premium = any(k in name.lower() for k in ("clarks", "court", "resort", "retreat", "mayura", "residency", "international"))
    price = r.choice([700, 900, 1100, 1300]) if low else r.choice([3200, 3800, 4500, 5200]) if premium else r.choice([1400, 1700, 2000, 2400, 2800])
    amen = {"ac": premium or r.random() < .6, "wifi": premium or r.random() < .55, "parking": premium or r.random() < .65,
            "restaurant": premium or r.random() < .5, "family_rooms": r.random() < .6, "hot_water": True,
            "wheelchair": premium and r.random() < .6, "pure_veg": "udupi" in name.lower(), "lift": premium and r.random() < .5,
            "pool": "resort" in name.lower() and r.random() < .6}
    stays.append({
        "id": "s_" + hashlib.md5(f"{name}{ll}".encode()).hexdigest()[:8], "name": name, "lat": ll[0], "lng": ll[1], "town": nearest_town(ll),
        "type": t.get("tourism"), "price": price, "rating": round(r.uniform(3.4, 4.3) + (0.25 if premium else 0), 1),
        "reviews": r.randint(25, 900), "amenities": [k for k, v in amen.items() if v],
        "owner": "government (KSTDC)" if "mayura" in name.lower() else "chain" if "clarks" in name.lower() else "local",
        "phone": None, "osm_tags": {k: v for k, v in t.items() if k in ("stars", "addr:city", "website", "phone")},
        "source": {"name_location": "OpenStreetMap", "simulated": ["price", "rating", "reviews", "amenities"]},
    })

CUISINES = ["North Karnataka meals", "South Indian", "North Indian", "Chinese", "Andhra meals", "Snacks & chats"]
for e in osm.get("food", []):
    t = e.get("tags", {}); name = t.get("name", "").strip()
    if not name: continue
    ll = coord(e); key = (name.lower(), round(ll[0], 2), round(ll[1], 2))
    if key in seen: continue
    seen.add(key); r = rng_for(name); nl = name.lower()
    if t.get("diet:vegetarian") == "only" or "udupi" in nl or "vegetarian" in nl or "veg)" in nl and "nonveg" not in nl:
        diet = "veg"
    elif "savji" in nl or "sawaji" in nl or "savaji" in nl or "andhra" in nl or "mess" in nl:
        diet = "non-veg"
    else:
        diet = r.choice(["veg", "veg & non-veg", "veg & non-veg"])
    cz = []
    if "andhra" in nl: cz.append("Andhra meals")
    if "udupi" in nl: cz += ["South Indian"]
    if "savji" in nl or "sawaji" in nl or "savaji" in nl: cz.append("Savji (non-veg)")
    if "chaiwala" in nl or "cool" in nl: cz.append("Snacks & chats")
    if not cz: cz = r.sample(CUISINES, 2)
    if "North Karnataka meals" not in cz and r.random() < .55: cz.insert(0, "North Karnataka meals")
    eats.append({
        "id": "e_" + hashlib.md5(f"{name}{ll}".encode()).hexdigest()[:8], "name": name, "lat": ll[0], "lng": ll[1], "town": nearest_town(ll),
        "type": t.get("amenity"), "diet": diet, "cuisines": cz[:3], "price_for_two": r.choice([150, 200, 250, 300, 400, 500, 700]),
        "rating": round(r.uniform(3.3, 4.5), 1), "reviews": r.randint(15, 650),
        "hours": r.choice(["07:00-22:30", "06:30-22:00", "11:00-23:00", "07:30-21:30"]),
        "jolada_rotti": "North Karnataka meals" in cz, "family": r.random() < .7, "owner": "chain" if "clark" in nl else "local",
        "source": {"name_location": "OpenStreetMap", "inferred_from_name": ["diet", "cuisines"],
                   "simulated": ["price_for_two", "rating", "reviews", "hours"]},
    })

out = {"attribution": "Names and locations © OpenStreetMap contributors (ODbL). Prices, ratings, amenities and hours are simulated for this prototype.",
       "stays": stays, "eateries": eats}
(HERE / "businesses.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf8")
from collections import Counter
print(len(stays), "stays", Counter(s["town"] for s in stays))
print(len(eats), "eateries", Counter(e["town"] for e in eats), Counter(e["diet"] for e in eats))
