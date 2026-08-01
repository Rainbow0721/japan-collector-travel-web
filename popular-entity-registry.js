(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./entity-resolver'));else root.PopularEntityRegistry=factory(root.EntityResolver)})(typeof globalThis!=='undefined'?globalThis:this,function(EntityResolver){
  const ENTRIES=[
    {entityId:'zojoji',entityType:'PLACE',exactAliases:['增上寺','zojoji'],fuzzyQueries:['東京鐵塔旁邊那座寺','東京鐵塔旁的寺','有德川將軍墓的寺','德川將軍墓的寺'],resolution:'RESOLVED'},
    {entityId:'kaminarimon',entityType:'LANDMARK',exactAliases:['雷門','kaminarimon'],fuzzyQueries:['那個很大的紅燈籠','東京那個大紅燈籠'],resolution:'RESOLVED'},
    {entityId:'shibuya',entityType:'PLACE',exactAliases:['忠犬八公','八公像','hachiko'],fuzzyQueries:['可以看到忠犬八公的地方'],resolution:'RESOLVED'},
    {entityId:'nittele-giant-clock',entityType:'PLACE',exactAliases:['宮崎駿大鐘','日視大時計'],fuzzyQueries:['宮崎駿那個鐘','宮崎駿的鐘'],resolution:'RESOLVED'},
    {entityId:'diver-city-unicorn-gundam',entityType:'PLACE',exactAliases:['獨角獸鋼彈','台場鋼彈'],fuzzyQueries:['東京那個很大的鋼彈'],resolution:'RESOLVED'},
    {entityId:'warner-bros-studio-tour-tokyo',entityType:'PLACE',exactAliases:['東京哈利波特影城','華納兄弟哈利波特影城'],fuzzyQueries:['哈利波特影城不是環球影城'],resolution:'RESOLVED'},
    {entityId:'solamachi',entityType:'PLACE',exactAliases:['東京晴空街道','晴空塔商場','solamachi'],fuzzyQueries:['晴空塔旁邊逛街','晴空塔旁的商場'],resolution:'RESOLVED'},
    {entityType:'PLACE',exactAliases:['東京迪士尼','迪士尼'],candidateEntityIds:['disneyland','disneysea'],candidateLabels:['東京迪士尼樂園','東京迪士尼海洋'],resolution:'AMBIGUOUS'},
    {entityType:'PLACE',exactAliases:['永旺','aeon','aeon mall'],candidateEntityIds:['aeon-mall-makuhari-shintoshin','aeon-laketown','aeon-mall-narita'],candidateLabels:['永旺夢樂城幕張新都心','AEON LakeTown','永旺夢樂城成田'],resolution:'AMBIGUOUS'}
  ];
  const resolver=EntityResolver.create(ENTRIES);
  function resolveKnowledge(text=''){const result=resolver.resolve(text);if(result.status==='UNRESOLVED')return[];return[{...result,input:String(text),registry:'POPULAR_ENTITY_V1'}]}
  return{ENTRIES,resolver,resolveKnowledge};
});
