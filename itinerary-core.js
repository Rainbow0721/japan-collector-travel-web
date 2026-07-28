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
      if(day.dayType==='full'&&day.items.length<2)errors.push(validationError('UNDERFILLED_FULL_DAY',expected,`Day ${expected} is a full travel day with fewer than 2 activities`));
      day.items.forEach((item,itemIndex)=>{
        if(!item||typeof item!=='object')errors.push(validationError('INVALID_ITEM',expected,`Day ${expected} item ${itemIndex+1} is invalid`));
        else if(!item.placeId||!item.category||!Number.isFinite(item.estimatedDuration)||!item.openingHoursStatus||item.travelFromPrevious==null)errors.push(validationError('INVALID_ITEM_SCHEMA',expected,`Day ${expected} item ${itemIndex+1} is missing required fields`));
      });
    }
    return{valid:errors.length===0,errors};
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
  return{validateItinerary,classifyChatIntent,resolveDayReference};
});
