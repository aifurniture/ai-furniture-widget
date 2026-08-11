/**
 * Measure-step copy + chip presets — generalised by product category.
 * Always ask for WIDTH of the matching piece already in the room photo
 * (left→right). That is the most reliable scale cue for placement.
 */

const CHIP_SETS = {
    sofa: [140, 160, 180, 200, 220, 240, 280, 300],
    armchair: [70, 80, 90, 100, 110],
    bed: [90, 120, 135, 150, 180, 200],
    diningTable: [120, 140, 160, 180, 200, 220, 240],
    coffeeTable: [80, 100, 120, 140, 160],
    sideTable: [40, 45, 50, 55, 60, 70],
    sideboard: [100, 120, 140, 160, 180, 200, 220],
    wardrobe: [80, 100, 120, 150, 180, 200],
    diningChair: [40, 45, 50, 55, 60],
    desk: [100, 120, 140, 160, 180],
    tvStand: [100, 120, 140, 160, 180, 200],
    rug: [120, 160, 200, 240, 280, 300],
    default: [80, 100, 120, 140, 160, 180, 200, 220],
};

/** Categories where a room-width cue is weak / confusing — soft-skip UX. */
const ACCESSORY_KINDS = new Set(['lamp', 'plant', 'decor', 'accessory']);

function textBlob(config = {}) {
    const pd = config.productData || {};
    return [
        config.productTitle,
        config.productUrl,
        pd.title,
        pd.type,
        pd.vendor,
        pd.category,
        pd.description,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

/**
 * Infer a stable measure kind from product title / type / url / description.
 */
export function inferMeasureKind(config = {}) {
    const text = textBlob(config);

    if (/\b(floor\s+lamp|table\s+lamp|lamp|pendant|sconce|light\s+fitting)\b/.test(text)) {
        return 'lamp';
    }
    if (/\b(plant|planter|pot\s+plant|vase)\b/.test(text)) return 'plant';
    if (/\b(cushion|throw|pillow|artwork|mirror|clock|decor)\b/.test(text)) return 'decor';

    if (/\b(rug|carpet|runner)\b/.test(text)) return 'rug';
    if (/\b(wardrobe|armoire|closet)\b/.test(text)) return 'wardrobe';
    if (/\b(tv\s+stand|media\s+unit|media\s+console|entertainment\s+unit)\b/.test(text)) {
        return 'tvStand';
    }
    if (/\b(sideboard|credenza|buffet|dresser|chest\s+of\s+drawers|lowboard|side\s+cabinet)\b/.test(text)) {
        return 'sideboard';
    }
    if (/\b(coffee\s+table|cocktail\s+table)\b/.test(text)) return 'coffeeTable';
    if (/\b(side\s+table|end\s+table|lamp\s+table|bedside|nightstand|night\s+table)\b/.test(text)) {
        return 'sideTable';
    }
    if (/\b(dining\s+table|kitchen\s+table|dining\s+set)\b/.test(text)) return 'diningTable';
    if (/\b(desk|writing\s+desk|office\s+desk)\b/.test(text)) return 'desk';
    if (/\b(dining\s+chair|kitchen\s+chair|bar\s+stool|counter\s+stool)\b/.test(text)) {
        return 'diningChair';
    }
    if (/\b(armchair|accent\s+chair|lounge\s+chair|occasional\s+chair|tub\s+chair)\b/.test(text)) {
        return 'armchair';
    }
    if (/\b(sofa|couch|settee|sectional|loveseat)\b/.test(text)) return 'sofa';
    if (/\b(bed|mattress|headboard|bedstead)\b/.test(text)) return 'bed';
    if (/\btable\b/.test(text)) return 'diningTable';
    if (/\bchair\b/.test(text)) return 'armchair';

    // Shopify product type alone
    const type = String(config.productData?.type || '').toLowerCase();
    if (type) {
        if (/sofa|couch/.test(type)) return 'sofa';
        if (/bed/.test(type)) return 'bed';
        if (/chair/.test(type)) return 'armchair';
        if (/table/.test(type)) return 'diningTable';
        if (/wardrobe|storage/.test(type)) return 'wardrobe';
        if (/rug|carpet/.test(type)) return 'rug';
        if (/lamp|light/.test(type)) return 'lamp';
    }

    return 'default';
}

export function isAccessoryMeasureKind(kind) {
    return ACCESSORY_KINDS.has(kind);
}

export function getMeasureChips(kind) {
    return CHIP_SETS[kind] || CHIP_SETS.default;
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function shortProductLabel(title = '') {
    const t = String(title || '').trim();
    if (!t) return '';
    const cleaned = t.split(/\s*[|–—]\s*/)[0].trim();
    if (cleaned.length <= 42) return cleaned;
    return `${cleaned.slice(0, 40).trim()}…`;
}

/** Friendly name for the NEW product (what they’re buying). */
function newProductNoun(kind) {
    switch (kind) {
        case 'sofa':
            return 'sofa';
        case 'armchair':
            return 'armchair';
        case 'bed':
            return 'bed';
        case 'diningTable':
            return 'dining table';
        case 'coffeeTable':
            return 'coffee table';
        case 'sideTable':
            return 'side table';
        case 'sideboard':
            return 'sideboard';
        case 'wardrobe':
            return 'wardrobe';
        case 'diningChair':
            return 'dining chair';
        case 'desk':
            return 'desk';
        case 'tvStand':
            return 'TV stand';
        case 'rug':
            return 'rug';
        case 'lamp':
            return 'lamp';
        case 'plant':
            return 'plant';
        case 'decor':
            return 'piece';
        default:
            return 'product';
    }
}

/** Name for the EXISTING piece in the photo they should measure. */
function oldPieceNoun(kind) {
    switch (kind) {
        case 'sofa':
            return 'sofa';
        case 'armchair':
            return 'armchair';
        case 'bed':
            return 'bed';
        case 'diningTable':
            return 'dining table';
        case 'coffeeTable':
            return 'coffee table';
        case 'sideTable':
            return 'side table or nightstand';
        case 'sideboard':
            return 'sideboard or chest';
        case 'wardrobe':
            return 'wardrobe';
        case 'diningChair':
            return 'dining chair';
        case 'desk':
            return 'desk';
        case 'tvStand':
            return 'TV stand or media unit';
        case 'rug':
            return 'rug';
        default:
            return 'piece';
    }
}

/**
 * User-facing copy for the measure step — always ties question to this product type.
 */
export function getMeasureCopy(kind, productTitle = '') {
    const buying = newProductNoun(kind);
    const oldNoun = oldPieceNoun(kind);
    const productLabel = escapeHtml(shortProductLabel(productTitle));
    const productBit = productLabel ? ` “${productLabel}”` : '';

    if (isAccessoryMeasureKind(kind)) {
        return {
            kind,
            isAccessory: true,
            eyebrow: productLabel ? `Placing${productBit}` : `Placing your ${buying}`,
            title: 'Ready to place',
            body: `No size check needed for this ${buying} — we’ll fit it naturally in your room.`,
            chipHeading: '',
            spanIdle: '',
            spanSelected: (cm) => `${cm} cm`,
            customLabel: '',
            tip: '',
            continueWith: (cm) => (cm ? `Use ${cm} cm` : 'Continue'),
            skipLabel: 'Continue without a size',
            ariaGroup: 'Size (optional)',
            examplePlaceholder: 'e.g. 180',
        };
    }

    const measureHint =
        kind === 'diningChair'
            ? 'one chair’s seat width'
            : kind === 'rug'
              ? 'the rug’s shorter side (width across)'
              : kind === 'bed'
                ? 'the bed left→right (across the headboard)'
                : `${oldNoun} left→right`;

    return {
        kind,
        isAccessory: false,
        eyebrow: productLabel ? `Sizing ·${productBit}` : `Sizing your ${buying}`,
        title: `How wide is the ${oldNoun} in your photo?`,
        body: `You’re previewing a new ${buying}. Measure the existing ${oldNoun} already in the photo (${measureHint}) in cm — a close guess is fine. If you’re measuring a different piece (e.g. a side table while buying a coffee table), sizes won’t match.`,
        chipHeading: `Width of ${oldNoun} in photo (cm)`,
        spanIdle: 'left → right',
        spanSelected: (cm) => `${cm} cm wide`,
        customLabel: `Or type ${oldNoun} width`,
        tip: `Only width of that ${oldNoun} in the photo — not the new ${buying}’s listed size. Height comes from the product photos.`,
        continueWith: (cm) => (cm ? `Use ${cm} cm` : 'Continue'),
        skipLabel: 'Skip — estimate for me',
        ariaGroup: `Width of ${oldNoun} in photo, centimetres`,
        examplePlaceholder:
            kind === 'diningChair' || kind === 'sideTable' || kind === 'armchair'
                ? 'e.g. 50'
                : 'e.g. 180',
    };
}

function toCm(num, unit) {
    const n = parseFloat(String(num).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return null;
    const u = String(unit || 'cm').toLowerCase();
    if (u === 'mm') return n / 10;
    if (u === 'm') return n * 100;
    if (u === 'in' || u === 'in.' || u === '"' || u === 'inches' || u === 'inch') return n * 2.54;
    return n;
}

/**
 * Best-effort catalog width (cm) from theme productData / description.
 */
export function parseCatalogWidthCm(config = {}) {
    const pd = config.productData && typeof config.productData === 'object' ? config.productData : {};
    const blobs = [pd.dimensions, pd.description, pd.title, config.productTitle]
        .filter(Boolean)
        .map(String);

    for (const text of blobs) {
        const productSize = text.match(
            /\bProduct\s*Size\s*[:\-]\s*([0-9]+(?:[.,][0-9]+)?)\s*(cm|mm|m|in\.?|")?\s*[x×]/i
        );
        if (productSize) {
            const cm = toCm(productSize[1], productSize[2] || 'cm');
            if (cm && cm >= 15 && cm <= 600) return Math.round(cm * 10) / 10;
        }

        const labeled = text.match(
            /\b(?:overall\s*)?(?:width|w)\s*[:\-]?\s*([0-9]+(?:[.,][0-9]+)?)\s*(cm|mm|m|in\.?|")?/i
        );
        if (labeled) {
            const cm = toCm(labeled[1], labeled[2] || 'cm');
            if (cm && cm >= 15 && cm <= 600) return Math.round(cm * 10) / 10;
        }

        const triple = text.match(
            /\b([0-9]+(?:[.,][0-9]+)?)\s*(cm|mm|m|in\.?|")?\s*[x×]\s*[0-9]+(?:[.,][0-9]+)?\s*(?:cm|mm|m|in\.?|")?\s*[x×]\s*[0-9]+(?:[.,][0-9]+)?\s*(cm|mm|m|in\.?|")?/i
        );
        if (triple) {
            const unit = triple[2] || triple[3] || 'cm';
            const cm = toCm(triple[1], unit);
            if (cm && cm >= 15 && cm <= 600) return Math.round(cm * 10) / 10;
        }
    }

    return null;
}

/**
 * Compare measured piece in photo vs catalog product width.
 * @returns {null | { severity: 'ok'|'notice'|'warn', mode: null|'room_adapt', ratio: number, oldWidthCm: number, catalogWidthCm: number, title: string, body: string, cta: string }}
 */
export function assessSizeFit(oldWidthCm, catalogWidthCm) {
    const oldW = Number(oldWidthCm);
    const newW = Number(catalogWidthCm);
    if (!Number.isFinite(oldW) || oldW <= 0 || !Number.isFinite(newW) || newW <= 0) return null;

    const ratio = newW / oldW;
    const oldLabel = Math.round(oldW);
    const newLabel = Math.round(newW);
    const times = ratio >= 1 ? ratio.toFixed(1) : (1 / ratio).toFixed(1);

    if (ratio >= 2.0 || ratio <= 0.5) {
        const wider = ratio >= 1;
        return {
            severity: 'warn',
            mode: 'room_adapt',
            ratio,
            oldWidthCm: oldW,
            catalogWidthCm: newW,
            title: wider
                ? `This product won’t fit that ${oldLabel} cm spot as-is`
                : `This product is much narrower than what you measured`,
            body: wider
                ? `You measured ~${oldLabel} cm in the photo, but this product is about ${newLabel} cm wide (~${times}× larger). We’ll rearrange that area of the room so it can sit at real size — not squeezed into the small piece.`
                : `You measured ~${oldLabel} cm, but this product is about ${newLabel} cm (~${times}× smaller). We’ll place it at true size and leave empty space — not stretch it to fill the old span.`,
            cta: wider ? 'Continue — adapt my room' : 'Continue — place at true size',
        };
    }

    if (ratio >= 1.4 || ratio <= 0.72) {
        const wider = ratio >= 1;
        return {
            severity: 'notice',
            mode: 'room_adapt',
            ratio,
            oldWidthCm: oldW,
            catalogWidthCm: newW,
            title: wider ? 'New piece is noticeably wider' : 'New piece is noticeably narrower',
            body: wider
                ? `Photo piece ~${oldLabel} cm → product ~${newLabel} cm. We’ll clear a bit of space so it fits at real size.`
                : `Photo piece ~${oldLabel} cm → product ~${newLabel} cm. We’ll keep true size and leave empty floor.`,
            cta: 'Continue',
        };
    }

    return {
        severity: 'ok',
        mode: null,
        ratio,
        oldWidthCm: oldW,
        catalogWidthCm: newW,
        title: '',
        body: '',
        cta: '',
    };
}
