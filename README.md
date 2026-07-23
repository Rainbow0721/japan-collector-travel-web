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
- 最終廣義東京資料固定 1,000 筆：959 筆完成度 80%、41 筆完成度 100%；全部可追溯且低於 80% 不輸出
- 分布包含特色餐廳 355、購物 209、寺社 183、美景／城市名勝 101、玩樂 62、藝文 74，另有市場、動漫與歷史類
- 1,089 筆 Google Place ID 供日後即時詳情比對；不永久保存受限制的 Google 內容
- 110 筆人工精選與 442 筆 Wikimedia 實體使用繁中主名；OSM 店家若無來源繁中名，顯示羅馬字＋繁中類型暫名並保留日文原名，明確標記待校名
- 精選資料顯示人氣；資料庫候選顯示資料品質，避免把資料完整度冒充人氣
- 依美食、購物、神社寺廟、動漫、自然、夜景與親子偏好改變推薦
- 東京近郊包含鎌倉／江之島、橫濱、箱根、富士河口湖、日光、川越、輕井澤、千葉迪士尼
- 花費拆成餐食、交通、門票，個人購物、機票與住宿不混入
- 依歷史文化、美食、購物、自然、夜景等分類探索
- 收藏必去景點
- 選擇 3–7 天、每日預算與旅行步調
- 長者、兒童與嬰兒車同行設定
- 依東京區域模板與 110 筆人工精選產生每日行程；可辨識壽司、燒鳥、壽喜燒、螃蟹、豬排、拉麵、沾麵、天婦羅、鰻魚、燒肉等具體料理需求
- 顯示時間軸、停留時間、交通時間、步行量與預估費用

## 目前限制

- 這是前端雛形，已載入靜態資料匯出，但尚未連接真正的 AI、即時路線、登入及付款。
- 交通時間與費用是展示用估算，不能用於真實旅程。
- 景點營業時間、票價與無障礙狀況仍須接入官方或授權資料來源。
- 舊版 1,000 筆仍保留作錯誤案例與稽核基準，但 APP 已改讀 `places.final.js`，不再載入舊垃圾候選。80% 地點可參與初步規劃並強制標示即時核對；100% 表示已逐筆核對永久核心欄位。
- 一般同質連鎖與錯誤分類資料不再載入 APP；特色連鎖需逐筆說明分店差異才可保留。
- 每個地點現在可以點開查看資料狀態、中文／日文／英文名稱、簡介或誠實的缺資料說明、費用、營業資訊與來源。
- Google Place ID 索引不是完整景點內容；Google 名稱、評分、評論、地址與照片須依條款即時取得。
- 「儲存行程」與「查看地圖」目前是介面示意。

## 資料檔案

重建資料前先執行 `python3 -m pip install -r prototype/requirements-data.txt`。

- `database/places.sqlite`：本機建置成果，不提交 Git；可由腳本重建。
- `places.final.js`：APP 實際載入的最終 1,000 筆；由人工精選、Wikimedia 與 OSM 旅客價值候選去重組成。
- `places.generated.js`：舊版 OSM 候選匯出，只保留作回歸稽核，不再由 APP 載入。
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
- `scripts/build_traveler_value_catalog.py`：從 Wikimedia 建立廣義東京跨語言旅客實體，低於 80% 不輸出。
- `scripts/build_osm_food_shopping_catalog.py`：從 OSM 快取重選 300 筆多料理美食與 150 筆高價值購物候選。
- `scripts/build_final_catalog.mjs`：合併三層資料、去重並固定輸出最終 1,000 筆。

## 景點研究來源

- GO TOKYO 東京官方旅遊指南：https://www.gotokyo.org/en/
- 日本政府觀光局 JNTO：https://www.japan.travel/en/destinations/kanto/tokyo/
- OpenStreetMap contributors（ODbL）：https://www.openstreetmap.org/copyright
- Wikidata（CC0）：https://www.wikidata.org/wiki/Wikidata:Licensing
- Google Places API 政策：https://developers.google.com/maps/documentation/places/web-service/policies
