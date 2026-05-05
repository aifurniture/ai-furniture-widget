/**
 * Optional email — links shopper to server-side preview history; collapsed by default to reduce noise.
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

    const savedWrap = document.createElement('div');
    savedWrap.className = 'aif-widget-footer__saved';
    savedWrap.style.display = 'none';

    const savedLabel = document.createElement('div');
    savedLabel.className = 'aif-widget-footer__saved-label';

    const savedLink = document.createElement('button');
    savedLink.type = 'button';
    savedLink.className = 'aif-widget-footer__saved-link';
    savedLink.textContent = 'Open saved previews';
    savedLink.title = 'Go to Ready tab';
    savedLink.addEventListener('click', () => goToCompleted());

    savedWrap.appendChild(savedLabel);
    savedWrap.appendChild(savedLink);

    const details = document.createElement('details');
    details.className = 'aif-widget-footer__details';

    const summary = document.createElement('summary');
    summary.className = 'aif-widget-footer__summary';
    summary.textContent = 'Optional: link email to see previews on any device';

    const formWrap = document.createElement('div');
    formWrap.className = 'aif-widget-footer__form';

    const label = document.createElement('label');
    label.className = 'aif-widget-footer__label';
    label.setAttribute('for', 'aif-shopper-email');
    label.textContent = 'Email';

    const input = document.createElement('input');
    input.id = 'aif-shopper-email';
    input.type = 'email';
    input.className = 'aif-widget-footer__input';
    input.placeholder = 'you@example.com';
    input.setAttribute('autocomplete', 'email');
    input.setAttribute('inputmode', 'email');

    const hint = document.createElement('p');
    hint.className = 'aif-widget-footer__hint';
    hint.textContent =
        'Previews are already kept in this browser. Add an email only if you want them on other devices too.';

    const commit = () => {
        const v = (input.value || '').trim().toLowerCase();
        if (v && !EMAIL_OK.test(v)) {
            hint.textContent = 'Enter a valid email or leave blank.';
            hint.style.color = '#b91c1c';
            return false;
        }
        hint.style.color = '';
        hint.textContent =
            'Previews are already kept in this browser. Add an email only if you want them on other devices too.';
        actions.setUserEmail(v);
        return true;
    };

    const row = document.createElement('div');
    row.className = 'aif-widget-footer__row';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'aif-widget-footer__submit';
    submitBtn.textContent = 'Link email';
    submitBtn.title = 'Save email and open saved server history';

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
                hint.textContent = 'Linked. Your previews for this store also appear under Ready → Saved.';
            } else {
                hint.textContent = 'Email removed. This browser still keeps previews until you clear them.';
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

    details.appendChild(summary);
    details.appendChild(formWrap);

    wrap.appendChild(savedWrap);
    wrap.appendChild(details);

    const updateMode = (state) => {
        const e = (state.userEmail || '').trim();
        const hasEmail = e.length > 0 && EMAIL_OK.test(e.toLowerCase());
        wrap.classList.toggle('aif-widget-footer--has-email', hasEmail);
        if (hasEmail) {
            savedWrap.style.display = '';
            details.style.display = 'none';
            savedLabel.textContent = `Linked as ${e}`;
            if (document.activeElement !== input) {
                input.value = e;
            }
        } else {
            savedWrap.style.display = 'none';
            details.style.display = '';
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
