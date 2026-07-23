// 官方交通基準（2026-07-24 查核）。這些是票價規則，不是即時班次承諾。
const TRANSPORT_REFERENCE={
  checkedAt:'2026-07-24',
  tokyoMetro:{
    name:'東京 Metro 地鐵普通票',
    sourceUrl:'https://www.tokyometro.jp/lang_en/ticket/types/regular/index.html',
    distanceFactor:1.35,
    fareBands:[
      {maxKm:6,ticket:180,ic:178},{maxKm:11,ticket:210,ic:209},
      {maxKm:19,ticket:260,ic:252},{maxKm:27,ticket:300,ic:293},{maxKm:40,ticket:330,ic:324}
    ]
  },
  toeiSubway:{
    name:'都營地下鐵普通票',
    sourceUrl:'https://www.kotsu.metro.tokyo.jp/subway/fare/regular.html',
    fareBands:[
      {maxKm:4,ticket:180,ic:178},{maxKm:9,ticket:220,ic:220},
      {maxKm:15,ticket:280,ic:272},{maxKm:21,ticket:330,ic:325},
      {maxKm:27,ticket:380,ic:377},{maxKm:46,ticket:430,ic:430}
    ]
  },
  airport:[
    {id:'skyliner-ueno-narita',name:'Skyliner 京成上野／日暮里－成田機場',adultTicket:2580,adultIc:2567,duration:'最快約 36 分鐘（依班次）',sourceUrl:'https://www.keisei.co.jp/keisei/tetudou/skyliner/tc/skyliner/purchase.php'}
  ],
  routeApi:{
    mode:'TRANSIT',status:'尚未接入正式站點與班次',sourceUrl:'https://developers.google.com/maps/documentation/routes'
  }
};

function estimateTransportLeg(from,to){
  const km=distance(from,to);
  if(km<1.2)return{mode:'步行',minutes:Math.max(8,Math.round(km*14)),fare:0,km,confidence:'中'};
  const railKm=Math.max(1,Math.ceil(km*TRANSPORT_REFERENCE.tokyoMetro.distanceFactor));
  const band=TRANSPORT_REFERENCE.tokyoMetro.fareBands.find(item=>railKm<=item.maxKm);
  const fare=band?band.ic:TRANSPORT_REFERENCE.tokyoMetro.fareBands.at(-1).ic;
  return{mode:'大眾運輸',minutes:Math.max(12,Math.round(km*4+8)),fare,km,confidence:'低',railKm};
}
