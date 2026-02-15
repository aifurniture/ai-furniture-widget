// src/domainVerification.js
import { getConfig } from './state.js';
import { debugLog } from './debug.js';

export function verifyDomain() {
    const config = getConfig();
    const currentHostname = window.location.hostname;

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

    // Client-side check is just a basic validation - actual verification happens on server
    // We always proceed to server verification for production domains
    debugLog('Domain check passed (will verify with backend database)', { currentHostname });
    return true;
}

export async function verifyDomainWithServer() {
    const config = getConfig();
    const currentHostname = window.location.hostname;

    // Allow localhost and local development domains - skip server check
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
        debugLog('Skipping server verification for local development', { currentHostname });
        return true;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

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
            return false; // Fail if we can't verify with backend
        }

        // Normalize domain by removing www prefix - backend should check for either version
        // This allows both "chesspoop.fyi" and "www.chesspoop.fyi" to work if either is in database
        const normalizedDomain = currentHostname.replace(/^www\./, '');
        
        // Check backend database to see if domain is allowed (with or without www)
        // Backend should check its database for both "domain.com" and "www.domain.com" variations
        // and return 200 if either is found, 403 if neither is found
        const healthUrl = `${apiEndpoint}/health?domain=${encodeURIComponent(normalizedDomain)}`;
        console.log('🔍 Checking backend database for domain:', normalizedDomain, '(normalized from:', currentHostname + ')');
        
        const response = await fetch(healthUrl, {
            method: 'GET',
            headers: { 
                'Accept': 'application/json',
            },
            signal: controller.signal,
            credentials: 'omit', // Don't send cookies for CORS
            mode: 'cors', // Explicitly set CORS mode
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(
                '🚫 AI Furniture Widget: Domain "' + currentHostname + '" (normalized: "' + normalizedDomain + '") is not authorized. ' +
                'Server returned status ' + response.status + '. ' +
                'Please ensure this domain (with or without www) is registered in the backend database.'
            );
            return false; // Domain not in database - reject
        }

        const responseData = await response.json().catch(() => ({}));
        console.log('✅ AI Furniture Widget: Domain verified by backend database:', normalizedDomain, '(from:', currentHostname + ')');
        debugLog('Domain verified by server database', { currentHostname, normalizedDomain, responseData });
        return true;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('❌ AI Furniture Widget: Server verification timeout. Cannot verify domain with backend database.');
        } else {
            console.error('❌ AI Furniture Widget: Could not verify domain with backend database:', error.message);
        }
        return false; // Fail if we can't reach the backend - security first
    }
}
