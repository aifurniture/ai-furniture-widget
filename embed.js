/* AI Furniture Widget - URL loader. Use: <script src=".../embed.js?domain=YOUR_DOMAIN&domainId=YOUR_ID" async></script> */
(function () {
  var s = document.currentScript;
  var q = s ? s.src.split('?')[1] || '' : '';
  var p = new URLSearchParams(q);
  var domain = p.get('domain');
  var domainId = p.get('domainId');
  if (!domain || !domainId) {
    console.warn('AI Furniture: Add ?domain=YOUR_DOMAIN&domainId=YOUR_ID to script URL');
    return;
  }

  window.FURNITURE_AI_CONFIG = { domain: domain, domainId: domainId };

  var WIDGET_CDN_VERSION = '31';
  var WIDGET_SRC =
    'https://cdn.jsdelivr.net/gh/aifurniture/ai-furniture-widget@main/dist/widget.js?v=' +
    WIDGET_CDN_VERSION;

  var NON_PRODUCT_SHOPIFY_TYPES = {
    index: 1,
    home: 1,
    collection: 1,
    'list-collections': 1,
    cart: 1,
    checkout: 1,
    search: 1,
    page: 1,
    blog: 1,
    article: 1
  };

  function getShopifyPageType() {
    try {
      return String(
        (window.ShopifyAnalytics &&
          window.ShopifyAnalytics.meta &&
          window.ShopifyAnalytics.meta.page &&
          window.ShopifyAnalytics.meta.page.pageType) ||
          (window.meta && window.meta.page && window.meta.page.pageType) ||
          ''
      ).toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function isCatalogPath(pathname) {
    var path = String(pathname || '').toLowerCase();
    if (!path || path === '/') return true;
    if (/^\/[a-z]{2}(-[a-z]{2})?\/?$/i.test(path)) return true;
    if (/\/product-category(\/|$)/i.test(path) || /\/product-tag(\/|$)/i.test(path)) return true;
    if (/\/shop\/?$/i.test(path)) return true;

    var markers = [
      '/collections',
      '/catalog',
      '/categories',
      '/search',
      '/cart',
      '/checkout',
      '/account',
      '/pages/',
      '/blog',
      '/blogs/',
      '/about',
      '/contact',
      '/home',
      '/index',
      '/brands',
      '/deals',
      '/tag/',
      '/tags/',
      '/vendor',
      '/vendors',
      '/browse',
      '/store',
      '/listing',
      '/all-products'
    ];

    if (/\/category(\/|$)/i.test(path) && path.indexOf('/product/') === -1) return true;
    if (/\/shop\//i.test(path) && path.indexOf('/product/') === -1) return true;
    if (/\/sale(\/|$)/i.test(path) && path.indexOf('/product/') === -1) return true;

    for (var i = 0; i < markers.length; i++) {
      if (path.indexOf(markers[i]) !== -1) return true;
    }
    if (/^\/products\/?$/i.test(path)) return true;
    return false;
  }

  function isProductDetailPath(pathname) {
    var path = String(pathname || '');
    return (
      /\/products\/[^/?#]+/i.test(path) ||
      /\/product\/[^/?#]+/i.test(path) ||
      /\/p\/[^/?#]+/i.test(path) ||
      /\/item\/[^/?#]+/i.test(path)
    );
  }

  function isWooCommerceProductPage() {
    try {
      var body = document.body;
      if (!body) return false;
      var cls = body.className || '';
      if (/\bsingle-product\b/.test(cls)) return true;
      if (
        document.querySelector(
          'form.cart .single_add_to_cart_button, .woocommerce div.product form.cart'
        )
      ) {
        return isProductDetailPath(window.location.pathname);
      }
    } catch (e) {}
    return false;
  }

  function hasActiveGenerationInStorage() {
    try {
      var raw = sessionStorage.getItem('ai_furniture_widget_state');
      if (!raw) return false;
      var data = JSON.parse(raw);
      var queue = data && data.queue ? data.queue : [];
      for (var i = 0; i < queue.length; i++) {
        var status = queue[i] && queue[i].status;
        if (status === 'PENDING' || status === 'PROCESSING') return true;
      }
    } catch (e) {
      /* ignore */
    }
    return false;
  }

  function shouldLoadWidgetNow() {
    if (window.__AIFurnitureInitialized || window.__AIFurnitureWidgetLoading) return false;
    if (hasActiveGenerationInStorage()) return true;

    var shopifyType = getShopifyPageType();
    if (shopifyType === 'product') return true;
    if (shopifyType && NON_PRODUCT_SHOPIFY_TYPES[shopifyType]) return false;

    var path = window.location.pathname;
    if (isProductDetailPath(path) || isWooCommerceProductPage()) return true;
    if (isCatalogPath(path)) return false;

    return false;
  }

  function loadWidgetBundle() {
    if (window.__AIFurnitureInitialized || window.__AIFurnitureWidgetLoading) return;
    window.__AIFurnitureWidgetLoading = true;

    var script = document.createElement('script');
    script.src = WIDGET_SRC;
    script.async = true;
    script.onload = function () {
      window.__AIFurnitureWidgetLoading = false;
      var w = window.AIFurnitureWidget;
      if (w && w.initAIFurnitureWidget) {
        w.initAIFurnitureWidget(window.FURNITURE_AI_CONFIG);
      }
    };
    script.onerror = function () {
      window.__AIFurnitureWidgetLoading = false;
    };
    document.head.appendChild(script);
  }

  function watchForProductPage() {
    if (window.__AIFurnitureEmbedWatcher) return;
    window.__AIFurnitureEmbedWatcher = true;

    var lastUrl = window.location.href;

    function check() {
      if (window.__AIFurnitureInitialized) return;
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
      }
      if (shouldLoadWidgetNow()) {
        loadWidgetBundle();
      }
    }

    if (!window.__AIFurniturePushStatePatchedEmbed) {
      window.__AIFurniturePushStatePatchedEmbed = true;
      var originalPushState = history.pushState;
      var originalReplaceState = history.replaceState;
      history.pushState = function () {
        originalPushState.apply(history, arguments);
        setTimeout(check, 0);
      };
      history.replaceState = function () {
        originalReplaceState.apply(history, arguments);
        setTimeout(check, 0);
      };
      window.addEventListener('popstate', check);
    }

    [250, 750, 1500, 3000, 5000].forEach(function (ms) {
      setTimeout(check, ms);
    });
  }

  if (shouldLoadWidgetNow()) {
    loadWidgetBundle();
  } else {
    watchForProductPage();
  }
})();
