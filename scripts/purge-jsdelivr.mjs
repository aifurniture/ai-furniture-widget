#!/usr/bin/env node
/**
 * Purge jsDelivr CDN cache for GitHub branch URLs.
 * API docs: https://github.com/jsdelivr/jsdelivr#purge-cache
 *
 * Usage:
 *   node scripts/purge-jsdelivr.mjs
 *   node scripts/purge-jsdelivr.mjs embed.js dist/widget.js
 */

const DEFAULT_PATHS = ['embed.js', 'dist/widget.js', 'loader.js'];
const REPO = 'aifurniture/ai-furniture-widget';
const BRANCH = 'main';

const paths = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_PATHS;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function purgePath(filePath) {
    const cdnUrl = `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/${filePath}`;
    const purgeUrl = `https://purge.jsdelivr.net/gh/${REPO}@${BRANCH}/${filePath}`;

    const res = await fetch(purgeUrl, { method: 'GET' });
    const body = await res.json().catch(() => ({}));
    const entry = body?.paths?.[`/gh/${REPO}@${BRANCH}/${filePath}`] || {};
    const throttled = !!entry.throttled;
    const ok = res.ok && !throttled;

    return { filePath, cdnUrl, purgeUrl, ok, throttled, body };
}

async function main() {
    console.log(`Purging ${paths.length} jsDelivr path(s) for @${BRANCH}…\n`);

    const results = [];
    for (let i = 0; i < paths.length; i++) {
        if (i > 0) await sleep(2500);
        const result = await purgePath(paths[i]);
        results.push(result);

        if (result.ok) {
            console.log(`✅ Purged: ${result.cdnUrl}`);
        } else if (result.throttled) {
            const reset = result.body?.paths
                ? Object.values(result.body.paths)[0]?.throttlingReset
                : null;
            console.log(`⏳ Throttled: ${result.cdnUrl}`);
            if (reset != null) console.log(`   Retry in ~${reset}s`);
        } else {
            console.log(`❌ Failed: ${result.cdnUrl}`);
            console.log(JSON.stringify(result.body, null, 2));
        }
    }

    const throttled = results.filter((r) => r.throttled);
    const ok = results.filter((r) => r.ok);

    console.log(`\nDone: ${ok.length} purged, ${throttled.length} throttled, ${results.length - ok.length - throttled.length} failed.`);

    if (throttled.length) {
        const reset = throttled[0].body?.paths
            ? Object.values(throttled[0].body.paths)[0]?.throttlingReset
            : 400;
        console.log(`\njsDelivr rate-limited this repo. Wait ~${reset}s, then run:`);
        console.log('  npm run purge:cdn');
        process.exitCode = 2;
    } else if (ok.length !== results.length) {
        process.exitCode = 1;
    }
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
