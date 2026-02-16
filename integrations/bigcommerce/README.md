# AI Furniture Widget – BigCommerce

Use the same widget and CDN as Shopify. Loads from GitHub via jsDelivr.

## Recommended: External URL (avoids "Enter a valid script" error)

1. **BigCommerce Admin** → **Storefront** → **Script Manager**
2. **Create a Script**
3. Choose **"Load a script from a URL"** (or External / Script URL)
4. **Script URL:**  
   `https://cdn.jsdelivr.net/gh/aifurniture/ai-furniture-widget@main/integrations/bigcommerce/loader.js?domainId=YOUR_DOMAIN_ID`  
   Replace `YOUR_DOMAIN_ID` with your ID from [furniture-ai.com/dashboard](https://furniture-ai.com/dashboard)
5. **Location:** Footer | **Pages:** Storefront
6. Save

This uses only a URL, so it avoids validation issues with inline scripts.

## Alternative: Inline script

If you must use inline scripts, use `script-snippet.js`:
- **HTML type:** Paste the whole file (including `<script>` tags)
- **Script type:** Paste only the code between the `<script>` tags

If you see "Enter a valid script", use the External URL method above.

## Alternative: theme template (Stencil)

To use Handlebars variables on product pages, add this to your product template (e.g. `templates/pages/product.html`), before `{{/partial}}`:

```html
{{#if product}}
<script>
window.FURNITURE_AI_CONFIG = {
  domain: '{{settings.store_domain}}',
  domainId: 'YOUR_DOMAIN_ID',
  position: 'bottom-right',
  bigCommerceStore: true,
  productId: {{product.id}},
  productTitle: "{{{product.name}}}",
  productUrl: window.location.href
};
</script>
<script src="https://cdn.jsdelivr.net/gh/aifurniture/ai-furniture-widget@main/dist/widget.js" async></script>
<script>
(function check() {
  if (window.AIFurnitureWidget && window.AIFurnitureWidget.initAIFurnitureWidget) {
    window.AIFurnitureWidget.initAIFurnitureWidget(window.FURNITURE_AI_CONFIG);
  } else {
    setTimeout(check, 50);
  }
})();
</script>
{{/if}}
```

Replace `YOUR_DOMAIN_ID` with your Domain ID. Stencil variable names may differ by theme; adjust as needed.

## Purge CDN cache

After pushing updates: [jsdelivr.com/tools/purge](https://www.jsdelivr.com/tools/purge)  
URL: `https://cdn.jsdelivr.net/gh/aifurniture/ai-furniture-widget@main/dist/widget.js`
