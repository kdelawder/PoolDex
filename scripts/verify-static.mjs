// Static analysis of index.html: find missing i18n keys, mismatched element IDs.
import { readFileSync } from 'node:fs';

const file = readFileSync('index.html', 'utf8');

// ----- Extract i18n tables (EN + ES) -----
function extractI18nTable(label) {
  // Look for "const I18N_<lang> = { ... }" — fall back to inline scan
  const re = /'([a-zA-Z][a-zA-Z0-9_.]+)'\s*:\s*['"`]/g;
  const keys = new Set();
  let m;
  while ((m = re.exec(file)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

// Locate I18N table boundaries by the en: { / es: { markers
const enMarker = file.search(/^\s*en:\s*\{/m);
const esMarker = file.search(/^\s*es:\s*\{/m);
if (enMarker === -1 || esMarker === -1) {
  console.error('Could not locate EN/ES i18n boundaries (en:/es: markers).');
  process.exit(1);
}
const enBlock = file.slice(enMarker, esMarker);
// ES block runs from `es: {` until the closing of the I18N table — find the next top-level
// closing that ends the I18N const. Easiest: take everything up to the next `};` after es:.
const afterEs = file.slice(esMarker);
const esEndRel = afterEs.search(/\n\s*\};\s*\n/);
const esBlock = esEndRel === -1 ? afterEs : afterEs.slice(0, esEndRel);

function extractKeys(block) {
  const re = /^[ \t]*'([a-zA-Z][a-zA-Z0-9_.]+)'\s*:\s*['"`]/gm;
  const keys = new Set();
  let m;
  while ((m = re.exec(block)) !== null) keys.add(m[1]);
  return keys;
}

// Keys ending in '.' are dynamic-prefix false positives (e.g., tr('glossary.' + key))
function isDynamicPrefix(k) { return k.endsWith('.'); }

const enKeys = extractKeys(enBlock);
const esKeys = extractKeys(esBlock);

// ----- Extract all tr('key') / tr("key") calls -----
const trCalls = new Set();
const trRe = /\btr\s*\(\s*['"`]([a-zA-Z][a-zA-Z0-9_.]+)['"`]/g;
let m;
while ((m = trRe.exec(file)) !== null) trCalls.add(m[1]);

// ----- Extract data-i18n="key" attributes from HTML -----
const dataI18n = new Set();
const dRe = /data-i18n(?:-html|-placeholder)?\s*=\s*"([a-zA-Z][a-zA-Z0-9_.]+)"/g;
while ((m = dRe.exec(file)) !== null) dataI18n.add(m[1]);

const allReferenced = new Set([...trCalls, ...dataI18n]);

// ----- Cross-check -----
const missingInEn = [];
const missingInEs = [];
for (const k of allReferenced) {
  if (isDynamicPrefix(k)) continue; // skip 'glossary.' / 'nav.' style concatenation roots
  if (!enKeys.has(k)) missingInEn.push(k);
  if (!esKeys.has(k)) missingInEs.push(k);
}

console.log('=== i18n consistency ===');
console.log(`EN keys: ${enKeys.size}, ES keys: ${esKeys.size}, referenced (tr+data-i18n): ${allReferenced.size}`);
if (missingInEn.length) {
  console.log(`\n✗ ${missingInEn.length} keys referenced but missing from EN:`);
  missingInEn.slice(0, 30).forEach(k => console.log('   ' + k));
} else {
  console.log('✓ All referenced keys exist in EN');
}
if (missingInEs.length) {
  console.log(`\n✗ ${missingInEs.length} keys referenced but missing from ES:`);
  missingInEs.slice(0, 30).forEach(k => console.log('   ' + k));
} else {
  console.log('✓ All referenced keys exist in ES');
}

// ----- Element ID consistency -----
const htmlIds = new Set();
const idRe = /\bid\s*=\s*"([a-zA-Z][a-zA-Z0-9_-]*)"/g;
while ((m = idRe.exec(file)) !== null) htmlIds.add(m[1]);

// Also accept template literal IDs like id="tgt-${k}-min" by detecting prefix patterns
const dynamicIdPrefixes = new Set();
const dynRe = /\bid\s*=\s*[`"]([a-zA-Z][a-zA-Z0-9_-]*)\$\{/g;
while ((m = dynRe.exec(file)) !== null) dynamicIdPrefixes.add(m[1]);

const getByIdRefs = new Set();
const gRe = /\bgetElementById\s*\(\s*['"`]([a-zA-Z][a-zA-Z0-9_-]*)['"`]\s*\)/g;
while ((m = gRe.exec(file)) !== null) getByIdRefs.add(m[1]);

// Also catch template literal element IDs in JS
const dynGetRe = /\bgetElementById\s*\(\s*`([a-zA-Z][a-zA-Z0-9_-]*)\$\{/g;
while ((m = dynGetRe.exec(file)) !== null) dynamicIdPrefixes.add(m[1]);

const missingHtmlIds = [];
for (const id of getByIdRefs) {
  if (htmlIds.has(id)) continue;
  // Skip if any dynamic prefix matches
  if ([...dynamicIdPrefixes].some(p => id.startsWith(p))) continue;
  missingHtmlIds.push(id);
}

console.log('\n=== Element ID consistency ===');
console.log(`HTML ids: ${htmlIds.size}, getElementById refs: ${getByIdRefs.size}`);
if (missingHtmlIds.length) {
  console.log(`\n✗ ${missingHtmlIds.length} getElementById refs without matching HTML id:`);
  missingHtmlIds.forEach(id => console.log('   ' + id));
} else {
  console.log('✓ All getElementById refs have matching HTML ids');
}

// ----- Function reference consistency -----
const onclickRefs = new Set();
const oRe = /\bon(?:click|change|input)\s*=\s*"([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
while ((m = oRe.exec(file)) !== null) onclickRefs.add(m[1]);

const definedFns = new Set();
const fRe = /\bfunction\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
while ((m = fRe.exec(file)) !== null) definedFns.add(m[1]);

const missingFns = [];
for (const fn of onclickRefs) {
  if (!definedFns.has(fn)) missingFns.push(fn);
}

console.log('\n=== Function references in HTML attrs ===');
console.log(`HTML onclick/onchange refs: ${onclickRefs.size}, JS function defs: ${definedFns.size}`);
if (missingFns.length) {
  console.log(`\n✗ ${missingFns.length} HTML inline-handler refs not defined as JS functions:`);
  missingFns.forEach(fn => console.log('   ' + fn));
} else {
  console.log('✓ All inline HTML handlers reference defined functions');
}

const failed = missingInEn.length + missingInEs.length + missingHtmlIds.length + missingFns.length;
console.log(`\n${failed === 0 ? '✓' : '✗'} ${failed} static issue(s) found`);
process.exit(failed === 0 ? 0 : 1);
