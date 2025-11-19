/**
 * Before/After Slider Component
 */
export const Slider = ({ beforeImage, afterImage }) => {
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.borderRadius = '12px';
    container.style.overflow = 'hidden';
    container.style.border = '1px dashed rgba(148, 163, 184, 0.9)';
    container.style.background = '#f8fafc';
    container.style.aspectRatio = '4/3';

    // Before Image (Bottom)
    const imgBefore = document.createElement('img');
    imgBefore.src = beforeImage;
    imgBefore.style.position = 'absolute';
    imgBefore.style.inset = '0';
    imgBefore.style.width = '100%';
    imgBefore.style.height = '100%';
    imgBefore.style.objectFit = 'cover';

    // After Image (Top, Clipped)
    const imgAfter = document.createElement('img');
    imgAfter.src = afterImage;
    imgAfter.style.position = 'absolute';
    imgAfter.style.inset = '0';
    imgAfter.style.width = '100%';
    imgAfter.style.height = '100%';
    imgAfter.style.objectFit = 'cover';
    imgAfter.style.clipPath = 'inset(0 50% 0 0)';
    imgAfter.style.transition = 'clip-path 0.05s linear';

    // Divider Line
    const divider = document.createElement('div');
    divider.style.position = 'absolute';
    divider.style.top = '0';
    divider.style.bottom = '0';
    divider.style.left = '50%';
    divider.style.width = '2px';
    divider.style.background = 'white';
    divider.style.boxShadow = '0 0 4px rgba(0,0,0,0.5)';
    divider.style.pointerEvents = 'none';
    divider.style.transition = 'left 0.05s linear';

    // Range Input (The controller)
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.value = '50';
    range.style.position = 'absolute';
    range.style.bottom = '12px';
    range.style.left = '50%';
    range.style.transform = 'translateX(-50%)';
    range.style.width = '80%';
    range.style.zIndex = '10';
    range.style.cursor = 'ew-resize';

    range.oninput = (e) => {
        const val = e.target.value;
        imgAfter.style.clipPath = `inset(0 ${100 - val}% 0 0)`;
        divider.style.left = `${val}%`;
    };

    container.appendChild(imgBefore);
    container.appendChild(imgAfter);
    container.appendChild(divider);
    container.appendChild(range);

    return container;
};
