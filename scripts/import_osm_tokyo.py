"""從 OpenStreetMap Overpass API 匯入東京景點。"""
from pathlib import Path
import json, re, urllib.parse, urllib.request

ENDPOINTS=(
    "https://overpass.nchc.org.tw/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
)
OUTPUT=Path(__file__).resolve().parents[1]/"osm-places.js"
FILTERS=(
    '["tourism"~"^(attraction|museum|gallery|viewpoint|theme_park|zoo|aquarium|artwork)$"]',
    '["historic"]',
    '["amenity"~"^(place_of_worship|arts_centre|theatre|marketplace)$"]',
    '["leisure"~"^(park|garden|nature_reserve)$"]',
    '["shop"~"^(mall|department_store)$"]',
)
CATS={"museum":("博物館","🏛"),"gallery":("藝文展覽","🖼"),"viewpoint":("觀景景點","🔭"),"theme_park":("主題樂園","🎡"),"zoo":("親子景點","🦒"),"aquarium":("親子景點","🐠"),"artwork":("藝文展覽","🎨"),"attraction":("熱門景點","📍"),"place_of_worship":("寺社文化","⛩"),"arts_centre":("藝文展覽","🎭"),"theatre":("表演娛樂","🎭"),"marketplace":("市場美食","🍢"),"park":("公園自然","🌳"),"garden":("公園自然","🌿"),"nature_reserve":("公園自然","🌲"),"mall":("購物","🛍"),"department_store":("購物","🏬"),"historic":("歷史文化","🏯")}
def point(e): return (e.get("lat") or e.get("center",{}).get("lat"),e.get("lon") or e.get("center",{}).get("lon"))
def kind(t):
    for key in ("tourism","amenity","leisure","shop"):
        if t.get(key) in CATS:return CATS[t[key]]
    return CATS["historic"]
def importance(t):
    return sum(bool(t.get(k)) for k in ("name:zh-Hant","name:zh","name:en","wikidata","wikipedia","website","opening_hours"))+4*bool(t.get("tourism") in {"attraction","museum","theme_park","zoo","aquarium","viewpoint"})+2*bool(t.get("historic"))

# 公開 Overpass 服務不適合一次掃描全東京所有 node/way/relation。
# 原型先匯入帶名稱的節點，並切成四格小範圍，降低逾時與伺服器負擔。
def fetch(query,timeout=120):
    last_error=None
    for endpoint in ENDPOINTS:
        try:
            req=urllib.request.Request(endpoint,data=urllib.parse.urlencode({"data":query}).encode(),headers={"User-Agent":"TABI-MATE-prototype/0.1 github.com/Rainbow0721/japan-ai-travel-app"})
            with urllib.request.urlopen(req,timeout=timeout) as response: return json.load(response).get("elements",[])
        except Exception as error: last_error=error
    raise last_error

# 先只取標籤來篩選候選名單，再分批補座標；資料量比一次下載完整物件小很多。
clauses="".join(f'node["name"]{item_filter}(35.50,139.45,35.92,140.00);' for item_filter in FILTERS)
elements=fetch(f'[out:json][timeout:90];({clauses});out tags qt;',150)
ranked=sorted(elements,key=lambda e:-importance(e.get("tags",{})))
seen=set(); candidates=[]
for e in ranked:
    t=e.get("tags",{}); name=t.get("name:zh-Hant") or t.get("name:zh") or t.get("name:en") or t.get("name")
    key=re.sub(r"\s+","",name or "").lower()
    if not key or key in seen: continue
    seen.add(key); candidates.append(e)
    if len(candidates)>=1400: break
print(f"已選出 {len(candidates)} 個候選地點，開始補座標",flush=True)
coords={}
for start in range(0,len(candidates),1400):
    chunk=candidates[start:start+1400]; ids=",".join(str(e["id"]) for e in chunk)
    for e in fetch(f'[out:json][timeout:90];node(id:{ids});out skel qt;',150): coords[e["id"]]=(e["lat"],e["lon"])
    print(f"已取得 {min(start+1400,len(candidates))}/{len(candidates)} 筆座標",flush=True)

places=[]
for e in candidates:
    t=e.get("tags",{}); name=t.get("name:zh-Hant") or t.get("name:zh") or t.get("name:en") or t.get("name")
    lat,lng=coords.get(e["id"],(None,None))
    if lat is None or lng is None:continue
    key=(re.sub(r"\s+","",name).lower(),round(float(lat),4),round(float(lng),4))
    cat,emoji=kind(t); typ,oid=e["type"],e["id"]
    places.append({"id":f"osm-{typ}-{oid}","name":name,"area":t.get("addr:city") or t.get("addr:suburb") or t.get("addr:quarter") or "東京都內","zone":"osm","category":cat,"emoji":emoji,"duration":60,"cost":0,"rating":None,"lat":float(lat),"lng":float(lng),"tags":[cat,"OSM 開放資料"],"desc":f"位於東京的{cat}；營業與票價資訊請於出發前再次確認。","source":f"https://www.openstreetmap.org/{typ}/{oid}","sourceLabel":"© OpenStreetMap contributors","importance":importance(t)})
places.sort(key=lambda p:(-p.pop("importance"),p["name"])); places=places[:1200]
OUTPUT.write_text("// 資料來源：OpenStreetMap contributors，ODbL。\nconst OSM_PLACES = "+json.dumps(places,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf-8")
print(json.dumps({"raw":len(elements),"unique":len(candidates),"written":len(places)},ensure_ascii=False))
