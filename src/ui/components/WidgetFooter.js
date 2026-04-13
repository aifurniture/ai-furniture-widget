/**
 * Optional email field — bottom of modal; links shopper to server-side preview history.
 */
import { store, actions, VIEWS } from '../../state/store.js';

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

    const commit = () => {
        const v = (input.value || '').trim().toLowerCase();
        if (v && !EMAIL_OK.test(v)) {
            hint.textContent = 'Enter a valid email or leave blank.';
            hint.style.color = '#b91c1c';
            return false;
        }
        hint.style.color = '';
        hint.textContent = 'Save your previews for this store across visits.';
        actions.setUserEmail(v);
        return true;
    };

    const row = document.createElement('div');
    row.className = 'aif-widget-footer__row';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'aif-widget-footer__submit';
    submitBtn.textContent = 'Save';
    submitBtn.title = 'Save email and load saved previews in Queue → Completed';

    const applyEmail = async () => {
        const v = (input.value || '').trim().toLowerCase();
        if (v && !EMAIL_OK.test(v)) {
            hint.textContent = 'Enter a valid email or leave blank.';
            hint.style.color = '#b91c1c';
            return;
        }
        hint.style.color = '';
        submitBtn.disabled = true;
        try {
            await actions.setUserEmail(v);
            if (v) {
                actions.setView(VIEWS.QUEUE);
                actions.setQueueTab('completed');
                hint.textContent =
                    'Saved for this session. Your previews from this store appear under Queue → Completed.';
            } else {
                hint.textContent = 'Email cleared.';
            }
        } finally {
            submitBtn.disabled = false;
        }
    };

    submitBtn.addEventListener('click', () => {
        applyEmail();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyEmail();
        }
    });

    /** Blur / change: persist when value differs from what is already saved (do not compare to live typing — that always matched and skipped save). */
    const maybeCommit = () => {
        const v = (input.value || '').trim().toLowerCase();
        const saved = (store.getState().userEmail || '').trim().toLowerCase();
        if (v === saved) return;
        commit();
    };

    input.addEventListener('blur', maybeCommit);
    input.addEventListener('change', maybeCommit);

    store.subscribe((state) => {
        const e = state.userEmail || '';
        if (document.activeElement !== input && e !== input.value.trim().toLowerCase()) {
            input.value = e;
        }
    });

    row.appendChild(input);
    row.appendChild(submitBtn);

    wrap.appendChild(label);
    wrap.appendChild(row);
    wrap.appendChild(hint);

    const initial = store.getState();
    input.value = initial.userEmail || '';

    return wrap;
}
