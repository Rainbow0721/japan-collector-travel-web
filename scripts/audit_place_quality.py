"""稽核 APP 地點資料是否足以支援旅遊推薦。

這不是 OSM 完整度評分，而是以「能否安全放進台灣旅客的每日行程」為標準。
輸出三層：完整、半成品、無行程參考性，並列出阻擋推薦的原因。
"""
from __future__ import annotations

import json
import re
import sqlite3
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "database" / "places.sqlite"
REPORT_PATH = ROOT / "database" / "quality-audit-report.json"
SUMMARY_PATH = ROOT / "research" / "quality-audit-summary.md"
CURATED_PATH = ROOT / "data.js"

LOW_VALUE_CHAIN_TOKENS = (
    "starbucks", "スターバックス", "tully", "タリーズ", "mcdonald", "マクドナルド",
    "matsuya", "松屋", "yoshinoya", "吉野家", "sukiya", "すき家", "doutor", "ドトール",
    "kfc", "ケンタッキー", "cafe veloce", "カフェ・ベローチェ", "excelsior", "エクセルシオール",
    "saint marc", "サンマルク", "cafe de crie", "カフェ・ド・クリエ", "mos burger", "モスバーガー",
    "coco ichibanya", "coco壱", "ココ壱", "katsuya", "かつや", "hotto motto", "ほっともっと",
    "saizeriya", "サイゼリヤ", "bamiyan", "バーミヤン", "marugame", "丸亀製麺", "ootoya", "大戸屋",
    "gindaco", "築地銀だこ", "sushiro", "スシロー", "kura sushi", "くら寿司", "hamazushi", "はま寿司",
)

# 這些資料可以留在「地圖搜尋／交通節點」層，但不能算旅遊景點完成度。
NON_TOURISM_SUBCATEGORIES = {
    "hotel", "hostel", "guest_house", "information", "station",
    "convenience", "supermarket", "mobile_phone", "chemist", "car", "car_parts",
    "hairdresser", "erotic", "wholesale", "laundry", "dry_cleaning",
}
GENERIC_FOOD_SUBCATEGORIES = {
    "coffee_shop", "beef_bowl", "burger", "chicken", "fast_food",
}


def has(value: object) -> bool:
    return bool(str(value or "").strip())


def audit(row: sqlite3.Row) -> dict[str, object]:
    combined_name = " ".join(str(row[key] or "").lower() for key in ("name_zh_hant", "name_ja", "name_en"))
    iconic_exceptions = ("kanda matsuya", "神田まつや", "神田藪蕎麦")
    chain = not any(name in combined_name for name in iconic_exceptions) and any(
        token.lower() in combined_name for token in LOW_VALUE_CHAIN_TOKENS
    )
    wrong_category = row["category"] == "美食餐廳與市場" and row["subcategory"] in {"attraction", "museum", "hotel"}
    non_tourism = row["subcategory"] in NON_TOURISM_SUBCATEGORIES
    generic_food = row["category"] == "美食餐廳與市場" and row["subcategory"] in GENERIC_FOOD_SUBCATEGORIES
    traceable = has(row["source_url"])
    authoritative = has(row["official_url"]) or has(row["wikidata"]) or has(row["wikipedia"])
    names = sum(has(row[key]) for key in ("name_zh_hant", "name_ja", "name_en"))
    typed = has(row["subcategory"]) or has(row["cuisine"])

    # 產品所需的簡介、停留時間、費用、旅客價值證據目前不在 SQLite schema，故完整層必為 0。
    missing_product_fields = ["繁中簡介", "建議停留時間", "費用", "旅客價值證據"]
    points = names * 8 + int(authoritative) * 18 + int(has(row["opening_hours"])) * 12 + int(typed) * 10 + int(traceable) * 8
    reasons: list[str] = []
    if chain:
        reasons.append("一般連鎖門市，不應作為赴日特色美食推薦")
    if wrong_category:
        reasons.append("分類錯誤")
    if non_tourism:
        reasons.append("屬住宿、普通車站或日常零售節點，不是旅遊景點")
    if generic_food:
        reasons.append("泛用咖啡／速食／牛丼類別，未具特色店家證據")
    if not has(row["name_zh_hant"]):
        reasons.append("缺繁中名稱")
    if not authoritative:
        reasons.append("缺官方／知識庫來源")
    if not has(row["opening_hours"]):
        reasons.append("缺營業時間")
    reasons.extend(f"缺{field}" for field in missing_product_fields)

    if chain or wrong_category or non_tourism or generic_food or (not has(row["name_zh_hant"]) and not authoritative) or not traceable:
        tier = "無行程參考性"
    elif points >= 50:
        tier = "半成品"
    else:
        tier = "無行程參考性"
    return {
        "id": row["id"], "name": row["name_zh_hant"] or row["name_ja"], "category": row["category"],
        "tier": tier, "score": points, "isLowValueChain": chain,
        "isNonTourism": non_tourism or generic_food, "reasons": reasons,
    }


def main() -> None:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    rows = connection.execute("SELECT * FROM places ORDER BY category, quality_score DESC").fetchall()
    audited = [audit(row) for row in rows]
    connection.close()
    tiers = Counter(item["tier"] for item in audited)
    tiers["完整"] = 0
    curated_rows = len(re.findall(r"^p\(", CURATED_PATH.read_text(encoding="utf-8"), flags=re.MULTILINE))
    categories = Counter((item["category"], item["tier"]) for item in audited)
    chains = [item for item in audited if item["isLowValueChain"]]
    non_tourism = [item for item in audited if item["isNonTourism"]]
    report = {
        "rawCandidatesFound": 9443,
        "databaseRows": len(audited),
        "curatedRows": curated_rows,
        "appRows": len(audited) + curated_rows,
        "definition": {
            "完整": "中英日名稱、真實簡介、正確分類、座標、來源、營業時間、停留、費用與旅客價值證據齊全",
            "半成品": "基本身份可追溯，但缺少至少一項排行程必要資訊",
            "無行程參考性": "連鎖灌水、分類錯誤、缺中文且缺權威來源，或不足以支持旅遊推薦",
        },
        "tiers": dict(tiers),
        "appTiersIncludingCurated": {
            "完整": 0,
            "半成品": tiers["半成品"] + curated_rows,
            "無行程參考性": tiers["無行程參考性"],
        },
        "lowValueChainRows": len(chains),
        "nonTourismRows": len(non_tourism),
        "byCategoryAndTier": {f"{category}｜{tier}": count for (category, tier), count in sorted(categories.items())},
        "examplesLowValue": chains[:80],
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    SUMMARY_PATH.write_text(
        "# 地點資料品質稽核\n\n"
        f"- 原始 OSM 候選：{report['rawCandidatesFound']:,} 筆（未全部匯入 APP）\n"
        f"- APP 永久資料：{report['databaseRows']:,} 筆\n"
        f"- 人工精選核心：{curated_rows:,} 筆（有簡介／停留／費用，但仍缺逐筆來源與營業時間）\n"
        f"- APP 合計：{report['appRows']:,} 筆\n"
        f"- 完整：{tiers['完整']:,} 筆\n"
        f"- 半成品：{tiers['半成品'] + curated_rows:,} 筆\n"
        f"- 無行程參考性：{tiers['無行程參考性']:,} 筆\n"
        f"- 一般連鎖門市：{len(chains):,} 筆\n\n"
        f"- 住宿、普通車站、日常零售與泛用速食：{len(non_tourism):,} 筆（全部隔離）\n\n"
        "完整的定義不是『有座標就算』，而是足以安全放進旅客每日 schedule。"
        "目前資料庫沒有真實簡介、建議停留、費用與旅客價值證據欄位，所以嚴格計算完整筆數為 0。\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
