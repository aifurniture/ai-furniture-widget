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
    consoleTable: [80, 100, 120, 140, 160, 180],
    sideboard: [100, 120, 140, 160, 180, 200, 220],
    chest: [80, 100, 120, 140, 160, 180, 200],
    wardrobe: [80, 100, 120, 150, 180, 200],
    diningChair: [40, 45, 50, 55, 60],
    desk: [100, 120, 140, 160, 180],
    tvStand: [100, 120, 140, 160, 180, 200],
    rug: [120, 160, 200, 240, 280, 300],
    default: [80, 100, 120, 140, 160, 180, 200, 220],
};

/** Categories where a room-width cue is weak / confusing — soft-skip UX. */
const ACCESSORY_KINDS = new Set(['lamp', 'plant', 'decor', 'accessory']);

/**
 * Kinds where product type often collides with a different piece in the photo
 * (e.g. coffee table vs dining table). Show placement-intent chips.
 */
const COLLISION_KINDS = new Set([
    'coffeeTable',
    'diningTable',
    'sideTable',
    'consoleTable',
    'desk',
    'diningChair',
    'armchair',
    'sideboard',
    'chest',
    'wardrobe',
    'tvStand',
]);

export const PLACEMENT_INTENTS = ['replace', 'add', 'unsure'];

export function isCollisionMeasureKind(kind) {
    return COLLISION_KINDS.has(kind);
}

/** Implicit intent when the shopper hasn’t tapped a choice yet. */
export function defaultPlacementIntent(kind) {
    if (kind === 'chest' || kind === 'sideboard' || kind === 'wardrobe' || kind === 'tvStand') {
        return 'replace';
    }
    if (isCollisionMeasureKind(kind)) return 'unsure';
    return null;
}

export function normalizePlacementIntent(raw) {
    const v = String(raw || '').trim().toLowerCase();
    if (v === 'replace' || v === 'add' || v === 'unsure') return v;
    return null;
}

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
    if (
        /\b(chest\s+of\s+drawers|drawer\s+chest|chest-of-drawers)\b/.test(text) ||
        /\bdresser\b/.test(text)
    ) {
        return 'chest';
    }
    if (/\b(sideboard|credenza|buffet|lowboard|side\s+cabinet)\b/.test(text)) {
        return 'sideboard';
    }
    if (/\b(coffee\s+table|cocktail\s+table)\b/.test(text)) return 'coffeeTable';
    if (/\b(side\s+table|end\s+table|lamp\s+table|bedside|nightstand|night\s+table)\b/.test(text)) {
        return 'sideTable';
    }
    if (/\b(console\s+table|hall\s+table)\b/.test(text)) return 'consoleTable';
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
        if (/wardrobe/.test(type)) return 'wardrobe';
        if (/chest|dresser/.test(type)) return 'chest';
        if (/sideboard|credenza|buffet/.test(type)) return 'sideboard';
        if (/rug|carpet/.test(type)) return 'rug';
        if (/lamp|light/.test(type)) return 'lamp';
    }

    return 'default';
}

export function isAccessoryMeasureKind(kind) {
    return ACCESSORY_KINDS.has(kind);
}

export function getMeasureChips(kind, { asRoomRuler = false } = {}) {
    if (asRoomRuler) {
        if (kind === 'coffeeTable' || kind === 'sideTable' || kind === 'armchair') {
            return CHIP_SETS.sofa;
        }
        if (kind === 'diningChair' || kind === 'diningTable') {
            return CHIP_SETS.diningTable;
        }
        return CHIP_SETS.default;
    }
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
        case 'consoleTable':
            return 'console table';
        case 'sideboard':
            return 'sideboard';
        case 'chest':
            return 'chest of drawers';
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
/** Visible room piece to use as a cm ruler when the matching product isn’t in the photo. */
function roomRulerNoun(kind) {
    switch (kind) {
        case 'coffeeTable':
        case 'sideTable':
        case 'armchair':
            return 'sofa';
        case 'diningChair':
            return 'dining table';
        case 'consoleTable':
            return 'sofa';
        case 'desk':
            return 'table nearby';
        case 'diningTable':
            return 'largest piece';
        default:
            return 'largest piece';
    }
}

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
        case 'consoleTable':
            return 'console table';
        case 'sideboard':
            return 'sideboard';
        case 'chest':
            return 'sideboard';
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
 * Placement-intent copy for collision-prone kinds (any room photo still allowed).
 * @returns {null | { heading: string, options: Array<{ id: string, label: string, meta?: string }>, buying: string, oldNoun: string }}
 */
export function getPlacementIntentCopy(kind) {
    if (!isCollisionMeasureKind(kind)) return null;
    const buying = newProductNoun(kind);
    const oldNoun = oldPieceNoun(kind);

    if (kind === 'chest') {
        return {
            heading: 'In your photo',
            options: [
                { id: 'replace', label: 'Replace', meta: 'the sideboard' },
                { id: 'add', label: 'Add it', meta: 'no storage there' },
                { id: 'unsure', label: 'Not sure', meta: 'you pick' },
            ],
            buying,
            oldNoun,
        };
    }

    if (kind === 'sideboard') {
        return {
            heading: 'In your photo',
            options: [
                { id: 'replace', label: 'Replace', meta: 'sideboard' },
                { id: 'add', label: 'Add it', meta: 'none there' },
                { id: 'unsure', label: 'Not sure', meta: 'you pick' },
            ],
            buying,
            oldNoun,
        };
    }

    return {
        heading: 'In your photo',
        options: [
            { id: 'replace', label: 'Replace', meta: oldNoun },
            { id: 'add', label: 'Add it', meta: `no ${oldNoun}` },
            { id: 'unsure', label: 'Not sure', meta: 'you pick' },
        ],
        buying,
        oldNoun,
    };
}

/**
 * User-facing copy for the measure step — always ties question to this product type.
 */
export function getMeasureCopy(kind, productTitle = '', { asRoomRuler = false, intent = null } = {}) {
    const buying = newProductNoun(kind);
    const matchingNoun = oldPieceNoun(kind);
    const oldNoun = asRoomRuler ? roomRulerNoun(kind) : matchingNoun;
    const productLabel = escapeHtml(shortProductLabel(productTitle));
    const productBit = productLabel ? ` “${productLabel}”` : '';
    const continueWith = (cm) => (cm ? `Use ${cm} cm` : 'Place in my room');

    if (isAccessoryMeasureKind(kind)) {
        return {
            kind,
            isAccessory: true,
            eyebrow: productLabel ? `Placing${productBit}` : `Placing your ${buying}`,
            title: 'Ready to place',
            body: `We’ll fit this ${buying} into your photo — no width needed.`,
            chipHeading: '',
            spanIdle: '',
            spanSelected: (cm) => `${cm} cm`,
            customLabel: '',
            tip: '',
            continueWith,
            skipLabel: 'Place in my room',
            ariaGroup: 'Size (optional)',
            examplePlaceholder: 'e.g. 180',
        };
    }

    if (asRoomRuler) {
        return {
            kind,
            isAccessory: false,
            eyebrow: productLabel ? `Sizing ·${productBit}` : `Sizing your ${buying}`,
            title: `How wide is the ${oldNoun}?`,
            body: `We already have this ${buying}’s listed size. Measure the ${oldNoun} in your photo so the new piece is to scale. Close guess is fine.`,
            chipHeading: `${oldNoun} width`,
            spanIdle: 'left → right',
            spanSelected: (cm) => `${cm} cm wide`,
            customLabel: `Or type ${oldNoun} width`,
            tip: '',
            continueWith,
            skipLabel: 'Skip — guess for me',
            ariaGroup: `Width of ${oldNoun} in photo, centimetres`,
            examplePlaceholder: 'e.g. 180',
        };
    }

    const isStorageSpot = kind === 'chest' || kind === 'sideboard';
    const measureHint =
        kind === 'diningChair'
            ? 'one chair’s seat, left to right'
            : kind === 'rug'
              ? 'the shorter side across the floor'
              : kind === 'bed'
                ? 'across the headboard'
                : isStorageSpot
                  ? 'left to right along the wall'
                  : `${matchingNoun}, left to right`;

    const listedLead = `We already have this ${buying}’s listed size — we need the piece in your photo.`;
    const unsureBody = isStorageSpot
        ? `${listedLead} Measure the sideboard (or chest) against the wall. If there isn’t one, tap Add it.`
        : `${listedLead} Measure the ${matchingNoun} if you see one (${measureHint}). If you don’t, tap Add it so we don’t swap the wrong piece.`;
    const replaceBody = isStorageSpot
        ? `${listedLead} Measure the sideboard (or chest) you want to replace, left to right. Close guess is fine.`
        : `${listedLead} Measure the ${matchingNoun} already in the photo (${measureHint}). Close guess is fine.`;

    const title = isStorageSpot
        ? 'How wide is the sideboard in your photo?'
        : `How wide is the ${matchingNoun}?`;
    const chipHeading = isStorageSpot ? 'Sideboard width in photo' : `${matchingNoun} width`;
    const customLabel = isStorageSpot ? 'Or type that width' : `Or type ${matchingNoun} width`;

    return {
        kind,
        isAccessory: false,
        eyebrow: productLabel ? `Sizing ·${productBit}` : `Sizing your ${buying}`,
        title,
        body: intent === 'unsure' || !intent ? unsureBody : replaceBody,
        chipHeading,
        spanIdle: 'left → right',
        spanSelected: (cm) => `${cm} cm wide`,
        customLabel,
        tip: '',
        continueWith,
        skipLabel: 'Skip — guess for me',
        ariaGroup: `Width of ${matchingNoun} in photo, centimetres`,
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
