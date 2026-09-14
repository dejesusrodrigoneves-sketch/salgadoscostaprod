// scripts/add-config-include.mjs — insere config.js antes do 1º script de js/ (idempotente)
import { readdir, readFile, writeFile } from 'node:fs/promises';

const TAG = '<script src="js/config.js"></script>';
// captura <script ... src="(./)?js/....js" ...> com quaisquer atributos (defer, type=module, etc.)
const SCRIPT_RE = /^([ \t]*)<script\b[^>]*\bsrc=["'](?:\.\/)?js\/[^"']+["'][^>]*>/im;

const files = (await readdir('.')).filter((f) => f.endsWith('.html'));
let changed = 0;
for (const f of files) {
  let html = await readFile(f, 'utf8');
  if (/<script\b[^>]*\bsrc=["'](?:\.\/)?js\/config\.js["']/i.test(html)) continue; // já tem
  const m = html.match(SCRIPT_RE);
  if (!m) { console.warn('sem <script js/...> em', f); continue; }
  html = html.replace(m[0], `${m[1]}${TAG}\n${m[0]}`);
  await writeFile(f, html);
  changed++;
  console.log('updated', f);
}
console.log(`total atualizados: ${changed}`);
