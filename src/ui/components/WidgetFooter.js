/**
 * Attribution + privacy note. Widget links must follow Google link-spam rules:
 * branded visible anchor, real href, rel=nofollow (does not pass ranking credit).
 * https://developers.google.com/search/docs/essentials/spam-policies#link-spam
 */
const AIFURNITURE_HOME = 'https://aifurniture.app/';

export function WidgetFooter() {
    const wrap = document.createElement('div');
    wrap.className = 'aif-widget-footer';

    const note = document.createElement('p');
    note.className = 'aif-widget-footer__note';
    note.textContent = 'Your photo is only used to create your preview.';

    const credit = document.createElement('p');
    credit.className = 'aif-widget-footer__credit';

    credit.appendChild(document.createTextNode('Learn more at '));

    const link = document.createElement('a');
    link.className = 'aif-widget-footer__more';
    link.href = AIFURNITURE_HOME;
    link.target = '_blank';
    link.rel = 'nofollow noopener noreferrer';
    link.textContent = 'AI Furniture';
    link.setAttribute('aria-label', 'AI Furniture (opens in a new tab)');

    credit.appendChild(link);

    wrap.appendChild(note);
    wrap.appendChild(credit);
    return wrap;
}
