/**
 * Compress a room photo in the browser before POST /api/upload.
 * Vercel rejects request bodies over ~4.5MB (413) before the server can compress.
 */

const DEFAULT_MAX_SIDE = 1920;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const MIN_QUALITY = 0.48;

function scaleDimensions(width, height, maxSide) {
    if (width <= maxSide && height <= maxSide) {
        return { width, height };
    }
    const ratio = Math.min(maxSide / width, maxSide / height);
    return {
        width: Math.max(1, Math.round(width * ratio)),
        height: Math.max(1, Math.round(height * ratio))
    };
}

function loadImageFromBlob(blob) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Could not read image'));
        };
        img.src = url;
    });
}

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Could not compress image'));
            },
            type,
            quality
        );
    });
}

/**
 * @param {File|Blob} fileOrBlob
 * @param {{ maxSide?: number, maxBytes?: number }} [options]
 * @returns {Promise<File>}
 */
export async function compressRoomImage(fileOrBlob, options = {}) {
    if (typeof document === 'undefined') {
        if (fileOrBlob instanceof File) return fileOrBlob;
        return new File([fileOrBlob], 'room.jpg', { type: fileOrBlob.type || 'image/jpeg' });
    }

    const maxSide = options.maxSide ?? DEFAULT_MAX_SIDE;
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const input =
        fileOrBlob instanceof Blob
            ? fileOrBlob
            : new Blob([fileOrBlob], { type: 'image/jpeg' });

    if (input.size <= maxBytes && input.type === 'image/jpeg') {
        const img = await loadImageFromBlob(input);
        if (img.width <= maxSide && img.height <= maxSide) {
            if (fileOrBlob instanceof File) return fileOrBlob;
            return new File([input], 'room.jpg', { type: 'image/jpeg' });
        }
    }

    const img = await loadImageFromBlob(input);
    const { width, height } = scaleDimensions(img.width, img.height, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not compress image');
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.88;
    let outBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
    while (outBlob.size > maxBytes && quality > MIN_QUALITY) {
        quality -= 0.06;
        outBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
    }

    return new File([outBlob], 'room.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}
