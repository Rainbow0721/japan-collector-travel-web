(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.InputRouting=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const INTENTS=Object.freeze(['TRIP_PLANNING','TRAVEL_QUESTION','TRAVEL_RECOMMENDATION','GENERAL_CHAT','NOISE_OR_PLAYFUL','NEEDS_CLARIFICATION','UNSUPPORTED_OR_IMPOSSIBLE','SAFETY_RESPONSE','SYSTEM_ERROR']);
  const UI_STATES=Object.freeze({IDLE:'IDLE',UNDERSTANDING:'UNDERSTANDING',ANSWERING:'ANSWERING',NEEDS_CONFIRMATION:'NEEDS_CONFIRMATION',PLANNING:'PLANNING',COMPLETED:'COMPLETED',UNAVAILABLE:'UNAVAILABLE'});
  const RESPONSE_POLICY=Object.freeze({
    NOISE_OR_PLAYFUL:{minSentences:1,maxSentences:2},
    GENERAL_CHAT:{minSentences:1,maxSentences:3},
    TRAVEL_QUESTION:{minSentences:1,maxSentences:4},
    TRAVEL_RECOMMENDATION:{minSentences:1,maxSentences:4},
    NEEDS_CLARIFICATION:{minSentences:1,maxSentences:3,maxQuestions:1},
    UNSUPPORTED_OR_IMPOSSIBLE:{minSentences:1,maxSentences:3},
    SAFETY_RESPONSE:{minSentences:1,maxSentences:5},
    SYSTEM_ERROR:{minSentences:1,maxSentences:3}
  });
  function normalize(result){
    if(!result||typeof result!=='object')return{action:'SYSTEM_ERROR',intent:'SYSTEM_ERROR',displayText:'目前暫時無法理解你的訊息，請稍後再試一次。你的日期與其他設定都已保留。',response:'目前暫時無法理解你的訊息，請稍後再試一次。你的日期與其他設定都已保留。',expectedInput:'',shouldPlan:false,questions:[],safetyLevel:'UNKNOWN'};
    const intent=INTENTS.includes(result.intent)?result.intent:'SYSTEM_ERROR',displayText=String(result.displayText||'').trim(),expectedInput=String(result.expectedInput||'').trim();
    return{action:String(result.action||'SYSTEM_ERROR'),intent,displayText,response:displayText,expectedInput,shouldPlan:intent==='TRIP_PLANNING'&&result.shouldPlan===true,questions:[],safetyLevel:String(result.safetyLevel||'SAFE'),reasonCode:String(result.reasonCode||''),planningAction:String(result.planningAction||'NONE'),planningActionEvidence:String(result.planningActionEvidence||''),retainedHardConstraints:Array.isArray(result.retainedHardConstraints)?result.retainedHardConstraints.filter(Boolean):[]};
  }
  function validate(result){
    const value=normalize(result),errors=[];
    if(!INTENTS.includes(value.intent))errors.push('INVALID_INTENT');
    if(value.intent!=='TRIP_PLANNING'&&!value.displayText)errors.push('EMPTY_DISPLAY_TEXT');
    if(value.intent!=='TRIP_PLANNING'&&value.shouldPlan)errors.push('NON_PLANNING_ROUTE_CANNOT_PLAN');
    if(value.intent==='TRIP_PLANNING'&&!value.shouldPlan)errors.push('PLANNING_ROUTE_MUST_PLAN');
    if(value.action==='ASK'&&!value.expectedInput)errors.push('ASK_WITHOUT_EXPECTED_INPUT');
    if(['PLAN','MODIFY'].includes(value.action)&&!value.shouldPlan)errors.push('PLANNING_ACTION_CANNOT_SKIP_PLANNER');
    if(value.shouldPlan&&(value.displayText||value.expectedInput))errors.push('PLANNING_ACTION_MUST_NOT_RENDER_DUPLICATE_TEXT');
    return{valid:errors.length===0,errors,value};
  }
  function uiStateFor(intent){if(intent==='TRIP_PLANNING')return UI_STATES.PLANNING;if(intent==='NEEDS_CLARIFICATION')return UI_STATES.NEEDS_CONFIRMATION;if(intent==='SYSTEM_ERROR')return UI_STATES.UNAVAILABLE;return UI_STATES.COMPLETED}
  function publicLabel(intent){return({TRIP_PLANNING:'準備規劃',TRAVEL_QUESTION:'旅行小幫手',TRAVEL_RECOMMENDATION:'旅行建議',GENERAL_CHAT:'旅行夥伴',NOISE_OR_PLAYFUL:'旅行夥伴',NEEDS_CLARIFICATION:'想再確認一下',UNSUPPORTED_OR_IMPOSSIBLE:'目前的支援範圍',SAFETY_RESPONSE:'先陪你處理現在的狀況',SYSTEM_ERROR:'暫時無法使用'})[intent]||'旅行夥伴'}
  return{INTENTS,UI_STATES,RESPONSE_POLICY,normalize,validate,uiStateFor,publicLabel};
});
