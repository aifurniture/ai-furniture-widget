/**
 * Download helpers: blob fetch + optional ZIP (single download for multiple images).
 */
import JSZip from 'jszip';

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

function extFromBlob(blob) {
    const t = blob.type || '';
    if (t.includes('png')) return '.png';
    if (t.includes('jpeg') || t.includes('jpg')) return '.jpg';
    if (t.includes('webp')) return '.webp';
    if (t.includes('gif')) return '.gif';
    return '.jpg';
}

/**
 * @param {string} url
 * @returns {Promise<Blob>}
 */
export async function fetchBlobFromUrl(url) {
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
 * One ZIP file containing multiple images — avoids browsers blocking multiple downloads.
 * @param {{ url: string, baseName: string }[]} entries — baseName without extension (e.g. "before", "after-1")
 * @param {string} [zipName]
 */
export async function downloadImagesAsZip(entries, zipName = 'ai-furniture-room-preview.zip') {
    if (!entries || entries.length === 0) return;
    const zip = new JSZip();
    const usedNames = new Set();
    for (const { url, baseName } of entries) {
        const blob = await fetchBlobFromUrl(url);
        const ext = extFromBlob(blob);
        let name = `${baseName}${ext}`;
        let n = 2;
        while (usedNames.has(name)) {
            name = `${baseName}-${n}${ext}`;
            n += 1;
        }
        usedNames.add(name);
        zip.file(name, blob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const blobUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = zipName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
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
        console.warn('[AI Furniture] Blob download failed, trying direct save:', err);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
}

export function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
