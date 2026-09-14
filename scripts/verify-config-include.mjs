// scripts/verify-config-include.mjs — garante exatamente 1 config.js e antes dos consumidores
import { readdir, readFile } from 'node:fs/promises';

const files = (await readdir('.')).filter((f) => f.endsWith('.html'));
const CONFIG_RE = /<script\b[^>]*\bsrc=["'](?:\.\/)?js\/config\.js["']/i;
let errors = 0;
for (const f of files) {
  const html = await readFile(f, 'utf8');
  const count = (html.match(new RegExp(CONFIG_RE.source, 'gi')) || []).length;
  const hasConsumer = /<script\b[^>]*\bsrc=["'](?:\.\/)?js\/(?!config\.js)[^"']+["']/i.test(html);
  if (hasConsumer && count !== 1) { console.error(`ERRO ${f}: ${count} referência(s) a config.js com consumidores js/`); errors++; continue; }
  if (!hasConsumer && count === 0) continue; // sem scripts js/ → config.js desnecessário
  const cfgIdx = html.search(CONFIG_RE);
  const firstConsumer = html.search(/<script\b[^>]*\bsrc=["'](?:\.\/)?js\/(?!config\.js)[^"']+["']/i);
  if (firstConsumer !== -1 && cfgIdx > firstConsumer) { console.error(`ERRO ${f}: config.js após consumidor`); errors++; }
}
if (errors) { console.error(`\n${errors} problema(s)`); process.exit(1); }
console.log(`OK: ${files.length} HTML com exatamente 1 config.js antes dos consumidores`);
