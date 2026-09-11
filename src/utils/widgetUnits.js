const IN_PER_CM = 1 / 2.54;

export function cmToInches(cm) {
    const n = Number(cm);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * IN_PER_CM);
}

export function inchesToCm(inches) {
    const n = Number(inches);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 2.54 * 10) / 10;
}

export function formatLength(cm, imperial) {
    const n = Number(cm);
    if (!Number.isFinite(n)) return '';
    return imperial ? `${cmToInches(n)} in` : `${Math.round(n)} cm`;
}

/** Parse a shopper-typed length. Imperial: inches (6–240). Metric: cm (15–600). Returns cm. */
export function parseCustomLengthToCm(raw, imperial) {
    if (raw == null || raw === '') return null;
    const n = parseFloat(String(raw).replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!Number.isFinite(n)) return null;
    if (imperial) {
        if (n < 6 || n > 240) return null;
        return inchesToCm(n);
    }
    if (n < 15 || n > 600) return null;
    return Math.round(n * 10) / 10;
}

export function chipDisplayValue(cm, imperial) {
    return imperial ? String(cmToInches(cm)) : String(cm);
}

export function selectedMatchesChip(selectedCm, chipCm, imperial) {
    if (selectedCm == null) return false;
    if (!imperial) return selectedCm === chipCm;
    return cmToInches(selectedCm) === cmToInches(chipCm);
}
