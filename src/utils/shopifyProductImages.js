/** Build preScrapedData for Shopify storefronts (theme-provided images, no HTTP scrape). */

function normalizeProductImageUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (s.startsWith('//')) return `https:${s}`;
  return s;
}

export function isShopifyStoreConfig(config) {
  if (!config) return false;
  if (config.shopifyStore === true) return true;
  const domain = String(config.domain || '').toLowerCase();
  return domain.endsWith('.myshopify.com');
}

/** Prefer live theme config so productImages stay current on product pages. */
export function mergeShopifyThemeConfig(mergedConfig) {
  const live =
    typeof window !== 'undefined' && window.FURNITURE_AI_CONFIG
      ? window.FURNITURE_AI_CONFIG
      : null;
  if (!live && !mergedConfig) return mergedConfig || null;

  const liveImages = Array.isArray(live?.productImages) ? live.productImages : [];
  const cfgImages = Array.isArray(mergedConfig?.productImages) ? mergedConfig.productImages : [];
  const productImages = cfgImages.length ? cfgImages : liveImages;

  return {
    ...(live && typeof live === 'object' ? live : {}),
    ...(mergedConfig && typeof mergedConfig === 'object' ? mergedConfig : {}),
    shopifyStore: mergedConfig?.shopifyStore ?? live?.shopifyStore ?? false,
    domain: mergedConfig?.domain || live?.domain,
    productTitle: mergedConfig?.productTitle || live?.productTitle,
    productImages,
    productData: mergedConfig?.productData || live?.productData || null,
  };
}

export function buildShopifyPreScrapedPayload(config) {
  const cfg = mergeShopifyThemeConfig(config);
  if (!isShopifyStoreConfig(cfg)) return null;

  const rawImages = cfg.productImages;
  if (!Array.isArray(rawImages) || rawImages.length === 0) return null;

  const images = rawImages
    .slice(0, 4)
    .map((entry, index) => {
      const url = normalizeProductImageUrl(
        typeof entry === 'string'
          ? entry
          : (entry?.url || entry?.src || '').toString()
      );
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
    ...(cfg.productData && typeof cfg.productData === 'object' ? cfg.productData : {}),
  };
  if (!productData.title && cfg.productTitle) {
    productData.title = cfg.productTitle;
  }

  return {
    images,
    productData,
    source: 'shopify-theme',
  };
}