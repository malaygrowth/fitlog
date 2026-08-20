/* CoachZ PUBLIC-build suite.
   Run: NODE_PATH=/opt/node22/lib/node_modules node test/public.cjs
   Builds the public variant, tests it, then restores the personal build.

   This is the build that goes to strangers, so it is tested as one: a clean
   install, every goal x plan combination through onboarding, the diet filter in
   all four settings, and the screens a first-day user actually reaches. */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = 'file://' + path.join(ROOT, 'index.html');
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

/* Names, brands and locales that belong to one person's app and must never
   reach a store build. Matched against the whole serialised store. */
const PERSONAL = [
  'GNC', 'Avatar', 'Pintola', 'Kulfi', 'wrist-safe', 'knee-safe',
  'Hyrox', 'wedding', 'BCA', '2026-08-10',
];

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  ✓ ' + name);
  else { failures++; console.log('  ✗ ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : '')); }
}

/* Every onboarding walk starts from a genuinely empty store, otherwise the
   previous combination's plan and weights leak into the next assertion. */
async function freshOnboard(page, { goal, diet, plan, w = 70, h = 175, age = 30, sex = 'm' }) {
  await page.evaluate(() => localStorage.clear());
  await page.goto(APP);
  await page.waitForTimeout(1100);
  return page.evaluate(([goal, diet, plan, w, h, age, sex]) => {
    obProfile();
    document.querySelector('#obName').value = 'Test';
    document.querySelector('#obSex').value = sex;
    document.querySelector('#obAge').value = String(age);
    document.querySelector('#obH').value = String(h);
    document.querySelector('#obW').value = String(w);
    obGoal();
    obDiet(goal);
    obPlan(goal, diet);
    obFinish(plan);
    const named = (id) => (S.routines.find((r) => r.id === id) || {}).name || '';
    return {
      onboarded: S.settings.onboarded === true,
      cal: S.settings.calGoal,
      protein: S.settings.proteinGoal,
      water: S.settings.waterGoal,
      diet: S.settings.diet,
      /* every non-empty slot must resolve to a real routine: a rename that
         breaks the rid() lookup shows up only as a silently empty day */
      slots: Object.keys(S.plan).filter((k) => S.plan[k]).length,
      unresolved: Object.keys(S.plan).filter((k) => S.plan[k] && !named(S.plan[k])).length,
      dayNames: Object.keys(S.plan).filter((k) => S.plan[k]).map((k) => named(S.plan[k])),
      week: programWeek(),
      weightLogged: S.weights.length === 1 && S.weights[0].kg === w,
    };
  }, [goal, diet, plan, w, h, age, sex]);
}

(async () => {
  execSync('./build.sh public', { cwd: ROOT });
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('dialog', (d) => d.accept());

  // ---------------------------------------------------------------- clean install
  console.log('public fresh boot');
  await page.goto(APP);
  await page.waitForTimeout(1800);
  const boot = await page.evaluate((PERSONAL) => ({
    pub: !!window.PUBLIC_BUILD,
    key: K,
    isolated: (function(){
      localStorage.setItem('fitlog.v1', JSON.stringify({sessions:[{id:'personal'}]}));
      const mine = JSON.parse(localStorage.getItem(K) || '{}');
      const leaked = (mine.sessions || []).some(function(s){ return s.id === 'personal'; });
      localStorage.removeItem('fitlog.v1');
      return !leaked;
    })(),
    sessions: S.sessions.length,
    weights: S.weights.length,
    breaks: S.breaks.length,
    reminders: S.reminders.length,
    supps: S.supps.map((x) => x.name),
    plan: Object.keys(S.plan || {}).filter((k) => S.plan[k]).length,
    routines: S.routines.map((r) => r.name),
    onboardingShown: document.querySelector('#sheet').classList.contains('on') && document.querySelector('#sheetIn').textContent.includes('Show up'),
    phase: currentPhase().name,
    /* the whole store, so nothing personal hides in a field nobody thought to
       assert on — quick foods, my foods, notes, routine names, anywhere */
    leaks: PERSONAL.filter((p) => JSON.stringify(S).toLowerCase().includes(p.toLowerCase())),
  }), PERSONAL);
  check('PUBLIC_BUILD flag set', boot.pub);
  /* the two builds share an origin on GitHub Pages (root vs /fitlog/), and
     localStorage is scoped to the origin rather than the path — so this is the
     assertion that keeps the public app out of the personal store */
  check('the public build has its own storage key', boot.key === 'coachz.v1', boot.key);
  check('a store written by the personal build is invisible to the public one',
    boot.isolated, boot.isolated);
  check('no personal sessions', boot.sessions === 0, boot.sessions);
  check('no personal weights', boot.weights === 0, boot.weights);
  check('no wedding break', boot.breaks === 0, boot.breaks);
  check('no BCA reminder', boot.reminders === 0, boot.reminders);
  check('no pre-seeded plan', boot.plan === 0, boot.plan);
  check('onboarding welcome shown', boot.onboardingShown);
  check('generic phase names', /Foundation/.test(boot.phase), boot.phase);
  check('nothing personal anywhere in a fresh store', boot.leaks.length === 0, boot.leaks);
  check('no injury-specific routine names before onboarding',
    !boot.routines.some((n) => /wrist|knee|Hyrox/i.test(n)), boot.routines.filter((n) => /wrist|knee|Hyrox/i.test(n)));
  check('VO2max routine available from the start', boot.routines.includes('VO2max intervals (4×4)'), boot.routines);

  console.log('starter supplement stack');
  const stack = await page.evaluate(() => {
    checklistSheet();
    const chk = document.querySelector('#sheetIn').textContent;
    closeSheet();
    suppGrid();
    const grid = { text: document.querySelector('#sheetIn').textContent, cells: document.querySelectorAll('#sheetIn .sgrid i').length };
    closeSheet();
    return {
      names: S.supps.map((s) => s.name),
      dosed: S.supps.every((s) => !!suppDose(s)),
      slotted: S.supps.every((s) => !!suppSlot(s)),
      info: S.supps.every((s) => !!suppInfo(s.name)),
      conflicts: suppConflicts(),
      chk,
      grid,
    };
  });
  check('five starter supplements seeded', stack.names.length === 5, stack.names);
  check('no dairy product on a stack seeded before diet is known',
    !stack.names.some((n) => /whey|casein|milk/i.test(n)), stack.names);
  check('every starter item has a dose and a slot', stack.dosed && stack.slotted, stack.names);
  check('every starter item resolves an evidence tier', stack.info);
  check('checklist renders the stack grouped by slot', stack.chk.includes('of 5') && /morning/i.test(stack.chk));
  check('no false conflict warning on the starter stack', stack.conflicts.length === 0, stack.conflicts);
  check('30-day grid renders 30 cells per supplement', stack.grid.cells === 150, stack.grid.cells);

  console.log('protocols screen from a clean install');
  const proto = await page.evaluate(() => {
    protocolsSheet();
    const t = document.querySelector('#sheetIn').textContent;
    closeSheet();
    return { len: t.length, graded: t.includes('Protocols, graded'), tiers: /Strong evidence/.test(t) };
  });
  check('protocols screen opens with no logged data', proto.graded && proto.tiers && proto.len > 800, proto);

  // ------------------------------------------------------- onboarding, every combo
  console.log('onboarding: every goal × every plan');
  const PLANS = { ppl3: 4, ppl6: 6, cardio: 5, gentle: 5 };
  for (const goal of ['gain', 'lose', 'fit']) {
    for (const plan of Object.keys(PLANS)) {
      const r = await freshOnboard(page, { goal, diet: 'veg', plan });
      const label = goal + '/' + plan;
      check(label + ': completes with sane targets',
        r.onboarded && r.cal >= 1400 && r.cal <= 3600 && r.protein === 126 && r.water >= 2000 && r.water <= 3000,
        { cal: r.cal, protein: r.protein, water: r.water });
      check(label + ': fills ' + PLANS[plan] + ' days, all resolving to real routines',
        r.slots === PLANS[plan] && r.unresolved === 0, { slots: r.slots, unresolved: r.unresolved });
      check(label + ': no injury-specific name in the week',
        !r.dayNames.some((n) => /wrist|knee|Hyrox/i.test(n)), r.dayNames);
      check(label + ': week 1, first weight logged', r.week === 1 && r.weightLogged);
    }
  }
  const cardioWeek = await freshOnboard(page, { goal: 'fit', diet: 'veg', plan: 'cardio' });
  check('the cardio plan actually contains two interval sessions',
    cardioWeek.dayNames.filter((n) => /VO2max/.test(n)).length === 2, cardioWeek.dayNames);
  const female = await freshOnboard(page, { goal: 'lose', diet: 'veg', plan: 'ppl3', sex: 'f', w: 58, h: 162, age: 35 });
  check('female BMR path gives a lower target than the male one',
    female.cal < cardioWeek.cal && female.cal > 1200, { f: female.cal, m: cardioWeek.cal });

  // ------------------------------------------------------------------- diet filter
  console.log('diet filter');
  const diet = await page.evaluate(() => {
    const names = (d) => { S.settings.diet = d; return fdbAllFoods().map((f) => f.name); };
    const has = (list, re) => list.some((n) => re.test(n));
    const out = {};
    ['nonveg', 'egg', 'veg', 'vegan'].forEach((d) => {
      const l = names(d);
      out[d] = {
        n: l.length,
        meat: has(l, /chicken|mutton|fish|prawn/i),
        egg: has(l, /^Egg |omelette|Anda /i),
        dairy: has(l, /paneer|Curd |Milk 250|Butter naan|Cheese/i),
        /* the three substring false positives: all vegan-safe */
        roti: has(l, /no ghee/i),
        pb: has(l, /^Peanut butter/i),
        salad: has(l, /kheera/i),
      };
    });
    return out;
  });
  check('nonveg is offered everything', diet.nonveg.meat && diet.nonveg.egg && diet.nonveg.dairy);
  check('egg keeps eggs and dairy, drops meat and fish', !diet.egg.meat && diet.egg.egg && diet.egg.dairy, diet.egg);
  check('veg drops meat, fish and eggs, keeps dairy', !diet.veg.meat && !diet.veg.egg && diet.veg.dairy, diet.veg);
  check('vegan drops dairy too', !diet.vegan.meat && !diet.vegan.egg && !diet.vegan.dairy, diet.vegan);
  check('each step strictly narrows the list',
    diet.nonveg.n > diet.egg.n && diet.egg.n > diet.veg.n && diet.veg.n > diet.vegan.n,
    { nonveg: diet.nonveg.n, egg: diet.egg.n, veg: diet.veg.n, vegan: diet.vegan.n });
  check('vegan keeps roti without ghee (substring "ghee")', diet.vegan.roti);
  check('vegan keeps peanut butter (substring "butter")', diet.vegan.pb);
  check('vegan keeps kheera salad (substring "kheer")', diet.vegan.salad);

  console.log('diet filters what is offered, never what is already yours');
  const snap = await page.evaluate(() => {
    S.settings.diet = 'nonveg';
    const day = (S.food[today()] = S.food[today()] || {});
    day.lunch = [{ id: 'x1', name: 'Chicken curry (bowl)', kcal: 320, p: 26, c: 8, f: 20, fb: 2 }];
    S.myFoods = [{ id: 'm1', name: 'Nani ka mutton keema', kcal: 400, p: 24, c: 6, f: 31, fb: 1 }];
    S.barcodes = { '8901234567890': { name: 'Chicken sausage 100g', kcal: 220, p: 14, c: 2, f: 17, fb: 0 } };
    S.settings.diet = 'vegan';
    render();
    renderFood();
    return {
      logged: (S.food[today()].lunch || []).length,
      loggedShown: document.body.textContent.includes('Chicken curry'),
      myFood: fdbAllFoods().some((f) => f.mine && /keema/i.test(f.name)),
      barcode: !!(S.barcodes['8901234567890']),
      offered: fdbAllFoods().some((f) => !f.mine && /chicken/i.test(f.name)),
    };
  });
  check('an already-logged entry survives switching to vegan', snap.logged === 1 && snap.loggedShown, snap);
  check('your own saved foods are never filtered', snap.myFood, snap);
  check('a learned barcode is never filtered', snap.barcode, snap);
  check('but the database no longer offers chicken', !snap.offered, snap);

  console.log('diet-aware supplement guidance');
  const advice = await page.evaluate(() => {
    const at = (d) => {
      S.settings.diet = d;
      return { b12: suppInfo('Vitamin B12').why, om: suppInfo('Omega-3 (EPA+DHA)').why, plan: suppPlan('Omega-3').note };
    };
    return { vegan: at('vegan'), veg: at('veg'), nonveg: at('nonveg') };
  });
  check('B12 copy differs across all three diets',
    advice.vegan.b12 !== advice.veg.b12 && advice.veg.b12 !== advice.nonveg.b12,
    [advice.vegan.b12.slice(0, 40), advice.nonveg.b12.slice(0, 40)]);
  check('B12 is framed hardest for vegans', /not optional/i.test(advice.vegan.b12), advice.vegan.b12);
  check('B12 is not called non-negotiable for a meat-eater',
    !/non-negotiable/i.test(advice.nonveg.b12), advice.nonveg.b12);
  check('the algal caveat appears only when it applies',
    /algal/i.test(advice.vegan.om) && /algal/i.test(advice.veg.om) && !/algal/i.test(advice.nonveg.om),
    advice.nonveg.om);
  check('the schedule note is diet-aware too',
    advice.nonveg.plan !== advice.vegan.plan && /fish oil/i.test(advice.nonveg.plan), advice.nonveg.plan);

  // ------------------------------------------------------------- day-one app usage
  console.log('post-onboarding app works');
  await freshOnboard(page, { goal: 'gain', diet: 'nonveg', plan: 'ppl3' });
  const use = await page.evaluate(() => {
    addWater(500);
    const bench = S.exercises.find((e) => e.name === 'Bench press').id;
    startSession(); closeSheet();
    addExToSession(bench);
    setVal(0, 0, 'w', '40'); setVal(0, 0, 'r', '10'); toggleSet(0, 0); restSkip();
    finishSession(); closeSheet();
    return {
      water: waterToday() === 500,
      session: S.sessions.length === 1,
      target: targetFor(bench),
      rxTag: prescribe(bench).tag,
      about: (function () { aboutSheet(); const t = document.querySelector('#sheetIn').textContent; closeSheet(); return t.includes('not medical advice') && t.includes('malay@growleads.io'); })(),
    };
  });
  check('water/session logging works', use.water && use.session);
  check('progression prescribes sets×weight×reps (fresh user, no comeback)',
    use.rxTag === 'reps' && /^3×40×\d+/.test(use.target || ''), use.target);
  check('about + disclaimer present', use.about);

  console.log('barcode learning, from a clean install');
  const bc = await page.evaluate(() => {
    /* the scanner itself needs a camera; the learn-link-log path is what
       actually holds the data, and it is reachable by typing a code */
    const code = '8901063011json'.replace('json', '');
    S.barcodes = {};
    barcodeLink(code);
    bcSearch('monaco');
    const hits = document.querySelectorAll('#bcRes .listrow, #bcRes button').length;
    document.querySelector('#bcName').value = 'Test biscuit packet';
    document.querySelector('#bcK').value = '250';
    document.querySelector('#bcP').value = '4';
    document.querySelector('#bcC').value = '32';
    document.querySelector('#bcF').value = '11';
    document.querySelector('#bcFb').value = '1';
    bcSaveTyped();
    const learned = S.barcodes[code];
    closeSheet();
    barcodeList();
    const listed = document.querySelector('#sheetIn').textContent.includes('Test biscuit packet');
    closeSheet();
    barcodeForget(code);
    return { hits, learned: !!learned, kcal: learned && learned.kcal, listed, forgotten: !S.barcodes[code] };
  });
  check('an unknown code can be searched against the food database', bc.hits > 0, bc.hits);
  check('a code typed off the label is learned', bc.learned && bc.kcal === 250, bc);
  check('learned products are listed back', bc.listed);
  check('a wrong code can be forgotten', bc.forgotten);

  console.log('missed-day catch-up');
  const missed = await page.evaluate(() => {
    /* fill every weekday so a missed day exists whichever day this runs */
    const push = S.routines.find((r) => r.name === 'Push day').id;
    S.plan = { 0: push, 1: push, 2: push, 3: push, 4: push, 5: push, 6: push };
    S.sessions = []; S.skipped = [];
    const card = catchUpCard();
    const d = missedSessions(3)[0].date;
    skipMissed(d);
    return { card, gone: catchUpCard().indexOf(d) < 0, skipped: S.skipped.length === 1 };
  });
  check('a missed plan day surfaces a catch-up card', /Missed/.test(missed.card) && /Do it today/.test(missed.card), missed.card.slice(0, 80));
  check('skipping a missed day clears it and leaves the plan alone', missed.gone && missed.skipped, missed);

  // ------------------------------------------------------------------- persistence
  console.log('persistence');
  await page.reload(); await page.waitForTimeout(900);
  const persist = await page.evaluate(() => ({
    onboarded: S.settings.onboarded,
    diet: S.settings.diet,
    sessions: S.sessions.length,
    noReonboard: !(document.querySelector('#sheet').classList.contains('on')),
    schema: S.schemaVersion,
  }));
  check('persists + no re-onboarding', persist.onboarded && persist.noReonboard, persist);
  check('the diet answer survives a reload', persist.diet === 'nonveg', persist.diet);
  check('schema stamped on a public store', persist.schema > 0, persist.schema);

  /* The 'gentle' plan is the rename chain's failure mode: the seed names, the
     RT_PUB_NAME map and the rid() lookups must all still agree. */
  console.log('onboarding rename chain (gentle plan)');
  const chain = await freshOnboard(page, { goal: 'lose', diet: 'veg', plan: 'gentle' });
  const chainMore = await page.evaluate(() => ({
    renamed: S.routines.filter((r) => /joint-friendly|Joint prep/.test(r.name)).length,
    noDash: !S.routines.some((r) => /—/.test(r.name)) && !S.supps.some((s) => /—/.test(s.name)),
  }));
  check('gentle plan resolves every slot (rename chain intact)', chain.slots === 5 && chain.unresolved === 0, chain);
  check('joint-friendly routines renamed', chainMore.renamed >= 4, chainMore.renamed);
  check('no em dashes in public seeded names', chainMore.noDash);

  console.log('upgrade path for an already-installed public user');
  const upgraded = await page.evaluate(() => {
    /* an install from before the launch work: old routine names, two supplements */
    const old = JSON.parse(localStorage.getItem(K));
    old.schemaVersion = 23;
    old.seedV24 = undefined; delete old.seedV24;
    old.routines = old.routines.map((r) => {
      const back = { 'Push: joint-friendly': 'Push: wrist-safe return', 'Station circuit': 'Hyrox stations' };
      return back[r.name] ? Object.assign({}, r, { name: back[r.name] }) : r;
    });
    old.supps = old.supps.slice(0, 2);
    localStorage.setItem(K, JSON.stringify(old));
    return true;
  });
  await page.goto(APP); await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({
    names: S.routines.map((r) => r.name),
    supps: S.supps.length,
    planIntact: Object.keys(S.plan).filter((k) => S.plan[k]).length,
    snapshot: !!localStorage.getItem(K + '.bak'),
  }));
  check('an old public store gets its routine names rewritten', upgraded &&
    !after.names.some((n) => /wrist-safe|Hyrox/i.test(n)), after.names.filter((n) => /wrist-safe|Hyrox/i.test(n)));
  check('the rename keeps ids, so the weekly plan still resolves', after.planIntact === 5, after.planIntact);
  check('the starter stack is topped up to five', after.supps === 5, after.supps);
  check('the upgrade wrote a restore point first', after.snapshot);

  check('zero page errors', pageErrors.length === 0, pageErrors.slice(0, 3));

  await browser.close();
  execSync('./build.sh', { cwd: ROOT }); // restore personal build
  console.log(failures === 0 ? '\nPUBLIC ALL GREEN (personal build restored)' : '\n' + failures + ' FAILURE(S)');
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); try { execSync('./build.sh', { cwd: ROOT }); } catch (_) {} process.exit(1); });
