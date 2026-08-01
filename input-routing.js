(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.InputRouting=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const INTENTS=Object.freeze(['TRIP_PLANNING','TRAVEL_QUESTION','TRAVEL_RECOMMENDATION','GENERAL_CHAT','NOISE_OR_PLAYFUL','NEEDS_CLARIFICATION','UNSUPPORTED_OR_IMPOSSIBLE','SAFETY_RESPONSE','SYSTEM_ERROR']);
  const UI_STATES=Object.freeze({IDLE:'IDLE',UNDERSTANDING:'UNDERSTANDING',ANSWERING:'ANSWERING',NEEDS_CONFIRMATION:'NEEDS_CONFIRMATION',PLANNING:'PLANNING',COMPLETED:'COMPLETED',UNAVAILABLE:'UNAVAILABLE'});
  const RESPONSE_POLICY=Object.freeze({
    NOISE_OR_PLAYFUL:{minSentences:1,maxSentences:2},
    GENERAL_CHAT:{minSentences:1,maxSentences:3},
    TRAVEL_QUESTION:{minSentences:1,maxSentences:4},
    TRAVEL_RECOMMENDATION:{minSentences:1,maxSentences:4},
    NEEDS_CLARIFICATION:{minSentences:1,maxSentences:3,maxQuestions:3},
    UNSUPPORTED_OR_IMPOSSIBLE:{minSentences:1,maxSentences:3},
    SAFETY_RESPONSE:{minSentences:1,maxSentences:5},
    SYSTEM_ERROR:{minSentences:1,maxSentences:3}
  });
  function normalize(result){
    if(!result||typeof result!=='object')return{intent:'SYSTEM_ERROR',response:'目前暫時無法理解你的訊息，請稍後再試一次。你的日期與其他設定都已保留。',shouldPlan:false,questions:[],safetyLevel:'UNKNOWN'};
    const intent=INTENTS.includes(result.intent)?result.intent:'SYSTEM_ERROR',policy=RESPONSE_POLICY[intent]||{},questions=Array.isArray(result.questions)?result.questions.filter(Boolean).slice(0,policy.maxQuestions||3):[];
    return{intent,response:String(result.response||'').trim(),shouldPlan:intent==='TRIP_PLANNING'&&result.shouldPlan===true,questions,safetyLevel:String(result.safetyLevel||'SAFE'),reasonCode:String(result.reasonCode||'')};
  }
  function validate(result){
    const value=normalize(result),errors=[];
    if(!INTENTS.includes(value.intent))errors.push('INVALID_INTENT');
    if(value.intent!=='TRIP_PLANNING'&&!value.response)errors.push('EMPTY_RESPONSE');
    if(value.intent!=='TRIP_PLANNING'&&value.shouldPlan)errors.push('NON_PLANNING_ROUTE_CANNOT_PLAN');
    if(value.intent==='TRIP_PLANNING'&&!value.shouldPlan)errors.push('PLANNING_ROUTE_MUST_PLAN');
    if(value.intent==='NEEDS_CLARIFICATION'&&!value.questions.length)errors.push('CLARIFICATION_WITHOUT_QUESTION');
    return{valid:errors.length===0,errors,value};
  }
  function uiStateFor(intent){if(intent==='TRIP_PLANNING')return UI_STATES.PLANNING;if(intent==='NEEDS_CLARIFICATION')return UI_STATES.NEEDS_CONFIRMATION;if(intent==='SYSTEM_ERROR')return UI_STATES.UNAVAILABLE;return UI_STATES.COMPLETED}
  function publicLabel(intent){return({TRIP_PLANNING:'準備規劃',TRAVEL_QUESTION:'旅行小幫手',TRAVEL_RECOMMENDATION:'旅行建議',GENERAL_CHAT:'旅行夥伴',NOISE_OR_PLAYFUL:'旅行夥伴',NEEDS_CLARIFICATION:'想再確認一下',UNSUPPORTED_OR_IMPOSSIBLE:'目前的支援範圍',SAFETY_RESPONSE:'先陪你處理現在的狀況',SYSTEM_ERROR:'暫時無法使用'})[intent]||'旅行夥伴'}
  function clarifyMissingDestination(message=''){
    const text=String(message).trim();
    const hasTravelNeed=/(?:帶|同行|出發|旅遊|旅行|行程|排行程|規劃|想去|要去|想吃|要吃|親子|小孩|兒童|長者|爸媽|媽媽|爸爸|壽司|拉麵|燒肉|景點)/.test(text);
    const hasDestination=/(?:日本|東京|東京都|淺草|浅草|上野|押上|晴空塔|銀座|秋葉原|澀谷|渋谷|新宿|池袋|台場|築地|京都|大阪|奈良|北海道|沖繩|沖縄|福岡|名古屋|廣島|広島|富士山|河口湖|箱根|鎌倉|橫濱|横浜|日光)/i.test(text);
    if(!hasTravelNeed||hasDestination)return null;
    return{intent:'NEEDS_CLARIFICATION',shouldPlan:false,response:'我記住了你的同行者和飲食需求，還需要先確認旅遊地區。',questions:['你想去日本哪個城市或地區？目前淺草一日遊可以直接規劃。'],safetyLevel:'SAFE',reasonCode:'MISSING_DESTINATION'};
  }
  return{INTENTS,UI_STATES,RESPONSE_POLICY,normalize,validate,uiStateFor,publicLabel,clarifyMissingDestination};
});
