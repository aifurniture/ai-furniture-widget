/**
 * Minimal privacy note — no email or account UI.
 */
export function WidgetFooter() {
    const wrap = document.createElement('div');
    wrap.className = 'aif-widget-footer';
    wrap.style.padding = '8px 16px 12px';
    wrap.style.textAlign = 'center';
    wrap.style.fontSize = '10px';
    wrap.style.color = '#94a3b8';
    wrap.style.lineHeight = '1.4';
    wrap.textContent = 'Your photo is only used to create your preview.';
    return wrap;
}
