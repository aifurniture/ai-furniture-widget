import fs from 'fs';
import path from 'path';

const src = 'dist/widget.js';
const dest = 'extensions/ai-furniture-widget/assets/widget.js';

if (!fs.existsSync(src)) {
  console.error(`Missing ${src} — run npm run build first`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Copied ${src} -> ${dest}`);