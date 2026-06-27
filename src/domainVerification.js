// src/domainVerification.js
import { debugLog } from './debug.js';

/** Auth is enforced on the backend API — widget UI always loads. */
export function verifyDomain() {
    debugLog('Client domain check skipped (backend validates Domain ID on API calls)');
    return true;
}

export async function verifyDomainWithServer() {
    return true;
}
