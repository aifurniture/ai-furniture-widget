/**
 * End-customer (shopper) email + generation history — backend /api/widget/* routes.
 */

export function getStorefrontDomain() {
    if (typeof window === 'undefined') return '';
    return window.location.hostname.replace(/^www\./, '');
}

function apiBase(apiEndpoint) {
    return (apiEndpoint || '').replace(/\/$/, '');
}

export async function postWidgetShopper(apiEndpoint, email, domain) {
    const res = await fetch(`${apiBase(apiEndpoint)}/widget/shopper`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify({ email, domain }),
        credentials: 'omit'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

export async function fetchWidgetGenerations(apiEndpoint, email, domain) {
    const q = new URLSearchParams({ email, domain });
    const res = await fetch(`${apiBase(apiEndpoint)}/widget/generations?${q}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
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
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}
