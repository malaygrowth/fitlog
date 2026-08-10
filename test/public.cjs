/* CoachZ PUBLIC-build suite: onboarding + de-personalization.
   Run: NODE_PATH=/opt/node22/lib/node_modules node test/public.cjs
   Builds the public variant, tests it, then restores the personal build. */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = 'file://' + path.join(ROOT, 'index.html');
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  ✓ ' + name);
  else { failures++; console.log('  ✗ ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : '')); }
}

(async () => {
  execSync('./build.sh public', { cwd: ROOT });
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  console.log('public fresh boot');
  await page.goto(APP);
  await page.waitForTimeout(1800);
  const boot = await page.evaluate(() => ({
    pub: !!window.PUBLIC_BUILD,
    sessions: S.sessions.length,
    weights: S.weights.length,
    breaks: S.breaks.length,
    reminders: S.reminders.length,
    supps: S.supps.map((x) => x.name),
    plan: Object.keys(S.plan || {}).filter((k) => S.plan[k]).length,
    onboardingShown: document.querySelector('#sheet').classList.contains('on') && document.querySelector('#sheetIn').textContent.includes('Show up'),
    phase: currentPhase().name,
  }));
  check('PUBLIC_BUILD flag set', boot.pub);
  check('no personal sessions', boot.sessions === 0, boot.sessions);
  check('no personal weights', boot.weights === 0, boot.weights);
  check('no wedding break', boot.breaks === 0, boot.breaks);
  check('no BCA reminder', boot.reminders === 0, boot.reminders);
  check('generic supplements only', boot.supps.length === 2 && !boot.supps.join().includes('GNC') && !boot.supps.join().includes('Kulfi'), boot.supps);
  check('no pre-seeded plan', boot.plan === 0, boot.plan);
  check('onboarding welcome shown', boot.onboardingShown);
  check('generic phase names', /Foundation/.test(boot.phase), boot.phase);

  console.log('onboarding flow');
  const ob = await page.evaluate(() => {
    obProfile();
    document.querySelector('#obName').value = 'Test User';
    document.querySelector('#obAge').value = '28';
    document.querySelector('#obH').value = '175';
    document.querySelector('#obW').value = '70';
    obGoal();
    obPlan('gain');
    obFinish('ppl3');
    return {
      onboarded: S.settings.onboarded === true,
      cal: S.settings.calGoal,
      protein: S.settings.proteinGoal,
      water: S.settings.waterGoal,
      planDays: Object.keys(S.plan).filter((k) => S.plan[k]).length,
      weightLogged: S.weights.length === 1 && S.weights[0].kg === 70,
      week: programWeek(),
      renamed: S.routines.some((r) => /joint-friendly/.test(r.name)) && !S.routines.some((r) => /wrist-safe return/.test(r.name)),
      name: S.settings.name,
    };
  });
  check('onboarding completes', ob.onboarded);
  check('calorie target sane (1800-3200)', ob.cal >= 1800 && ob.cal <= 3200, ob.cal);
  check('protein = 1.8g/kg', ob.protein === 126, ob.protein);
  check('water goal from bodyweight', ob.water >= 2000 && ob.water <= 3000, ob.water);
  check('plan seeded (4 training days)', ob.planDays === 4, ob.planDays);
  check('first weight logged', ob.weightLogged);
  check('program week = 1', ob.week === 1, ob.week);
  check('routines renamed for public', ob.renamed);

  console.log('post-onboarding app works');
  const use = await page.evaluate(() => {
    addWater(500);
    startSession(); closeSheet();
    addExToSession(S.exercises.find((e) => e.name === 'Bench press').id);
    setVal(0, 0, 'w', '40'); setVal(0, 0, 'r', '10'); toggleSet(0, 0); restSkip();
    finishSession(); closeSheet();
    return {
      water: waterToday() === 500,
      session: S.sessions.length === 1,
      target: targetFor(S.exercises.find((e) => e.name === 'Bench press').id),
      about: (function(){ aboutSheet(); const t=document.querySelector('#sheetIn').textContent; closeSheet(); return t.includes('not medical advice') && t.includes('malay@growleads.io'); })(),
    };
  });
  check('water/session logging works', use.water && use.session);
  check('progression target (no comeback — fresh user)', /target:/.test(use.target || ''), use.target);
  check('about + disclaimer present', use.about);

  // persistence
  await page.reload(); await page.waitForTimeout(800);
  const persist = await page.evaluate(() => ({
    onboarded: S.settings.onboarded, sessions: S.sessions.length,
    noReonboard: !(document.querySelector('#sheet').classList.contains('on')),
  }));
  check('persists + no re-onboarding', persist.onboarded && persist.sessions === 1 && persist.noReonboard, persist);
  check('zero page errors', pageErrors.length === 0, pageErrors.slice(0, 3));

  await browser.close();
  execSync('./build.sh', { cwd: ROOT }); // restore personal build
  console.log(failures === 0 ? '\nPUBLIC ALL GREEN (personal build restored)' : '\n' + failures + ' FAILURE(S)');
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); try { execSync('./build.sh', { cwd: ROOT }); } catch (_) {} process.exit(1); });
