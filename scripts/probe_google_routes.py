"""用極小批次驗證 Google Routes 大眾運輸時間與票價。

結果只輸出到終端，不寫入資料庫，避免違反 Google Routes 快取限制。
必須在 .env 明確設定 GOOGLE_ROUTES_MAX_REQUESTS_PER_RUN，且最多 10 次。
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT.parent / ".env"
ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes"
SAMPLES = (
    {"name": "東京站→淺草寺", "origin": (35.6812, 139.7671), "destination": (35.7148, 139.7967)},
)


def load_env() -> dict[str, str]:
    values = dict(os.environ)
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                values.setdefault(key, value.strip())
    return values


def request_route(api_key: str, sample: dict[str, object]) -> dict[str, object]:
    origin_lat, origin_lng = sample["origin"]
    destination_lat, destination_lng = sample["destination"]
    tomorrow = datetime.now(timezone.utc).date() + timedelta(days=1)
    departure_time = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    body = json.dumps({
        "origin": {"location": {"latLng": {"latitude": origin_lat, "longitude": origin_lng}}},
        "destination": {"location": {"latLng": {"latitude": destination_lat, "longitude": destination_lng}}},
        "travelMode": "TRANSIT", "departureTime": departure_time,
        "languageCode": "zh-TW", "units": "METRIC",
    }).encode()
    request = urllib.request.Request(ENDPOINT, data=body, headers={
        "Content-Type": "application/json", "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.travelAdvisory.transitFare,routes.localizedValues",
    })
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.load(response)


def main() -> None:
    env = load_env()
    api_key = env.get("GOOGLE_MAPS_API_KEY", "")
    limit = int(env.get("GOOGLE_ROUTES_MAX_REQUESTS_PER_RUN", "0"))
    if not api_key.startswith("AIza"):
        raise SystemExit("GOOGLE_MAPS_API_KEY 缺失或格式錯誤")
    if limit < len(SAMPLES) or limit > 10:
        raise SystemExit(f"成本熔斷：本次 {len(SAMPLES)} 次；設定上限須介於本次數量與 10 之間，目前為 {limit}")
    for sample in SAMPLES:
        try:
            result = request_route(api_key, sample)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:800]
            raise SystemExit(f"Routes API HTTP {exc.code}：{detail}") from exc
        route = (result.get("routes") or [{}])[0]
        print(json.dumps({"sample": sample["name"], "routeFound": bool(result.get("routes")), "route": route}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
