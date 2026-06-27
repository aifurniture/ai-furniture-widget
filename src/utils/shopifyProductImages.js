/** Build preScrapedData for Shopify storefronts (theme-provided images, no HTTP scrape). */
export function isShopifyStoreConfig(config) {
  if (!config) return false;
  if (config.shopifyStore === true) return true;
  const domain = String(config.domain || '').toLowerCase();
  return domain.endsWith('.myshopify.com');
}

export function buildShopifyPreScrapedPayload(config) {
  if (!isShopifyStoreConfig(config)) return null;

  const rawImages = config.productImages;
  if (!Array.isArray(rawImages) || rawImages.length === 0) return null;

  const images = rawImages
    .slice(0, 4)
    .map((entry, index) => {
      const url =
        typeof entry === 'string'
          ? entry.trim()
          : (entry?.url || entry?.src || '').toString().trim();
      if (!url) return null;
      return {
        url,
        type: index === 0 ? 'main' : 'product',
        score: 100 - index,
      };
    })
    .filter(Boolean);

  if (!images.length) return null;

  const productData = {
    ...(config.productData && typeof config.productData === 'object' ? config.productData : {}),
  };
  if (!productData.title && config.productTitle) {
    productData.title = config.productTitle;
  }

  return {
    images,
    productData,
    source: 'shopify-theme',
  };
}