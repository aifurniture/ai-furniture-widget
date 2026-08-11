/**
 * Queue View Component - Enhanced with tabs and better UI
 */
import { actions, QUEUE_STATUS, VIEWS } from '../../state/store.js';
import { Button } from './Button.js';
import { trackEvent } from '../../tracking.js';

function toTimestampMs(value) {
    if (value == null) return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const ms = new Date(value).getTime();
        return Number.isFinite(ms) ? ms : 0;
    }
    return 0;
}

function queueItemSortTimestamp(item) {
    return toTimestampMs(
        item.completedAt || item.startedAt || item.queuedAt || item.timestamp || 0
    );
}

function sortQueueItemsNewestFirst(items) {
    return [...items].sort((a, b) => queueItemSortTimestamp(b) - queueItemSortTimestamp(a));
}

function sortRemoteGenerationsNewestFirst(entries) {
    return [...entries].sort((a, b) => toTimestampMs(b.createdAt) - toTimestampMs(a.createdAt));
}

function normalizePreviewUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
        const u = new URL(url);
        return `${u.origin}${u.pathname}`;
    } catch {
        return url.split('?')[0] || url;
    }
}

/** Merge session completed items with server history, skipping duplicates already in the queue. */
function buildReadyTabEntries(queue, remoteGenerations) {
    const sessionCompleted = sortQueueItemsNewestFirst(
        queue.filter((item) => item.status === QUEUE_STATUS.COMPLETED)
    );

    const sessionQueueIds = new Set(sessionCompleted.map((item) => item.id));
    const sessionPreviewUrls = new Set(
        sessionCompleted
            .map((item) => item.result?.generatedImageUrl)
            .filter(Boolean)
            .map(normalizePreviewUrl)
    );

    const savedOnly = sortRemoteGenerationsNewestFirst(remoteGenerations || []).filter((entry) => {
        const queueId = entry?.metadata?.queueId;
        if (queueId && sessionQueueIds.has(queueId)) return false;
        const previewUrl = normalizePreviewUrl(entry?.previewImageUrl);
        if (previewUrl && sessionPreviewUrls.has(previewUrl)) return false;
        return true;
    });

    return [
        ...sessionCompleted.map((item) => ({
            kind: 'session',
            ts: queueItemSortTimestamp(item),
            item
        })),
        ...savedOnly.map((entry) => ({
            kind: 'saved',
            ts: toTimestampMs(entry?.createdAt),
            entry
        }))
    ].sort((a, b) => b.ts - a.ts);
}

export const QueueView = (state) => {
    const container = document.createElement('div');
    container.className = 'aif-queue-view';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';
    container.style.height = '100%';
    container.style.minHeight = '0';
    container.style.overflow = 'hidden';

    const activeItem = state.queue.find(
        (i) => i.status === QUEUE_STATUS.PROCESSING || i.status === QUEUE_STATUS.PENDING
    );
    const failedItem = state.queue.find((i) => i.status === QUEUE_STATUS.ERROR);

    if (activeItem) {
        container.appendChild(createProgressView(activeItem));
        return container;
    }

    if (failedItem) {
        container.appendChild(createErrorView(failedItem));
        return container;
    }

    const remoteGenerations = state.remoteGenerations || [];
    const readyEntries = buildReadyTabEntries(state.queue, remoteGenerations);

    const header = document.createElement('div');
    header.className = 'aif-header';
    header.innerHTML = `
    <h2>Your previews</h2>
    <p>${readyEntries.length ? 'Tap a preview to open it.' : 'No previews yet.'}</p>
  `;
    container.appendChild(header);

    const list = document.createElement('div');
    list.className = 'aif-queue-list';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.flex = '1';
    list.style.minHeight = '0';
    list.style.overflow = 'auto';
    list.style.overscrollBehavior = 'contain';

    if (readyEntries.length === 0) {
        const empty = document.createElement('div');
        empty.style.textAlign = 'center';
        empty.style.padding = '24px 12px';
        empty.style.color = '#64748b';
        empty.innerHTML = `
            <p style="margin:0 0 16px; font-size:14px;">Take a room photo to see this product in your space.</p>
        `;
        const startBtn = Button({
            text: 'Take a photo',
            onClick: () => actions.setView(VIEWS.UPLOAD)
        });
        empty.appendChild(startBtn);
        list.appendChild(empty);
    } else {
        readyEntries.forEach((x) => {
            if (x.kind === 'saved') list.appendChild(createSavedHistoryRow(x.entry));
            else list.appendChild(createQueueItem(x.item));
        });
    }

    container.appendChild(list);

    const footer = document.createElement('div');
    footer.style.marginTop = 'auto';
    footer.style.flexShrink = '0';
    footer.appendChild(
        Button({
            text: 'New photo',
            variant: 'secondary',
            onClick: () => actions.setView(VIEWS.UPLOAD)
        })
    );
    container.appendChild(footer);

    return container;
};

const ANALYZE_STEPS = [
    { atMs: 0, label: 'Reading room geometry', detail: 'Walls, floor plane & camera angle' },
    { atMs: 3500, label: 'Finding scale anchors', detail: 'Doors, seating height & perspective cues' },
    {
        atMs: 8000,
        label: 'Calibrating product size',
        detailText: 'Matching catalog dimensions to the scene',
        detailWithCue: (cm) => `Using your ${cm} cm scale cue`,
    },
    { atMs: 14000, label: 'Aligning lighting & shadows', detail: 'Colour temperature, contact & cast shadows' },
    { atMs: 21000, label: 'Compositing into your photo', detail: 'Placing the piece with correct occlusion' },
    { atMs: 30000, label: 'Refining edges & realism', detail: 'Final photoreal polish' },
];

function analyzeProgressRatio(elapsedMs) {
    const t = Math.max(0, elapsedMs) / 40000;
    return Math.min(0.92, 1 - Math.exp(-2.1 * t));
}

function stepDetailText(step, item) {
    if (step.detailWithCue && typeof item?.furnitureWidthCm === 'number' && item.furnitureWidthCm > 0) {
        return step.detailWithCue(item.furnitureWidthCm);
    }
    return step.detailText || step.detail || '';
}

function createProgressView(item) {
    const wrap = document.createElement('div');
    wrap.className = 'aif-analyze-view';

    const header = document.createElement('div');
    header.className = 'aif-header aif-analyze-header';
    header.innerHTML = `
      <span class="aif-eyebrow">Room analysis</span>
      <h2>Placing it accurately…</h2>
      <p>Matching scale, lighting and perspective to your photo.</p>
    `;
    wrap.appendChild(header);

    const visual = document.createElement('div');
    visual.className = 'aif-analyze-visual';

    const roomFrame = document.createElement('div');
    roomFrame.className = 'aif-analyze-room';
    const roomSrc = item.userImageDataUrl || item.userImageUrl || item.result?.originalImageUrl;
    if (roomSrc) {
        const img = document.createElement('img');
        img.src = roomSrc;
        img.alt = '';
        roomFrame.appendChild(img);
    } else {
        roomFrame.classList.add('aif-analyze-room--empty');
    }
    const scan = document.createElement('div');
    scan.className = 'aif-analyze-scan';
    roomFrame.appendChild(scan);
    const grid = document.createElement('div');
    grid.className = 'aif-analyze-grid';
    roomFrame.appendChild(grid);
    visual.appendChild(roomFrame);

    const meter = document.createElement('div');
    meter.className = 'aif-analyze-meter';
    const meterTrack = document.createElement('div');
    meterTrack.className = 'aif-analyze-meter__track';
    const meterFill = document.createElement('div');
    meterFill.className = 'aif-analyze-meter__fill';
    meterTrack.appendChild(meterFill);
    const meterLabel = document.createElement('div');
    meterLabel.className = 'aif-analyze-meter__label';
    meter.appendChild(meterTrack);
    meter.appendChild(meterLabel);
    visual.appendChild(meter);

    wrap.appendChild(visual);

    const stepsEl = document.createElement('ol');
    stepsEl.className = 'aif-analyze-steps';
    stepsEl.setAttribute('aria-live', 'polite');

    const stepNodes = [];
    for (let index = 0; index < ANALYZE_STEPS.length; index++) {
        const step = ANALYZE_STEPS[index];
        const li = document.createElement('li');
        li.className = 'aif-analyze-step is-pending';
        li.dataset.stepIndex = String(index);
        const detail = stepDetailText(step, item);
        li.innerHTML = `
          <span class="aif-analyze-step__mark" aria-hidden="true"></span>
          <span class="aif-analyze-step__body">
            <span class="aif-analyze-step__label">${step.label}</span>
            <span class="aif-analyze-step__detail">${detail}</span>
          </span>
        `;
        stepsEl.appendChild(li);
        stepNodes.push(li);
    }
    wrap.appendChild(stepsEl);

    const hint = document.createElement('p');
    hint.className = 'aif-analyze-hint';
    hint.textContent = 'Usually 20–40s. Keep browsing — we’ll finish in the background.';
    wrap.appendChild(hint);

    const startedAt = item.startedAt || item.queuedAt || Date.now();
    let intervalId = 0;

    // Function declaration (hoisted) — avoids const/TDZ clashes with minified names
    function paintAnalyzeProgress() {
        if (intervalId && !wrap.isConnected) {
            clearInterval(intervalId);
            intervalId = 0;
            return;
        }
        const elapsed = Date.now() - startedAt;
        const ratio = analyzeProgressRatio(elapsed);
        meterFill.style.width = `${Math.round(ratio * 100)}%`;
        meterLabel.textContent = `${Math.round(ratio * 100)}% calibrated`;

        let activeIndex = 0;
        for (let i = 0; i < ANALYZE_STEPS.length; i++) {
            if (elapsed >= ANALYZE_STEPS[i].atMs) activeIndex = i;
        }

        for (let i = 0; i < stepNodes.length; i++) {
            const li = stepNodes[i];
            li.classList.remove('is-done', 'is-active', 'is-pending');
            if (i < activeIndex) li.classList.add('is-done');
            else if (i === activeIndex) li.classList.add('is-active');
            else li.classList.add('is-pending');
        }
    }

    intervalId = setInterval(paintAnalyzeProgress, 400);
    wrap._aifAnalyzeTimer = intervalId;
    // Paint after interval is assigned (and after the node is typically mounted next frame)
    requestAnimationFrame(paintAnalyzeProgress);

    return wrap;
}

function createErrorView(item) {
    const wrap = document.createElement('div');
    wrap.style.flex = '1';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.textAlign = 'center';
    wrap.style.padding = '24px 16px';
    wrap.style.gap = '12px';

    const icon = document.createElement('div');
    icon.textContent = '😕';
    icon.style.fontSize = '40px';

    const title = document.createElement('h2');
    title.style.margin = '0';
    title.style.fontSize = '18px';
    title.style.fontWeight = '600';
    title.textContent = "That didn't work";

    const msg = document.createElement('p');
    msg.style.margin = '0';
    msg.style.fontSize = '14px';
    msg.style.color = '#64748b';
    msg.style.maxWidth = '280px';
    msg.textContent = item.error || 'Something went wrong. Please try again.';

    const retryBtn = Button({
        text: 'Try again',
        onClick: () => {
            actions.updateQueueItem(item.id, { status: QUEUE_STATUS.PENDING, error: null });
        }
    });

    const newPhotoBtn = Button({
        text: 'New photo',
        variant: 'secondary',
        onClick: () => {
            actions.removeFromQueue(item.id);
            actions.setView(VIEWS.UPLOAD);
        }
    });

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.flexDirection = 'column';
    btnRow.style.gap = '8px';
    btnRow.style.width = '100%';
    btnRow.style.maxWidth = '280px';
    btnRow.style.marginTop = '8px';
    btnRow.appendChild(retryBtn);
    btnRow.appendChild(newPhotoBtn);

    wrap.appendChild(icon);
    wrap.appendChild(title);
    wrap.appendChild(msg);
    wrap.appendChild(btnRow);

    return wrap;
}

/** Server-stored preview (same shape as GET /api/widget/generations). */
function createSavedHistoryRow(entry) {
    const itemEl = document.createElement('div');
    itemEl.className = 'aif-queue-card';
    itemEl.style.padding = '10px';
    itemEl.style.background = '#ffffff';
    itemEl.style.borderRadius = '12px';
    itemEl.style.border = '1px solid #e2e8f0';
    itemEl.style.display = 'flex';
    itemEl.style.gap = '12px';
    itemEl.style.alignItems = 'center';
    itemEl.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';

    const thumbnail = document.createElement('div');
    thumbnail.style.width = '48px';
    thumbnail.style.height = '48px';
    thumbnail.style.borderRadius = '8px';
    thumbnail.style.background = '#f1f5f9';
    thumbnail.style.flexShrink = '0';
    thumbnail.style.overflow = 'hidden';

    const setExpiredState = () => {
        thumbnail.innerHTML = '';
        thumbnail.style.display = 'flex';
        thumbnail.style.alignItems = 'center';
        thumbnail.style.justifyContent = 'center';
        thumbnail.style.background = '#fff7ed';
        thumbnail.style.border = '1px solid #fed7aa';
        thumbnail.style.color = '#9a3412';
        thumbnail.style.fontSize = '10px';
        thumbnail.style.fontWeight = '700';
        thumbnail.style.letterSpacing = '0.04em';
        thumbnail.style.textTransform = 'uppercase';
        thumbnail.textContent = 'Expired';

        meta.textContent = 'Expired';
        viewBtn.disabled = true;
        viewBtn.style.opacity = '0.6';
        viewBtn.style.cursor = 'not-allowed';
    };

    const isSignedUrlExpired = (url) => {
        try {
            if (!url || typeof url !== 'string') return false;
            if (!url.includes('X-Amz-Expires=') || !url.includes('X-Amz-Date=')) return false;
            const u = new URL(url);
            const amzDate = u.searchParams.get('X-Amz-Date');
            const amzExpires = u.searchParams.get('X-Amz-Expires');
            if (!amzDate || !amzExpires) return false;
            const expiresSec = Number(amzExpires);
            if (!Number.isFinite(expiresSec) || expiresSec <= 0) return false;

            // X-Amz-Date format: YYYYMMDDTHHMMSSZ
            const m = amzDate.match(
                /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/
            );
            if (!m) return false;
            const issuedAt = Date.UTC(
                Number(m[1]),
                Number(m[2]) - 1,
                Number(m[3]),
                Number(m[4]),
                Number(m[5]),
                Number(m[6])
            );
            if (!Number.isFinite(issuedAt)) return false;
            const expiresAt = issuedAt + expiresSec * 1000;
            return Date.now() > expiresAt;
        } catch {
            return false;
        }
    };

    const content = document.createElement('div');
    content.style.flex = '1';
    content.style.minWidth = '0';

    const productName = document.createElement('div');
    productName.style.fontWeight = '600';
    productName.style.fontSize = '13px';
    productName.style.color = '#1e293b';
    let pathLabel = 'Preview';
    try {
        if (entry.productUrl) {
            pathLabel =
                new URL(entry.productUrl).pathname.split('/').filter(Boolean).pop() || pathLabel;
        }
    } catch {
        /* ignore */
    }
    productName.textContent = (entry.productName && entry.productName.slice(0, 60)) || pathLabel;

    const meta = document.createElement('div');
    meta.style.fontSize = '11px';
    meta.style.color = '#64748b';
    meta.style.marginTop = '2px';
    try {
        meta.textContent = entry.createdAt
            ? `Saved · ${new Date(entry.createdAt).toLocaleString()}`
            : 'Saved';
    } catch {
        meta.textContent = 'Saved';
    }

    content.appendChild(productName);
    content.appendChild(meta);

    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'View';
    viewBtn.style.padding = '8px 14px';
    viewBtn.style.background = '#059669';
    viewBtn.style.color = 'white';
    viewBtn.style.border = 'none';
    viewBtn.style.borderRadius = '8px';
    viewBtn.style.cursor = 'pointer';
    viewBtn.style.fontSize = '12px';
    viewBtn.style.fontWeight = '600';
    viewBtn.style.flexShrink = '0';
    // Default disabled until we confirm the thumbnail loads.
    viewBtn.disabled = true;
    viewBtn.style.opacity = '0.6';
    viewBtn.style.cursor = 'not-allowed';
    viewBtn.onclick = () => {
        if (viewBtn.disabled) return;
        actions.setGenerationResults([
            {
                url: entry.previewImageUrl,
                originalImageUrl: entry.originalImageUrl || '',
                originalAspectRatio: entry.metadata?.originalAspectRatio,
                originalWidth: entry.metadata?.originalWidth,
                originalHeight: entry.metadata?.originalHeight,
                imageS3Key: entry.metadata?.imageS3Key || null,
                furnitureWidthCm:
                    typeof entry.metadata?.furnitureWidthCm === 'number' &&
                    Number.isFinite(entry.metadata.furnitureWidthCm)
                        ? entry.metadata.furnitureWidthCm
                        : null
            }
        ]);
    };

    const img = document.createElement('img');
    img.src = entry.previewImageUrl;
    img.alt = '';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.loading = 'lazy';
    img.onload = () => {
        viewBtn.disabled = false;
        viewBtn.style.opacity = '';
        viewBtn.style.cursor = 'pointer';
    };
    img.onerror = () => {
        setExpiredState();
    };
    thumbnail.appendChild(img);

    itemEl.appendChild(thumbnail);
    itemEl.appendChild(content);
    itemEl.appendChild(viewBtn);

    // If the backend returned a signed URL and it's already expired, don't show a broken image.
    if (isSignedUrlExpired(entry.previewImageUrl)) {
        setExpiredState();
    }

    return itemEl;
}

function createQueueItem(item) {
    const itemEl = document.createElement('div');
    itemEl.className = 'aif-queue-card';
    itemEl.style.padding = '12px';
    itemEl.style.background = '#ffffff';
    itemEl.style.borderRadius = '12px';
    itemEl.style.border = '1px solid #e2e8f0';
    itemEl.style.display = 'flex';
    itemEl.style.gap = '12px';
    itemEl.style.alignItems = 'center';
    itemEl.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
    itemEl.style.cursor = 'pointer';

    const thumbnail = document.createElement('div');
    thumbnail.style.width = '56px';
    thumbnail.style.height = '56px';
    thumbnail.style.borderRadius = '8px';
    thumbnail.style.background = '#f1f5f9';
    thumbnail.style.flexShrink = '0';
    thumbnail.style.overflow = 'hidden';

    const previewUrl = item.result?.generatedImageUrl;
    if (previewUrl) {
        const img = document.createElement('img');
        img.src = previewUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        thumbnail.appendChild(img);
    } else if (item.userImageUrl) {
        const img = document.createElement('img');
        img.src = item.userImageUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        thumbnail.appendChild(img);
    } else {
        thumbnail.innerHTML = '<span style="font-size:24px;">🖼️</span>';
        thumbnail.style.display = 'flex';
        thumbnail.style.alignItems = 'center';
        thumbnail.style.justifyContent = 'center';
    }

    const content = document.createElement('div');
    content.style.flex = '1';
    content.style.minWidth = '0';

    const label = document.createElement('div');
    label.style.fontWeight = '600';
    label.style.fontSize = '14px';
    label.style.color = '#1e293b';
    label.textContent = 'Room preview';

    const meta = document.createElement('div');
    meta.style.fontSize = '12px';
    meta.style.color = '#64748b';
    meta.style.marginTop = '2px';
    meta.textContent = 'Tap to view';

    content.appendChild(label);
    content.appendChild(meta);

    const openPreview = () => {
        if (!item.result?.generatedImageUrl) return;
        trackEvent('results_viewed', {
            queueId: item.id,
            productUrl: item.productUrl,
            productName: item.productName,
            model: item.selectedModel,
            generationTime: item.result?.generationTime
        });
        actions.setGenerationResults([
            {
                url: item.result.generatedImageUrl,
                originalImageUrl: item.result?.originalImageUrl || item.userImageUrl || '',
                originalAspectRatio: item.result?.originalAspectRatio,
                originalWidth: item.result?.originalWidth,
                originalHeight: item.result?.originalHeight,
                imageS3Key: item.result?.imageS3Key || item.imageS3Key || null
            }
        ]);
    };

    itemEl.onclick = openPreview;

    itemEl.appendChild(thumbnail);
    itemEl.appendChild(content);

    return itemEl;
}

// Add spinner animation
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}
