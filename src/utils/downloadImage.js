/**
 * Save image URLs as files (fetch → blob → download). Works for blob:/data: URLs too.
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

async function fetchBlobFromUrl(url) {
    if (!url) throw new Error('Missing image URL');
    if (url.startsWith('blob:') || url.startsWith('data:')) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Could not read image');
        return await res.blob();
    }
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`Could not download image (${res.status})`);
    return await res.blob();
}

/**
 * @param {string} url
 * @param {string} filename - suggested download filename
 */
export async function downloadUrlAsFile(url, filename) {
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

    try {
        const blob = await fetchBlobFromUrl(url);
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.warn('[AI Furniture] Save failed, trying direct link:', err);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
}
