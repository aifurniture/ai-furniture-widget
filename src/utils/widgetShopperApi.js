/**
 * Anonymous shopper preview history — backend /api/widget/* routes.
 */

export function getStorefrontDomain() {
    if (typeof window === 'undefined') return '';
    return window.location.hostname.replace(/^www\./, '');
}

function apiBase(apiEndpoint) {
    return (apiEndpoint || '').replace(/\/$/, '');
}

export async function fetchWidgetGenerations(apiEndpoint, { domain, anonymousClientKey }) {
    const q = new URLSearchParams();
    if (domain) q.set('domain', domain);
    if (anonymousClientKey) q.set('anonymousClientKey', anonymousClientKey);
    const res = await fetch(`${apiBase(apiEndpoint)}/widget/generations?${q}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

export async function postWidgetGeneration(apiEndpoint, payload) {
    const res = await fetch(`${apiBase(apiEndpoint)}/widget/generations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify(payload),
        credentials: 'omit'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

/** Start async widget generation (returns immediately; poll with fetchWidgetGenerationStatus). */
export async function startWidgetGeneration(apiEndpoint, formData) {
    const res = await fetch(`${apiBase(apiEndpoint)}/widget/generate`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
        credentials: 'omit'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

/** Poll async generation status by widget queueId. */
export async function fetchWidgetGenerationStatus(apiEndpoint, { queueId, domain, domainId }) {
    const q = new URLSearchParams();
    if (queueId) q.set('queueId', queueId);
    if (domain) q.set('domain', domain);
    if (domainId) q.set('domainId', domainId);
    const res = await fetch(`${apiBase(apiEndpoint)}/widget/generate?${q}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}
