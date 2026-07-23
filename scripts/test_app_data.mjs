import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = {};
vm.createContext(context);
vm.runInContext(`${fs.readFileSync("prototype/data.js", "utf8")}\nthis.curated = TOKYO_PLACES;`, context, {filename:"prototype/data.js"});
vm.runInContext(`${fs.readFileSync("prototype/places.generated.js", "utf8")}\nthis.generated = DATABASE_PLACES;`, context, {filename:"prototype/places.generated.js"});

assert.equal(context.curated.length, 69, "人工精選應為 69 筆");
assert.equal(context.generated.length, 1000, "永久候選應為 1,000 筆");
assert.ok(context.curated.every(place => place.name && place.nameJa && place.nameEn && place.desc), "人工精選須具中英日名稱與簡介");
assert.equal(context.generated.filter(place => place.recommendationEligible).length, 0, "未完整候選不得自動推薦");
assert.equal(context.generated.filter(place => place.dataTier === "半成品").length, 575, "半成品數量異常");
assert.equal(context.generated.filter(place => place.dataTier === "無行程參考性").length, 425, "隔離資料數量異常");
assert.equal(context.generated.filter(place => place.isLowValueChain).length, 261, "一般連鎖隔離數量異常");
assert.ok(context.generated.filter(place => place.isLowValueChain).every(place => !place.recommendationEligible), "一般連鎖不得進推薦池");

const curatedRestaurants = context.curated.filter(place => place.category === "特色餐廳");
assert.equal(curatedRestaurants.length, 8, "第一批特色餐廳應為 8 筆");
assert.ok(curatedRestaurants.every(place => place.officialUrl && place.cuisine && place.priceBand), "特色餐廳須有官方來源、料理類型與價位帶");

console.log(JSON.stringify({
  curated: context.curated.length,
  generated: context.generated.length,
  curatedRestaurants: curatedRestaurants.length,
  halfComplete: context.generated.filter(place => place.dataTier === "半成品").length,
  quarantined: context.generated.filter(place => place.dataTier === "無行程參考性").length,
  lowValueChains: context.generated.filter(place => place.isLowValueChain).length,
}, null, 2));
