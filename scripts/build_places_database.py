"""建立東京與熱門近郊 1,000 筆候選地點資料庫。

永久資料來源使用 OpenStreetMap（ODbL）；Google/NAVITIME 資料只在日後以
provider reference 與短期快取加入，避免違反供應商儲存政策。
"""
from __future__ import annotations

import json
import math
import random
import re
import sqlite3
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "database" / "places.sqlite"
REPORT_PATH = ROOT / "database" / "build-report.json"
CACHE_DIR = Path("/tmp/tabi-mate-osm-cache")
ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)

# 每區先抓比配額多的候選，最後依資料完整度與類別平衡選出 1,000 筆。
REGIONS = (
    ("台東區", "東京市區", 35.714, 139.790, 4200, 80),
    ("千代田區", "東京市區", 35.691, 139.753, 4300, 65),
    ("中央區", "東京市區", 35.674, 139.773, 3600, 65),
    ("新宿區", "東京市區", 35.694, 139.703, 4000, 70),
    ("澀谷區", "東京市區", 35.665, 139.701, 4300, 70),
    ("港區", "東京市區", 35.658, 139.735, 5000, 55),
    ("豐島區", "東京市區", 35.729, 139.715, 3300, 38),
    ("墨田區", "東京市區", 35.710, 139.810, 3500, 32),
    ("江東區", "東京市區", 35.666, 139.817, 6000, 38),
    ("文京區", "東京市區", 35.718, 139.752, 3500, 24),
    ("目黑區", "東京市區", 35.634, 139.698, 3500, 24),
    ("世田谷區", "東京市區", 35.646, 139.653, 6000, 24),
    ("中野杉並", "東京市區", 35.704, 139.636, 6500, 28),
    ("品川大田", "東京市區", 35.596, 139.714, 8500, 24),
    ("東京北東區", "東京市區", 35.765, 139.805, 8500, 30),
    ("東京西北區", "東京市區", 35.750, 139.635, 8500, 28),
    ("東京都西側", "東京都近郊", 35.690, 139.480, 18000, 55),
    ("鎌倉江之島", "熱門近郊", 35.320, 139.520, 13500, 40),
    ("橫濱", "熱門近郊", 35.455, 139.630, 12500, 30),
    ("箱根小田原", "熱門近郊", 35.232, 139.070, 18000, 30),
    ("富士河口湖御殿場", "熱門近郊", 35.420, 138.830, 33000, 35),
    ("日光", "熱門近郊", 36.760, 139.600, 18000, 20),
    ("川越", "熱門近郊", 35.925, 139.485, 9000, 15),
    ("輕井澤", "熱門近郊", 36.350, 138.635, 12000, 15),
    ("千葉舞濱成田", "熱門近郊", 35.720, 140.020, 47000, 35),
)

FILTERS = (
    '["amenity"~"^(restaurant|cafe|fast_food|food_court|marketplace|ice_cream)$"]',
    '["shop"~"^(department_store|mall|gift|convenience|supermarket|deli|bakery|confectionery|tea|coffee|cosmetics|chemist|clothes|shoes|jewelry|electronics|camera|books|stationery|toys|anime|variety_store|second_hand)$"]',
    '["amenity"="place_of_worship"]',
    '["tourism"~"^(attraction|viewpoint|theme_park|zoo|aquarium|museum|gallery|artwork)$"]',
    '["historic"]',
    '["leisure"~"^(park|garden|nature_reserve)$"]',
    '["railway"="station"]',
)
FILTER_GROUPS = (
    ("food", tuple(f'["amenity"="{value}"]' for value in ("restaurant","cafe","fast_food","food_court","marketplace","ice_cream"))),
    ("shopping", ('["shop"]',)),
    ("culture", (
        '["amenity"="place_of_worship"]','["tourism"]','["historic"]',
        '["leisure"="park"]','["leisure"="garden"]','["leisure"="nature_reserve"]','["railway"="station"]'
    )),
)

CATEGORY_QUOTA = {
    "美食餐廳與市場": 320,
    "購物百貨與商店街": 180,
    "神社寺廟與歷史文化": 140,
    "地標展望與城市散策": 120,
    "公園自然與季節景觀": 70,
    "動漫娛樂與主題樂園": 70,
    "藝文展覽與博物館": 60,
    "溫泉體驗與特色交通": 40,
}


def fetch(query: str, timeout: int = 90) -> list[dict]:
    error = None
    for attempt, endpoint in enumerate(ENDPOINTS, 1):
        try:
            request = urllib.request.Request(
                endpoint,
                data=urllib.parse.urlencode({"data": query}).encode(),
                headers={"User-Agent": "TABI-MATE-dev/0.3 github.com/Rainbow0721/japan-ai-travel-app"},
            )
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.load(response).get("elements", [])
        except Exception as exc:  # 公開端點可能暫時忙碌，依序換站
            error = exc
            if attempt < len(ENDPOINTS):
                time.sleep(min(6, attempt * 1.5) + random.random())
    raise RuntimeError(f"Overpass 查詢失敗：{error}")


def point(element: dict) -> tuple[float | None, float | None]:
    return element.get("lat") or element.get("center", {}).get("lat"), element.get("lon") or element.get("center", {}).get("lon")


def classify(tags: dict) -> str:
    amenity, shop, tourism = tags.get("amenity"), tags.get("shop"), tags.get("tourism")
    if amenity in {"restaurant", "cafe", "fast_food", "food_court", "marketplace", "ice_cream"}:
        return "美食餐廳與市場"
    if shop:
        if shop in {"toys", "anime"}: return "動漫娛樂與主題樂園"
        return "購物百貨與商店街"
    if amenity == "place_of_worship" or tags.get("historic"):
        return "神社寺廟與歷史文化"
    if tourism in {"museum", "gallery", "artwork"}:
        return "藝文展覽與博物館"
    if tourism in {"theme_park", "zoo", "aquarium"}:
        return "動漫娛樂與主題樂園"
    if tags.get("leisure") in {"park", "garden", "nature_reserve"}:
        return "公園自然與季節景觀"
    if tags.get("railway") == "station" or tags.get("amenity") in {"spa", "public_bath"}:
        return "溫泉體驗與特色交通"
    return "地標展望與城市散策"


def quality(tags: dict, category: str) -> float:
    score = 20
    score += 16 if tags.get("name:zh-Hant") or tags.get("name:zh") else 0
    score += 10 if tags.get("name:en") else 0
    score += 12 if tags.get("wikidata") or tags.get("wikipedia") else 0
    score += 9 if tags.get("website") or tags.get("contact:website") else 0
    score += 7 if tags.get("opening_hours") else 0
    score += 5 if tags.get("addr:street") or tags.get("addr:full") else 0
    score += 4 if tags.get("wheelchair") else 0
    if category == "美食餐廳與市場":
        score += 5 if tags.get("cuisine") else 0
        score += 4 if tags.get("brand") else 0
    return min(score, 100)


def normalized_name(value: str) -> str:
    return re.sub(r"[\s・･\-—_（）()]+", "", value).casefold()


def make_record(element: dict, region: tuple) -> dict | None:
    tags = element.get("tags", {})
    lat, lon = point(element)
    name_ja = tags.get("name:ja") or tags.get("name")
    if not name_ja or lat is None or lon is None:
        return None
    category = classify(tags)
    name_zh = tags.get("name:zh-Hant") or tags.get("name:zh")
    name_en = tags.get("name:en")
    area, scope, *_ = region
    return {
        "id": f"osm-{element['type']}-{element['id']}",
        "name_zh_hant": name_zh,
        "name_zh_hans": tags.get("name:zh-Hans") or tags.get("name:zh"),
        "name_ja": name_ja,
        "name_en": name_en,
        "category": category,
        "subcategory": tags.get("cuisine") or tags.get("shop") or tags.get("tourism") or tags.get("historic") or tags.get("leisure") or tags.get("railway") or tags.get("amenity"),
        "scope": scope,
        "area_cluster": area,
        "latitude": float(lat),
        "longitude": float(lon),
        "official_url": tags.get("website") or tags.get("contact:website"),
        "provider": "openstreetmap",
        "provider_place_id": f"{element['type']}/{element['id']}",
        "source_url": f"https://www.openstreetmap.org/{element['type']}/{element['id']}",
        "opening_hours": tags.get("opening_hours"),
        "wheelchair": tags.get("wheelchair"),
        "cuisine": tags.get("cuisine"),
        "wikidata": tags.get("wikidata"),
        "wikipedia": tags.get("wikipedia"),
        "quality_score": quality(tags, category),
        "popularity_score": None,
        "popularity_status": "awaiting_live_provider",
        "translation_status": "verified_source" if name_zh else "needs_zh_review",
        "verification_status": "candidate",
    }


def select_balanced(records: list[dict]) -> list[dict]:
    # 先依區域配額選擇，區內再確保類別不完全被餐廳壟斷。
    grouped = defaultdict(list)
    for record in records:
        grouped[record["area_cluster"]].append(record)
    selected, used = [], set()
    for area, _scope, _lat, _lon, _radius, area_quota in REGIONS:
        pool = sorted(grouped[area], key=lambda r: (-r["quality_score"], r["name_ja"]))
        per_category = defaultdict(list)
        for item in pool: per_category[item["category"]].append(item)
        # 區域內至少保留多種類型，再以品質補滿。
        soft_cap = max(4, math.ceil(area_quota * .45))
        chosen = []
        for category in CATEGORY_QUOTA:
            chosen.extend(per_category[category][:min(soft_cap, max(2, area_quota // 8))])
        chosen_ids = {x["id"] for x in chosen}
        chosen.extend(x for x in pool if x["id"] not in chosen_ids)
        for item in chosen:
            if item["id"] not in used and len([x for x in selected if x["area_cluster"] == area]) < area_quota:
                selected.append(item); used.add(item["id"])
    # 若某近郊資料不足，以其他區高品質候選補足，仍受全域類別上限約束。
    category_count = Counter(x["category"] for x in selected)
    remaining = sorted((r for r in records if r["id"] not in used), key=lambda r: (-r["quality_score"], r["name_ja"]))
    for item in remaining:
        if len(selected) >= 1000: break
        if category_count[item["category"]] < CATEGORY_QUOTA[item["category"]]:
            selected.append(item); used.add(item["id"]); category_count[item["category"]] += 1
    for item in remaining:
        if len(selected) >= 1000: break
        if item["id"] not in used:
            selected.append(item); used.add(item["id"])
    return selected[:1000]


def write_database(records: list[dict]) -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists(): DB_PATH.unlink()
    connection = sqlite3.connect(DB_PATH)
    connection.executescript("""
    CREATE TABLE places (
      id TEXT PRIMARY KEY, name_zh_hant TEXT, name_zh_hans TEXT, name_ja TEXT NOT NULL, name_en TEXT,
      category TEXT NOT NULL, subcategory TEXT, scope TEXT NOT NULL, area_cluster TEXT NOT NULL,
      latitude REAL NOT NULL, longitude REAL NOT NULL, official_url TEXT, provider TEXT NOT NULL,
      provider_place_id TEXT NOT NULL, source_url TEXT NOT NULL, opening_hours TEXT, wheelchair TEXT,
      cuisine TEXT, wikidata TEXT, wikipedia TEXT, quality_score REAL NOT NULL, popularity_score REAL,
      popularity_status TEXT NOT NULL, translation_status TEXT NOT NULL, verification_status TEXT NOT NULL,
      last_verified_at TEXT
    );
    CREATE INDEX places_area_category_idx ON places(area_cluster, category);
    CREATE INDEX places_quality_idx ON places(quality_score DESC);
    CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    """)
    columns = tuple(records[0])
    sql = f"INSERT INTO places ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})"
    connection.executemany(sql, ([item[key] for key in columns] for item in records))
    connection.executemany("INSERT INTO metadata VALUES (?,?)", (
        ("license", "OpenStreetMap ODbL; © OpenStreetMap contributors"),
        ("target_count", "1000"),
        ("recommendation_rule", "Only verified records with Chinese name and live popularity may enter recommendations"),
    ))
    connection.commit(); connection.close()


def main() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    all_records, seen, failed_groups = [], set(), []
    for index, region in enumerate(REGIONS, 1):
        area, _scope, lat, lon, radius, _quota = region
        cache_file = CACHE_DIR / f"{index:02d}.json"
        if cache_file.exists():
            elements = json.loads(cache_file.read_text(encoding="utf-8"))
        else:
            elements = []
            # 商家與多數景點在 OSM 皆有 node；分三批並限制回傳量，尊重公共服務負載。
            lat_delta = radius / 111000
            lon_delta = radius / (111000 * math.cos(math.radians(lat)))
            bbox = f"{lat-lat_delta:.5f},{lon-lon_delta:.5f},{lat+lat_delta:.5f},{lon+lon_delta:.5f}"
            for group_name, filters in FILTER_GROUPS:
                # 每一組各自快取，避免第 3 組逾時時讓前兩組成功結果全部重抓。
                group_cache = CACHE_DIR / f"{index:02d}-{group_name}.json"
                if group_cache.exists():
                    group_elements = json.loads(group_cache.read_text(encoding="utf-8"))
                else:
                    clauses = "".join(f'node["name"]{item_filter}({bbox});' for item_filter in filters)
                    query = f'[out:json][timeout:12];({clauses});out body 450;'
                    try:
                        group_elements = fetch(query, 15)
                    except RuntimeError as exc:
                        # 不讓單一免費公共端點逾時中止整批；失敗組不寫空快取，之後可續跑補齊。
                        failed_groups.append({"area": area, "group": group_name, "error": str(exc)})
                        print(f"略過逾時組別：{area}/{group_name}", flush=True)
                        group_elements = []
                    else:
                        group_cache.write_text(json.dumps(group_elements, ensure_ascii=False), encoding="utf-8")
                        time.sleep(.5)
                elements.extend(group_elements)
            cache_file.write_text(json.dumps(elements, ensure_ascii=False), encoding="utf-8")
        for element in elements:
            record = make_record(element, region)
            if not record: continue
            key = (normalized_name(record["name_ja"]), round(record["latitude"], 4), round(record["longitude"], 4))
            if key in seen: continue
            seen.add(key); all_records.append(record)
        print(f"已完成 {index}/{len(REGIONS)}：{area}（累計 {len(all_records)}）", flush=True)
        time.sleep(.2)
    selected = select_balanced(all_records)
    if len(selected) < 1000:
        raise RuntimeError(f"合格候選只有 {len(selected)} 筆，未達 1,000 筆，停止建立資料庫")
    write_database(selected)
    report = {
        "candidateFetched": len(all_records), "databaseRows": len(selected),
        "categories": Counter(x["category"] for x in selected),
        "areas": Counter(x["area_cluster"] for x in selected),
        "withChineseName": sum(bool(x["name_zh_hant"]) for x in selected),
        "withOfficialUrl": sum(bool(x["official_url"]) for x in selected),
        "withWikidata": sum(bool(x["wikidata"]) for x in selected),
        "verifiedForRecommendation": 0, "failedGroups": failed_groups,
        "note": "本批為永久核心候選資料；須補中文、官方驗證與即時人氣後才可進推薦池。"
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=dict), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, default=dict), flush=True)


if __name__ == "__main__": main()
