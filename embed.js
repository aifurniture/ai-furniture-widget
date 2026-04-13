/* AI Furniture Widget - URL loader. Use: <script src=".../embed.js?domain=YOUR_DOMAIN&domainId=YOUR_ID" async></script> */
(function(){
  var s=document.currentScript;
  var q=s?s.src.split('?')[1]||'':'';
  var p=new URLSearchParams(q);
  var domain=p.get('domain');
  var domainId=p.get('domainId');
  if(!domain||!domainId){console.warn('AI Furniture: Add ?domain=YOUR_DOMAIN&domainId=YOUR_ID to script URL');return;}
  window.FURNITURE_AI_CONFIG={domain:domain,domainId:domainId};
  var script=document.createElement('script');
  var WIDGET_CDN_VERSION='17';
  script.src='https://cdn.jsdelivr.net/gh/aifurniture/ai-furniture-widget@main/dist/widget.js?v='+WIDGET_CDN_VERSION;
  script.async=1;
  script.onload=function(){var w=window.AIFurnitureWidget;if(w&&w.initAIFurnitureWidget)w.initAIFurnitureWidget(window.FURNITURE_AI_CONFIG);};
  document.head.appendChild(script);
})();
