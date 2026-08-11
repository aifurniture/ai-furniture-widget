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

    // Only pad top/bottom when the theme lacks viewport-fit=cover — never invent
    // left/right gutters (those look like buggy side borders on the open drawer).
    if (isNotchIphone() && top === 0 && bottom === 0) {
        top = 47;
        bottom = 34;
    }

    if (isAndroidMobile()) {
        if (top === 0) top = 24;
        if (bottom === 0) bottom = 16;
    }

    if (window.visualViewport && window.visualViewport.offsetTop > 0) {
        top = Math.max(top, 0);
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

    const vv = window.visualViewport;
    const vvh = Math.round(vv?.height || window.innerHeight);
    const offsetTop = Math.round(vv?.offsetTop || 0);
    // Full visual viewport; safe areas are padding inside the drawer (not side gaps).
    const drawerHeight = Math.max(280, vvh);

    root.style.setProperty('--aif-safe-top', `${safeTop}px`);
    root.style.setProperty('--aif-safe-bottom', `${safeBottom}px`);
    root.style.setProperty('--aif-safe-left', `${safeLeft}px`);
    root.style.setProperty('--aif-safe-right', `${safeRight}px`);
    root.style.setProperty('--aif-vvh', `${vvh}px`);
    root.style.setProperty('--aif-drawer-height', `${drawerHeight}px`);
    root.style.setProperty('--aif-vv-offset-top', `${offsetTop}px`);

    const container = document.querySelector('#ai-furniture-modal .aif-container');
    if (container && window.innerWidth <= 768) {
        container.style.top = `${offsetTop}px`;
        container.style.left = '0';
        container.style.right = '0';
        container.style.bottom = 'auto';
        container.style.width = '100%';
        container.style.height = `${drawerHeight}px`;
        container.style.maxHeight = `${drawerHeight}px`;
        container.style.borderRadius = '0';
        container.style.border = 'none';
        container.style.boxShadow = 'none';
    } else if (container) {
        container.style.top = '';
        container.style.left = '';
        container.style.right = '';
        container.style.bottom = '';
        container.style.width = '';
        container.style.height = '';
        container.style.maxHeight = '';
        container.style.borderRadius = '';
        container.style.border = '';
        container.style.boxShadow = '';
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
