/**
 * Drop-in for WordPress Code Snippets (JavaScript) or footer custom JS.
 * Sets domain ID globally so loader works even when injected dynamically.
 */
window.AIFURNITURE_DOMAIN_ID = 'cmtrefkym0004k304apqz553m';

(function () {
  if (window.__AIFurnitureWooLoader) return;
  window.__AIFurnitureWooLoader = true;

  function inject() {
    var s = document.createElement('script');
    s.src =
      'https://cdn.jsdelivr.net/gh/aifurniture/ai-furniture-widget@main/integrations/woocommerce/loader.js?v=3';
    s.async = true;
    document.head.appendChild(s);
  }

  if (document.head) {
    inject();
  } else {
    document.addEventListener('DOMContentLoaded', inject);
  }
})();
