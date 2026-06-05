/**
 * Mobile safe-area + visual viewport sync for embedded storefronts (often lack viewport-fit=cover).
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

function isAndroidMobile() {
    return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent) && window.innerWidth <= 768;
}

function applyInsetFallbacks(insets) {
    let { top, bottom, left, right } = insets;

    if (isNotchIphone() && top === 0 && bottom === 0) {
        top = 47;
        bottom = 34;
    }

    if (isAndroidMobile()) {
        if (top === 0) top = 32;
        if (right === 0) right = 12;
        if (left === 0) left = 12;
    }

    if (window.visualViewport && window.visualViewport.offsetTop > 0) {
        top = Math.max(top, Math.round(window.visualViewport.offsetTop));
    }

    return { top, bottom, left, right };
}

export function syncMobileLayoutVars() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const root = document.documentElement;
    const raw = {
        top: probeInset('top'),
        bottom: probeInset('bottom'),
        left: probeInset('left'),
        right: probeInset('right')
    };
    const { top: safeTop, bottom: safeBottom, left: safeLeft, right: safeRight } =
        applyInsetFallbacks(raw);

    const vvh = Math.round(window.visualViewport?.height || window.innerHeight);
    const drawerHeight = Math.max(320, vvh - safeTop);

    root.style.setProperty('--aif-safe-top', `${safeTop}px`);
    root.style.setProperty('--aif-safe-bottom', `${safeBottom}px`);
    root.style.setProperty('--aif-safe-left', `${safeLeft}px`);
    root.style.setProperty('--aif-safe-right', `${safeRight}px`);
    root.style.setProperty('--aif-vvh', `${vvh}px`);
    root.style.setProperty('--aif-drawer-height', `${drawerHeight}px`);

    const container = document.querySelector('#ai-furniture-modal .aif-container');
    if (container && window.innerWidth <= 768) {
        container.style.top = `${safeTop}px`;
        container.style.left = `${safeLeft}px`;
        container.style.right = `${safeRight}px`;
        container.style.width = 'auto';
        container.style.height = `${drawerHeight}px`;
        container.style.maxHeight = `${drawerHeight}px`;
    } else if (container) {
        container.style.top = '';
        container.style.left = '';
        container.style.right = '';
        container.style.width = '';
        container.style.height = '';
        container.style.maxHeight = '';
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
