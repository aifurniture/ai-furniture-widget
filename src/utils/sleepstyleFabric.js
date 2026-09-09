/** SleepStyle (UK) — MageWorx APO fabric swatches. Do not run on other shops. */

const SLEEPSTYLE_HOSTS = new Set(['sleepstyle.co.uk', 'sleepstyle-kbx.myshopify.com']);

const SKIP_TITLE =
  /decid(e|ing)\s+after|received your swatches|headboard split|storage not required|ottoman/i;

function normalizeHost(raw) {
  return String(raw || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase()
    .trim();
}

export function isSleepStyleStorefront(config) {
  const hosts = [typeof window !== 'undefined' ? window.location.hostname : '', config?.domain];
  return hosts.some((h) => SLEEPSTYLE_HOSTS.has(normalizeHost(h)));
}

function cleanText(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function optionTitle(optionEl) {
  if (!optionEl) return '';
  const strong = optionEl.querySelector('.mw-text.mw-text--style-strong, .mw-option__title, legend, .mw-label');
  return cleanText(strong?.textContent || '');
}

function isPipingOption(optionEl) {
  const title = optionTitle(optionEl);
  if (/piping|trim/i.test(title)) return true;
  const all = Array.from(document.querySelectorAll('.mw-option'));
  const idx = all.indexOf(optionEl);
  if (idx < 0) return false;
  for (let i = 0; i < idx; i++) {
    if (/select piping/i.test(optionTitle(all[i]))) return true;
  }
  return false;
}

function lookupApoValue(id) {
  if (!id) return null;
  const root = typeof window !== 'undefined' ? window.mwApoInit?.response : null;
  if (!root || typeof root !== 'object') return null;
  if (root.values?.[id]?.value) return root.values[id].value;
  for (const entry of Object.values(root)) {
    if (entry?.values?.[id]?.value) return entry.values[id].value;
    if (entry?.value?.id === id) return entry.value;
  }
  return null;
}

function firstImageUrl(value, selectedEl) {
  const fromApi = value?.images?.[0]?.url || value?.images?.[0]?.img || value?.images?.[0]?.full;
  if (fromApi) return String(fromApi).trim();
  const img = selectedEl?.querySelector?.('img');
  const src = img?.currentSrc || img?.src || img?.getAttribute?.('src');
  return src ? String(src).trim() : '';
}

function normalizeImageUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (s.startsWith('//')) return `https:${s}`;
  if (!/^https:\/\//i.test(s)) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return '';
    return u.href;
  } catch {
    return '';
  }
}

function composeLabel(groupTitle, valueTitle) {
  const g = cleanText(groupTitle);
  const v = cleanText(valueTitle);
  if (!v) return g;
  if (!g || /select fabric|select piping/i.test(g)) return v;
  if (v.toLowerCase().includes(g.toLowerCase())) return v;
  return `${g} ${v}`.trim();
}

function selectedNodes(optionEl) {
  const values = Array.from(
    optionEl.querySelectorAll('.mw-option__value--selected, .mw-selected')
  );
  if (values.length) return values;
  return Array.from(optionEl.querySelectorAll('.mw-option__control:checked'));
}

function valueIdFromNode(node) {
  return (
    node.getAttribute?.('data-value-id') ||
    node.getAttribute?.('data-value') ||
    node.value ||
    node.getAttribute?.('value') ||
    ''
  );
}

/**
 * Live fabric + piping the shopper has picked on sleepstyle.co.uk.
 * @returns {null | { color: string, material: string, images: Array<{ url: string, type: string, role: string }> }}
 */
export function readSleepStyleFabricSelection(config) {
  if (typeof document === 'undefined') return null;
  if (!isSleepStyleStorefront(config)) return null;

  try {
    const options = Array.from(
      document.querySelectorAll('.mw-option:not(.mw-hidden):not(.fabricSswatches)')
    );
    const picked = [];

    for (const optionEl of options) {
      const group = optionTitle(optionEl);
      if (SKIP_TITLE.test(group)) continue;

      for (const node of selectedNodes(optionEl)) {
        const id = valueIdFromNode(node);
        const apo = lookupApoValue(id);
        const valueTitle =
          apo?.title ||
          cleanText(node.querySelector?.('.mws_option-name, .mw-option__value-text')?.textContent) ||
          cleanText(node.getAttribute?.('aria-label')) ||
          '';
        if (!valueTitle || SKIP_TITLE.test(valueTitle)) continue;

        const url = normalizeImageUrl(firstImageUrl(apo, node.closest?.('.mw-option__value') || node));
        if (!url) continue;
        if (picked.some((p) => p.url === url)) continue;

        const role = isPipingOption(optionEl) ? 'piping' : 'main';
        picked.push({
          role,
          label: composeLabel(group, valueTitle),
          material: /select fabric|select piping/i.test(group) ? valueTitle : group,
          url,
        });
      }
    }

    const main = picked.find((p) => p.role === 'main') || picked[0];
    if (!main) return null;

    const piping = picked.find((p) => p.role === 'piping' && p.url !== main.url);
    const color = piping
      ? `${main.label} with ${piping.label} piping/trim`
      : main.label;

    const images = [{ url: main.url, type: 'fabric', role: 'main' }];
    if (piping) images.push({ url: piping.url, type: 'fabric', role: 'piping' });

    return {
      color,
      material: cleanText(main.material) || '',
      images,
    };
  } catch {
    return null;
  }
}
