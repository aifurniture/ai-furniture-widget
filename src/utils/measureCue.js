/**
 * Measure-step copy + chip presets — generalised by product category.
 * Always ask for WIDTH of the matching piece already in the room photo
 * (left→right). That is the most reliable scale cue for placement.
 */

import { formatLength } from './widgetUnits.js';

function formatFitLength(cm, imperial) {
    return formatLength(cm, imperial);
}

const CHIP_SETS = {
    sofa: [140, 160, 180, 200, 220, 240, 280, 300, 320, 340, 360, 380, 400],
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
    barStool: [40, 45, 50, 55, 60],
    desk: [100, 120, 140, 160, 180],
    tvStand: [100, 120, 140, 160, 180, 200],
    rug: [120, 160, 200, 240, 280, 300],
    sink: [40, 50, 60, 70, 80, 90, 100, 120],
    vanity: [60, 80, 100, 120, 140, 160, 180],
    bathtub: [140, 150, 160, 170, 180],
    default: [80, 100, 120, 140, 160, 180, 200, 220],
};

/** Categories where a room-width cue is weak / confusing — soft-skip UX. */
const ACCESSORY_KINDS = new Set([
    'lamp',
    'plant',
    'decor',
    'accessory',
    'faucet',
    'mirror',
]);

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
    'barStool',
    'armchair',
    'sofa',
    'bed',
    'sideboard',
    'chest',
    'wardrobe',
    'tvStand',
    'sink',
    'vanity',
    'bathtub',
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

function identityBlob(config = {}) {
    const pd = config.productData || {};
    return [config.productTitle, pd.title, pd.type, pd.category, config.productUrl]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function descriptionBlob(config = {}) {
    return String(config.productData?.description || '').toLowerCase();
}

function matchFurnitureKind(text) {
    if (!text) return null;

    if (/\b(rug|carpet|runner)\b/.test(text)) return 'rug';
    if (/\b(wardrobe|armoire|closet)\b/.test(text)) return 'wardrobe';
    if (/\b(tv\s+stand|media\s+unit|media\s+console|entertainment\s+unit)\b/.test(text)) {
        return 'tvStand';
    }
    if (
        /\b(chest\s+of\s+drawers|drawer\s+chest|chest-of-drawers)\b/.test(text) ||
        /\bdresser\b/.test(text) ||
        (/\bchest\b/.test(text) && /\bdrawers?\b/.test(text))
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
    if (/\b(bar\s+stools?|counter\s+stools?|breakfast\s+bar\s+stools?|kitchen\s+stools?)\b/.test(text)) {
        return 'barStool';
    }
    if (/\b(dining\s+chair|kitchen\s+chair)\b/.test(text)) {
        return 'diningChair';
    }
    if (/\b(armchair|accent\s+chair|lounge\s+chair|occasional\s+chair|tub\s+chair)\b/.test(text)) {
        return 'armchair';
    }
    if (/\b(sofa|couch|settee|sectional|loveseat)\b/.test(text)) return 'sofa';
    if (/\b(bed|mattress|headboard|bedstead)\b/.test(text)) return 'bed';
    if (/\b(bathtub|bath\s*tub|soaking\s+tub|freestanding\s+tub|free-standing\s+tub)\b/.test(text)) {
        return 'bathtub';
    }
    if (/\b(vanity|bathroom\s+vanity|vanity\s+unit|vanity\s+cabinet)\b/.test(text)) {
        return 'vanity';
    }
    if (/\b(kitchen\s+sink|bathroom\s+sink|undermount(?:ed)?\s+sink|drop-?in\s+sink|apron\s+sink|sink|basin)\b/.test(text)) {
        return 'sink';
    }
    if (/\btable\b/.test(text)) return 'diningTable';
    if (/\bchair\b/.test(text)) return 'armchair';
    if (/\bdrawers?\b/.test(text)) return 'chest';
    return null;
}

function matchAccessoryKind(text) {
    if (!text) return null;
    if (/\b(faucet|tap|mixer|shower\s+head|floor\s+drain)\b/.test(text)) return 'faucet';
    if (/\b(floor\s+lamp|table\s+lamp|lamp|pendant|sconce|light\s+fitting|ceiling\s+fan|bulb)\b/.test(text)) {
        return 'lamp';
    }
    if (/\b(plant|planter|pot\s+plant|vase)\b/.test(text)) return 'plant';
    if (/\b(mirror|lighted\s+mirror)\b/.test(text)) return 'mirror';
    if (/\b(cushion|throw|pillow|artwork|clock|decor)\b/.test(text)) return 'decor';
    return null;
}

/**
 * Infer a stable measure kind from product title / type / url.
 * Description is only a furniture fallback — never used to mark accessories
 * (PDP copy like “matches your decor” was skipping the width step).
 */
export function inferMeasureKind(config = {}) {
    const identity = identityBlob(config);
    const fromIdentity = matchFurnitureKind(identity);
    if (fromIdentity) return fromIdentity;

    const type = String(config.productData?.type || '').toLowerCase();
    if (type) {
        if (/sofa|couch/.test(type)) return 'sofa';
        if (/bed/.test(type)) return 'bed';
        if (/stool/.test(type)) return 'barStool';
        if (/chair/.test(type)) return 'armchair';
        if (/table/.test(type)) return 'diningTable';
        if (/wardrobe/.test(type)) return 'wardrobe';
        if (/chest|dresser|drawer/.test(type)) return 'chest';
        if (/sideboard|credenza|buffet/.test(type)) return 'sideboard';
        if (/rug|carpet/.test(type)) return 'rug';
    }

    const fromDescription = matchFurnitureKind(descriptionBlob(config));
    if (fromDescription) return fromDescription;

    const accessory = matchAccessoryKind(identity);
    if (accessory) return accessory;

    if (/lamp|light/.test(type)) return 'lamp';

    return 'default';
}

export function isAccessoryMeasureKind(kind) {
    return ACCESSORY_KINDS.has(kind);
}

export function normalizeAddAnchor(raw) {
    const v = String(raw || '').trim();
    if (v === 'surfaceHeight' || v === 'zoneWidth') return v;
    return null;
}

export function normalizePlacementCount(raw) {
    const n = typeof raw === 'number' ? raw : parseInt(String(raw || '').trim(), 10);
    if (!Number.isFinite(n) || n < 1 || n > 12) return null;
    return n;
}

/**
 * When the shopper says there is no matching piece, ask for a zone-specific
 * measurement (counter height, sofa width, wall run) — not the old product width.
 */
export function getAddPlacementSpec(kind) {
    const buying = newProductNoun(kind);

    const zoneWidth = ({
        title,
        body,
        noun,
        chips,
        zone,
        examplePlaceholder = 'e.g. 180',
    }) => ({
        addAnchor: 'zoneWidth',
        metric: 'width',
        zone,
        title,
        body,
        chipHeading: `${noun} width`,
        noun,
        chips,
        examplePlaceholder,
        customLabel: `Or type ${noun} width`,
        spanIdle: 'left → right',
        spanSelected: (cm) => `${cm} cm wide`,
        ariaGroup: `Width of ${noun} in photo, centimetres`,
        count: null,
    });

    switch (kind) {
        case 'barStool':
            return {
                addAnchor: 'surfaceHeight',
                metric: 'height',
                zone: 'the empty seating side of a kitchen island, breakfast bar, or high counter',
                title: 'How high is the counter?',
                body: 'We already have this bar stool’s listed size. Measure floor to the worktop so the stools tuck under at the right height — we won’t swap other furniture.',
                chipHeading: 'Counter height',
                noun: 'counter',
                chips: [86, 90, 92, 95, 100, 105, 110],
                examplePlaceholder: 'e.g. 90',
                customLabel: 'Or type counter height',
                spanIdle: 'floor → worktop',
                spanSelected: (cm) => `${cm} cm high`,
                ariaGroup: 'Counter height in centimetres',
                count: { heading: 'How many stools?', chips: [2, 3, 4, 5], noun: 'stools' },
            };
        case 'diningChair':
            return {
                addAnchor: 'surfaceHeight',
                metric: 'height',
                zone: 'around the dining table',
                title: 'How high is the dining table?',
                body: 'We already have this dining chair’s listed size. Measure floor to the tabletop so chairs sit at the right height around an empty table.',
                chipHeading: 'Table height',
                noun: 'dining table',
                chips: [72, 75, 78, 80],
                examplePlaceholder: 'e.g. 75',
                customLabel: 'Or type table height',
                spanIdle: 'floor → tabletop',
                spanSelected: (cm) => `${cm} cm high`,
                ariaGroup: 'Dining table height in centimetres',
                count: { heading: 'How many chairs?', chips: [2, 4, 6, 8], noun: 'chairs' },
            };
        case 'coffeeTable':
            return zoneWidth({
                title: 'How wide is the sofa?',
                body: `We already have this coffee table’s listed size. Measure the sofa so the new table sits on the empty floor in front of it — we won’t replace the sofa.`,
                noun: 'sofa',
                chips: CHIP_SETS.sofa,
                zone: 'the empty floor in front of the sofa',
            });
        case 'sideTable':
            return zoneWidth({
                title: 'How wide is the sofa?',
                body: `Measure the sofa so this ${buying} sits beside it at the right scale — we won’t swap other tables.`,
                noun: 'sofa',
                chips: CHIP_SETS.sofa,
                zone: 'beside a sofa arm, bed, or armchair',
            });
        case 'armchair':
            return zoneWidth({
                title: 'How wide is the sofa?',
                body: `Measure the sofa so this ${buying} sits beside it at the right scale.`,
                noun: 'sofa',
                chips: CHIP_SETS.sofa,
                zone: 'beside the sofa or in an empty seating corner',
            });
        case 'consoleTable':
        case 'sideboard':
        case 'chest':
        case 'wardrobe':
        case 'tvStand':
            return zoneWidth({
                title: 'How wide is that wall run?',
                body: `Measure a visible span along the empty wall (or the largest nearby piece) so this ${buying} sits at true size against it.`,
                noun: 'wall run',
                chips: CHIP_SETS.sideboard,
                zone: 'against an empty wall',
            });
        case 'diningTable':
            return zoneWidth({
                title: 'How wide is the dining zone?',
                body: `Measure the largest nearby piece so this dining table sits at true size — we won’t swap other furniture.`,
                noun: 'largest piece',
                chips: CHIP_SETS.diningTable,
                zone: 'the empty dining area',
            });
        case 'desk':
            return zoneWidth({
                title: 'How wide is the work wall?',
                body: `Measure a nearby piece or wall span so this desk sits at true size in an empty work zone.`,
                noun: 'wall run',
                chips: CHIP_SETS.desk,
                zone: 'a natural empty work zone against a wall',
            });
        case 'sofa':
            return zoneWidth({
                title: 'How wide is the wall it should sit on?',
                body: `Measure that wall run (or the largest nearby piece) so this sofa sits at true size — we won’t stretch it to fill the wall.`,
                noun: 'wall run',
                chips: CHIP_SETS.sofa,
                zone: 'the empty living-room wall / seating zone',
            });
        case 'bed':
            return zoneWidth({
                title: 'How wide is the bedroom wall?',
                body: `Measure that wall run so this bed sits at true size against it.`,
                noun: 'wall run',
                chips: CHIP_SETS.bed,
                zone: 'the empty wall where a bed would go',
            });
        case 'sink':
        case 'vanity':
            return zoneWidth({
                title: 'How wide is the bathroom run?',
                body: `Measure a nearby cabinet or counter so this ${buying} sits at true size.`,
                noun: 'cabinet nearby',
                chips: CHIP_SETS.vanity,
                zone: 'the empty vanity / basin zone',
            });
        case 'bathtub':
            return zoneWidth({
                title: 'How wide is the bath zone?',
                body: 'Measure the largest nearby piece so this bathtub sits at true size in the empty alcove.',
                noun: 'largest piece',
                chips: CHIP_SETS.bathtub,
                zone: 'the empty bath alcove or floor',
            });
        default:
            return zoneWidth({
                title: 'How wide is the largest piece in the photo?',
                body: `Measure a visible object so this ${buying} is to scale in the empty spot — we won’t replace existing furniture.`,
                noun: 'largest piece',
                chips: CHIP_SETS.default,
                zone: 'the most natural empty place for this product',
            });
    }
}

export function getMeasureChips(kind, { asRoomRuler = false, addSpec = null } = {}) {
    if (addSpec?.chips?.length) return addSpec.chips;
    if (asRoomRuler) {
        if (kind === 'coffeeTable' || kind === 'sideTable' || kind === 'armchair') {
            return CHIP_SETS.sofa;
        }
        if (kind === 'diningChair' || kind === 'diningTable') {
            return CHIP_SETS.diningTable;
        }
        if (kind === 'barStool') {
            return [86, 90, 92, 95, 100, 105, 110];
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
        case 'barStool':
            return 'bar stool';
        case 'desk':
            return 'desk';
        case 'tvStand':
            return 'TV stand';
        case 'rug':
            return 'rug';
        case 'sink':
            return 'sink';
        case 'vanity':
            return 'vanity';
        case 'bathtub':
            return 'bathtub';
        case 'lamp':
            return 'lamp';
        case 'plant':
            return 'plant';
        case 'decor':
        case 'mirror':
        case 'faucet':
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
        case 'barStool':
            return 'kitchen counter';
        case 'consoleTable':
            return 'sofa';
        case 'desk':
            return 'table nearby';
        case 'diningTable':
            return 'largest piece';
        case 'sink':
        case 'vanity':
            return 'cabinet or counter nearby';
        case 'bathtub':
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
        case 'barStool':
            return 'bar stool';
        case 'desk':
            return 'desk';
        case 'tvStand':
            return 'TV stand or media unit';
        case 'rug':
            return 'rug';
        case 'sink':
            return 'sink';
        case 'vanity':
            return 'vanity';
        case 'bathtub':
            return 'bathtub';
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

    if (kind === 'barStool') {
        return {
            heading: 'In your photo',
            options: [
                { id: 'replace', label: 'Replace', meta: 'existing stools' },
                { id: 'add', label: 'Add it', meta: 'empty counter' },
                { id: 'unsure', label: 'Not sure', meta: 'you pick' },
            ],
            buying,
            oldNoun,
        };
    }

    if (kind === 'diningChair') {
        return {
            heading: 'In your photo',
            options: [
                { id: 'replace', label: 'Replace', meta: 'chairs at table' },
                { id: 'add', label: 'Add it', meta: 'empty table' },
                { id: 'unsure', label: 'Not sure', meta: 'you pick' },
            ],
            buying,
            oldNoun,
        };
    }

    if (kind === 'coffeeTable') {
        return {
            heading: 'In your photo',
            options: [
                { id: 'replace', label: 'Replace', meta: 'coffee table' },
                { id: 'add', label: 'Add it', meta: 'empty floor' },
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
export function getMeasureCopy(kind, productTitle = '', { asRoomRuler = false, intent = null, addSpec = null } = {}) {
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

    if (intent === 'add') {
        const spec = addSpec || getAddPlacementSpec(kind);
        return {
            kind,
            isAccessory: false,
            eyebrow: productLabel ? `Sizing ·${productBit}` : `Sizing your ${buying}`,
            title: spec.title,
            body: spec.body,
            chipHeading: spec.chipHeading,
            spanIdle: spec.spanIdle,
            spanSelected: spec.spanSelected,
            customLabel: spec.customLabel,
            tip: '',
            continueWith,
            skipLabel: 'Skip — guess for me',
            ariaGroup: spec.ariaGroup,
            examplePlaceholder: spec.examplePlaceholder,
            addAnchor: spec.addAnchor,
            metric: spec.metric,
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
            : kind === 'barStool'
              ? 'one stool’s seat, left to right'
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
        : kind === 'sofa'
          ? `${listedLead} Measure the sofa already in the photo, left to right — not this product’s listed size. Close guess is fine.`
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
            kind === 'diningChair' || kind === 'barStool' || kind === 'sideTable' || kind === 'armchair'
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
export function assessSizeFit(oldWidthCm, catalogWidthCm, { imperial = false } = {}) {
    const oldW = Number(oldWidthCm);
    const newW = Number(catalogWidthCm);
    if (!Number.isFinite(oldW) || oldW <= 0 || !Number.isFinite(newW) || newW <= 0) return null;

    const ratio = newW / oldW;
    const oldLabel = formatFitLength(oldW, imperial);
    const newLabel = formatFitLength(newW, imperial);
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
                ? `This product won’t fit that ${oldLabel} spot as-is`
                : `This product is much narrower than what you measured`,
            body: wider
                ? `You measured ~${oldLabel} in the photo, but this product is about ${newLabel} wide (~${times}× larger). We’ll rearrange that area of the room so it can sit at real size — not squeezed into the small piece.`
                : `You measured ~${oldLabel}, but this product is about ${newLabel} (~${times}× smaller). We’ll place it at true size and leave empty space — not stretch it to fill the old span.`,
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
                ? `Photo piece ~${oldLabel} → product ~${newLabel}. We’ll clear a bit of space so it fits at real size.`
                : `Photo piece ~${oldLabel} → product ~${newLabel}. We’ll keep true size and leave empty floor.`,
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

/**
 * Shopper tapped a width that matches the PRODUCT, not the piece in the photo.
 * That makes the model treat old≈new and stretch into the real (larger) sofa.
 */
export function assessChoseProductWidth(selectedCm, catalogWidthCm, kind, { imperial = false } = {}) {
    const selected = Number(selectedCm);
    const catalog = Number(catalogWidthCm);
    if (!Number.isFinite(selected) || selected <= 0 || !Number.isFinite(catalog) || catalog <= 0) {
        return null;
    }
    const ratio = selected / catalog;
    if (ratio < 0.88 || ratio > 1.12) return null;
    const noun = kind === 'sofa' ? 'sofa' : 'piece';
    const cat = formatFitLength(catalog, imperial);
    return {
        title: 'That matches this product’s listed size',
        body: `This item is about ${cat} wide. Measure the ${noun} already in your photo instead — if that’s bigger (e.g. a corner sofa), type that width. Using ${cat} here makes the new one stretch to fill the old one.`,
    };
}
