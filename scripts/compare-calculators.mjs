// Side-by-side dose comparison: PoolDex vs Pool Math (TFP) vs Orenda.
// Calibrated from Kevin's controlled measurements 2026-04-28.
//
// Confidence:
//   PoolDex   EXACT    — formulas extracted from index.html source.
//   Orenda    HIGH     — calibrated from 5 measurements (linearity in volume,
//                        TA buffer slope, FC baseline). TA model is linear.
//                        Conflict noted: an earlier user report of 55.59 fl oz
//                        for a 30,360 gal SWG case doesn't fit this calibration
//                        (predicts ~32 fl oz). Possible Orenda SWG-specific mult.
//   Pool Math HIGH     — calibrated from 4 measurements. TA model is non-linear:
//                        less reduction at low TA, more boost at high TA.
//
// Run: node scripts/compare-calculators.mjs

// ---------- PoolDex (extracted from index.html) ----------
const PoolDex = {
  phDown(drop, gallons, ta, style = 'aggressive') {
    const baseline = 10; // fl oz / 0.2 pH drop / 10k gal at TA 100
    const taBuffer = ta && ta > 0 ? Math.max(0.5, Math.min(2.0, ta / 100)) : 1.0;
    const styleMult = style === 'conservative' ? 0.5 : 1.0;
    return baseline * (drop / 0.2) * taBuffer * (gallons / 10000) * styleMult;
  },
  fcUp(ppm, gallons) { return 10.7 * ppm * (gallons / 10000); },
  taUp(ppm, gallons) { return 24.0 * (ppm / 10) * (gallons / 10000); }, // CORRECTED 2026-04-28
  chUp(ppm, gallons) { return 12.5 * (ppm / 10) * (gallons / 10000); },
  cyaUp(ppm, gallons) { return 13.4 * (ppm / 10) * (gallons / 10000); },
};

// ---------- Pool Math / TFP (calibrated from Kevin's measurements) ----------
// Calibration data:
//   A: 10k, 0.5 drop, TA 100 → 11.00 fl oz  → baseline 4.40 fl oz/0.2/10k
//   B: 20k, same chemistry → 23.00 fl oz   → linear in volume (2.09×, ~rounding)
//   C: 10k, TA 60  → 8.90 fl oz             → TA factor 0.809
//   D: 10k, TA 150 → 20.00 fl oz            → TA factor 1.818
// TA factor fit (quadratic from 3 points):
//   f(TA) ≈ 1.291 - 0.01575·TA + 0.0001284·TA²
const PoolMath = {
  phDown(drop, gallons, ta) {
    const baseline = 4.40;
    const taBuffer = ta && ta > 0
      ? 1.291 - 0.01575 * ta + 0.0001284 * ta * ta
      : 1.0;
    return baseline * (drop / 0.2) * Math.max(0.4, taBuffer) * (gallons / 10000);
  },
  fcUp(ppm, gallons) { return 10.7 * ppm * (gallons / 10000); }, // TFP wiki standard
  taUp(ppm, gallons) { return 23.5 * (ppm / 10) * (gallons / 10000); }, // user-verified 47 oz / 20 ppm / 10k
  chUp(ppm, gallons) { return 12.0 * (ppm / 10) * (gallons / 10000); },
  cyaUp(ppm, gallons) { return 13.0 * (ppm / 10) * (gallons / 10000); },
};

// ---------- Orenda (calibrated from Kevin's measurements) ----------
// Calibration data:
//   A: 10k, 0.5 drop, TA 100 → 13.14 fl oz → baseline 5.256 fl oz/0.2/10k
//   B: 20k, same chemistry → 26.28 fl oz   → exactly 2× (linear in volume ✓)
//   C: 10k, TA 60  → 7.91 fl oz             → TA factor 0.602 (≈ 60/100)
//   D: 10k, TA 150 → 19.61 fl oz            → TA factor 1.493 (≈ 150/100)
//   E: 10k, +1 ppm FC, 12.5% liquid → 10.24 fl oz → 10.24 fl oz/ppm/10k
//      (~4% below the TFP/PoolDex baseline of 10.7 — essentially identical)
const Orenda = {
  phDown(drop, gallons, ta) {
    const baseline = 5.256;
    const taBuffer = ta && ta > 0 ? ta / 100 : 1.0; // linear, no clamp seen
    return baseline * (drop / 0.2) * taBuffer * (gallons / 10000);
  },
  fcUp(ppm, gallons) { return 10.24 * ppm * (gallons / 10000); },
  taUp(ppm, gallons) { return 22.4 * (ppm / 10) * (gallons / 10000); }, // user-verified 2.8 lbs / 20 ppm / 10k
  chUp(ppm, gallons) { return 12.0 * (ppm / 10) * (gallons / 10000); }, // estimate
  cyaUp(ppm, gallons) { return 13.5 * (ppm / 10) * (gallons / 10000); }, // estimate
};

// ---------- Helpers ----------
const pad = (n, w = 7) => n.toFixed(2).padStart(w);
function row(label, pdAgg, pdCons, pm, or, unit) {
  const dPm = pm ? `${(((pm - pdAgg) / pdAgg) * 100).toFixed(0)}%` : '—';
  const dOr = or ? `${(((or - pdAgg) / pdAgg) * 100).toFixed(0)}%` : '—';
  console.log(
    `  ${label.padEnd(38)} ${pad(pdAgg)}  ${pad(pdCons)}  ${pad(pm)} ${dPm.padStart(5)}  ${pad(or)} ${dOr.padStart(5)}  ${unit}`
  );
}
function header(title) {
  console.log(`\n${'═'.repeat(96)}\n${title}\n${'═'.repeat(96)}`);
  console.log(`  ${'Scenario'.padEnd(38)} ${'PD-Agg'.padStart(7)}  ${'PD-Con'.padStart(7)}  ${'PoolMath'.padStart(7)}      ${'Orenda'.padStart(7)}        ${'Unit'}`);
  console.log(`  ${'─'.repeat(38)} ${'─'.repeat(7)}  ${'─'.repeat(7)}  ${'─'.repeat(13)}  ${'─'.repeat(13)}  ────`);
}

// ---------- Calibration verification (sanity check vs raw measurements) ----------
console.log('═'.repeat(96));
console.log('CALIBRATION CHECK — model output vs raw measurements');
console.log('═'.repeat(96));
function check(label, predicted, observed, unit) {
  const err = Math.abs(predicted - observed) / observed * 100;
  const ok = err < 3;
  console.log(`  ${ok ? '✓' : '✗'} ${label.padEnd(50)} predicted ${pad(predicted)} ${unit}, observed ${pad(observed)} ${unit}  (err ${err.toFixed(1)}%)`);
}
check('Orenda A: 10k, 0.5 drop, TA 100', Orenda.phDown(0.5, 10000, 100), 13.14, 'fl oz');
check('Orenda B: 20k, 0.5 drop, TA 100', Orenda.phDown(0.5, 20000, 100), 26.28, 'fl oz');
check('Orenda C: 10k, 0.5 drop, TA 60',  Orenda.phDown(0.5, 10000, 60),  7.91,  'fl oz');
check('Orenda D: 10k, 0.5 drop, TA 150', Orenda.phDown(0.5, 10000, 150), 19.61, 'fl oz');
check('Orenda E: 10k, +1 ppm FC',         Orenda.fcUp(1, 10000),          10.24, 'fl oz');
check('PoolMath A: 10k, 0.5 drop, TA 100', PoolMath.phDown(0.5, 10000, 100), 11.00, 'fl oz');
check('PoolMath B: 20k, 0.5 drop, TA 100', PoolMath.phDown(0.5, 20000, 100), 23.00, 'fl oz');
check('PoolMath C: 10k, 0.5 drop, TA 60',  PoolMath.phDown(0.5, 10000, 60),  8.90,  'fl oz');
check('PoolMath D: 10k, 0.5 drop, TA 150', PoolMath.phDown(0.5, 10000, 150), 20.00, 'fl oz');
check('Orenda F: 10k, +20 ppm TA',         Orenda.taUp(20, 10000),           44.80, 'oz wt');
check('PoolMath F: 10k, +20 ppm TA',       PoolMath.taUp(20, 10000),         47.00, 'oz wt');

// ---------- Scenarios ----------
header('pH DOWN — 31.45% muriatic acid');
{
  const cases = [
    { label: 'Standard 10k pool, 0.2 drop, TA 100', drop: 0.2, gal: 10000, ta: 100 },
    { label: 'Standard 10k pool, 0.5 drop, TA 100', drop: 0.5, gal: 10000, ta: 100 },
    { label: 'Standard 20k pool, 0.3 drop, TA 100', drop: 0.3, gal: 20000, ta: 100 },
    { label: 'Low TA 60: 10k pool, 0.5 drop',       drop: 0.5, gal: 10000, ta: 60  },
    { label: 'High TA 150: 10k pool, 0.5 drop',     drop: 0.5, gal: 10000, ta: 150 },
    { label: '30,360 gal SWG, 0.5 drop, TA 80',     drop: 0.5, gal: 30360, ta: 80  },
  ];
  for (const c of cases) {
    row(c.label,
      PoolDex.phDown(c.drop, c.gal, c.ta, 'aggressive'),
      PoolDex.phDown(c.drop, c.gal, c.ta, 'conservative'),
      PoolMath.phDown(c.drop, c.gal, c.ta),
      Orenda.phDown(c.drop, c.gal, c.ta),
      'fl oz');
  }
}

header('FC UP — 12.5% liquid chlorine');
{
  const cases = [
    { label: '10k pool, +1 ppm', ppm: 1, gal: 10000 },
    { label: '10k pool, +3 ppm', ppm: 3, gal: 10000 },
    { label: '20k pool, +3 ppm', ppm: 3, gal: 20000 },
  ];
  for (const c of cases) {
    row(c.label,
      PoolDex.fcUp(c.ppm, c.gal),
      PoolDex.fcUp(c.ppm, c.gal),
      PoolMath.fcUp(c.ppm, c.gal),
      Orenda.fcUp(c.ppm, c.gal),
      'fl oz');
  }
}

header('TA UP — baking soda  (PD-Agg shows post-fix value of 24)');
{
  const cases = [
    { label: '10k pool, +10 ppm TA', ppm: 10, gal: 10000 },
    { label: '10k pool, +20 ppm TA', ppm: 20, gal: 10000 },
    { label: '20k pool, +30 ppm TA', ppm: 30, gal: 20000 },
  ];
  for (const c of cases) {
    row(c.label,
      PoolDex.taUp(c.ppm, c.gal),
      PoolDex.taUp(c.ppm, c.gal),
      PoolMath.taUp(c.ppm, c.gal),
      Orenda.taUp(c.ppm, c.gal),
      'oz wt');
  }
}

console.log(`
${'═'.repeat(96)}
KEY TAKEAWAYS (calibrated from your measurements)
${'═'.repeat(96)}

  pH DOWN — the headline finding:
    PoolDex Aggressive:    100% (full TFP wiki baseline, 10 fl oz/0.2/10k @ TA 100)
    PoolDex Conservative:   50% of Aggressive
    Orenda:                 53% of PoolDex Aggressive — close to PoolDex Conservative!
    Pool Math:              44% of PoolDex Aggressive — slightly below Conservative

    Translation: PoolDex Conservative ≈ Orenda. Pool Math is even more cautious.
    PoolDex Aggressive is roughly DOUBLE both real-world calculators.

  TA buffer behavior:
    Orenda  — strict linear (TA/100). Same shape as PoolDex.
    PoolMath — non-linear: less reduction at low TA, more boost at high TA.
              At TA 60 they cut by 19% (vs 40% for linear).
              At TA 150 they boost by 82% (vs 50% for linear).

  FC up — all three calculators agree:
    PoolDex / Pool Math: 10.7 fl oz/ppm/10k of 12.5% liquid chlorine.
    Orenda:               10.24 fl oz/ppm/10k (~4% lower; effectively identical).

  TA up — was a calibration bug, now fixed:
    Pool Math: 23.5 oz wt baking soda / 10 ppm / 10k gal (TFP wiki: 24)
    Orenda:    22.4 oz wt
    PoolDex:   was 14, now 24 (FIXED to match TFP wiki + user-verified data)
    Pre-fix users would have under-dosed TA by 40% and lost trust on retest.

  STRATEGIC IMPLICATION FOR POOLDEX:
    Your "Aggressive" mode is significantly more aggressive than Orenda — the
    most aggressive real-world calculator on the market. Two options:

    (A) Keep current behavior, rename labels:
        "Aggressive" → "Theoretical (TFP wiki baseline)"
        "Conservative" → "Real-world (matches Orenda)"
        Honest framing; calls out that Aggressive is academic, not field-tested.

    (B) Recalibrate Aggressive to match Orenda (~5.3 baseline):
        Then Conservative becomes ~2.6 baseline (half of Orenda).
        Closer to industry norms but loses the "if you trust the wiki" mode.

    Strong recommendation: option A. Keep the math, fix the labels and copy.
    For your Reddit post: lead with "Conservative ≈ Pool Math, Aggressive ≈
    full TFP wiki baseline (more aggressive than both reference calculators)."
`);
