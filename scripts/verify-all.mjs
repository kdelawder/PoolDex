// Run every verification suite, summarize at the end.
import { spawnSync } from 'node:child_process';

const suites = [
  ['Static analysis (i18n, IDs, handlers)', 'scripts/verify-static.mjs'],
  ['Dose math (pH/FC, TA buffer, chemicals)', 'scripts/verify-doses.mjs'],
  ['LSI + target resolution',                 'scripts/verify-lsi.mjs'],
  ['Tier resolution (launch modes)',          'scripts/verify-tiers.mjs'],
  ['Addition order (TA before pH, Cl last)',  'scripts/verify-order.mjs'],
];

const results = [];
for (const [label, file] of suites) {
  console.log(`\n========== ${label} ==========`);
  const r = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  results.push([label, r.status === 0]);
}

console.log('\n========== SUMMARY ==========');
let allPass = true;
for (const [label, ok] of results) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) allPass = false;
}
process.exit(allPass ? 0 : 1);
