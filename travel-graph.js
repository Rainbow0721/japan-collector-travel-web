(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TravelGraph=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create({entities=[],relationships=[]}={}){
    const entityMap=new Map(entities.map(entity=>[entity.id,Object.freeze({...entity})]));
    const edges=relationships.map(edge=>Object.freeze({...edge}));
    function entity(id){return entityMap.get(id)||null}
    function related(id,{type,direction='out'}={}){return edges.filter(edge=>(direction==='out'?edge.from===id:edge.to===id)&&(!type||edge.type===type)).map(edge=>({edge,entity:entity(direction==='out'?edge.to:edge.from)})).filter(item=>item.entity)}
    function neighbors(id,options={}){return related(id,options).map(item=>item.entity)}
    return Object.freeze({entity,related,neighbors,entities:()=>[...entityMap.values()],relationships:()=>[...edges]});
  }
  return{create};
});
