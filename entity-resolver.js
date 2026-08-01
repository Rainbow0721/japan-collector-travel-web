(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EntityResolver=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const VARIANTS={'浅':'淺','観':'觀','门':'門','寺庙':'寺廟'};
  function normalize(value=''){return Object.entries(VARIANTS).reduce((text,[from,to])=>text.split(from).join(to),String(value).normalize('NFKC').trim().toLowerCase()).replace(/[\s・\-_]/g,'')}
  function create(entries=[]){
    const exact=new Map(),fuzzy=[];
    for(const entry of entries){for(const alias of entry.exactAliases||[]){const key=normalize(alias),prior=exact.get(key)||[];if(!prior.includes(entry))exact.set(key,[...prior,entry])}for(const query of entry.fuzzyQueries||[])fuzzy.push({key:normalize(query),entry})}
    function resolve(input){const key=normalize(input),hits=exact.get(key)||[];if(hits.length===1)return{status:hits[0].resolution||'RESOLVED',confidence:1,entityId:hits[0].entityId,entityType:hits[0].entityType,source:'EXACT_ALIAS'};if(hits.length>1)return{status:'AMBIGUOUS',confidence:1,candidates:hits.map(item=>item.entityId).filter(Boolean),source:'EXACT_ALIAS'};const contained=[...exact.entries()].filter(([alias])=>alias.length>=2&&key.includes(alias)).flatMap(([,values])=>values);const unique=[...new Map(contained.map(item=>[item.entityId||JSON.stringify(item.candidateEntityIds),item])).values()];if(unique.length===1)return{status:unique[0].resolution||'RESOLVED',confidence:.92,entityId:unique[0].entityId,entityType:unique[0].entityType,source:'CONTAINED_ALIAS'};const fuzzyHit=fuzzy.find(item=>key.includes(item.key)||item.key.includes(key));if(fuzzyHit)return{status:fuzzyHit.entry.resolution||'RESOLVED',confidence:.82,entityId:fuzzyHit.entry.entityId,entityType:fuzzyHit.entry.entityType,source:'CURATED_FUZZY'};return{status:'UNRESOLVED',confidence:0,entityId:null,source:'NONE'}}
    return Object.freeze({resolve,normalize});
  }
  return{create,normalize};
});
