# 旅伴｜東京 AI 私人地陪雛形

這是一個不需要安裝套件的互動式網頁雛形，用來驗證第一版 APP 的主要體驗。

## 開啟方式

在此資料夾啟動本機網站：

```bash
python3 -m http.server 4173
```

再用瀏覽器開啟 `http://127.0.0.1:4173`。

## 已有功能

- 繁體中文桌面與手機版面
- 76 筆人工精選核心地點（含 15 筆具官方來源的特色餐廳），加上 1,000 筆 OpenStreetMap／Wikidata 永久候選資料
- 1,089 筆 Google Place ID 供日後即時詳情比對；不永久保存受限制的 Google 內容
- 468 筆具可追溯中文名稱；其餘以日文原名顯示並標記待中文覆核
- 精選資料顯示人氣；資料庫候選顯示資料品質，避免把資料完整度冒充人氣
- 依美食、購物、神社寺廟、動漫、自然、夜景與親子偏好改變推薦
- 東京近郊包含鎌倉／江之島、橫濱、箱根、富士河口湖、日光、川越、輕井澤、千葉迪士尼
- 花費拆成餐食、交通、門票，個人購物、機票與住宿不混入
- 依歷史文化、美食、購物、自然、夜景等分類探索
- 收藏必去景點
- 選擇 3–7 天、每日預算與旅行步調
- 長者、兒童與嬰兒車同行設定
- 依東京區域模板與 76 筆人工精選產生每日行程；可辨識壽司、燒鳥、壽喜燒、螃蟹、豬排等具體料理需求
- 顯示時間軸、停留時間、交通時間、步行量與預估費用

## 目前限制

- 這是前端雛形，已載入靜態資料匯出，但尚未連接真正的 AI、即時路線、登入及付款。
- 交通時間與費用是展示用估算，不能用於真實旅程。
- 景點營業時間、票價與無障礙狀況仍須接入官方或授權資料來源。
- 目前嚴格稽核為完整 0、半成品 651（含 76 筆人工精選）、無行程參考性 425；其餘候選不會宣稱已人工驗證。
- 一般連鎖門市與錯誤分類資料已隔離，只能在稽核模式查看，不會進入自動行程。
- 每個地點現在可以點開查看資料狀態、中文／日文／英文名稱、簡介或誠實的缺資料說明、費用、營業資訊與來源。
- Google Place ID 索引不是完整景點內容；Google 名稱、評分、評論、地址與照片須依條款即時取得。
- 「儲存行程」與「查看地圖」目前是介面示意。

## 資料檔案

- `database/places.sqlite`：本機建置成果，不提交 Git；可由腳本重建。
- `places.generated.js`：提供 APP 的 1,000 筆合法永久資料匯出。
- `transport-data.js`：東京 Metro、都營地下鐵與 Skyliner 官方票價基準及來源。
- `database/google-place-ids.json`：1,089 筆可永久保存的 Google Place ID 索引。
- `database/*-report.json`：資料筆數、覆蓋、失敗查詢與品質報告。
- `database/quality-audit-report.json`：完整／半成品／無參考性與連鎖灌水稽核。
- `research/v4-quality-and-product-benchmark.md`：旅行社、近郊、美食分類、旅遊工具與使用者評論研究。
- `scripts/audit_place_quality.py`：可重跑的產品級資料品質門檻。
- `scripts/build_places_database.py`：OSM 分區、分類、快取與配額選取。
- `scripts/enrich_wikidata_labels.py`：Wikidata 中文／英文名稱補充。
- `scripts/export_places_for_app.py`：SQLite 到前端資料的可重現匯出。
- `scripts/build_google_place_ids.py`：固定 100 次、IDs Only、無重試的成本安全索引程式。
- `scripts/probe_google_routes.py`：有請求上限、無重試且不保存回應的 Routes API 交通驗證工具。

## 景點研究來源

- GO TOKYO 東京官方旅遊指南：https://www.gotokyo.org/en/
- 日本政府觀光局 JNTO：https://www.japan.travel/en/destinations/kanto/tokyo/
- OpenStreetMap contributors（ODbL）：https://www.openstreetmap.org/copyright
- Wikidata（CC0）：https://www.wikidata.org/wiki/Wikidata:Licensing
- Google Places API 政策：https://developers.google.com/maps/documentation/places/web-service/policies
