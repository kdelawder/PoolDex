// Verify the two hard ordering rules:
//   1. TA always comes before pH (alkalinity buffers pH).
//   2. Chlorine always comes last (acid + chlorine = toxic gas).
// Within those constraints, doses sort by urgency (priority asc).
// Mirrors ADDITION_TIER from index.html.

const ADDITION_TIER = { CYA: 1, Salt: 1, CH: 1, TA: 1, pH: 2, Cl: 3 };

// Simulate dose objects with type + tier + priority, then sort.
function simulate(items) {
  // items: array of [type, priority]
  const doses = items.map(([type, priority]) => {
    const prefix = type.match(/^(CYA|Salt|CH|TA|pH|Cl)/)[1];
    return { type, tier: ADDITION_TIER[prefix], priority };
  });
  doses.sort((a, b) => (a.tier - b.tier) || (a.priority - b.priority));
  return doses.map(d => d.type);
}

const tests = [
  // === Hard rule 1: TA before pH ===
  { name: 'Rule 1: TA before pH (TA more urgent)',
    input:    [['pH↓', 2], ['TA↑', 4]],
    expected: ['TA↑', 'pH↓'] },
  { name: 'Rule 1: TA before pH (pH more urgent — TA still wins)',
    input:    [['pH↓', 2], ['TA↑', 5]],
    expected: ['TA↑', 'pH↓'] },

  // === Hard rule 2: chlorine last ===
  { name: 'Rule 2: Cl after pH',
    input:    [['Cl', 1], ['pH↓', 2]],
    expected: ['pH↓', 'Cl'] },
  { name: 'Rule 2: Cl last even when critically low (priority 1)',
    input:    [['Cl', 1], ['TA↑', 4], ['CH↑', 4]],
    expected: ['TA↑', 'CH↑', 'Cl'] },

  // === Within tier-1 (CYA/Salt/CH/TA): pure urgency ordering ===
  { name: 'Tier 1: CYA, Salt, CH, TA all sort by priority',
    input:    [['CYA↑', 5], ['CH↑', 4], ['Salt', 4], ['TA↑', 4]],
    // priority 4s tie — stable sort keeps input order (CH, Salt, TA), CYA(5) last
    expected: ['CH↑', 'Salt', 'TA↑', 'CYA↑'] },

  // === Realistic multi-dose scenarios ===
  { name: 'New pool, all six need adjustment',
    input:    [['Cl', 1], ['pH↓', 2], ['TA↑', 4], ['CH↑', 4], ['CYA↑', 5], ['Salt', 4]],
    // tier-1 first (sorted by priority): TA, CH, Salt all 4 → input order; CYA last
    // then pH, then Cl
    expected: ['TA↑', 'CH↑', 'Salt', 'CYA↑', 'pH↓', 'Cl'] },
  { name: 'Weekly maintenance: pH + Cl',
    input:    [['Cl', 3], ['pH↓', 2]],
    expected: ['pH↓', 'Cl'] },
  { name: 'pH up + TA up: TA first regardless',
    input:    [['pH↑', 2], ['TA↑', 4]],
    expected: ['TA↑', 'pH↑'] },
  { name: 'SWG salt + supplemental chlorine: salt first',
    input:    [['Cl', 3], ['Salt', 4]],
    expected: ['Salt', 'Cl'] },

  // === Single-dose: order is trivial ===
  { name: 'Single dose pH down',
    input:    [['pH↓', 2]],
    expected: ['pH↓'] },
  { name: 'Single dose Cl',
    input:    [['Cl', 1]],
    expected: ['Cl'] },

  // === Edge: down-direction types still respect tiers ===
  { name: 'CYA↓ and TA↓ both tier-1, sort by priority',
    input:    [['TA↓', 5], ['CYA↓', 5]],
    expected: ['TA↓', 'CYA↓'] }, // stable sort preserves input
];

let pass = 0, fail = 0;
for (const t of tests) {
  const actual = simulate(t.input);
  const ok = JSON.stringify(actual) === JSON.stringify(t.expected);
  console.log(`${ok ? '✓ PASS' : '✗ FAIL'}  ${t.name}`);
  if (!ok) {
    console.log(`         expected ${JSON.stringify(t.expected)}`);
    console.log(`         got      ${JSON.stringify(actual)}`);
  }
  if (ok) pass++; else fail++;
}

// Cross-cutting invariants — run on every test that contains TA/pH or pH/Cl pairs.
const invariants = [];
for (const t of tests) {
  const out = simulate(t.input);
  const taIdx = out.findIndex(x => x.startsWith('TA'));
  const phIdx = out.findIndex(x => x.startsWith('pH'));
  const clIdx = out.findIndex(x => x === 'Cl');
  if (taIdx !== -1 && phIdx !== -1 && taIdx > phIdx) {
    invariants.push(`✗ INVARIANT FAIL: TA after pH in "${t.name}": ${JSON.stringify(out)}`);
  }
  if (clIdx !== -1 && clIdx !== out.length - 1) {
    invariants.push(`✗ INVARIANT FAIL: Cl not last in "${t.name}": ${JSON.stringify(out)}`);
  }
  if (phIdx !== -1 && clIdx !== -1 && phIdx > clIdx) {
    invariants.push(`✗ INVARIANT FAIL: pH after Cl in "${t.name}": ${JSON.stringify(out)}`);
  }
}
if (invariants.length === 0) {
  console.log('\n✓ Cross-cutting invariants hold across all scenarios (TA<pH, pH<Cl, Cl=last)');
} else {
  invariants.forEach(m => console.log(m));
  fail += invariants.length;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
