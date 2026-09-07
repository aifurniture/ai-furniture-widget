import { resolveWidgetTheme } from './theme.js';

function readConfig() {
    if (typeof window === 'undefined') return {};
    return window.FURNITURE_AI_CONFIG || {};
}

/**
 * Bottom inset for the floating launcher (px). Higher = further above storefront chrome.
 */
export function computeLauncherBottom(isMobile, safeBottom = 0) {
    const theme = resolveWidgetTheme(readConfig()) || {};
    const base = Math.max(isMobile ? 16 : 20, safeBottom + 12);

    if (typeof theme.launcherBottom === 'number' && !isMobile) {
        return Math.max(base, theme.launcherBottom);
    }
    if (typeof theme.launcherBottomMobile === 'number' && isMobile) {
        return Math.max(base, theme.launcherBottomMobile);
    }

    const extra = Number(theme.launcherBottomExtra) || 0;
    return base + extra;
}

export function computeLauncherRight(isMobile, safeRight = 0) {
    const theme = resolveWidgetTheme(readConfig()) || {};
    const base = Math.max(isMobile ? 16 : 20, safeRight + 12);

    if (typeof theme.launcherRight === 'number') {
        return Math.max(base, theme.launcherRight);
    }

    const extra = Number(theme.launcherRightExtra) || 0;
    return base + extra;
}
