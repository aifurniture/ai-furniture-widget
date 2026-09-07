# WooCommerce / WordPress install

## Platinum Imports (and any Woo store)

1. Register the storefront hostname in the [AI Furniture dashboard](https://aifurniture.app/dashboard) → copy **Domain ID**.
2. In WordPress, add this before `</body>` (Theme → Theme File Editor → `footer.php`, or a Code Snippets / `wp_footer` hook):

```html
<script
  src="https://cdn.jsdelivr.net/gh/aifurniture/ai-furniture-widget@main/integrations/woocommerce/loader.js?v=1&domainId=YOUR_DOMAIN_ID"
  async
></script>
```

3. Open any **single product** URL (`/product/...`). You should see **See this product in your room**.
4. Category archives (`/product-category/...`) stay clean — the loader only boots on PDPs (or when a generation is already in progress).

### What the loader sends
- `domain` / `domainId` for API auth  
- `productUrl`, `productTitle`, gallery `productImages`  
- `productData.dimensions` when the title/description has sizes like `33" x 22" x 8"`

Backend scrape already understands WooCommerce galleries if images are missing from the page config.

### Code Snippets (JavaScript)

**Important:** Code Snippets often runs JS too early or without `domainId` on the script URL. Set the global first:

```javascript
window.AIFURNITURE_DOMAIN_ID = 'YOUR_DOMAIN_ID';

(function () {
  if (window.__AIFurnitureWooLoader) return;
  window.__AIFurnitureWooLoader = true;

  function inject() {
    var s = document.createElement('script');
    s.src =
      'https://cdn.jsdelivr.net/gh/aifurniture/ai-furniture-widget@main/integrations/woocommerce/loader.js?v=2';
    s.async = true;
    document.head.appendChild(s);
  }

  if (document.head) inject();
  else document.addEventListener('DOMContentLoaded', inject);
})();
```

**Recommended:** use a **PHP snippet** instead (more reliable on WordPress):

```php
add_action('wp_footer', function () {
    if (is_admin()) return;
    $domain_id = 'YOUR_DOMAIN_ID';
    $url = add_query_arg(
        array('v' => '2', 'domainId' => $domain_id),
        'https://cdn.jsdelivr.net/gh/aifurniture/ai-furniture-widget@main/integrations/woocommerce/loader.js'
    );
    echo '<script src="' . esc_url($url) . '" async></script>';
}, 20);
```
```bash
cd ai-furniture-widget
npm run build
npx serve -l 5173 .
# open preview-platinum.html (uses local dist + Platinum theme)
```
