// Verify tier resolution logic across launch modes.

function tierLogic(launchMode, configTier) {
  const state = { config: { tier: configTier } };
  function currentTier() {
    if (launchMode === 'soft-launch') {
      if (state.config.tier === 'commercial') return 'commercial';
      return 'pro';
    }
    return state.config.tier || 'free';
  }
  function isPro() { return currentTier() === 'pro' || currentTier() === 'commercial'; }
  function isCommercial() { return currentTier() === 'commercial'; }
  return { currentTier: currentTier(), isPro: isPro(), isCommercial: isCommercial() };
}

const cases = [
  // soft-launch defaults
  { mode: 'soft-launch', tier: 'free',       expect: { currentTier: 'pro',        isPro: true,  isCommercial: false } },
  { mode: 'soft-launch', tier: undefined,    expect: { currentTier: 'pro',        isPro: true,  isCommercial: false } },
  // soft-launch beta opt-in
  { mode: 'soft-launch', tier: 'commercial', expect: { currentTier: 'commercial', isPro: true,  isCommercial: true  } },
  // soft-launch with explicit pro (shouldn't happen but should be safe)
  { mode: 'soft-launch', tier: 'pro',        expect: { currentTier: 'pro',        isPro: true,  isCommercial: false } },
  // paid mode
  { mode: 'paid',        tier: 'free',       expect: { currentTier: 'free',       isPro: false, isCommercial: false } },
  { mode: 'paid',        tier: 'pro',        expect: { currentTier: 'pro',        isPro: true,  isCommercial: false } },
  { mode: 'paid',        tier: 'commercial', expect: { currentTier: 'commercial', isPro: true,  isCommercial: true  } },
  // commercial mode
  { mode: 'commercial',  tier: 'free',       expect: { currentTier: 'free',       isPro: false, isCommercial: false } },
  { mode: 'commercial',  tier: 'commercial', expect: { currentTier: 'commercial', isPro: true,  isCommercial: true  } },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const actual = tierLogic(c.mode, c.tier);
  const ok = JSON.stringify(actual) === JSON.stringify(c.expect);
  const status = ok ? '✓ PASS' : '✗ FAIL';
  console.log(`${status}  mode=${c.mode}, tier=${String(c.tier)}`);
  console.log(`         expected ${JSON.stringify(c.expect)}`);
  console.log(`         got      ${JSON.stringify(actual)}`);
  if (ok) pass++; else fail++;
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
