// src/domainVerification.js
import { getConfig } from './state.js';
import { debugLog } from './debug.js';

export function verifyDomain() {
    const config = getConfig();
    const currentHostname = window.location.hostname;
    const configuredDomain = config.domain;

    if (!configuredDomain) {
        console.error('🚫 AI Furniture Widget: Domain not configured.');
        return false;
    }

    const normalizedCurrent = currentHostname.replace(/^www\./, '');
    const normalizedConfigured = configuredDomain
        .replace(/^www\./, '')
        .replace(/^https?:\/\//, '');

    if (normalizedCurrent !== normalizedConfigured) {
        console.error(
            '🚫 AI Furniture Widget: Unauthorized domain. Widget is configured for "' +
            configuredDomain +
            '" but running on "' +
            currentHostname + '"'
        );
        return false;
    }

    debugLog('Domain verified on client', { currentHostname, configuredDomain });
    return true;
}

export async function verifyDomainWithServer() {
    const config = getConfig();

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // Use config API endpoint (auto-detects localhost)
        const healthUrl = `${config.apiEndpoint}/health?domain=${encodeURIComponent(window.location.hostname)}`;
        const response = await fetch(healthUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal
        });
        console.log(response)
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error('🚫 AI Furniture Widget: Domain not authorized by server. Status:', response.status);
            return false;
        }

        console.log('✅ AI Furniture Widget: Domain verified by server');
        return true;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn('⚠️ AI Furniture Widget: Server verification timeout, proceeding with client-side verification only');
        } else {
            console.warn('⚠️ AI Furniture Widget: Could not verify domain with server, proceeding with client-side verification only:', error.message);
        }
        return true; // Proceed if server check fails (network issues, etc.)
    }
}
