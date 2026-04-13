/**
 * Optional email field — bottom of modal; links shopper to server-side preview history.
 */
import { store, actions } from '../../state/store.js';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WidgetFooter() {
    const wrap = document.createElement('div');
    wrap.className = 'aif-widget-footer';

    const label = document.createElement('label');
    label.className = 'aif-widget-footer__label';
    label.setAttribute('for', 'aif-shopper-email');
    label.textContent = 'Email (optional)';

    const input = document.createElement('input');
    input.id = 'aif-shopper-email';
    input.type = 'email';
    input.className = 'aif-widget-footer__input';
    input.placeholder = 'you@example.com';
    input.setAttribute('autocomplete', 'email');
    input.setAttribute('inputmode', 'email');

    const hint = document.createElement('p');
    hint.className = 'aif-widget-footer__hint';
    hint.textContent = 'Save your previews for this store across visits.';

    let localEdit = '';

    const commit = () => {
        const v = (input.value || '').trim().toLowerCase();
        if (v && !EMAIL_OK.test(v)) {
            hint.textContent = 'Enter a valid email or leave blank.';
            hint.style.color = '#b91c1c';
            return;
        }
        hint.style.color = '';
        hint.textContent = 'Save your previews for this store across visits.';
        actions.setUserEmail(v);
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        }
    });

    input.addEventListener('blur', () => {
        const v = (input.value || '').trim().toLowerCase();
        if (v === localEdit) return;
        commit();
    });

    input.addEventListener('input', () => {
        localEdit = (input.value || '').trim().toLowerCase();
    });

    store.subscribe((state) => {
        const e = state.userEmail || '';
        if (document.activeElement !== input && e !== input.value.trim().toLowerCase()) {
            input.value = e;
            localEdit = e;
        }
    });

    wrap.appendChild(label);
    wrap.appendChild(input);
    wrap.appendChild(hint);

    const initial = store.getState();
    input.value = initial.userEmail || '';
    localEdit = (input.value || '').trim().toLowerCase();

    return wrap;
}
