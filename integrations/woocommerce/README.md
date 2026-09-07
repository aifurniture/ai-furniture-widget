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

### Local test
```bash
cd ai-furniture-widget
npm run build
npx serve -l 5173 .
# open preview-platinum.html (uses local dist + Platinum theme)
```
