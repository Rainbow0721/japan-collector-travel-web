import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = {};
vm.createContext(context);
vm.runInContext(`${fs.readFileSync("prototype/data.js", "utf8")}\nthis.curated = TOKYO_PLACES;`, context, {filename:"prototype/data.js"});
vm.runInContext(`${fs.readFileSync("prototype/places.generated.js", "utf8")}\nthis.generated = DATABASE_PLACES;`, context, {filename:"prototype/places.generated.js"});

assert.equal(context.curated.length, 110, "人工精選應為 110 筆");
assert.equal(context.generated.length, 1000, "永久候選應為 1,000 筆");
assert.ok(context.curated.every(place => place.name && place.nameJa && place.nameEn && place.desc), "人工精選須具中英日名稱與簡介");
assert.equal(context.generated.filter(place => place.recommendationEligible).length, 0, "未完整候選不得自動推薦");
assert.equal(context.generated.filter(place => place.dataTier === "半成品").length, 267, "半成品數量異常");
assert.equal(context.generated.filter(place => place.dataTier === "無行程參考性").length, 733, "隔離資料數量異常");
assert.equal(context.generated.filter(place => place.isLowValueChain).length, 261, "一般連鎖隔離數量異常");
assert.ok(context.generated.filter(place => place.isLowValueChain).every(place => !place.recommendationEligible), "一般連鎖不得進推薦池");

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
}, null, 2));
