import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = {};
vm.createContext(context);
vm.runInContext(`${fs.readFileSync("prototype/data.js", "utf8")}\nthis.curated = TOKYO_PLACES;`, context, {filename:"prototype/data.js"});
vm.runInContext(`${fs.readFileSync("prototype/places.generated.js", "utf8")}\nthis.generated = DATABASE_PLACES;`, context, {filename:"prototype/places.generated.js"});
vm.runInContext(`${fs.readFileSync("prototype/places.final.js", "utf8")}\nthis.finalPlaces = FINAL_PLACES;`, context, {filename:"prototype/places.final.js"});

assert.equal(context.curated.length, 110, "人工精選應為 110 筆");
assert.equal(context.generated.length, 1000, "永久候選應為 1,000 筆");
assert.ok(context.curated.every(place => place.name && place.nameJa && place.nameEn && place.desc), "人工精選須具中英日名稱與簡介");
assert.equal(context.generated.filter(place => place.recommendationEligible).length, 0, "未完整候選不得自動推薦");
assert.equal(context.generated.filter(place => place.dataTier === "半成品").length, 267, "半成品數量異常");
assert.equal(context.generated.filter(place => place.dataTier === "無行程參考性").length, 733, "隔離資料數量異常");
assert.equal(context.generated.filter(place => place.isLowValueChain).length, 261, "一般連鎖隔離數量異常");
assert.ok(context.generated.filter(place => place.isLowValueChain).every(place => !place.recommendationEligible), "一般連鎖不得進推薦池");

assert.equal(context.finalPlaces.length, 1000, "最終廣義東京資料必須正好 1,000 筆");
assert.ok(context.finalPlaces.every(place => place.completionScore >= 80), "最終資料不得低於 80% 完成度");
assert.ok(context.finalPlaces.every(place => place.name && place.nameJa && place.nameEn && place.desc), "最終資料須有主名稱、日英副名稱與簡介");
assert.ok(context.finalPlaces.every(place => Number.isFinite(place.lat) && Number.isFinite(place.lng)), "最終資料須有有效座標");
assert.ok(context.finalPlaces.every(place => place.officialUrl || place.sourceUrl), "最終資料須可追溯來源");
assert.equal(context.finalPlaces.filter(place => place.completionScore === 100).length, 41, "100% 逐筆核對數量異常");
assert.ok(context.finalPlaces.filter(place => place.recommendationEligible).every(place => place.completionScore >= 80), "低於 80% 的資料不得排行程");
assert.ok(context.finalPlaces.filter(place => place.completionScore === 80).every(place => place.requiresLiveCheck), "80% 資料必須要求即時核對");
assert.ok(context.finalPlaces.filter(place => place.category === '特色餐廳').length >= 300, "美食資料量不足");
assert.ok(context.finalPlaces.filter(place => place.category === '購物血拼').length >= 180, "購物資料量不足");
assert.ok(context.finalPlaces.filter(place => place.category === '神社寺廟').length >= 120, "寺社巡禮資料量不足");
assert.ok(context.finalPlaces.filter(place => ['公園自然','展望夜景','城市地標'].includes(place.category)).length >= 90, "美景與城市名勝資料量不足");
assert.ok(!context.finalPlaces.some(place => /株式会社|協会|事務所/.test(place.name)), "公司／協會／事務所不可當旅遊景點");

const curatedRestaurants = context.curated.filter(place => place.category === "特色餐廳");
assert.equal(curatedRestaurants.length, 30, "特色餐廳應為 30 筆");
assert.ok(curatedRestaurants.every(place => place.officialUrl && place.cuisine && place.priceBand), "特色餐廳須有官方來源、料理類型與價位帶");
assert.ok(['壽司','燒鳥','壽喜燒','螃蟹','炸豬排'].every(cuisine => curatedRestaurants.some(place => place.cuisine.includes(cuisine))), "主要美食分類尚未接入");
assert.ok(['拉麵','沾麵','天婦羅','鰻魚','燒肉','創意日本料理'].every(cuisine => curatedRestaurants.some(place => place.cuisine.includes(cuisine))), "美食擴充分類尚未接入");
assert.ok(context.curated.filter(place => place.sourceCheckedAt === '2026-07-24').length >= 34, "本輪逐筆核對資料不足");
const chainExceptions = context.curated.filter(place => place.chainException);
assert.equal(chainExceptions.length, 3, "特色連鎖範例應為 3 筆");
assert.ok(chainExceptions.every(place => place.branchUniqueness && place.travelerReason && place.validationSignals?.length), "特色連鎖必須說明分店差異與旅客理由");

vm.runInContext(`${fs.readFileSync("prototype/transport-data.js", "utf8")}\nthis.transport = TRANSPORT_REFERENCE;`, context, {filename:"prototype/transport-data.js"});
assert.equal(context.transport.tokyoMetro.fareBands[0].ic, 178, "東京 Metro IC 最低票價應為 ¥178");
assert.equal(context.transport.toeiSubway.fareBands.at(-1).ticket, 430, "都營地下鐵最高紙票級距應為 ¥430");

console.log(JSON.stringify({
  curated: context.curated.length,
  generated: context.generated.length,
  curatedRestaurants: curatedRestaurants.length,
  halfComplete: context.generated.filter(place => place.dataTier === "半成品").length,
  quarantined: context.generated.filter(place => place.dataTier === "無行程參考性").length,
  lowValueChains: context.generated.filter(place => place.isLowValueChain).length,
  finalPlaces: context.finalPlaces.length,
  final80: context.finalPlaces.filter(place => place.completionScore === 80).length,
  final100: context.finalPlaces.filter(place => place.completionScore === 100).length,
}, null, 2));
