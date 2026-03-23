/* AI Furniture Widget - BigCommerce loader. Load via: ?domainId=YOUR_DOMAIN_ID */
(function(){
  var params=new URLSearchParams(document.currentScript?document.currentScript.src.split('?')[1]||'':window.location.search);
  var domainId=params.get('domainId');
  if(!domainId){console.warn('AI Furniture: Add ?domainId=YOUR_DOMAIN_ID to script URL');return;}
  window.FURNITURE_AI_CONFIG={domain:location.hostname,domainId:domainId,position:'bottom-right',bigCommerceStore:true,productUrl:location.href,productTitle:document.title||''};
  var h1=document.querySelector('.productView-title,.productView-product h1,h1.productTitle');
  if(h1)window.FURNITURE_AI_CONFIG.productTitle=h1.textContent.trim();
  var s=document.createElement('script');
  // Cache-bust to ensure users always get the latest widget bundle from jsDelivr
  // (helps when a browser caches an older dist/widget.js)
  var cacheBust = Date.now();
  // Use a fixed commit to avoid jsDelivr/@main caching lag.
  // (If you change widget code again, update this SHA in loader.js.)
  var widgetCommit = '65137c862d3fe792e446f3070b0208b8cf84a5e1';
  s.src='https://cdn.jsdelivr.net/gh/aifurniture/ai-furniture-widget@' + widgetCommit + '/dist/widget.js?t=' + cacheBust;
  s.async=1;
  s.onload=function(){
    if(window.AIFurnitureWidget&&window.AIFurnitureWidget.initAIFurnitureWidget)window.AIFurnitureWidget.initAIFurnitureWidget(window.FURNITURE_AI_CONFIG);
    else if(window.initAIFurnitureWidget)window.initAIFurnitureWidget(window.FURNITURE_AI_CONFIG);
  };
  document.head.appendChild(s);
})();
