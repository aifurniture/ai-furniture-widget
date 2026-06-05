/**
 * iOS safe-area + visual viewport sync for embedded storefronts (often lack viewport-fit=cover).
 */

function probeInset(prop) {
    if (typeof document === 'undefined') return 0;
    const el = document.createElement('div');
    el.style.cssText = [
        'position:fixed',
        'visibility:hidden',
        'pointer-events:none',
        `padding-${prop}:env(safe-area-inset-${prop})`
    ].join(';');
    document.documentElement.appendChild(el);
    const value = parseFloat(getComputedStyle(el).getPropertyValue(`padding-${prop}`)) || 0;
    el.remove();
    return value;
}

function isNotchIphone() {
    if (!/iPhone/i.test(navigator.userAgent || '')) return false;
    const h = Math.max(window.screen.height, window.screen.width);
    const w = Math.min(window.screen.height, window.screen.width);
    return h >= 812 && w >= 375;
}

export function syncMobileLayoutVars() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const root = document.documentElement;
    let safeTop = probeInset('top');
    let safeBottom = probeInset('bottom');
    let safeLeft = probeInset('left');
    let safeRight = probeInset('right');

    if (isNotchIphone() && safeTop === 0 && safeBottom === 0) {
        safeTop = 47;
        safeBottom = 34;
    }

    if (window.visualViewport && window.visualViewport.offsetTop > 0) {
        safeTop = Math.max(safeTop, Math.round(window.visualViewport.offsetTop));
    }

    const vvh = Math.round(window.visualViewport?.height || window.innerHeight);

    root.style.setProperty('--aif-safe-top', `${safeTop}px`);
    root.style.setProperty('--aif-safe-bottom', `${safeBottom}px`);
    root.style.setProperty('--aif-safe-left', `${safeLeft}px`);
    root.style.setProperty('--aif-safe-right', `${safeRight}px`);
    root.style.setProperty('--aif-vvh', `${vvh}px`);

    const container = document.querySelector('#ai-furniture-modal .aif-container');
    if (container && window.innerWidth <= 768) {
        container.style.height = `${vvh}px`;
        container.style.maxHeight = `${vvh}px`;
    }

    const trigger = document.getElementById('ai-furniture-trigger-btn');
    if (trigger) {
        const isMobile = window.innerWidth <= 768;
        const base = isMobile ? 16 : 20;
        trigger.style.bottom = `${Math.max(base, safeBottom + 12)}px`;
        trigger.style.right = `${Math.max(base, safeRight + 12)}px`;
    }
}

let initialized = false;

export function initMobileLayout() {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;

    syncMobileLayoutVars();

    window.visualViewport?.addEventListener('resize', syncMobileLayoutVars);
    window.visualViewport?.addEventListener('scroll', syncMobileLayoutVars);
    window.addEventListener('resize', syncMobileLayoutVars);
    window.addEventListener('orientationchange', () => {
        setTimeout(syncMobileLayoutVars, 80);
        setTimeout(syncMobileLayoutVars, 320);
    });
}
