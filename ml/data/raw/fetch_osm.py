import requests, json, time
UA={"User-Agent":"ChalukyaAI-student-project/0.1 (+https://github.com/framemindaistudio/chalukya-ai)"}
bbox="15.80,75.55,16.30,76.15"   # Badami, Pattadakal, Aihole, Bagalkot, Kudalasangama, Ilkal, Guledgudda
parts={
 "stay":f'nwr["tourism"~"^(hotel|guest_house|hostel|motel|resort)$"]({bbox});',
 "food":f'nwr["amenity"~"^(restaurant|cafe|fast_food|food_court)$"]({bbox});',
 "civic":f'nwr["amenity"~"^(parking|hospital|clinic|police|toilets|drinking_water|bus_station|fuel)$"]({bbox});',
 "sights":f'nwr["tourism"~"^(attraction|museum|viewpoint)$"]({bbox});nwr["historic"~"^(archaeological_site|monument|fort|temple|ruins|memorial)$"]({bbox});',
}
EPS=["https://overpass.private.coffee/api/interpreter","https://overpass-api.de/api/interpreter","https://maps.mail.ru/osm/tools/overpass/api/interpreter","https://overpass.kumi.systems/api/interpreter"]
out={}
for name,body in parts.items():
    q=f"[out:json][timeout:60];({body});out center tags;"
    for url in EPS:
        try:
            r=requests.post(url,data={"data":q},headers=UA,timeout=90); r.raise_for_status(); out[name]=r.json()["elements"]; print(name,len(out[name]),"via",url); break
        except Exception as e: print("  fail",name,url,str(e)[:80]); time.sleep(2)
json.dump(out,open("osm_bagalkot.json","w",encoding="utf8"),ensure_ascii=False,indent=0)
for name in ("stay","food"):
    for e in out.get(name,[]):
        t=e.get("tags",{}); lat=e.get("lat") or e.get("center",{}).get("lat"); lon=e.get("lon") or e.get("center",{}).get("lon")
        print(f'{name:5s} {lat:.4f},{lon:.4f} {t.get("name","<no name>")[:40]:40s}| {t.get("cuisine","")} {t.get("diet:vegetarian","")} {t.get("stars","")} {t.get("addr:city","") or t.get("addr:place","")}')
