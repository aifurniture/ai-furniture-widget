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

    // Allow localhost and local development domains
    const isLocalDevelopment = (
        currentHostname === 'localhost' ||
        currentHostname === '127.0.0.1' ||
        currentHostname === '0.0.0.0' ||
        currentHostname.startsWith('192.168.') ||
        currentHostname.startsWith('10.0.') ||
        currentHostname.startsWith('172.16.') ||
        currentHostname.endsWith('.local')
    );

    if (isLocalDevelopment) {
        debugLog('Domain verification skipped for local development', { currentHostname });
        console.log('🔧 AI Furniture Widget: Running in local development mode');
        return true;
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

        // Ensure apiEndpoint is defined - use fallback if missing
        let apiEndpoint = config.apiEndpoint;
        if (!apiEndpoint) {
            // Fallback to default production endpoint if config is missing
            const isLocalMode = window.location.hostname === 'localhost' || 
                               window.location.hostname === '127.0.0.1' || 
                               window.location.hostname === '0.0.0.0';
            apiEndpoint = isLocalMode 
                ? 'http://localhost:3000/api' 
                : 'https://ai-furniture-backend.vercel.app/api';
            console.warn('⚠️ apiEndpoint was undefined in domainVerification, using fallback:', apiEndpoint);
        }

        // Validate apiEndpoint is a valid URL
        if (!apiEndpoint || typeof apiEndpoint !== 'string') {
            console.error('❌ Invalid API endpoint, cannot verify domain with server');
            return true; // Proceed with client-side verification only
        }

        // Use config API endpoint (auto-detects localhost)
        const healthUrl = `${apiEndpoint}/health?domain=${encodeURIComponent(window.location.hostname)}`;
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
