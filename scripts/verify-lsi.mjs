// LSI calculation, lsiStatus thresholds, and getTargets() override resolution.
// Mirrors the implementations in index.html.

// ---------- LSI ----------
const TF_TABLE = [
  [32, 0.0], [37, 0.1], [46, 0.2], [53, 0.3], [60, 0.4],
  [66, 0.5], [76, 0.6], [84, 0.7], [94, 0.8], [105, 0.9]
];

function calculateLSI(t) {
  const { ph, ta, ch } = t;
  const temp = t.temp || 80;
  if (!ph || !ta || !ch || !temp) return null;

  let TF;
  if (temp <= TF_TABLE[0][0]) TF = TF_TABLE[0][1];
  else if (temp >= TF_TABLE[TF_TABLE.length - 1][0]) TF = TF_TABLE[TF_TABLE.length - 1][1];
  else {
    for (let i = 0; i < TF_TABLE.length - 1; i++) {
      const [t0, f0] = TF_TABLE[i], [t1, f1] = TF_TABLE[i + 1];
      if (temp >= t0 && temp <= t1) { TF = f0 + (f1 - f0) * (temp - t0) / (t1 - t0); break; }
    }
  }

  const CF = Math.log10(ch) - 0.4;
  const AF = Math.log10(Math.max(1, ta));
  const tds = (t.salt && t.salt > 0) ? (t.salt + 700) : 1000;
  const TDSF = 12.10 + (Math.log10(tds) - 3) * 0.31;

  return Number((ph + TF + CF + AF - TDSF).toFixed(2));
}

function lsiStatus(lsi) {
  if (lsi === null) return 'noData';
  if (lsi < -0.6) return 'corrosive';
  if (lsi < -0.3) return 'under';
  if (lsi <= 0.3) return 'balanced';
  if (lsi <= 0.6) return 'over';
  return 'scaling';
}

// ---------- Targets ----------
function computeAutoTargets(c, latestCya) {
  const isSWG = c.sanitizer === 'swg';
  const cyaForFC = latestCya || (isSWG ? 75 : 40);
  let fcMin, fcTarget, fcMax;
  if (isSWG) {
    fcMin = Math.max(2, cyaForFC * 0.045);
    fcTarget = cyaForFC * 0.07;
    fcMax = cyaForFC * 0.10;
  } else {
    fcMin = Math.max(3, cyaForFC * 0.075);
    fcTarget = cyaForFC * 0.115;
    fcMax = cyaForFC * 0.15;
  }
  return {
    fc: [Number(fcMin.toFixed(1)), Number(fcMax.toFixed(1))],
    fcTarget: Number(fcTarget.toFixed(1)),
    ph: [7.2, 7.8], phTarget: 7.5,
    ta: (c.surface === 'plaster' || c.surface === 'pebble') ? [50, 90] : [60, 110],
    taTarget: (c.surface === 'plaster' || c.surface === 'pebble') ? 70 : 80,
    ch: c.surface === 'vinyl' ? [150, 300] : c.surface === 'fiberglass' ? [200, 400] : [250, 450],
    chTarget: c.surface === 'vinyl' ? 220 : c.surface === 'fiberglass' ? 300 : 350,
    cya: isSWG ? [70, 80] : [30, 50],
    cyaTarget: isSWG ? 75 : 40,
    salt: isSWG ? [2800, 3400] : [0, 500],
    saltTarget: isSWG ? 3200 : 0,
  };
}

const TARGET_METRICS = [
  { key: 'fc',   hasTarget: true  },
  { key: 'ph',   hasTarget: true  },
  { key: 'ta',   hasTarget: true  },
  { key: 'ch',   hasTarget: true  },
  { key: 'cya',  hasTarget: true  },
  { key: 'salt', hasTarget: true  },
];

function getTargets(c, overrides, latestCya) {
  const auto = computeAutoTargets(c, latestCya);
  const o = overrides || {};
  const isNum = v => (typeof v === 'number' && !isNaN(v));
  const pick = (v, f) => isNum(v) ? v : f;
  const out = {};
  for (const m of TARGET_METRICS) {
    const k = m.key;
    const min = pick(o[k + 'Min'], auto[k][0]);
    const max = pick(o[k + 'Max'], auto[k][1]);
    out[k] = [min, max];
    if (m.hasTarget) {
      let fb = auto[k + 'Target'];
      if (isNum(o[k + 'Min']) && isNum(o[k + 'Max'])) fb = (min + max) / 2;
      out[k + 'Target'] = pick(o[k + 'Target'], fb);
    }
  }
  return out;
}

// ---------- Tests ----------
const tests = [
  // LSI: balanced reference pool. pH 7.5, TA 80, CH 300, temp 80, no salt.
  // TF@80 = 0.6 + (0.7-0.6)*(80-76)/(84-76) = 0.65
  // CF = log10(300) - 0.4 = 2.477 - 0.4 = 2.077
  // AF = log10(80) = 1.903
  // TDSF = 12.10 + (log10(1000)-3)*0.31 = 12.10
  // LSI = 7.5 + 0.65 + 2.077 + 1.903 - 12.10 = 0.030 → 0.03
  { name: 'LSI balanced reference (pH 7.5, TA 80, CH 300, 80°F)',
    fn: () => calculateLSI({ ph: 7.5, ta: 80, ch: 300, temp: 80 }), expected: 0.03, tol: 0.02 },

  // LSI: scaling-tendency pool. High pH, high CH.
  // TF@85=0.71, CF=2.299, AF=2.079, TDSF=12.10 → 8.0+0.71+2.299+2.079-12.10 = 0.99
  { name: 'LSI scaling (pH 8.0, TA 120, CH 500, 85°F)',
    fn: () => calculateLSI({ ph: 8.0, ta: 120, ch: 500, temp: 85 }), expected: 0.99, tol: 0.02 },

  // LSI: low-end pool. Lowish pH, low CH, cool temp.
  // TF@60=0.4, CF=1.776, AF=1.778, TDSF=12.10 → 7.0+0.4+1.776+1.778-12.10 = -1.15
  { name: 'LSI under (pH 7.0, TA 60, CH 150, 60°F)',
    fn: () => calculateLSI({ ph: 7.0, ta: 60, ch: 150, temp: 60 }), expected: -1.15, tol: 0.02 },

  // LSI: SWG pool with salt. salt 3200 → TDS 3900 → TDSF = 12.10 + (log10(3900)-3)*0.31
  // = 12.10 + 0.591*0.31 = 12.10 + 0.183 = 12.283
  // pH 7.5, TA 70, CH 350, 80°F: TF=0.65, CF=2.144, AF=1.845
  // LSI = 7.5 + 0.65 + 2.144 + 1.845 - 12.283 = -0.144 → -0.14
  { name: 'LSI SWG with salt 3200 (pH 7.5, TA 70, CH 350)',
    fn: () => calculateLSI({ ph: 7.5, ta: 70, ch: 350, temp: 80, salt: 3200 }), expected: -0.14, tol: 0.05 },

  // LSI: missing data returns null
  { name: 'LSI null when CH missing',
    fn: () => calculateLSI({ ph: 7.5, ta: 80, temp: 80 }), expected: null, tol: 0 },

  // TF interpolation at exact anchors
  { name: 'LSI temperature clamp at low end (32°F)',
    fn: () => calculateLSI({ ph: 7.5, ta: 80, ch: 300, temp: 30 }) - calculateLSI({ ph: 7.5, ta: 80, ch: 300, temp: 32 }),
    expected: 0, tol: 0.001 },
  { name: 'LSI temperature clamp at high end (110°F)',
    fn: () => calculateLSI({ ph: 7.5, ta: 80, ch: 300, temp: 120 }) - calculateLSI({ ph: 7.5, ta: 80, ch: 300, temp: 105 }),
    expected: 0, tol: 0.001 },

  // lsiStatus thresholds
  { name: 'lsiStatus -0.61 → corrosive', fn: () => lsiStatus(-0.61) === 'corrosive' ? 1 : 0, expected: 1, tol: 0 },
  { name: 'lsiStatus -0.6 → under (boundary inclusive)', fn: () => lsiStatus(-0.6) === 'under' ? 1 : 0, expected: 1, tol: 0 },
  { name: 'lsiStatus -0.3 → balanced', fn: () => lsiStatus(-0.3) === 'balanced' ? 1 : 0, expected: 1, tol: 0 },
  { name: 'lsiStatus 0 → balanced', fn: () => lsiStatus(0) === 'balanced' ? 1 : 0, expected: 1, tol: 0 },
  { name: 'lsiStatus 0.3 → balanced', fn: () => lsiStatus(0.3) === 'balanced' ? 1 : 0, expected: 1, tol: 0 },
  { name: 'lsiStatus 0.31 → over', fn: () => lsiStatus(0.31) === 'over' ? 1 : 0, expected: 1, tol: 0 },
  { name: 'lsiStatus 0.7 → scaling', fn: () => lsiStatus(0.7) === 'scaling' ? 1 : 0, expected: 1, tol: 0 },

  // Targets — defaults for chlorine pool with plaster surface
  { name: 'Auto targets: chlorine + plaster pH range = [7.2, 7.8]',
    fn: () => { const t = getTargets({ sanitizer: 'tabs', surface: 'plaster' }, {}, null); return t.ph[0] === 7.2 && t.ph[1] === 7.8 ? 1 : 0; },
    expected: 1, tol: 0 },
  { name: 'Auto targets: chlorine + plaster TA target = 70',
    fn: () => getTargets({ sanitizer: 'tabs', surface: 'plaster' }, {}, null).taTarget,
    expected: 70, tol: 0 },
  { name: 'Auto targets: vinyl CH target = 220',
    fn: () => getTargets({ sanitizer: 'tabs', surface: 'vinyl' }, {}, null).chTarget,
    expected: 220, tol: 0 },
  { name: 'Auto targets: SWG CYA target = 75',
    fn: () => getTargets({ sanitizer: 'swg', surface: 'plaster' }, {}, null).cyaTarget,
    expected: 75, tol: 0 },
  { name: 'Auto targets: SWG salt target = 3200',
    fn: () => getTargets({ sanitizer: 'swg', surface: 'plaster' }, {}, null).saltTarget,
    expected: 3200, tol: 0 },
  // FC scales with CYA: SWG with cya 75 → fcTarget = 75 * 0.07 = 5.25
  { name: 'Auto targets: SWG FC target tracks CYA (cya=75 → fc=5.25)',
    fn: () => getTargets({ sanitizer: 'swg', surface: 'plaster' }, {}, 75).fcTarget,
    expected: 5.3, tol: 0.1 }, // toFixed(1) → 5.3
  // Chlorine with cya 40 → fcTarget = 40 * 0.115 = 4.6
  { name: 'Auto targets: tabs FC target tracks CYA (cya=40 → fc=4.6)',
    fn: () => getTargets({ sanitizer: 'tabs', surface: 'plaster' }, {}, 40).fcTarget,
    expected: 4.6, tol: 0.1 },

  // *** The bug Kevin hit ***
  // User overrode pH min/max to [9, 10] but did NOT override target.
  // Old behavior: phTarget stayed 7.5 → app recommends acid to bring 8 down to 7.5.
  // Fix: phTarget should be midpoint = (9 + 10) / 2 = 9.5.
  { name: 'getTargets: pH min/max override → target follows midpoint',
    fn: () => getTargets({ sanitizer: 'tabs', surface: 'plaster' }, { phMin: 9, phMax: 10 }, null).phTarget,
    expected: 9.5, tol: 0 },
  // Explicit target override beats the midpoint
  { name: 'getTargets: explicit phTarget override wins over midpoint',
    fn: () => getTargets({ sanitizer: 'tabs', surface: 'plaster' }, { phMin: 9, phMax: 10, phTarget: 9.2 }, null).phTarget,
    expected: 9.2, tol: 0 },
  // Min only (without max) does NOT trigger midpoint — preserves auto target
  { name: 'getTargets: only phMin override → target stays at auto',
    fn: () => getTargets({ sanitizer: 'tabs', surface: 'plaster' }, { phMin: 7.0 }, null).phTarget,
    expected: 7.5, tol: 0 },
  // No overrides → all auto values come through
  { name: 'getTargets: empty overrides → auto pH range [7.2, 7.8]',
    fn: () => { const r = getTargets({ sanitizer: 'tabs', surface: 'plaster' }, {}, null); return r.ph[0] === 7.2 && r.ph[1] === 7.8 ? 1 : 0; },
    expected: 1, tol: 0 },
  // Mixed override: TA min/max override (40, 60) → midpoint 50
  { name: 'getTargets: TA min/max override → target = midpoint (50)',
    fn: () => getTargets({ sanitizer: 'tabs', surface: 'plaster' }, { taMin: 40, taMax: 60 }, null).taTarget,
    expected: 50, tol: 0 },
];

let pass = 0, fail = 0;
for (const t of tests) {
  const actual = t.fn();
  const ok = (actual === t.expected) || (typeof actual === 'number' && typeof t.expected === 'number' && Math.abs(actual - t.expected) <= t.tol);
  console.log(`${ok ? '✓ PASS' : '✗ FAIL'}  ${t.name}`);
  if (!ok) console.log(`         expected ${t.expected}, got ${actual}`);
  if (ok) pass++; else fail++;
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
