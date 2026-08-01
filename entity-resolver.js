(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EntityResolver=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const VARIANTS={'浅':'淺','観':'觀','门':'門','寺庙':'寺廟'};
  function normalize(value=''){return Object.entries(VARIANTS).reduce((text,[from,to])=>text.split(from).join(to),String(value).normalize('NFKC').trim().toLowerCase()).replace(/[\s・\-_]/g,'')}
  function create(entries=[]){
    const exact=new Map(),fuzzy=[];
    for(const entry of entries){for(const alias of entry.exactAliases||[]){const key=normalize(alias),prior=exact.get(key)||[];if(!prior.includes(entry))exact.set(key,[...prior,entry])}for(const query of entry.fuzzyQueries||[])fuzzy.push({key:normalize(query),entry})}
    function result(entry,confidence,source){return{status:entry.resolution||'RESOLVED',confidence,entityId:entry.entityId||null,entityType:entry.entityType,candidates:[...(entry.candidateEntityIds||[])],candidateLabels:[...(entry.candidateLabels||[])],source}}
    function resolve(input){const key=normalize(input),hits=exact.get(key)||[];if(hits.length===1)return result(hits[0],1,'EXACT_ALIAS');if(hits.length>1)return{status:'AMBIGUOUS',confidence:1,candidates:hits.flatMap(item=>item.entityId?[item.entityId]:(item.candidateEntityIds||[])).filter(Boolean),source:'EXACT_ALIAS'};const fuzzyHit=fuzzy.find(item=>key.includes(item.key)||item.key.includes(key));if(fuzzyHit)return result(fuzzyHit.entry,.96,'CURATED_DESCRIPTIVE_CLUE');const contained=[...exact.entries()].filter(([alias])=>alias.length>=2&&key.includes(alias)).flatMap(([,values])=>values);const unique=[...new Map(contained.map(item=>[item.entityId||JSON.stringify(item.candidateEntityIds),item])).values()];if(unique.length===1)return result(unique[0],.92,'CONTAINED_ALIAS');if(unique.length>1)return{status:'AMBIGUOUS',confidence:.85,candidates:unique.flatMap(item=>item.entityId?[item.entityId]:(item.candidateEntityIds||[])).filter(Boolean),source:'MULTIPLE_CONTAINED_ALIASES'};return{status:'UNRESOLVED',confidence:0,entityId:null,candidates:[],source:'NONE'}}
    return Object.freeze({resolve,normalize});
  }
  return{create,normalize};
});
