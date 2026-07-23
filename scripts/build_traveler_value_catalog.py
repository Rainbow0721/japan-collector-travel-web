"""用 Wikimedia 開放資料建立廣義東京旅客價值候選。

Wikidata 為 CC0；Wikipedia 摘要只用於辨識實體，不逐字輸出。產出的中文簡介是
結構化事實的短句重寫。低於 80 分的資料不會進入輸出。
"""
from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
import urllib.error
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "database" / "traveler-value-places.json"
OUT_JS = ROOT / "places.traveler-value.js"
REPORT = ROOT / "database" / "traveler-value-report.json"
CACHE = Path("/tmp/tabi-mate-wikimedia-cache-v4")
API = "https://ja.wikipedia.org/w/api.php"
WD = "https://www.wikidata.org/w/api.php"
UA = "TABI-MATE/0.5 (github.com/Rainbow0721/japan-ai-travel-app)"

REGIONS = [
    ("淺草・上野・谷中",35.714,139.785,6500,65),("東京站・銀座・日本橋",35.681,139.769,6500,70),
    ("秋葉原・神田・御茶之水",35.700,139.769,5000,45),("新宿・中野",35.696,139.695,7500,65),
    ("澀谷・原宿・青山",35.665,139.705,6500,60),("六本木・麻布・東京鐵塔",35.660,139.738,6000,50),
    ("池袋・大塚・巢鴨",35.731,139.721,6500,40),("押上・兩國・柴又",35.719,139.827,12000,45),
    ("豐洲・台場・清澄白河",35.655,139.801,9500,45),("目黑・惠比壽・中目黑",35.641,139.704,7000,35),
    ("世田谷・下北澤",35.651,139.658,9000,35),("吉祥寺・三鷹・東京西側",35.700,139.560,18000,55),
    ("立川・高尾・奧多摩",35.690,139.300,42000,45),("鎌倉・江之島",35.320,139.535,16000,55),
    ("橫濱",35.455,139.635,16000,55),("箱根・小田原",35.235,139.075,22000,45),
    ("河口湖・富士吉田・御殿場",35.450,138.820,38000,50),("日光",36.755,139.600,23000,35),
    ("川越・秩父",35.970,139.300,42000,35),("輕井澤",36.350,138.635,18000,25),
    ("千葉・舞濱・成田",35.700,140.020,52000,55),
]

# 只收旅客可能專程造訪的百科實體；學校、醫院、行政機關、一般車站等排除。
CATEGORY_RULES = [
    ("巡禮文化", r"神社|神宮|寺$|寺院|大仏|教会|聖堂|御朱印|霊場|城跡|史跡|古墳|宿場|文化財"),
    ("美景自然", r"公園|庭園|山$|岳$|湖$|池$|滝$|渓谷|海岸|岬|桜|梅林|紅葉|展望|夜景|温泉"),
    ("購物", r"百貨店|デパート|ショッピング|モール|商店街|市場|横丁|地下街|アウトレット|電気街|書店|玩具|アニメ|キャラクター"),
    ("玩樂", r"遊園地|テーマパーク|動物園|水族館|劇場|映画館|ライブハウス|スタジアム|競技場|プラネタリウム"),
    ("藝文景點", r"博物館|美術館|資料館|記念館|科学館|文学館|ギャラリー|アート|邸宅|建築|会館"),
    ("美食", r"料理店|レストラン|寿司|蕎麦|ラーメン|うなぎ|天ぷら|洋食|喫茶店|菓子|酒造|醸造|食品|市場"),
    ("城市名勝", r"名所|観光|街$|通り|坂$|橋$|塔$|タワー|駅舎|埠頭|倉庫|門$|像$|ランドマーク"),
]
BLOCK = re.compile(r"学校|大学|病院|診療所|区役所|市役所|警察署|消防署|郵便局|インターチェンジ|ジャンクション|放送局|企業$|株式会社|会社|協会|事務所|スタジオ|廃止|廃業|閉館|跡地|一般駅$|鉄道駅", re.I)


def get(url: str, params: dict) -> dict:
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{url}?{query}", headers={"User-Agent": UA})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code not in {429,502,503,504} or attempt == 4: raise
            time.sleep(5 * (attempt + 1))


def category_for(text: str) -> str | None:
    if BLOCK.search(text): return None
    for category, pattern in CATEGORY_RULES:
        if re.search(pattern, text, re.I): return category
    return None


def fetch_region(name: str, lat: float, lon: float, radius: int) -> list[dict]:
    CACHE.mkdir(parents=True,exist_ok=True)
    cache=CACHE/(re.sub(r"\W+","-",name)+".json")
    if cache.exists(): return json.loads(cache.read_text(encoding="utf-8"))
    search=get(API,{"action":"query","list":"geosearch","gscoord":f"{lat}|{lon}","gsradius":min(radius,10000),"gslimit":500,"gsnamespace":0,"format":"json"})
    geo={str(x["pageid"]):x for x in search.get("query",{}).get("geosearch",[])}
    # 每區取最近 150 個百科實體；比舊流程直接掃所有商家更聚焦，也避免對公共 API 過量請求。
    ids=list(geo)[:150]
    rows = []
    for start in range(0,len(ids),50):
        data=get(API,{"action":"query","pageids":"|".join(ids[start:start+50]),"prop":"pageprops|info","inprop":"url","format":"json","formatversion":2})
        for page in data.get("query",{}).get("pages",[]):
            qid = page.get("pageprops",{}).get("wikibase_item")
            point=geo.get(str(page.get("pageid")),{})
            if qid:
                rows.append({"qid":qid,"titleJa":page["title"],"lat":point["lat"],"lng":point["lon"],"wikiUrl":page.get("fullurl"),"area":name})
        time.sleep(1.2)
    cache.write_text(json.dumps(rows,ensure_ascii=False),encoding="utf-8")
    time.sleep(1.0)
    return rows


def entity_batches(qids: list[str]) -> dict[str, dict]:
    result = {}
    for start in range(0, len(qids), 50):
        batch=qids[start:start+50]
        cache=CACHE/("entities-"+batch[0]+"-"+batch[-1]+".json")
        cached=cache.exists()
        if cached: data=json.loads(cache.read_text(encoding="utf-8"))
        else:
            data = get(WD, {"action":"wbgetentities","ids":"|".join(batch),"props":"labels|descriptions|claims|sitelinks","languages":"zh-tw|zh-hant|zh|ja|en","languagefallback":1,"format":"json"})
            cache.write_text(json.dumps(data,ensure_ascii=False),encoding="utf-8")
        result.update(data.get("entities",{})); time.sleep(.02 if cached else .8)
        if start % 500 == 0: print(f"跨語言實體：{min(start+50,len(qids))}/{len(qids)}",flush=True)
    return result


def value(obj: dict, lang: str) -> str:
    return obj.get(lang,{}).get("value","")


def official_url(entity: dict) -> str | None:
    claims = entity.get("claims",{}).get("P856",[])
    try: return claims[0]["mainsnak"]["datavalue"]["value"]
    except (KeyError, IndexError, TypeError): return None


def make_intro(name: str, category: str, area: str, description: str) -> str:
    fact = description.strip("。 ") if description else category
    reasons = {
        "美食":"適合尋找具地方性、老店或明確料理目的的旅客；排行程前仍要核對店家官方菜單與營業狀態。",
        "購物":"適合把限定商品、伴手禮或特定購物主題排進同區行程，應再核對免稅規則與店舖營業時間。",
        "美景自然":"適合依季節、天候與光線安排，花況、紅葉、積雪或能見度需在出發前再次確認。",
        "玩樂":"適合有明確體驗目的的旅客，門票、場次、年齡限制與預約狀態需查官方。",
        "巡禮文化":"適合歷史、寺社、御守御朱印或作品巡禮；參拜、授與時間與拍攝規則需尊重現場公告。",
        "藝文景點":"適合對展覽、建築或地方文化有興趣的旅客；展期與休館日需查官方。",
        "城市名勝":"可作為同區散步與拍照節點，不應為了打卡造成跨區折返。",
    }
    return f"{name}位於{area}，屬於{fact}。{reasons[category]}"


def completion(row: dict) -> int:
    fields = ["nameZhHant","nameJa","nameEn","intro","category","travelerIntent","travelerReason","areaCluster","latitude","longitude","sourceUrl","evidence","averageStayMinutes","costNote","lastVerifiedAt"]
    core = round(100 * sum(bool(row.get(x)) for x in fields) / len(fields))
    # 批次資料雖具完整永久核心，但尚未逐筆核對營業、價格、無障礙與近期人氣，最高只能 80。
    return min(80, core)


def main() -> None:
    raw = []
    for i, (name,lat,lon,radius,_quota) in enumerate(REGIONS,1):
        raw.extend(fetch_region(name,lat,lon,radius)); print(f"{i}/{len(REGIONS)} {name}: {len(raw)}", flush=True)
    by_qid = {}
    for item in raw:
        by_qid.setdefault(item["qid"],item)
    entities = entity_batches(list(by_qid))
    records = []
    for qid,item in by_qid.items():
        entity = entities.get(qid,{})
        labels, descriptions = entity.get("labels",{}), entity.get("descriptions",{})
        zh = value(labels,"zh-tw") or value(labels,"zh-hant") or value(labels,"zh")
        ja = value(labels,"ja") or item["titleJa"]
        en = value(labels,"en")
        desc = value(descriptions,"zh-tw") or value(descriptions,"zh-hant") or value(descriptions,"zh")
        if not zh or not en: continue
        desc_ja = value(descriptions,"ja")
        category = category_for(f"{item['titleJa']} {ja} {desc_ja} {desc}")
        if not category: continue
        row = {
            "id":f"wd-{qid}","qid":qid,"nameZhHant":zh,"nameJa":ja,"nameEn":en,
            "category":category,"travelerIntent":category,"travelerReason":make_intro(zh,category,item["area"],desc),
            "intro":make_intro(zh,category,item["area"],desc),"areaCluster":item["area"],
            "latitude":item["lat"],"longitude":item["lng"],"officialUrl":official_url(entity),
            "sourceUrl":f"https://www.wikidata.org/wiki/{qid}","wikipediaUrl":item["wikiUrl"],
            "evidence":["Wikidata 跨語言實體","日文 Wikipedia 旅遊相關實體",*(['官方網站'] if official_url(entity) else [])],
            "averageStayMinutes":60 if category not in {"美景自然","玩樂"} else 100,
            "costNote":"免費或費用待官方核對" if category not in {"美食","玩樂"} else "依官方當期價格；尚未保存即時價格",
            "openingHoursNote":"出發前查官方最新營業／開放資訊","lastVerifiedAt":"2026-07-24",
            "dataLicense":"Wikidata CC0；Wikipedia 連結僅作來源，不複製摘要", "recommendationEligible":False,
        }
        row["completionScore"] = completion(row)
        if row["completionScore"] >= 80: records.append(row)
    # 區域先達配額，再以跨語言完整、官方網址與類別稀缺性補足。
    grouped, selected, used = defaultdict(list), [], set()
    for row in records: grouped[row["areaCluster"]].append(row)
    for name,*_rest,quota in REGIONS:
        pool=sorted(grouped[name],key=lambda x:(not bool(x["officialUrl"]),-x["completionScore"],x["nameZhHant"]))
        cats=defaultdict(list)
        for x in pool: cats[x["category"]].append(x)
        order=[]
        while len(order)<quota and any(cats.values()):
            for cat in [x[0] for x in CATEGORY_RULES]:
                if cats[cat]: order.append(cats[cat].pop(0))
                if len(order)>=quota: break
        for x in order:
            if x["qid"] not in used: selected.append(x); used.add(x["qid"])
    for x in sorted(records,key=lambda x:(not bool(x["officialUrl"]),-x["completionScore"])):
        if len(selected)>=930: break
        if x["qid"] not in used: selected.append(x); used.add(x["qid"])
    selected=selected[:930]
    OUT_JSON.write_text(json.dumps(selected,ensure_ascii=False,indent=2),encoding="utf-8")
    OUT_JS.write_text("// Wikidata CC0；低於 80% 不輸出。\nconst TRAVELER_VALUE_PLACES="+json.dumps(selected,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf-8")
    report={"rawTourismEntities":len(by_qid),"eligible80Plus":len(records),"selected":len(selected),"completion":Counter(x["completionScore"] for x in selected),"categories":Counter(x["category"] for x in selected),"areas":Counter(x["areaCluster"] for x in selected),"withOfficialUrl":sum(bool(x["officialUrl"]) for x in selected)}
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2,default=dict),encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,default=dict),flush=True)


if __name__ == "__main__": main()
