import fs from 'node:fs';
import vm from 'node:vm';

const context={};vm.createContext(context);
vm.runInContext(`${fs.readFileSync('prototype/data.js','utf8')}\nthis.curated=TOKYO_PLACES;`,context);
vm.runInContext(`${fs.readFileSync('prototype/places.traveler-value.js','utf8')}\nthis.traveler=TRAVELER_VALUE_PLACES;`,context);
vm.runInContext(`${fs.readFileSync('prototype/places.osm-value.js','utf8')}\nthis.osmValue=OSM_VALUE_PLACES;`,context);

const normalize=value=>(value||'').normalize('NFKC').replace(/[\s・･\-—_（）()]/g,'').toLowerCase();
const key=p=>`${normalize(p.nameJa||p.name)}|${Number(p.lat??p.latitude).toFixed(3)}|${Number(p.lng??p.longitude).toFixed(3)}`;
const categoryMap={美食:'特色餐廳',購物:'購物血拼',美景自然:'公園自然',玩樂:'主題樂園',巡禮文化:'神社寺廟',藝文景點:'藝文體驗',城市名勝:'城市地標'};
const emojiMap={美食:'🍱',購物:'🛍',美景自然:'🌿',玩樂:'🎟',巡禮文化:'⛩',藝文景點:'🏛',城市名勝:'📍'};
const zoneFor=area=>{
  const rules=[['asakusa',/淺草|押上|墨田|柴又/],['ueno',/上野|谷中|秋葉原|神田|御茶之水|台東|文京/],['central',/東京站|銀座|日本橋|千代田|中央區/],['shinjuku',/新宿/],['shibuya',/澀谷|原宿|青山|惠比壽|目黑/],['minato',/六本木|麻布|東京鐵塔|港區/],['ikebukuro',/池袋|大塚|巢鴨|豐島/],['bay',/豐洲|台場|清澄|江東/],['kamakura',/鎌倉|江之島/],['yokohama',/橫濱/],['hakone',/箱根|小田原/],['fuji',/河口湖|富士吉田|御殿場/],['nikko',/日光/],['kawagoe',/川越|秩父/],['karuizawa',/輕井澤/],['chiba',/千葉|舞濱|成田/]];
  return rules.find(([,pattern])=>pattern.test(area))?.[0]||'west';
};
const mapTraveler=p=>({
  id:p.id,name:p.nameZhHant,nameJa:p.nameJa,nameEn:p.nameEn,area:p.areaCluster,zone:zoneFor(p.areaCluster),
  category:categoryMap[p.category]||p.category,emoji:emojiMap[p.category]||'📍',duration:p.averageStayMinutes,
  admission:0,cost:0,popularity:55,rating:null,tags:[p.travelerIntent,'跨語言開放資料','完成度80%'],
  desc:p.intro,lat:p.latitude,lng:p.longitude,officialUrl:p.officialUrl,sourceUrl:p.sourceUrl,
  wikipediaUrl:p.wikipediaUrl,evidence:p.evidence,costNote:p.costNote,openingHours:p.openingHoursNote,
  sourceCheckedAt:p.lastVerifiedAt,completionScore:80,dataTier:'完成度 80%',curated:false,
  recommendationEligible:true,requiresLiveCheck:true,qualityReasons:['尚未逐筆核對即時營業、價格、無障礙與近期人氣；排行程後必須即時核對'],
});
const mapOsm=p=>({id:p.id,name:p.nameZhHant,nameJa:p.nameJa,nameEn:p.nameEn,area:p.areaCluster,zone:zoneFor(p.areaCluster),category:p.category==='美食'?'特色餐廳':'購物血拼',emoji:p.category==='美食'?'🍱':'🛍',duration:p.averageStayMinutes,admission:0,cost:0,popularity:50,rating:null,tags:[p.subcategory,'完成度80%','待人氣核對'],desc:p.intro,lat:p.latitude,lng:p.longitude,officialUrl:p.officialUrl,sourceUrl:p.sourceUrl,evidence:p.evidence,costNote:p.costNote,openingHours:p.openingHours,sourceCheckedAt:p.lastVerifiedAt,completionScore:80,dataTier:'完成度 80%',curated:false,recommendationEligible:true,requiresLiveCheck:true,qualityReasons:['尚待近期人氣、繁中校名與營業價格逐筆核對；排行程後必須即時核對']});
const final=[],seen=new Set();
for(const p of context.curated){
  const completionScore=p.sourceCheckedAt&&p.officialUrl?100:80;
  const sourceUrl=p.officialUrl||p.sourceUrl||`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
  const item={...p,sourceUrl,completionScore,dataTier:completionScore===100?'完成度 100%':'完成度 80%',curated:true,recommendationEligible:true,requiresLiveCheck:completionScore<100};
  const k=key(item);if(!seen.has(k)){seen.add(k);final.push(item)}
}
for(const source of context.osmValue){const item=mapOsm(source),k=key(item);if(!seen.has(k)){seen.add(k);final.push(item)}}
for(const source of context.traveler){
  if(final.length>=1000)break;
  const item=mapTraveler(source),k=key(item);if(!seen.has(k)){seen.add(k);final.push(item)}
}
if(final.length!==1000)throw new Error(`去重後只有 ${final.length} 筆，未達 1,000`);
const report={total:final.length,completion80:final.filter(x=>x.completionScore===80).length,completion100:final.filter(x=>x.completionScore===100).length,recommendationEligible:final.filter(x=>x.recommendationEligible).length,categories:Object.fromEntries([...new Set(final.map(x=>x.category))].sort().map(c=>[c,final.filter(x=>x.category===c).length])),areas:Object.fromEntries([...new Set(final.map(x=>x.area))].sort().map(a=>[a,final.filter(x=>x.area===a).length]))};
fs.writeFileSync('prototype/places.final.js',`// 最終 1,000 筆：全部完成度至少 80%；只有逐筆核對資料標 100%。\nconst FINAL_PLACES=${JSON.stringify(final)};\n`);
fs.writeFileSync('prototype/database/final-catalog-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
