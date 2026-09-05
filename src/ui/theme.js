/**
 * Per-domain widget chrome. One bundle — CSS variables swap by hostname.
 * Optional override: FURNITURE_AI_CONFIG.theme = { primary: '#0b3374', ... }
 */

const THEME_VARS = {
    primary: '--aif-primary',
    primaryMid: '--aif-primary-mid',
    primaryHover: '--aif-primary-hover',
    primaryDark: '--aif-primary-dark',
    accentSoft: '--aif-accent-soft',
    accentGlow: '--aif-accent-glow',
    bgPanel: '--aif-bg-panel',
    bgElevated: '--aif-bg-elevated',
    textMain: '--aif-text-main',
    textMuted: '--aif-text-muted',
    border: '--aif-border',
    font: '--aif-font',
    fontDisplay: '--aif-font-display',
    radius: '--aif-radius',
};

/** Hostnames without www. */
export const DOMAIN_THEMES = {
    'platinumimportsinc.com': {
        primary: '#0b3374',
        primaryMid: '#1a4a9c',
        primaryHover: '#08255a',
        primaryDark: '#041633',
        accentSoft: '#eef3f9',
        accentGlow: 'rgba(214, 167, 77, 0.35)',
        bgPanel: '#f6f7f9',
        bgElevated: '#ffffff',
        textMain: '#222222',
        textMuted: '#777777',
        border: '#dde2ea',
        font: "Montserrat, ui-sans-serif, system-ui, sans-serif",
        fontDisplay: "Montserrat, ui-sans-serif, system-ui, sans-serif",
        radius: '18px',
    },
};

function normalizeHost(raw) {
    if (!raw || typeof raw !== 'string') return '';
    return raw
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
        .split(':')[0]
        .toLowerCase()
        .trim();
}

function pickDomain(config) {
    return normalizeHost(
        config?.domain ||
            (typeof window !== 'undefined' && window.location && window.location.hostname) ||
            ''
    );
}

export function resolveWidgetTheme(config = {}) {
    const fromConfig =
        config.theme && typeof config.theme === 'object' && !Array.isArray(config.theme)
            ? config.theme
            : null;
    const fromDomain = DOMAIN_THEMES[pickDomain(config)] || null;
    if (!fromConfig && !fromDomain) return null;
    return { ...(fromDomain || {}), ...(fromConfig || {}) };
}

export function applyWidgetTheme(config = {}) {
    if (typeof document === 'undefined') return;
    const theme = resolveWidgetTheme(config);
    if (!theme) return;

    const roots = [document.documentElement, document.getElementById('ai-furniture-modal')].filter(
        Boolean
    );
    for (const el of roots) {
        for (const [key, cssVar] of Object.entries(THEME_VARS)) {
            if (theme[key]) el.style.setProperty(cssVar, String(theme[key]));
        }
    }
}
