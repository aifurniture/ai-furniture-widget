/**
 * Reusable Button Component
 */

export const Button = ({
    text,
    onClick,
    disabled = false,
    loading = false,
    variant = 'primary',
    className = ''
}) => {
    const button = document.createElement('button');
    button.className = `aif-btn-${variant} ${className}`;
    button.disabled = disabled || loading;

    if (loading) {
        const spinner = document.createElement('div');
        spinner.className = 'aif-spinner';
        button.appendChild(spinner);

        const span = document.createElement('span');
        span.textContent = ' ' + text;
        button.appendChild(span);

        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.gap = '8px';
    } else {
        button.textContent = text;
    }

    button.addEventListener('click', onClick);

    return button;
};
