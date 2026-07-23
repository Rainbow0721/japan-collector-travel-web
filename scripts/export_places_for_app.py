"""將 SQLite 永久資料庫輸出成瀏覽器可直接載入的 JavaScript。"""
from __future__ import annotations

import json
import sqlite3
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "database" / "places.sqlite"
OUTPUT_PATH = ROOT / "places.generated.js"
REPORT_PATH = ROOT / "database" / "app-export-report.json"

ZONE_MAP = {
    "台東區": "asakusa", "千代田區": "central", "中央區": "central", "新宿區": "shinjuku",
    "澀谷區": "shibuya", "港區": "minato", "豐島區": "ikebukuro", "墨田區": "asakusa",
    "江東區": "bay", "文京區": "ueno", "目黑區": "shibuya", "世田谷區": "west",
    "中野杉並": "west", "品川大田": "central", "東京北東區": "ueno", "東京西北區": "ikebukuro",
    "東京都西側": "west", "鎌倉江之島": "kamakura", "橫濱": "yokohama", "箱根小田原": "hakone",
    "富士河口湖御殿場": "fuji", "日光": "nikko", "川越": "kawagoe", "輕井澤": "karuizawa",
    "千葉舞濱成田": "chiba",
}
CATEGORY_MAP = {
    "美食餐廳與市場": ("美食市場", "🍜", 75),
    "購物百貨與商店街": ("購物血拼", "🛍", 90),
    "神社寺廟與歷史文化": ("神社寺廟", "⛩", 75),
    "地標展望與城市散策": ("城市地標", "📍", 70),
    "公園自然與季節景觀": ("公園自然", "🌳", 90),
    "動漫娛樂與主題樂園": ("動漫娛樂", "🎮", 110),
    "藝文展覽與博物館": ("藝文體驗", "🖼", 90),
    "溫泉體驗與特色交通": ("特色交通", "♨️", 90),
}


def main() -> None:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    rows = connection.execute("SELECT * FROM places ORDER BY quality_score DESC, name_ja").fetchall()
    output = []
    for row in rows:
        category, emoji, duration = CATEGORY_MAP[row["category"]]
        chinese = (row["name_zh_hant"] or "").strip()
        name = chinese or row["name_ja"]
        verified_name = bool(chinese)
        traceable = bool(row["official_url"] or row["wikidata"])
        recommendation_eligible = verified_name and traceable and row["quality_score"] >= 55
        tags = [row["subcategory"], row["cuisine"], "可追溯來源" if traceable else "待來源覆核"]
        if row["wheelchair"]:
            tags.append(f"輪椅：{row['wheelchair']}")
        output.append({
            "id": f"db-{row['id']}", "name": name, "nameJa": row["name_ja"], "nameEn": row["name_en"] or "",
            "area": row["area_cluster"], "zone": ZONE_MAP[row["area_cluster"]], "category": category,
            "sourceCategory": row["category"], "emoji": emoji, "duration": duration, "admission": 0,
            "popularity": min(79, round(row["quality_score"] * .72)), "qualityScore": row["quality_score"],
            "tags": [tag for tag in tags if tag][:4],
            "desc": f"{row['area_cluster']}的{row['category']}候選；資料來自 OpenStreetMap" + ("及 Wikidata。" if row["wikidata"] else "。"),
            "lat": row["latitude"], "lng": row["longitude"], "transit": 0,
            "sourceUrl": row["source_url"], "officialUrl": row["official_url"] or "",
            "nameStatus": row["translation_status"], "verificationStatus": row["verification_status"],
            "recommendationEligible": recommendation_eligible, "curated": False,
        })
    connection.close()
    OUTPUT_PATH.write_text(
        "// 由 scripts/export_places_for_app.py 產生；永久來源為 OpenStreetMap/Wikidata。\n"
        "const DATABASE_PLACES=" + json.dumps(output, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    report = {
        "rows": len(output),
        "withChineseName": sum(item["nameStatus"] != "needs_zh_review" for item in output),
        "recommendationEligible": sum(item["recommendationEligible"] for item in output),
        "categories": Counter(item["sourceCategory"] for item in output),
        "areas": Counter(item["area"] for item in output),
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=dict), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, default=dict))


if __name__ == "__main__":
    main()
