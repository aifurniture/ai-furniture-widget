/**
 * Save images as files. Remote URLs use the backend proxy first so the browser
 * actually downloads (S3/CDN often block CORS; <a download> is ignored cross-origin).
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

function triggerBlobDownload(blob, filename) {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
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
export async function downloadUrlAsFile(url, filename, options = {}) {
    if (!url) return;

    if (url.startsWith('blob:') || url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
    }

    const blob = await fetchImageBlob(url, filename, options);
    if (blob) {
        triggerBlobDownload(blob, filename);
        return;
    }

    const { apiEndpoint } = options;
    const isHttp = /^https?:\/\//i.test(url);
    if (apiEndpoint && isHttp) {
        const base = apiEndpoint.replace(/\/$/, '');
        const proxyUrl = `${base}/download-image?${new URLSearchParams({ url, name: filename })}`;
        window.open(proxyUrl, '_blank', 'noopener,noreferrer');
        return;
    }

    alert('Could not save this image automatically. Try again after refreshing, or long-press the image and choose Save.');
}
