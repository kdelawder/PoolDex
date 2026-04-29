// Run every verification suite (pass/fail) + informational reports, summarize at the end.
// Test suites exit 0/1 and gate the overall pass/fail status.
// Reports are informational only — they print output but don't affect the gate.
import { spawnSync } from 'node:child_process';

const suites = [
  ['Static analysis (i18n, IDs, handlers)',   'scripts/verify-static.mjs'],
  ['Dose math (pH/FC, TA buffer, chemicals)', 'scripts/verify-doses.mjs'],
  ['LSI + target resolution',                 'scripts/verify-lsi.mjs'],
  ['Tier resolution (launch modes)',          'scripts/verify-tiers.mjs'],
  ['Addition order (TA before pH, Cl last)',  'scripts/verify-order.mjs'],
];

const reports = [
  ['Calculator comparison (vs Pool Math, Orenda)', 'scripts/compare-calculators.mjs'],
];

const results = [];
for (const [label, file] of suites) {
  console.log(`\n========== ${label} ==========`);
  const r = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  results.push([label, r.status === 0]);
}

for (const [label, file] of reports) {
  console.log(`\n========== REPORT: ${label} ==========`);
  spawnSync(process.execPath, [file], { stdio: 'inherit' });
}

console.log('\n========== SUMMARY ==========');
let allPass = true;
for (const [label, ok] of results) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) allPass = false;
}
for (const [label] of reports) {
  console.log(`📊 ${label} (informational)`);
}
process.exit(allPass ? 0 : 1);
