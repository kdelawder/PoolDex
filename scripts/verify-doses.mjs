// Standalone verification of pH/FC dose math against known TFP/Orenda baselines.
// Run: node scripts/verify-doses.mjs

const DOSE_PER_10K = {
  liquidChlorine:    { qty: 10.7 },
  liquidChlorine10:  { qty: 13.4 },
  liquidChlorine825: { qty: 16.2 },
  liquidChlorine6:   { qty: 22.3 },
  calHypo:           { qty: 2.1 },
  dichlor:           { qty: 2.4 },
  muriaticAcid:      { qty: 10 },
  muriaticAcid14:    { qty: 22 },
  dryAcid:           { qty: 12 },
  borax:             { qty: 12 },
  sodaAsh:           { qty: 6 },
};

const TA_REF = 100;
function taBufferOf(ta) {
  if (!ta || ta <= 0) return 1.0;
  return Math.max(0.5, Math.min(2.0, ta / TA_REF));
}

function pHDoseFor(chemKey, drop, gallons, ta) {
  const dose = DOSE_PER_10K[chemKey];
  return dose.qty * (drop / 0.2) * taBufferOf(ta) * (gallons / 10000);
}

function fcDoseFor(chemKey, ppmNeeded, gallons) {
  const dose = DOSE_PER_10K[chemKey];
  return dose.qty * ppmNeeded * (gallons / 10000);
}

const tests = [
  // pH down — 31.45% muriatic, baseline conditions
  { name: '31% muriatic, 0.2 pH drop, 10k gal, TA 100',
    fn: () => pHDoseFor('muriaticAcid', 0.2, 10000, 100), expected: 10, tol: 0.1, unit: 'fl oz' },
  // pH down — 14.5% muriatic should be ~2.17x of 31%
  { name: '14.5% muriatic, 0.2 pH drop, 10k gal, TA 100',
    fn: () => pHDoseFor('muriaticAcid14', 0.2, 10000, 100), expected: 22, tol: 0.1, unit: 'fl oz' },
  // pH down — dry acid sodium bisulfate
  { name: 'Dry acid, 0.2 pH drop, 10k gal, TA 100',
    fn: () => pHDoseFor('dryAcid', 0.2, 10000, 100), expected: 12, tol: 0.1, unit: 'oz wt' },
  // pH up — borax
  { name: 'Borax, 0.2 pH rise, 10k gal, TA 100',
    fn: () => pHDoseFor('borax', 0.2, 10000, 100), expected: 12, tol: 0.1, unit: 'oz wt' },
  // pH up — soda ash
  { name: 'Soda ash, 0.2 pH rise, 10k gal, TA 100',
    fn: () => pHDoseFor('sodaAsh', 0.2, 10000, 100), expected: 6, tol: 0.1, unit: 'oz wt' },

  // TA buffer — low TA reduces dose
  { name: '31% muriatic, 0.2 pH drop, TA 60 (buffer 0.6x)',
    fn: () => pHDoseFor('muriaticAcid', 0.2, 10000, 60), expected: 6, tol: 0.1, unit: 'fl oz' },
  // TA buffer — high TA increases dose
  { name: '31% muriatic, 0.2 pH drop, TA 150 (buffer 1.5x)',
    fn: () => pHDoseFor('muriaticAcid', 0.2, 10000, 150), expected: 15, tol: 0.1, unit: 'fl oz' },
  // TA buffer — clamp at low end (TA 40 → buffer floor 0.5x)
  { name: '31% muriatic, 0.2 pH drop, TA 40 (clamp 0.5x)',
    fn: () => pHDoseFor('muriaticAcid', 0.2, 10000, 40), expected: 5, tol: 0.1, unit: 'fl oz' },
  // TA buffer — clamp at high end (TA 300 → buffer ceiling 2.0x)
  { name: '31% muriatic, 0.2 pH drop, TA 300 (clamp 2.0x)',
    fn: () => pHDoseFor('muriaticAcid', 0.2, 10000, 300), expected: 20, tol: 0.1, unit: 'fl oz' },

  // Volume scaling — 20k gal pool, baseline TA
  { name: '31% muriatic, 0.2 pH drop, 20k gal, TA 100',
    fn: () => pHDoseFor('muriaticAcid', 0.2, 20000, 100), expected: 20, tol: 0.1, unit: 'fl oz' },

  // FC raise — 12.5% liquid, 1 ppm in 10k
  { name: '12.5% liquid chlorine, +1 ppm FC, 10k gal',
    fn: () => fcDoseFor('liquidChlorine', 1, 10000), expected: 10.7, tol: 0.1, unit: 'fl oz' },
  // FC raise — 10% liquid (TFP says ~13.4 fl oz)
  { name: '10% liquid chlorine, +1 ppm FC, 10k gal',
    fn: () => fcDoseFor('liquidChlorine10', 1, 10000), expected: 13.4, tol: 0.1, unit: 'fl oz' },
  // FC raise — 8.25% Clorox (TFP says ~16 fl oz)
  { name: '8.25% bleach, +1 ppm FC, 10k gal',
    fn: () => fcDoseFor('liquidChlorine825', 1, 10000), expected: 16.2, tol: 0.2, unit: 'fl oz' },
  // FC raise — 6% bleach (TFP says ~22.3 fl oz)
  { name: '6% bleach, +1 ppm FC, 10k gal',
    fn: () => fcDoseFor('liquidChlorine6', 1, 10000), expected: 22.3, tol: 0.1, unit: 'fl oz' },
  // FC raise — cal-hypo 65%
  { name: 'Cal-Hypo 65%, +1 ppm FC, 10k gal',
    fn: () => fcDoseFor('calHypo', 1, 10000), expected: 2.1, tol: 0.05, unit: 'oz wt' },

  // Concentration ratios — 6% should be ~2.08x of 12.5%
  { name: '6% bleach / 12.5% liquid ratio',
    fn: () => fcDoseFor('liquidChlorine6', 1, 10000) / fcDoseFor('liquidChlorine', 1, 10000),
    expected: 12.5 / 6, tol: 0.05, unit: 'x' },
  // 8.25% should be ~1.515x of 12.5%
  { name: '8.25% bleach / 12.5% liquid ratio',
    fn: () => fcDoseFor('liquidChlorine825', 1, 10000) / fcDoseFor('liquidChlorine', 1, 10000),
    expected: 12.5 / 8.25, tol: 0.05, unit: 'x' },
];

let pass = 0, fail = 0;
for (const t of tests) {
  const actual = t.fn();
  const ok = Math.abs(actual - t.expected) <= t.tol;
  const status = ok ? '✓ PASS' : '✗ FAIL';
  console.log(`${status}  ${t.name}`);
  console.log(`         expected ${t.expected} ${t.unit} (±${t.tol}), got ${actual.toFixed(2)} ${t.unit}`);
  if (ok) pass++; else fail++;
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
