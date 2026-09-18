import requests, json, sys
S = requests.Session(); S.headers["User-Agent"] = "ChalukyaAI-student-project/0.1 (+https://github.com/framemindaistudio/chalukya-ai)"
API = "https://commons.wikimedia.org/w/api.php"
def members(cat, cmtype="file|subcat"):
    out, cont = [], {}
    while True:
        r = S.get(API, params={"action":"query","format":"json","list":"categorymembers","cmtitle":cat,"cmlimit":500,"cmtype":cmtype, **cont}).json()
        out += r["query"]["categorymembers"]
        if "continue" not in r: break
        cont = r["continue"]
    return out
roots = sys.argv[1:]
for root in roots:
    m = members(root)
    files = [x for x in m if x["ns"] == 6]
    subs = [x["title"] for x in m if x["ns"] == 14]
    print(f"\n{root}: {len(files)} files, {len(subs)} subcats")
    for s in subs:
        mm = members(s)
        print(f"   {len([x for x in mm if x['ns']==6]):4d} files  {len([x for x in mm if x['ns']==14]):3d} subs  {s}")
