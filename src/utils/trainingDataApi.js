/**
 * Training dataset export/reject — backend /api/training/* routes.
 */

function apiBase(apiEndpoint) {
    return (apiEndpoint || '').replace(/\/$/, '');
}

export async function exportTrainingPair(apiEndpoint, payload) {
    const res = await fetch(`${apiBase(apiEndpoint)}/training/pairs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'omit',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

export async function rejectTrainingItem(apiEndpoint, { itemNumber, folderName }) {
    const res = await fetch(`${apiBase(apiEndpoint)}/training/reject`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ itemNumber, folderName }),
        credentials: 'omit',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}
