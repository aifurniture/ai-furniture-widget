/**
 * Save images as files. Remote URLs use the backend proxy first so the browser
 * actually downloads (S3/CDN often block CORS; <a download> is ignored cross-origin).
 * iOS Safari ignores programmatic downloads — use Web Share API or per-tap image open.
 */

export function getFilenameFromUrl(url, fallback = 'image') {
    try {
        const u = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined);
        let name = u.pathname.split('/').pop() || fallback;
        name = name.split('?')[0];
        if (!name || name === '') return fallback;
        return name;
    } catch (_) {
        return fallback;
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isIOSDevice() {
    if (typeof navigator === 'undefined') return false;
    return (
        /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
}

function isIOS() {
    return isIOSDevice();
}

function guessMimeFromFilename(filename) {
    const lower = (filename || '').toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
}

function blobToFile(blob, filename) {
    const type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : guessMimeFromFilename(filename);
    return new File([blob], filename, { type });
}

function triggerBlobDownload(blob, filename) {
    if (isIOS()) return false;
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
    return true;
}

/**
 * Open image in a new tab — must run synchronously inside a user click on iOS.
 */
export function openImageSaveTarget(url, filename, options = {}) {
    if (!url) return;

    if (url.startsWith('blob:') || url.startsWith('data:')) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }

    const { apiEndpoint } = options;
    if (apiEndpoint && /^https?:\/\//i.test(url)) {
        const base = apiEndpoint.replace(/\/$/, '');
        const proxyUrl = `${base}/download-image?${new URLSearchParams({ url, name: filename })}`;
        window.open(proxyUrl, '_blank', 'noopener,noreferrer');
        return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
}

async function shareFiles(files) {
    if (typeof navigator.share !== 'function' || typeof File === 'undefined' || !files.length) {
        return false;
    }

    try {
        if (files.length > 1) {
            const multi = { files };
            if (!navigator.canShare || navigator.canShare(multi)) {
                await navigator.share(multi);
                return true;
            }
        }

        for (const file of files) {
            const single = { files: [file] };
            if (!navigator.canShare || navigator.canShare(single)) {
                await navigator.share(single);
            }
        }
        return true;
    } catch (e) {
        if (e?.name === 'AbortError') throw e;
        return false;
    }
}

/**
 * Save one or more images. Prefers Web Share on mobile (Save to Photos on iOS).
 * @param {{ url: string, filename: string }[]} items
 * @param {{ apiEndpoint?: string }} [options]
 * @returns {Promise<{ ok: boolean, reason?: string, method?: string, saved?: number, items?: { url: string, filename: string }[] }>}
 */
export async function saveImageSet(items, options = {}) {
    const entries = (items || []).filter((i) => i?.url);
    if (!entries.length) return { ok: false, reason: 'empty' };

    const blobs = await Promise.all(
        entries.map((item) => fetchImageBlob(item.url, item.filename, options))
    );

    const ready = entries
        .map((item, index) => ({ item, blob: blobs[index] }))
        .filter((pair) => pair.blob);

    if (!ready.length) {
        return { ok: false, reason: 'fetch_failed', items: entries };
    }

    const files = ready.map(({ item, blob }) => blobToFile(blob, item.filename));

    try {
        const shared = await shareFiles(files);
        if (shared) {
            return { ok: true, method: 'share', saved: files.length };
        }
    } catch (e) {
        if (e?.name === 'AbortError') return { ok: false, reason: 'cancelled' };
    }

    if (isIOS()) {
        return { ok: false, reason: 'ios_fallback', items: entries };
    }

    for (const { item, blob } of ready) {
        triggerBlobDownload(blob, item.filename);
        await sleep(250);
    }

    return { ok: true, method: 'download', saved: ready.length };
}

/**
 * Fetch image bytes (same proxy / CORS strategy as download). For share, Web Share API, etc.
 * @param {string} url
 * @param {string} filename - used for proxy request name=
 * @param {{ apiEndpoint?: string }} [options]
 * @returns {Promise<Blob|null>}
 */
export async function fetchImageBlob(url, filename, options = {}) {
    if (!url) return null;

    const { apiEndpoint } = options;

    if (url.startsWith('blob:') || url.startsWith('data:')) {
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            return await res.blob();
        } catch (e) {
            console.warn('[AI Furniture] fetchImageBlob local failed:', e);
            return null;
        }
    }

    const isHttp = /^https?:\/\//i.test(url);

    if (apiEndpoint && isHttp) {
        try {
            const base = apiEndpoint.replace(/\/$/, '');
            const proxyUrl = `${base}/download-image?${new URLSearchParams({ url, name: filename })}`;
            const res = await fetch(proxyUrl, { mode: 'cors', credentials: 'omit' });
            if (res.ok) return await res.blob();
            console.warn('[AI Furniture] fetchImageBlob proxy HTTP', res.status);
        } catch (e) {
            console.warn('[AI Furniture] fetchImageBlob proxy failed:', e);
        }
    }

    try {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.blob();
    } catch (err) {
        console.warn('[AI Furniture] fetchImageBlob direct failed:', err);
        return null;
    }
}

/**
 * @param {string} url
 * @param {string} filename
 * @param {{ apiEndpoint?: string }} [options] - e.g. `https://ai-furniture-backend.vercel.app/api` (uses /download-image proxy)
 */
/** Save one image — on iPhone opens in a new tab for long-press Save to Photos. */
export async function saveSingleImage(item, options = {}) {
    if (!item?.url) return { ok: false, reason: 'empty' };
    if (isIOS()) {
        openImageSaveTarget(item.url, item.filename, options);
        return { ok: true, method: 'open' };
    }
    return saveImageSet([item], options);
}

export async function downloadUrlAsFile(url, filename, options = {}) {
    const result = await saveImageSet([{ url, filename }], options);
    if (result.ok) return;
    if (result.reason === 'cancelled') return;
    if (result.reason === 'ios_fallback' || result.reason === 'fetch_failed') {
        openImageSaveTarget(url, filename, options);
        return;
    }
    alert('Could not save this image automatically. Try again after refreshing, or long-press the image and choose Save.');
}
