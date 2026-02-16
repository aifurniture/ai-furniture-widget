/* AI Furniture Widget - BigCommerce loader. Load via: ?domainId=YOUR_DOMAIN_ID */
(function(){
  var params=new URLSearchParams(document.currentScript?document.currentScript.src.split('?')[1]||'':window.location.search);
  var domainId=params.get('domainId');
  if(!domainId){console.warn('AI Furniture: Add ?domainId=YOUR_DOMAIN_ID to script URL');return;}
  window.FURNITURE_AI_CONFIG={domain:location.hostname,domainId:domainId,position:'bottom-right',bigCommerceStore:true,productUrl:location.href,productTitle:document.title||''};
  var h1=document.querySelector('.productView-title,.productView-product h1,h1.productTitle');
  if(h1)window.FURNITURE_AI_CONFIG.productTitle=h1.textContent.trim();
  var s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/gh/aifurniture/ai-furniture-widget@main/dist/widget.js';
  s.async=1;
  s.onload=function(){
    if(window.AIFurnitureWidget&&window.AIFurnitureWidget.initAIFurnitureWidget)window.AIFurnitureWidget.initAIFurnitureWidget(window.FURNITURE_AI_CONFIG);
    else if(window.initAIFurnitureWidget)window.initAIFurnitureWidget(window.FURNITURE_AI_CONFIG);
  };
  document.head.appendChild(s);
})();
