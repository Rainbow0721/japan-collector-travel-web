"""建立可永久保存的 Google Place ID 索引。

只要求 Places API Text Search (New) 的 places.id 欄位；不儲存 Google 名稱、
評分、評論、地址、照片或座標。固定最多 100 次、無自動重試。
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT.parent / ".env"
OUTPUT_PATH = ROOT / "database" / "google-place-ids.json"
REPORT_PATH = ROOT / "database" / "google-place-ids-report.json"

REGIONS = (
    "台東區 淺草 上野 谷中", "千代田區 東京站 丸之內 秋葉原", "中央區 築地 銀座 日本橋",
    "新宿區", "澀谷區 原宿 惠比壽", "港區 東京鐵塔 六本木", "豐島區 池袋", "墨田區 晴空塔 兩國",
    "江東區 豐洲 台場 清澄白河", "文京區", "目黑區", "世田谷區", "中野區 杉並區",
    "品川區 大田區", "東京北區 足立區 葛飾區 江戶川區", "練馬區 板橋區 吉祥寺 三鷹",
    "立川 高尾山 東京", "鎌倉 江之島", "橫濱", "箱根 小田原", "富士河口湖 富士吉田 御殿場",
    "日光 栃木", "川越 埼玉", "輕井澤 長野", "千葉 舞濱 成田",
)
CATEGORIES = {
    "美食餐廳與市場": "熱門 美食 餐廳 市場",
    "購物百貨與商店街": "熱門 購物 百貨 商店街",
    "神社寺廟與歷史文化": "熱門 神社 寺廟 歷史 景點",
    "地標娛樂與自然": "熱門 景點 地標 樂園 公園 展望台",
}


def load_env() -> dict[str, str]:
    values = dict(os.environ)
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values.setdefault(key, value.strip())
    return values


def search(api_key: str, query: str) -> list[str]:
    body = json.dumps({
        "textQuery": query,
        "languageCode": "zh-TW",
        "regionCode": "JP",
        "maxResultCount": 20,
    }).encode()
    request = urllib.request.Request(
        "https://places.googleapis.com/v1/places:searchText",
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": "places.id",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return [place["id"] for place in json.load(response).get("places", []) if place.get("id")]


def main() -> None:
    env = load_env()
    api_key = env.get("GOOGLE_MAPS_API_KEY", "")
    configured_limit = int(env.get("GOOGLE_PLACES_MAX_REQUESTS_PER_RUN", "0"))
    queries = [(region, category, f"{region} {terms}") for region in REGIONS for category, terms in CATEGORIES.items()]
    if not api_key.startswith("AIza"):
        raise SystemExit("GOOGLE_MAPS_API_KEY 缺失或格式錯誤")
    if configured_limit < len(queries) or len(queries) > 100:
        raise SystemExit(f"成本熔斷：需要 {len(queries)} 次，但單次上限是 {configured_limit}")

    rows, seen, failures = [], set(), []
    for request_number, (region, category, query) in enumerate(queries, 1):
        try:
            place_ids = search(api_key, query)
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            # 禁止自動重試；記錄後繼續下一個不同查詢。
            failures.append({"request": request_number, "region": region, "category": category, "error": type(exc).__name__})
            continue
        for rank, place_id in enumerate(place_ids, 1):
            if place_id in seen:
                continue
            seen.add(place_id)
            rows.append({
                "googlePlaceId": place_id,
                "discoveredByRegion": region,
                "discoveredByCategory": category,
                "queryRank": rank,
            })
        print(f"{request_number:03d}/100｜唯一 Place ID：{len(rows)}", flush=True)

    generated_at = datetime.now(timezone.utc).isoformat()
    OUTPUT_PATH.write_text(json.dumps({
        "generatedAt": generated_at,
        "storagePolicy": "Only Google Place IDs are persisted; IDs are exempt from caching restrictions.",
        "places": rows,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT_PATH.write_text(json.dumps({
        "generatedAt": generated_at,
        "requestLimit": 100,
        "requestsAttempted": len(queries),
        "uniquePlaceIds": len(rows),
        "failures": failures,
        "byCategory": Counter(row["discoveredByCategory"] for row in rows),
    }, ensure_ascii=False, indent=2, default=dict), encoding="utf-8")
    print(json.dumps({"uniquePlaceIds": len(rows), "failures": len(failures)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
