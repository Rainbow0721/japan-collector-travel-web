(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ItineraryCore=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const CHINESE_NUMBERS={一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
  const DAY_TYPES=new Set(['full','arrival','departure']);
  function validationError(code,dayNumber,message){return{code,dayNumber,message}}
  function validateItinerary(plan){
    const errors=[];
    if(!plan||typeof plan!=='object')return{valid:false,errors:[validationError('INVALID_PLAN',null,'Itinerary must be an object')]};
    const tripDays=Number(plan.tripDays);
    if(!Number.isInteger(tripDays)||tripDays<1)errors.push(validationError('INVALID_TRIP_DAYS',null,'tripDays must be a positive integer'));
    if(!Array.isArray(plan.days)){errors.push(validationError('INVALID_DAYS',null,'days must be an array'));return{valid:false,errors}}
    if(Number.isInteger(tripDays)&&plan.days.length!==tripDays)errors.push(validationError('DAY_COUNT_MISMATCH',null,`Expected ${tripDays} days but received ${plan.days.length}`));
    const seen=new Set();
    for(let index=0;index<Math.max(tripDays||0,plan.days.length);index++){
      const day=plan.days[index],expected=index+1;
      if(!day){errors.push(validationError('MISSING_DAY',expected,`Day ${expected} is missing`));continue}
      if(day.dayNumber!==expected)errors.push(validationError('NON_SEQUENTIAL_DAY',expected,`Expected dayNumber ${expected} but received ${day.dayNumber}`));
      if(seen.has(day.dayNumber))errors.push(validationError('DUPLICATE_DAY_NUMBER',day.dayNumber,`dayNumber ${day.dayNumber} is duplicated`));
      seen.add(day.dayNumber);
      if(typeof day.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day.date))errors.push(validationError('INVALID_DATE',expected,`Day ${expected} has no valid date`));
      if(!DAY_TYPES.has(day.dayType))errors.push(validationError('INVALID_DAY_TYPE',expected,`Day ${expected} requires full, arrival, or departure dayType`));
      if(typeof day.startTime!=='string'||typeof day.endTime!=='string')errors.push(validationError('INVALID_DAY_TIME',expected,`Day ${expected} requires startTime and endTime`));
      if(!Array.isArray(day.items)||day.items.length===0){errors.push(validationError('EMPTY_DAY',expected,`Day ${expected} has no valid itinerary items`));continue}
      const isFullDayAnchor=day.items.length===1&&Number(day.items[0]?.estimatedDuration)>=480;
      if(day.dayType==='full'&&day.items.length<2&&!isFullDayAnchor)errors.push(validationError('UNDERFILLED_FULL_DAY',expected,`Day ${expected} is a full travel day with fewer than 2 activities`));
      day.items.forEach((item,itemIndex)=>{
        if(!item||typeof item!=='object')errors.push(validationError('INVALID_ITEM',expected,`Day ${expected} item ${itemIndex+1} is invalid`));
        else if(!item.placeId||!item.category||!Number.isFinite(item.estimatedDuration)||!item.openingHoursStatus||item.travelFromPrevious==null)errors.push(validationError('INVALID_ITEM_SCHEMA',expected,`Day ${expected} item ${itemIndex+1} is missing required fields`));
      });
    }
    return{valid:errors.length===0,errors};
  }
  function validateSeniorTravel(plan,options={}){
    const errors=[],days=plan?.days||[],religiousPrimary=Boolean(options.religiousPrimary);
    for(const day of days){
      const items=day?.items||[],n=day?.dayNumber||null;
      if(items.length>5)errors.push(validationError('SENIOR_DAILY_ACTIVITY_CAP',n,`Day ${n} has ${items.length} activities; senior cap is 5`));
      const main=items.filter(item=>!/(餐廳|美食|休息|咖啡)/.test(`${item.category||''}${item.name||''}`));
      if(main.length>3)errors.push(validationError('SENIOR_MAIN_PLACE_CAP',n,`Day ${n} has ${main.length} main places; senior cap is 3`));
      if(day?.endTime&&day.endTime>'20:30'&&day.endTime<'23:59')errors.push(validationError('SENIOR_LATE_END',n,`Day ${n} ends at ${day.endTime}; default senior limit is 20:30`));
      let run=0,maxRun=0;for(const item of items){if(item.category==='神社寺廟'){run++;maxRun=Math.max(maxRun,run)}else run=0}
      if(!religiousPrimary&&maxRun>=3)errors.push(validationError('RELIGIOUS_CATEGORY_REPETITION',n,`Day ${n} has ${maxRun} consecutive religious sites`));
      const walk=Number(options.dailyWalkingKm?.[n-1]);if(Number.isFinite(walk)&&walk>5)errors.push(validationError('SENIOR_WALKING_CAP',n,`Day ${n} walking ${walk.toFixed(1)} km exceeds 5 km`));
    }
    const all=days.flatMap(day=>day?.items||[]),religious=all.filter(item=>item.category==='神社寺廟').length,ratio=all.length?religious/all.length:0;
    if(!religiousPrimary&&ratio>.3)errors.push(validationError('RELIGIOUS_CATEGORY_RATIO',null,`Religious-site ratio ${(ratio*100).toFixed(1)}% exceeds 30%`));
    return{valid:errors.length===0,errors,metrics:{dayActivityCounts:days.map(day=>day?.items?.length||0),religiousCount:religious,totalActivities:all.length,religiousRatio:ratio}};
  }
  function classifyChatIntent(text){
    const value=String(text||'').trim();
    if(!value)return'AMBIGUOUS';
    if(/這什麼爛|亂排|很爛|不合理|搞什麼/.test(value))return'COMPLAINT';
    if(/^(為什麼|爲什麼|怎麼會|怎麼是|怎麼沒有|為何)/.test(value))return'EXPLANATION';
    if(/[？?]$/.test(value))return'QUESTION';
    if(/(?:現在|目前).*(?:哪些|幾個|有什麼|進度)|(?:Day|第).*(?:有哪些|幾個|現在)|行程.*(?:狀態|進度)/i.test(value))return'STATUS';
    if(/整(?:份|趟).*(?:重排|重新)|重新(?:生成|安排|排)(?:整|全)/.test(value))return'REPLAN_TRIP';
    if(/重新(?:生成|安排|排)|補排|補上/.test(value))return'REPLAN_DAY';
    if(/刪除|移除/.test(value))return'REMOVE_ITEM';
    if(/換成|取代|替換/.test(value))return'REPLACE_ITEM';
    if(/移到|改到|調到|順序/.test(value))return'MOVE_ITEM';
    if(/加入|新增|增加/.test(value))return'ADD_ITEM';
    if(/不要太累|好累|太累|放鬆|減少|睡到中午|下午再出門/.test(value))return'CHANGE_PACE';
    return'AMBIGUOUS';
  }
  function resolveDayReference(text,context={}){
    const value=String(text||''),tripDays=Number(context.tripDays)||0,dates=context.dates||[];
    let dayNumber=null,source=null;
    const english=value.match(/\bday\s*(\d{1,2})\b/i);if(english){dayNumber=Number(english[1]);source='explicit'}
    if(dayNumber==null){const numeric=value.match(/第\s*(\d{1,2})\s*天/);if(numeric){dayNumber=Number(numeric[1]);source='explicit'}}
    if(dayNumber==null){const chinese=value.match(/第\s*([一二三四五六七八九十])\s*天/);if(chinese){dayNumber=CHINESE_NUMBERS[chinese[1]];source='explicit'}}
    if(dayNumber==null&&/最後一天|旅行最後一天/.test(value)){dayNumber=tripDays;source='last'}
    if(dayNumber==null){const date=value.match(/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/);if(date){const iso=`${date[1]}-${String(date[2]).padStart(2,'0')}-${String(date[3]).padStart(2,'0')}`,index=dates.indexOf(iso);if(index>=0){dayNumber=index+1;source='date'}else return{resolved:false,dayIndex:null,dayNumber:null,source:'date',error:'DATE_OUTSIDE_TRIP'}}}
    if(dayNumber==null&&/明天/.test(value)){dayNumber=(Number(context.currentTravelDayNumber)||Number(context.activeDayNumber)||1)+1;source='tomorrow'}
    if(dayNumber==null&&/今天|今日/.test(value)){dayNumber=Number(context.currentTravelDayNumber)||Number(context.activeDayNumber)||null;source='today'}
    if(dayNumber==null)return{resolved:false,dayIndex:null,dayNumber:null,source:null,error:'NO_DAY_REFERENCE'};
    if(dayNumber<1||dayNumber>tripDays)return{resolved:false,dayIndex:null,dayNumber,source,error:'DAY_OUT_OF_RANGE'};
    return{resolved:true,dayIndex:dayNumber-1,dayNumber,source,error:null};
  }
  function createConversationState(){return{activeIntent:null,pendingAction:null,missingSlots:[],selectedDay:null,selectedItem:null,lastAssistantQuestion:null,lastUserComplaint:null}}
  function classifyChatDecision(text,context={},conversation=createConversationState()){
    const value=String(text||'').trim(),day=resolveDayReference(value,context),selectedDay=day.resolved?day.dayNumber:conversation.selectedDay;
    const result={primaryIntent:null,secondaryIntent:null,confidence:.9,sentiment:'NEUTRAL',targetDay:selectedDay||null,targetItem:null,modificationType:null,category:null,pace:null,preferences:[],missingSlots:[],shouldModifyNow:false,shouldAskClarification:false,clarificationQuestion:null};
    const angry=/幹你|他媽|靠北|垃圾|爛行程|爛安排|什麼鬼|亂排/.test(value),hasProblem=/(?:day\s*\d|第.+天).*(?:沒|空|錯|根本)|(?:沒行程|沒有行程)/i.test(value);
    if(angry){result.sentiment='ANGRY';result.primaryIntent=hasProblem?'COMPLAINT':'EXPRESS_FRUSTRATION';result.secondaryIntent=hasProblem?'ASK_QUESTION':null;result.confidence=.98;if(hasProblem){result.shouldAskClarification=false}else{result.shouldAskClarification=true;result.clarificationQuestion='看來我這次真的排得很差。你最不滿意哪一天或哪個安排？我先幫你修。'}return result}
    if(!value||/^[\sㄅ-ㄩ˙ˊˇˋ]+$/.test(value)){result.primaryIntent='NONSENSE';result.confidence=.98;result.shouldAskClarification=true;result.clarificationQuestion='我沒看懂這段內容。你可以直接說「第三天輕鬆一點」、「增加購物」，或告訴我哪個景點不想去。';return result}
    if(/我愛你|聊聊天|你是誰/.test(value)){result.primaryIntent='CASUAL_CHAT';result.shouldAskClarification=false;return result}
    if(/為什麼|為何|怎麼會|怎麼沒有|根本沒排/.test(value)){result.primaryIntent='ASK_QUESTION';result.confidence=.96;return result}
    const modify=/修改行程|改行程|幫我改|幫我調|調一下|重弄|重新安排|不要這個|增加|新增|刪掉|移除|換一個|對調|移晚|太累|輕鬆|晚點出門|想逛街|買東西|大買特買|不要排神社|不想一直/.test(value)||conversation.activeIntent==='MODIFY_ITINERARY';
    if(modify){result.primaryIntent='MODIFY_ITINERARY';result.confidence=.97;if(/增加|新增|多一點|想逛街|買東西|大買特買/.test(value))result.modificationType='ADD_CATEGORY';if(/購物|逛街|買東西|大買特買/.test(value)){result.category='SHOPPING';result.modificationType=result.modificationType||'SHOPPING_FOCUS'}if(/刪掉|移除|不要這個/.test(value))result.modificationType='REMOVE_ITEM';if(/輕鬆|太累|走不動|晚點出門/.test(value)){result.modificationType='CHANGE_PACE';result.pace='RELAXED'}if(/重新安排|重弄/.test(value))result.modificationType='REPLAN_DAY';if(/不要排神社|不想一直看神社/.test(value))result.preferences.push('AVOID_SHRINE');if(!result.targetDay)result.missingSlots.push('targetDay');if(!result.modificationType)result.missingSlots.push('modificationType');result.shouldModifyNow=result.missingSlots.length===0;result.shouldAskClarification=!result.shouldModifyNow;if(result.missingSlots.includes('targetDay'))result.clarificationQuestion=result.modificationType==='REMOVE_ITEM'?'你想刪掉目前選取的景點，還是哪一天裡的某個景點？':result.modificationType?'想加在哪一天？也可以由我選擇最順路、最不影響原行程的一天。':'可以。你想改某一天，還是整趟行程？';else if(result.missingSlots.includes('modificationType'))result.clarificationQuestion=`第 ${result.targetDay} 天想怎麼改？可以調輕鬆、增加購物、換景點或重新安排。`;return result}
    if(day.resolved){result.primaryIntent='AMBIGUOUS';result.targetDay=day.dayNumber;result.shouldAskClarification=true;result.clarificationQuestion=`你想查看第 ${day.dayNumber} 天，還是修改這一天？`;return result}
    if(/這什麼|不合理|不喜歡|有問題/.test(value)){result.primaryIntent='COMPLAINT';result.shouldAskClarification=true;result.clarificationQuestion='是行程太趕、景點不喜歡、交通太遠，還是哪一天特別有問題？';return result}
    result.primaryIntent='AMBIGUOUS';result.shouldAskClarification=true;result.clarificationQuestion='你是想查看目前行程，還是調整其中一部分？';return result;
  }
  function advanceConversation(state,decision){const next={...createConversationState(),...state};next.activeIntent=decision.primaryIntent==='MODIFY_ITINERARY'?'MODIFY_ITINERARY':decision.shouldModifyNow?null:next.activeIntent;next.pendingAction=decision.modificationType||next.pendingAction;next.missingSlots=[...decision.missingSlots];next.selectedDay=decision.targetDay||next.selectedDay;next.selectedItem=decision.targetItem||next.selectedItem;next.lastAssistantQuestion=decision.clarificationQuestion||null;if(['COMPLAINT','EXPRESS_FRUSTRATION'].includes(decision.primaryIntent))next.lastUserComplaint=true;return next}
  return{validateItinerary,validateSeniorTravel,classifyChatIntent,classifyChatDecision,createConversationState,advanceConversation,resolveDayReference};
});
