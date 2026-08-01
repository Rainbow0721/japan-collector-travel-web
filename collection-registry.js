/* Versioned travel facts and completeness constraints; never a fixed planner answer. */
const TRAVEL_COLLECTIONS=[{id:'asakusa-shichifukujin',name:'淺草名所七福神',aliases:['淺草七福神','浅草七福神','淺草名所七福神','浅草名所七福神','淺草七福神御朱印','七福神御朱印'],sourceUrl:'https://www.asakusa7.jp/',checkedAt:'2026-08-02',scope:'COMPLETE_COLLECTION',expectedStopCount:9,notes:['名稱雖為七福神，官方巡禮實際包含九處寺社。','全年可巡禮；授與時間與臨時變更應在出發前查各寺社公告。'],places:[
  {id:'asakusa-shrine',name:'淺草神社',nameJa:'浅草神社',deity:'惠比壽',lat:35.71519,lng:139.79745,officialUrl:'https://www.asakusajinja.jp/'},
  {id:'sensoji',name:'淺草寺',nameJa:'浅草寺',deity:'大黑天',lat:35.71477,lng:139.79666,officialUrl:'https://www.senso-ji.jp/'},
  {id:'matsuchiyama-shoden',name:'待乳山聖天 本龍院',nameJa:'待乳山聖天 本龍院',deity:'毘沙門天',lat:35.72146,lng:139.80357,officialUrl:'https://www.matsuchiyama.jp/'},
  {id:'imado-jinja',name:'今戶神社',nameJa:'今戸神社',deity:'福祿壽',lat:35.72421,lng:139.80357,officialUrl:'https://imadojinja1063.crayonsite.net/'},
  {id:'hashiba-fudoin',name:'橋場不動院',nameJa:'橋場不動院',deity:'布袋尊',lat:35.72846,lng:139.80708,officialUrl:'https://www.asakusa7.jp/'},
  {id:'ishihama-jinja',name:'石濱神社',nameJa:'石浜神社',deity:'壽老神',lat:35.73340,lng:139.80868,officialUrl:'https://www.ishihamajinja.jp/'},
  {id:'yoshiwara-jinja',name:'吉原神社',nameJa:'吉原神社',deity:'弁財天',lat:35.72459,lng:139.79405,officialUrl:'https://yoshiwarajinja.tokyo-jinjacho.or.jp/'},
  {id:'otori-jinja',name:'鷲神社',nameJa:'鷲神社',deity:'壽老人',lat:35.72289,lng:139.79176,officialUrl:'https://otorisama.or.jp/'},
  {id:'yasaki-inari-jinja',name:'矢先稻荷神社',nameJa:'矢先稲荷神社',deity:'福祿壽',lat:35.71153,lng:139.78815,officialUrl:'https://www.asakusa7.jp/'}
]}];
function collectionSearchText(value=''){return String(value).toLowerCase().replace(/[\s・]/g,'')}
function resolveTravelCollections(values=[]){const query=(Array.isArray(values)?values:[values]).map(collectionSearchText).filter(Boolean);return TRAVEL_COLLECTIONS.filter(collection=>query.some(value=>[collection.name,...collection.aliases].some(alias=>value.includes(collectionSearchText(alias))||collectionSearchText(alias).includes(value))))}
function collectionPlaceRecord(place,collection){return{id:place.id,name:place.name,nameJa:place.nameJa,nameEn:'',aliases:[],area:'淺草名所七福神',zone:'asakusa',category:'神社寺廟',emoji:'⛩',duration:35,admission:0,cost:0,popularity:86,tags:['御朱印','七福神',collection.name,place.deity,'完整巡禮必訪'],desc:`${collection.name}的${place.deity}札所。完整巡禮九處缺一不可。`,lat:place.lat,lng:place.lng,officialUrl:place.officialUrl,sourceUrl:place.officialUrl,sourceCheckedAt:collection.checkedAt,completionScore:100,dataTier:'P0 收藏知識',curated:true,recommendationEligible:true,requiresLiveCheck:true,collectionId:collection.id,collectionRole:place.deity}}
window.TRAVEL_COLLECTIONS=TRAVEL_COLLECTIONS;window.TravelCollectionRegistry={resolve:resolveTravelCollections,placeRecord:collectionPlaceRecord};
