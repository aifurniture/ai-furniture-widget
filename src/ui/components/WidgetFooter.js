/**
 * Optional email field — bottom of modal; links shopper to server-side preview history.
 */
import { store, actions, VIEWS } from '../../state/store.js';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function goToCompleted() {
    actions.setView(VIEWS.QUEUE);
    actions.setQueueTab('completed');
    actions.syncShopperGenerations();
}

export function WidgetFooter() {
    const wrap = document.createElement('div');
    wrap.className = 'aif-widget-footer';

    // Shown when shopper has saved an email — no need to re-enter
    const savedWrap = document.createElement('div');
    savedWrap.className = 'aif-widget-footer__saved';
    savedWrap.style.display = 'none';

    const savedLabel = document.createElement('div');
    savedLabel.className = 'aif-widget-footer__saved-label';

    const savedLink = document.createElement('button');
    savedLink.type = 'button';
    savedLink.className = 'aif-widget-footer__saved-link';
    savedLink.textContent = 'Open Completed previews →';
    savedLink.title = 'Go to Queue → Completed tab';
    savedLink.addEventListener('click', () => goToCompleted());

    savedWrap.appendChild(savedLabel);
    savedWrap.appendChild(savedLink);

    // Email form (optional)
    const formWrap = document.createElement('div');
    formWrap.className = 'aif-widget-footer__form';

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
                goToCompleted();
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

    const maybeCommit = () => {
        const v = (input.value || '').trim().toLowerCase();
        const saved = (store.getState().userEmail || '').trim().toLowerCase();
        if (v === saved) return;
        commit();
    };

    input.addEventListener('blur', maybeCommit);
    input.addEventListener('change', maybeCommit);

    row.appendChild(input);
    row.appendChild(submitBtn);

    formWrap.appendChild(label);
    formWrap.appendChild(row);
    formWrap.appendChild(hint);

    wrap.appendChild(savedWrap);
    wrap.appendChild(formWrap);

    const updateMode = (state) => {
        const e = (state.userEmail || '').trim();
        const hasEmail = e.length > 0 && EMAIL_OK.test(e.toLowerCase());
        wrap.classList.toggle('aif-widget-footer--has-email', hasEmail);
        if (hasEmail) {
            savedWrap.style.display = '';
            formWrap.style.display = 'none';
            savedLabel.textContent = `Saved as ${e}`;
            if (document.activeElement !== input) {
                input.value = e;
            }
        } else {
            savedWrap.style.display = 'none';
            formWrap.style.display = '';
            if (document.activeElement !== input) {
                input.value = e;
            }
        }
    };

    store.subscribe(updateMode);

    const initial = store.getState();
    input.value = initial.userEmail || '';
    updateMode(initial);

    return wrap;
}
