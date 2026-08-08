/**
 * Normalize + compress a room photo in the browser before upload.
 * Vercel rejects request bodies over ~4.5MB (413) before the server can compress.
 *
 * Gallery vs camera inconsistency fix:
 * - Always bake EXIF orientation into pixels (gallery JPEGs often have Orientation=6/8)
 * - Prefer createImageBitmap (high-quality resize + consistent orientation)
 * - Always emit upright sRGB JPEG so Gemini sees the same kind of input
 */

const DEFAULT_MAX_SIDE = 2048;
const DEFAULT_MAX_BYTES = 2.4 * 1024 * 1024;
const MIN_QUALITY = 0.55;
const START_QUALITY = 0.92;
/** Skip re-encode only for our own already-normalized outputs. */
const NORMALIZED_NAME = 'room.jpg';

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

function isJpegType(type) {
    const t = (type || '').toLowerCase().split(';')[0].trim();
    return t === 'image/jpeg' || t === 'image/jpg';
}

/**
 * Decode with orientation applied. Gallery photos often need this; camera captures
 * usually already look upright but we treat both the same for consistency.
 */
async function decodeOrientedBitmap(blob, resizeWidth, resizeHeight) {
    if (typeof createImageBitmap === 'function') {
        try {
            const opts = {
                imageOrientation: 'from-image',
                colorSpaceConversion: 'default',
            };
            if (resizeWidth && resizeHeight) {
                opts.resizeWidth = resizeWidth;
                opts.resizeHeight = resizeHeight;
                opts.resizeQuality = 'high';
            }
            return await createImageBitmap(blob, opts);
        } catch {
            // Fall through — older WebViews / odd HEIC
        }

        // Retry without resize options (some browsers reject resizeQuality)
        try {
            return await createImageBitmap(blob, {
                imageOrientation: 'from-image',
                colorSpaceConversion: 'default',
            });
        } catch {
            // Fall through to Image()
        }
    }

    return null;
}

/**
 * @param {File|Blob} fileOrBlob
 * @param {{ maxSide?: number, maxBytes?: number }} [options]
 * @returns {Promise<File>}
 */
export async function compressRoomImage(fileOrBlob, options = {}) {
    if (typeof document === 'undefined') {
        if (fileOrBlob instanceof File) return fileOrBlob;
        return new File([fileOrBlob], NORMALIZED_NAME, { type: fileOrBlob.type || 'image/jpeg' });
    }

    const maxSide = options.maxSide ?? DEFAULT_MAX_SIDE;
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const input =
        fileOrBlob instanceof Blob
            ? fileOrBlob
            : new Blob([fileOrBlob], { type: 'image/jpeg' });

    // Second-pass short circuit: already our normalized JPEG under limits
    if (
        fileOrBlob instanceof File &&
        fileOrBlob.name === NORMALIZED_NAME &&
        isJpegType(fileOrBlob.type) &&
        fileOrBlob.size <= maxBytes
    ) {
        try {
            const probe = await decodeOrientedBitmap(input);
            if (probe) {
                const ok = probe.width <= maxSide && probe.height <= maxSide;
                const w = probe.width;
                const h = probe.height;
                probe.close?.();
                if (ok) return fileOrBlob;
                // need resize — fall through with known dims unused
                void w;
                void h;
            }
        } catch {
            // re-encode below
        }
    }

    let width;
    let height;
    let source;

    // Probe natural size (oriented)
    const probeBitmap = await decodeOrientedBitmap(input);
    if (probeBitmap) {
        width = probeBitmap.width;
        height = probeBitmap.height;
        probeBitmap.close?.();
    } else {
        const img = await loadImageFromBlob(input);
        width = img.naturalWidth || img.width;
        height = img.naturalHeight || img.height;
        source = img;
    }

    if (!width || !height) {
        throw new Error('Could not read image dimensions');
    }

    const target = scaleDimensions(width, height, maxSide);

    // Prefer bitmap decode+resize in one step when available
    let bitmap = null;
    if (!source) {
        bitmap = await decodeOrientedBitmap(input, target.width, target.height);
        if (bitmap && (bitmap.width !== target.width || bitmap.height !== target.height)) {
            // Browser ignored resize — draw at target via canvas
        }
    }

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx =
        canvas.getContext('2d', { alpha: false, colorSpace: 'srgb' }) ||
        canvas.getContext('2d', { alpha: false }) ||
        canvas.getContext('2d');
    if (!ctx) throw new Error('Could not compress image');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Neutral background (avoids black edges if anything is weird)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, target.width, target.height);

    if (bitmap) {
        ctx.drawImage(bitmap, 0, 0, target.width, target.height);
        bitmap.close?.();
    } else if (source) {
        ctx.drawImage(source, 0, 0, target.width, target.height);
    } else {
        const img = await loadImageFromBlob(input);
        ctx.drawImage(img, 0, 0, target.width, target.height);
    }

    let quality = START_QUALITY;
    let outBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
    while (outBlob.size > maxBytes && quality > MIN_QUALITY) {
        quality -= 0.05;
        outBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
    }

    // Last resort: shrink dimensions further if still huge
    let side = maxSide;
    while (outBlob.size > maxBytes && side > 1280) {
        side = Math.floor(side * 0.85);
        const smaller = scaleDimensions(width, height, side);
        canvas.width = smaller.width;
        canvas.height = smaller.height;
        // Resizing canvas resets the context
        const shrinkCtx = canvas.getContext('2d', { alpha: false, colorSpace: 'srgb' });
        if (!shrinkCtx) break;
        shrinkCtx.imageSmoothingEnabled = true;
        shrinkCtx.imageSmoothingQuality = 'high';
        shrinkCtx.fillStyle = '#ffffff';
        shrinkCtx.fillRect(0, 0, smaller.width, smaller.height);

        const again = await decodeOrientedBitmap(input, smaller.width, smaller.height);
        if (again) {
            shrinkCtx.drawImage(again, 0, 0, smaller.width, smaller.height);
            again.close?.();
        } else {
            const img = await loadImageFromBlob(input);
            shrinkCtx.drawImage(img, 0, 0, smaller.width, smaller.height);
        }
        outBlob = await canvasToBlob(canvas, 'image/jpeg', Math.max(quality, MIN_QUALITY));
    }

    return new File([outBlob], NORMALIZED_NAME, {
        type: 'image/jpeg',
        lastModified: Date.now(),
    });
}
