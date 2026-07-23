"""用 Wikidata 免費 API 補充可追溯的繁中／英文名稱。"""
from __future__ import annotations

import json
import sqlite3
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "database" / "places.sqlite"
REPORT_PATH = ROOT / "database" / "wikidata-label-report.json"


def chunks(values: list[str], size: int = 50):
    for start in range(0, len(values), size):
        yield values[start:start + size]


def main() -> None:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        "SELECT id, wikidata, name_zh_hant, name_en FROM places WHERE wikidata IS NOT NULL"
    ).fetchall()
    entity_ids = sorted({row["wikidata"] for row in rows if row["wikidata"].startswith("Q")})
    if len(entity_ids) > 500:
        raise SystemExit("安全上限：單次最多處理 500 個 Wikidata 實體")

    entities, failures, calls = {}, [], 0
    for batch in chunks(entity_ids):
        calls += 1
        params = urllib.parse.urlencode({
            "action": "wbgetentities",
            "format": "json",
            "ids": "|".join(batch),
            "props": "labels",
            "languages": "zh-tw|zh-hant|zh|en|ja",
            "languagefallback": "1",
            "origin": "*",
        })
        request = urllib.request.Request(
            f"https://www.wikidata.org/w/api.php?{params}",
            headers={"User-Agent": "TABI-MATE-dev/0.3 github.com/Rainbow0721/japan-ai-travel-app"},
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                entities.update(json.load(response).get("entities", {}))
        except Exception as exc:
            failures.append({"batch": calls, "error": type(exc).__name__})

    updated_zh = updated_en = 0
    for row in rows:
        labels = entities.get(row["wikidata"], {}).get("labels", {})
        zh = next((labels[key]["value"] for key in ("zh-tw", "zh-hant", "zh") if key in labels), None)
        en = labels.get("en", {}).get("value")
        if zh and not row["name_zh_hant"]:
            connection.execute(
                "UPDATE places SET name_zh_hant=?, translation_status='verified_wikidata' WHERE id=?",
                (zh, row["id"]),
            )
            updated_zh += 1
        if en and not row["name_en"]:
            connection.execute("UPDATE places SET name_en=? WHERE id=?", (en, row["id"]))
            updated_en += 1

    connection.commit()
    with_chinese = connection.execute(
        "SELECT COUNT(*) FROM places WHERE name_zh_hant IS NOT NULL AND trim(name_zh_hant) <> ''"
    ).fetchone()[0]
    connection.close()
    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "wikidataEntities": len(entity_ids),
        "apiCalls": calls,
        "failures": failures,
        "addedChineseNames": updated_zh,
        "addedEnglishNames": updated_en,
        "totalWithChineseName": with_chinese,
        "costTwd": 0,
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
