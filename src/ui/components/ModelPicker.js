/**
 * Fast vs Best quality (slow) preview toggle.
 */
import { actions } from '../../state/store.js';

const OPTIONS = [
    {
        id: 'slow',
        label: 'Best quality',
        hint: 'Slower · sharper detail',
    },
    {
        id: 'fast',
        label: 'Fast',
        hint: 'Quicker preview',
    },
];

export function createModelPicker(selectedModel = 'slow', { compact = false } = {}) {
    const current = selectedModel === 'fast' ? 'fast' : 'slow';
    const wrap = document.createElement('div');
    wrap.className = `aif-model-picker${compact ? ' aif-model-picker--compact' : ''}`;
    wrap.setAttribute('role', 'radiogroup');
    wrap.setAttribute('aria-label', 'Preview speed');

    if (!compact) {
        const heading = document.createElement('p');
        heading.className = 'aif-model-picker__heading';
        heading.textContent = 'Preview speed';
        wrap.appendChild(heading);
    }

    const row = document.createElement('div');
    row.className = 'aif-model-picker__options';

    OPTIONS.forEach((opt) => {
        const selected = current === opt.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `aif-model-picker__option${selected ? ' is-selected' : ''}`;
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', selected ? 'true' : 'false');
        btn.setAttribute('aria-label', `${opt.label}. ${opt.hint}`);

        const label = document.createElement('span');
        label.className = 'aif-model-picker__label';
        label.textContent = opt.label;
        btn.appendChild(label);

        if (!compact) {
            const hint = document.createElement('span');
            hint.className = 'aif-model-picker__hint';
            hint.textContent = opt.hint;
            btn.appendChild(hint);
        }

        btn.onclick = () => {
            if (current !== opt.id) {
                actions.setSelectedModel(opt.id);
            }
        };
        row.appendChild(btn);
    });

    wrap.appendChild(row);
    return wrap;
}
