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
 * @param {string} url
 * @param {string} filename
 * @param {{ apiEndpoint?: string }} [options] - e.g. `https://ai-furniture-backend.vercel.app/api` (uses /download-image proxy)
 */
export async function downloadUrlAsFile(url, filename, options = {}) {
    if (!url) return;

    const { apiEndpoint } = options;

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

    const isHttp = /^https?:\/\//i.test(url);

    // 1) Backend proxy — server fetches image with Content-Disposition; browser gets a same-origin blob via fetch
    if (apiEndpoint && isHttp) {
        try {
            const base = apiEndpoint.replace(/\/$/, '');
            const proxyUrl = `${base}/download-image?${new URLSearchParams({ url, name: filename })}`;
            const res = await fetch(proxyUrl, { mode: 'cors', credentials: 'omit' });
            if (res.ok) {
                const blob = await res.blob();
                triggerBlobDownload(blob, filename);
                return;
            }
            console.warn('[AI Furniture] Download proxy HTTP', res.status);
        } catch (e) {
            console.warn('[AI Furniture] Download proxy failed:', e);
        }
    }

    // 2) Direct fetch (only if image sends Access-Control-Allow-Origin)
    try {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        triggerBlobDownload(blob, filename);
        return;
    } catch (err) {
        console.warn('[AI Furniture] Direct download failed:', err);
    }

    // 3) Open proxy URL — navigation often triggers file download from Content-Disposition
    if (apiEndpoint && isHttp) {
        const base = apiEndpoint.replace(/\/$/, '');
        const proxyUrl = `${base}/download-image?${new URLSearchParams({ url, name: filename })}`;
        window.open(proxyUrl, '_blank', 'noopener,noreferrer');
        return;
    }

    alert('Could not save this image automatically. Try again after refreshing, or long-press the image and choose Save.');
}
