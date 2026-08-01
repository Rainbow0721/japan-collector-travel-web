(function(root){
  if(!root.InputRouting)return;
  root.InputRouting.clarifyMissingDestination=function(message=''){
    const text=String(message).trim();
    const hasTravelNeed=/(?:帶|同行|出發|旅遊|旅行|行程|排行程|規劃|想去|要去|想吃|要吃|親子|小孩|兒童|長者|爸媽|媽媽|爸爸|壽司|拉麵|燒肉|景點)/.test(text);
    const hasDestination=/(?:日本|東京|東京都|淺草|浅草|上野|押上|晴空塔|銀座|秋葉原|澀谷|渋谷|新宿|池袋|台場|築地|京都|大阪|奈良|北海道|沖繩|沖縄|福岡|名古屋|廣島|広島|富士山|河口湖|箱根|鎌倉|橫濱|横浜|日光)/i.test(text);
    if(!hasTravelNeed||hasDestination)return null;
    return{intent:'NEEDS_CLARIFICATION',shouldPlan:false,response:'我記住了你的同行者和飲食需求，還需要先確認旅遊地區。',questions:['你想去日本哪個城市或地區？目前淺草一日遊可以直接規劃。'],safetyLevel:'SAFE',reasonCode:'MISSING_DESTINATION'};
  };
})(typeof globalThis!=='undefined'?globalThis:this);
