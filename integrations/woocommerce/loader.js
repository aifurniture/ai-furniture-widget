/**
 * AI Furniture — WooCommerce / WordPress loader.
 *
 * Install (Appearance → Theme File Editor → footer.php before wp_footer, or a
 * Code Snippets plugin / wp_footer hook):
 *
 *   <script
 *     src="https://cdn.jsdelivr.net/gh/aifurniture/ai-furniture-widget@main/integrations/woocommerce/loader.js?v=1&domainId=YOUR_DOMAIN_ID"
 *     async
 *   ></script>
 *
 * Or with local self-host after npm run build — point src at your hosted loader.js.
 */
(function () {
  var params = new URLSearchParams(
    document.currentScript ? document.currentScript.src.split('?')[1] || '' : window.location.search
  );
  var domainId =
    params.get('domainId') ||
    (typeof window.AIFURNITURE_DOMAIN_ID === 'string' && window.AIFURNITURE_DOMAIN_ID) ||
    (window.FURNITURE_AI_CONFIG && window.FURNITURE_AI_CONFIG.domainId) ||
    '';
  if (!domainId) {
    console.warn(
      'AI Furniture: Add ?domainId=YOUR_DOMAIN_ID to the loader URL, or set window.AIFURNITURE_DOMAIN_ID before loading.'
    );
    return;
  }

  function isProductPage() {
    var path = (location.pathname || '').toLowerCase();
    if (/\/product\/[^/?#]+/i.test(path)) return true;
    var body = document.body;
    if (!body) return false;
    var cls = body.className || '';
    if (/\bsingle-product\b/.test(cls)) return true;
    if (/\barchive\b/.test(cls) || /\bproduct-category\b/.test(cls)) return false;
    return !!document.querySelector(
      'form.cart .single_add_to_cart_button, .woocommerce div.product form.cart button.single_add_to_cart_button'
    );
  }

  function collectProductImages() {
    var urls = [];
    var seen = {};
    function add(raw) {
      if (!raw) return;
      var u = String(raw).trim().replace(/-\d+x\d+(\.[a-z]+)$/i, '$1');
      if (!u || seen[u]) return;
      if (!/^https?:\/\//i.test(u) && u.indexOf('//') === 0) u = location.protocol + u;
      if (!/^https?:\/\//i.test(u)) return;
      seen[u] = 1;
      urls.push(u);
    }

    document
      .querySelectorAll(
        '.woocommerce-product-gallery__image img, .woocommerce-product-gallery img, .product .images img, .wp-post-image'
      )
      .forEach(function (img) {
        add(img.getAttribute('data-large_image') || img.getAttribute('data-src') || img.currentSrc || img.src);
        var srcset = img.getAttribute('srcset') || '';
        if (srcset) {
          var best = srcset.split(',').map(function (part) {
            return part.trim().split(/\s+/)[0];
          });
          if (best.length) add(best[best.length - 1]);
        }
      });

    document.querySelectorAll('meta[property="og:image"]').forEach(function (m) {
      add(m.getAttribute('content'));
    });

    return urls.slice(0, 6);
  }

  function productTitle() {
    var el =
      document.querySelector(
        '.product_title, h1.product_title, .product_title.entry-title, .summary h1, h1.entry-title'
      ) || document.querySelector('h1');
    return (el && el.textContent ? el.textContent.trim() : document.title || '').split('|')[0].trim();
  }

  function productDescription() {
    var el =
      document.querySelector(
        '#tab-description, .woocommerce-Tabs-panel--description, .woocommerce-product-details__short-description, .summary .woocommerce-product-details__short-description'
      ) || document.querySelector('.product .description');
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 4000) : '';
  }

  function dimensionsFromText(text) {
    if (!text) return '';
    var m =
      text.match(
        /(\d+(?:[.,]\d+)?)\s*(?:["″”]|in(?:ch(?:es)?)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:["″”]|in(?:ch(?:es)?)?)(?:\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:["″”]|in(?:ch(?:es)?)?))?/i
      ) ||
      text.match(
        /(\d+(?:[.,]\d+)?)\s*cm\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*cm(?:\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*cm)?/i
      );
    return m ? m[0] : '';
  }

  function buildConfig() {
    var title = productTitle();
    var description = productDescription();
    var dims = dimensionsFromText(title + ' ' + description);
    var images = collectProductImages();
    var host = location.hostname.replace(/^www\./, '');

    return {
      domain: host,
      domainId: domainId,
      position: 'bottom-right',
      wooCommerceStore: true,
      productUrl: location.href.split('#')[0],
      productTitle: title,
      productImages: images,
      productData: {
        title: title,
        description: description,
        type: '',
        ...(dims ? { dimensions: dims } : {}),
      },
    };
  }

  function shouldLoadNow() {
    if (window.__AIFurnitureInitialized || window.__AIFurnitureWidgetLoading) return false;
    try {
      var raw = sessionStorage.getItem('ai_furniture_widget_state');
      if (raw) {
        var data = JSON.parse(raw);
        var queue = (data && data.queue) || [];
        for (var i = 0; i < queue.length; i++) {
          var st = queue[i] && queue[i].status;
          if (st === 'PENDING' || st === 'PROCESSING') return true;
        }
      }
    } catch (e) {
      /* ignore */
    }
    return isProductPage();
  }

  function loadWidget() {
    if (window.__AIFurnitureInitialized || window.__AIFurnitureWidgetLoading) return;
    if (!shouldLoadNow()) return;

    window.__AIFurnitureWidgetLoading = true;
    window.FURNITURE_AI_CONFIG = Object.assign({}, window.FURNITURE_AI_CONFIG || {}, buildConfig());

    var WIDGET_CDN_VERSION = '50';
    var s = document.createElement('script');
    s.src =
      'https://cdn.jsdelivr.net/gh/aifurniture/ai-furniture-widget@main/dist/widget.js?v=' +
      WIDGET_CDN_VERSION;
    s.async = true;
    s.onload = function () {
      window.__AIFurnitureWidgetLoading = false;
      var cfg = window.FURNITURE_AI_CONFIG;
      if (window.AIFurnitureWidget && window.AIFurnitureWidget.initAIFurnitureWidget) {
        window.AIFurnitureWidget.initAIFurnitureWidget(cfg);
      } else if (window.initAIFurnitureWidget) {
        window.initAIFurnitureWidget(cfg);
      }
    };
    s.onerror = function () {
      window.__AIFurnitureWidgetLoading = false;
    };
    document.head.appendChild(s);
  }

  function boot() {
    if (shouldLoadNow()) {
      loadWidget();
      return;
    }
    // Category → PDP navigations (some themes are soft-nav)
    var last = location.href;
    setInterval(function () {
      if (location.href === last) return;
      last = location.href;
      if (shouldLoadNow()) loadWidget();
    }, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
