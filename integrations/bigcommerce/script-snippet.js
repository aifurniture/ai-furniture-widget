<!--
  OPTION 1: If Script Manager has "HTML" type - paste this ENTIRE file.
  OPTION 2: If "Script" type - paste ONLY the code between script tags.
  Replace YOUR_DOMAIN_ID with your Domain ID from furniture-ai.com/dashboard
-->
<script>
(function(){
  var DOMAIN_ID='YOUR_DOMAIN_ID';
  if(!DOMAIN_ID||DOMAIN_ID==='YOUR_DOMAIN_ID'){console.warn('AI Furniture: Set DOMAIN_ID');return;}
  window.FURNITURE_AI_CONFIG={domain:location.hostname,domainId:DOMAIN_ID,position:'bottom-right',bigCommerceStore:true,productUrl:location.href,productTitle:document.title||''};
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
</script>
