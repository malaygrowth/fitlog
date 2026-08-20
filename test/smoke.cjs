/* CoachZ persistent smoke suite.
   Run:  NODE_PATH=/opt/node22/lib/node_modules node test/smoke.cjs
   Env:  CHROME_PATH overrides the Chromium binary (default /opt/pw-browsers/chromium).
   Always run ./build.sh first — the suite loads index.html. */
const { chromium } = require('playwright');
const path = require('path');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
/* Read the schema out of the source rather than hard-coding it. What these
   checks are really for is that the stamp gets written and persisted, and that
   the pre-upgrade snapshot records the right jump — not that the number is 23.
   Hard-coding it made every migration break five unrelated assertions. */
const SCHEMA = +require('fs')
  .readFileSync(path.resolve(__dirname, '..', 'core.html'), 'utf8')
  .match(/const SCHEMA=(\d+)/)[1];

let failures = 0;
function check(name, cond, detail) {
  if (cond) { console.log('  ✓ ' + name); }
  else { failures++; console.log('  ✗ ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : '')); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.emulateMedia({ reducedMotion: 'reduce' }); // deterministic flows; motion tested separately
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('dialog', (d) => d.accept());

  console.log('boot + migrations');
  await page.goto(APP);
  await page.waitForTimeout(500);
  const boot = await page.evaluate(() => ({
    sessions: S.sessions.length,
    supps: S.supps.length,
    routines: S.routines.length,
    planDays: Object.keys(S.plan).filter((k) => S.plan[k] !== undefined).length,
    wedding: S.breaks.some((b) => /wedding/i.test(b.label)),
    schema: S.schemaVersion,
    weights: S.weights.length,
    shake: S.myFoods.some((m) => /post-workout shake/i.test(m.name)),
  }));
  check('38 imported sessions, the 10 August push and the first VO2max block', boot.sessions === 40, boot.sessions);
  check('11 supplements seeded, including the shake', boot.supps === 11, boot.supps);
  check('routines seeded', boot.routines >= 10, boot.routines);
  check('weekly plan seeded', boot.planDays === 7, boot.planDays);
  check('wedding break seeded', boot.wedding);
  check('schemaVersion stamped', boot.schema === SCHEMA, boot.schema);
  check('post-workout shake seeded to My Foods', boot.shake === true, boot.shake);
  check('weight journey present', boot.weights >= 4, boot.weights);

  console.log('idempotency (double reload)');
  await page.reload(); await page.waitForTimeout(350);
  await page.reload(); await page.waitForTimeout(350);
  const again = await page.evaluate(() => ({
    sessions: S.sessions.length, supps: S.supps.length, routines: S.routines.length,
  }));
  check('no duplicate sessions', again.sessions === boot.sessions, again.sessions);
  check('no duplicate supplements', again.supps === boot.supps, again.supps);
  check('no duplicate routines', again.routines === boot.routines, again.routines);

  console.log('the re-entered 10 August session');
  const aug10 = await page.evaluate(() => {
    const all = S.sessions.filter((s) => s.date === '2026-08-10');
    const s = all[0];
    const push = S.routines.find((r) => /Push: wrist/.test(r.name));
    const rx = {};
    push.exIds.forEach((id) => { const r = prescribe(id); rx[exName(id)] = { tag: r.tag, w: r.sets[0].w, r: r.sets[0].r }; });
    const wk = S.sessions.filter((x) => x.date > dShift(today(), -7)).length;
    return {
      count: all.length, name: s && s.name, vol: s && s.vol,
      exCount: s && s.ex.length, sets: s && s.ex.reduce((a, e) => a + e.sets.length, 0),
      prs: s && (s.prs || []).length,
      allDone: s && s.ex.every((e) => e.sets.every((t) => t.done === true)),
      allOk: s && s.ex.every((e) => e.sets.every((t) => t.e === 'ok')),
      anyEasy: s && s.ex.some((e) => e.sets.some((t) => t.e === 'easy')),
      sorted: S.sessions.every((x, i, a) => !i || a[i - 1].date <= x.date),
      inWeek: wk, ownWeek: weekStats(wkMonday('2026-08-10')).ses, total: S.sessions.length, rx, held: readiness().hold,
    };
  });
  check('exactly one session on 10 August', aug10.count === 1, aug10.count);
  check('it is the Monday push routine', aug10.name === 'Push: wrist-safe return', aug10.name);
  check('6 exercises, 18 sets, all completed', aug10.exCount === 6 && aug10.sets === 18 && aug10.allDone, aug10);
  check('volume 1575, plank contributes nothing', aug10.vol === 1575, aug10.vol);
  check('comeback loads set no records', aug10.prs === 0, aug10.prs);
  check('every set marked moderate, not easy', aug10.allOk && !aug10.anyEasy, aug10);
  check('history stays sorted and it counts in its own week', aug10.sorted && aug10.ownWeek >= 1, aug10);
  check('the payoff: every push lift now progresses', Object.values(aug10.rx).every((r) => r.tag === 'up' || r.tag === 'progress'), aug10.rx);
  check('moderate sets earn a single increment, not a doubled one',
    aug10.rx['Incline dumbbell press'].w === 12.5 && aug10.rx['Chest fly (dumbbell)'].w === 7.5
    && aug10.rx['Lateral raise'].w === 3.75 && aug10.rx['Overhead triceps extension'].w === 11.25
    && aug10.rx['Triceps pushdown'].w === 16.25, aug10.rx);
  check('a moderate hold adds five seconds, not ten', aug10.rx['Plank'].r === 25, aug10.rx['Plank']);
  check('readiness does not hold it back on real data', aug10.held === false);


  console.log('fiber');
  const fib = await page.evaluate(() => {
    const rows = FOODDB;
    const bad = rows.filter((r) => r.length !== 6 || typeof r[5] !== 'number' || r[5] < 0 || r[5] > 20);
    const by = (n) => (rows.find((r) => r[0] === n) || [])[5];
    go('food'); addFoodForm('l');
    const before = foodTotals(foodDate).fb;
    function pick(q) { document.querySelector('#fdbQ').value = q; fdbSearch(q); fdbPick(0); }
    pick('dal tadka'); plateAdd();
    pick('atta roti / phulka'); document.querySelector('#fdbQty').value = '2'; plateAdd();
    const plateFb = plateTotals().fb;
    plateLog();
    const list = (S.food[foodDate] || {}).l || [];
    const e = list[list.length - 1];
    const dayFb = foodTotals(foodDate).fb;
    S.food[foodDate].l = list.filter((x) => x.id !== e.id);
    // backfill: one entry whose name matches the DB, one that cannot
    const d = dShift(today(), -40);
    S.food[d] = { s: [{ id: 'bf1', name: '2× Dal tadka (bowl)', kcal: 1, p: 0, c: 0, f: 0 },
                      { id: 'bf2', name: 'Something I typed myself', kcal: 1, p: 0, c: 0, f: 0 }] };
    delete S.fiberBackfilled;
    fiberBackfill();
    const bf = S.food[d].s;
    S.myFoods.push({ id: 'tfb', name: 'Test fib', kcal: 10, p: 1, c: 1, f: 0, fb: 4 });
    save();
    const custom = (fdbAllFoods().find((x) => x.id === 'tfb') || {}).fb;
    S.myFoods = S.myFoods.filter((m) => m.id !== 'tfb');
    delete S.food[d]; save(); closeSheet();
    return {
      rows: rows.length, bad: bad.map((r) => r[0]),
      dal: by('Dal tadka (bowl)'), ghee: by('Ghee (1 tsp)'), milk: by('Milk full-fat (250ml)'),
      plateFb, entryFb: e.fb, dayDelta: Math.round((dayFb - before) * 10) / 10,
      backfilled: bf[0].fb, unmatched: bf[1].fb, custom, goal: S.settings.fiberGoal,
    };
  });
  check('every food carries a sane fiber value', fib.rows >= 315 && fib.bad.length === 0, fib.bad);
  check('legumes high, fats and dairy zero', fib.dal === 8 && fib.ghee === 0 && fib.milk === 0, fib);
  check('plate sums fiber from its parts (8 + 2×3)', fib.plateFb === 14, fib.plateFb);
  check('the logged entry carries it, and the day total moves', fib.entryFb === 14 && fib.dayDelta === 14, fib);
  check('backfill fills a pre-existing entry from its name', fib.backfilled === 16, fib.backfilled);
  check('backfill leaves an unmatched entry at zero, not guessed', fib.unmatched === 0, fib.unmatched);
  check('custom foods can carry fiber', fib.custom === 4, fib.custom);
  check('a daily fiber goal exists', fib.goal === 30, fib.goal);

  console.log('cardio fitness: VO2max and zone 2');
  const cardio = await page.evaluate(() => {
    const out = {};
    out.cooper = vo2Cooper(2400);
    out.rockport = vo2Rockport(63.9, 31, true, 13.5, 130);
    out.bands = [vo2Band(30, 31, 'm').label, vo2Band(42.7, 31, 'm').label,
                 vo2Band(58, 31, 'm').label, vo2Band(42.7, 31, 'f').label];
    out.garbage = [vo2Cooper(0), vo2Rockport(63.9, 31, true, 0, 130)];
    const savedAge = S.settings.age, savedVo2 = S.vo2, savedSessions = S.sessions;
    S.settings.age = ''; S.vo2 = [];
    out.noAge = /age and sex/i.test(cardioHTML()) && !/NaN/.test(cardioHTML());
    S.settings.age = savedAge;
    const cid = S.exercises.find((e) => e.name === 'Cycling').id;
    S.sessions = [
      { id: 'z1', name: 'A', date: dShift(today(), -2), dur: 1, vol: 0, prs: [],
        ex: [{ exId: cid, sets: [{ w: 12, r: 45, done: true, z: true }, { w: 3, r: 10, done: true }] }] },
      { id: 'z2', name: 'B', date: dShift(today(), -20), dur: 1, vol: 0, prs: [],
        ex: [{ exId: cid, sets: [{ w: 20, r: 60, done: true, z: true }] }] },
    ];
    out.week = zone2Mins(7);
    out.month = zone2Mins(30);
    S.sessions = savedSessions; S.vo2 = savedVo2; save();
    return out;
  });
  check('Cooper: 2400 m gives 42.7', cardio.cooper === 42.7, cardio.cooper);
  check('Rockport: 63.9 kg, 31M, 13.5 min, 130 bpm gives 51.9', cardio.rockport === 51.9, cardio.rockport);
  check('bands read by age and sex', cardio.bands.join('|') === 'Below average|Good|Excellent|Very good', cardio.bands);
  check('missing inputs return null rather than a number', cardio.garbage.every((v) => v === null), cardio.garbage);
  check('missing age prompts instead of rendering NaN', cardio.noAge);
  check('zone 2 counts only flagged cardio sets', cardio.week === 45, cardio.week);
  check('zone 2 respects the window', cardio.month === 105, cardio.month);

  console.log('supplement evidence');
  const supp = await page.evaluate(() => {
    suppEditor();
    const txt = document.querySelector('#sheetIn').textContent;
    closeSheet();
    return {
      allResolve: S.supps.every((sp) => !!suppInfo(sp.name)),
      tiers: S.supps.map((sp) => suppInfo(sp.name).tier),
      creatine: suppInfo('Creatine 5g: GNC monohydrate').tier,
      theanine: suppInfo('L-theanine: evening wind-down').tier,
      iron: suppInfo('Iron bisglycinate').tier,
      nmn: suppInfo('NMN 500mg').tier,
      unknown: suppInfo('Something invented'),
      algal: /algal/i.test(txt),
      ironTestFirst: /ferritin/i.test(txt) && /never supplement iron blind/i.test(txt),
      skipNamed: /NMN/.test(txt) && /resveratrol/i.test(txt),
      disclaimer: /not medical advice/i.test(txt),
    };
  });
  check('every supplement in the stack resolves to a tier', supp.allResolve, supp.tiers);
  check('creatine strong, theanine limited', supp.creatine === 'strong' && supp.theanine === 'limited', supp);
  check('iron is test-first, never a recommendation', supp.iron === 'test-first' && supp.ironTestFirst, supp.iron);
  check('the hyped ones are named and marked skip', supp.nmn === 'skip' && supp.skipNamed, supp.nmn);
  check('an unrecognised supplement gets no invented claim', supp.unknown === null);
  check('omega-3 carries the algal caveat', supp.algal);
  check('the not-medical-advice line survives', supp.disclaimer);

  console.log('protocols: regularity, caffeine, sauna, daylight, volume');
  const lev = await page.evaluate(() => {
    const savedSleep = JSON.stringify(S.sleep), savedSessions = S.sessions;
    // a fortnight of near-identical timings should score high
    S.sleep = {};
    for (let i = 0; i < 14; i++) S.sleep[dShift(today(), -i)] = { bed: '23:15', wake: '07:10', hrs: 7.9, q: 'g' };
    const tight = sleepRegularity(14);
    // the same average, scattered, should score much lower
    S.sleep = {};
    for (let i = 0; i < 14; i++) {
      const off = (i % 2) ? 90 : -90;
      const bm = 23 * 60 + 15 + off, wm = 7 * 60 + 10 + off;
      S.sleep[dShift(today(), -i)] = { bed: pad(Math.floor((bm % 1440) / 60)) + ':' + pad(bm % 60),
        wake: pad(Math.floor(wm / 60)) + ':' + pad(wm % 60), hrs: 7.9, q: 'g' };
    }
    const loose = sleepRegularity(14);
    // too little data to judge
    S.sleep = {}; S.sleep[today()] = { bed: '23:00', wake: '07:00', hrs: 8, q: 'g' };
    const thin = sleepRegularity(14);
    S.sleep = JSON.parse(savedSleep);

    // caffeine: cutoff is bedtime minus 8.8h, and lateness is flagged
    const cut = caffCutoff();
    S.caff[today()] = [{ t: '09:00', mg: 95, name: 'Coffee' }, { t: '18:00', mg: 50, name: 'Chai' }];
    const mg = caffMg(), late = caffLate().length;
    delete S.caff[today()];

    // sauna and daylight
    S.sauna[dShift(today(), -2)] = 20; S.sauna[dShift(today(), -5)] = 25; S.sauna[dShift(today(), -20)] = 30;
    const sa = saunaWeek();
    S.light[today()] = true; S.light[dShift(today(), -1)] = true;
    const streak = lightStreak();
    S.sauna = {}; S.light = {};

    // weekly volume by muscle group, warm-ups excluded
    const bench = S.exercises.find((e) => e.name === 'Bench press').id;
    const cyc = S.exercises.find((e) => e.name === 'Cycling').id;
    S.sessions = [
      { id: 'v1', name: 'A', date: dShift(today(), -1), dur: 1, vol: 1, prs: [],
        ex: [{ exId: bench, sets: [{ w: 60, r: 8, done: true }, { w: 60, r: 8, done: true }, { w: 20, r: 10, wu: true }] },
             { exId: cyc, sets: [{ w: 10, r: 30, done: true }] }] },
      { id: 'v2', name: 'B', date: dShift(today(), -3), dur: 1, vol: 1, prs: [],
        ex: [{ exId: bench, sets: [{ w: 60, r: 8, done: true }] }] },
      { id: 'v3', name: 'C', date: dShift(today(), -20), dur: 1, vol: 1, prs: [],
        ex: [{ exId: bench, sets: [{ w: 60, r: 8, done: true }] }] },
    ];
    const vol = weeklyVolume(7);
    const chest = vol.find((v) => v.group === 'Chest');
    const hasCardio = vol.some((v) => v.group === 'Cardio');
    S.sessions = savedSessions; save();

    protocolsSheet();
    const txt = document.querySelector('#sheetIn').textContent;
    closeSheet();
    return {
      tight: tight.score, loose: loose.score, thin,
      cut, mg, late,
      sauna: sa, streak,
      chestSets: chest && chest.sets, chestFreq: chest && chest.freq, hasCardio,
      coldWarning: /cold plunge/i.test(txt) && /NOT SUPPORTED|blunt|attenuat/i.test(txt),
      setsProtocol: /10-20 hard sets/i.test(txt),
      rirProtocol: /reps in reserve/i.test(txt),
      observational: /observational/i.test(txt),
      steamHonest: /steam/i.test(txt) && /do not transfer/i.test(txt) && /DRY sauna/.test(txt),
      disclaimer: /not medical advice/i.test(txt),
    };
  });
  check('consistent sleep timing scores high', lev.tight >= 95, lev.tight);
  check('scattered timing scores much lower, same average duration', lev.loose < 40 && lev.loose < lev.tight - 50, lev);
  check('too few nights returns nothing rather than a fake score', lev.thin === null, lev.thin);
  check('caffeine cutoff is bedtime minus 8.8h', lev.cut === '13:42', lev.cut);
  check('caffeine totals, and flags what is past the cutoff', lev.mg === 145 && lev.late === 1, lev);
  check('steam bath counts the week, not older sessions', lev.sauna.n === 2 && lev.sauna.mins === 45, lev.sauna);
  check('daylight streak counts back from today', lev.streak === 2, lev.streak);
  check('weekly sets exclude warm-ups and count frequency', lev.chestSets === 3 && lev.chestFreq === 2, lev);
  check('cardio and mobility are not counted as lifting volume', !lev.hasCardio);
  check('the cold plunge warning is present and unambiguous', lev.coldWarning);
  check('training protocols are graded too', lev.setsProtocol && lev.rirProtocol, lev);
  check('observational evidence is labelled as such', lev.observational);
  check('steam is not sold as the dry-sauna result', lev.steamHonest);
  check('the not-medical-advice line is on the protocols screen', lev.disclaimer);

  console.log('integration audit: does every new field reach every path');
  const audit = await page.evaluate(() => {
    const g = {};
    g.backfillRan = S.fiberBackfilled === 2;
    g.quickAll = S.quick.every((q) => q.fb !== undefined);
    g.suppAll = S.supps.every((s) => s.fb !== undefined);
    g.myFoodAll = S.myFoods.every((m) => m.fb !== undefined);
    g.entriesAll = Object.keys(S.food).every((d) => ['b', 'l', 'd', 's']
      .every((m) => (S.food[d][m] || []).every((e) => e.fb !== undefined)));
    // every write path carries fiber through
    go('food'); addFoodForm('s');
    document.querySelector('#fName').value = 'Audit food';
    document.querySelector('#fK').value = '100';
    document.querySelector('#fFb').value = '7';
    document.querySelector('#fSaveQ').checked = true;
    saveFood('s');
    const manual = ((S.food[foodDate] || {}).s || []).slice(-1)[0];
    const savedQuick = S.quick.slice(-1)[0];
    g.manualFb = manual && manual.fb;
    g.quickSaveFb = savedQuick && savedQuick.fb;
    S.food[foodDate].s = S.food[foodDate].s.filter((x) => x.id !== manual.id);
    S.quick = S.quick.filter((x) => x.id !== savedQuick.id);
    quickAdd('s', S.quick[0].id);
    const qe = ((S.food[foodDate] || {}).s || []).slice(-1)[0];
    g.quickAddFb = qe && qe.fb !== undefined;
    S.food[foodDate].s = S.food[foodDate].s.filter((x) => x.id !== qe.id);
    const sp = S.supps.find((x) => x.logFood);
    toggleSupp(sp.id);
    const se = ((S.food[today()] || {}).s || []).slice(-1)[0];
    g.suppFb = se && se.fb !== undefined;
    toggleSupp(sp.id);
    // the weekly report surfaces what the app now measures
    S.vo2 = [{ date: today(), val: 42.7, method: 'Cooper run' }];
    for (let i = 0; i < 14; i++) S.sleep[dShift(today(), -i)] = { bed: '23:15', wake: '07:10', hrs: 7.9, q: 'g' };
    save();
    openReport();
    const rep = document.querySelector('#sheetIn').textContent;
    closeSheet();
    g.report = ['Fiber', 'VO2max', 'Zone 2', 'Regularity'].filter((k) => !new RegExp(k, 'i').test(rep));
    S.vo2 = [];
    g.z2Shown = /Z2/.test(fmtSet({ w: 10, r: 30, z: true }, 'Cardio', false));
    g.z2Absent = !/Z2/.test(fmtSet({ w: 10, r: 30 }, 'Cardio', false));
    const src = obFinish.toString();
    g.onboarding = ['st.age', 'st.sex', 'fiberGoal'].filter((k) => !src.includes(k));
    openExInfo(S.exercises.find((x) => x.name === 'Leg press').id);
    g.cardLeads = /kg|reps|×/.test(document.querySelector('#sheetIn').textContent.slice(0, 220));
    closeSheet();
    save();
    return g;
  });
  check('the fiber backfill runs at boot, not only when called', audit.backfillRan);
  check('quick foods, supplements and my foods all carry fiber', audit.quickAll && audit.suppAll && audit.myFoodAll, audit);
  check('every logged entry carries fiber after backfill', audit.entriesAll);
  check('the manual add form saves fiber', audit.manualFb === 7, audit.manualFb);
  check('saving that as a quick food keeps the fiber', audit.quickSaveFb === 7, audit.quickSaveFb);
  check('quick-add and supplement logging carry fiber', audit.quickAddFb && audit.suppFb, audit);
  check('the weekly report covers fiber, VO2max, zone 2 and regularity', audit.report.length === 0, audit.report);
  check('zone 2 shows on a cardio set, and only when flagged', audit.z2Shown && audit.z2Absent, audit);
  check('onboarding stores age, sex and a fiber goal', audit.onboarding.length === 0, audit.onboarding);
  check('the exercise card leads with what to lift today', audit.cardLeads);

  console.log('barcode scanning');
  const bc = await page.evaluate(() => {
    const g = {};
    const savedFood = JSON.stringify(S.food);
    S.barcodes = {};
    go('food'); addFoodForm('s');
    g.entryPoint = /scanSheet\(/.test(document.querySelector('#sheetIn').innerHTML);
    // this browser has no reader: the sheet must say so rather than hang
    g.supported = barcodeSupported();
    scanSheet('s');
    const noSupport = document.querySelector('#sheetIn').textContent;
    g.degrades = g.supported || (/no barcode reader/i.test(noSupport) && /type the number/i.test(noSupport));
    // an unknown code asks once
    onCode('8901058000108');
    const t1 = document.querySelector('#sheetIn').textContent;
    g.asks = /New barcode/.test(t1) && /8901058000108/.test(t1);
    // link it by searching the database
    bcSearch('monaco');
    g.searchHits = BCRES.length;
    bcAttach(0);
    g.learned = !!S.barcodes['8901058000108'];
    g.snapshot = ['name', 'kcal', 'p', 'c', 'f', 'fb'].every((k) => k in S.barcodes['8901058000108']);
    // the snapshot must survive the source food being deleted
    const src = S.barcodes['8901058000108'].name;
    g.independent = S.barcodes['8901058000108'].kcal > 0 && typeof src === 'string';
    // a second scan goes straight to a quantity, and scales correctly
    onCode('8901058000108');
    g.straightToQty = /Quantity/.test(document.querySelector('#sheetIn').textContent);
    const before = ((S.food[foodDate] || {}).s || []).length;
    document.querySelector('#bcQty').value = '2';
    barcodeLog('8901058000108');
    const list = (S.food[foodDate] || {}).s || [];
    const e = list[list.length - 1];
    const unit = S.barcodes['8901058000108'];
    g.logged = list.length === before + 1;
    g.scaled = e.kcal === Math.round(unit.kcal * 2) && e.fb === Math.round(unit.fb * 2 * 10) / 10;
    g.quantityInName = /^2× /.test(e.name);
    // typing off the label also works
    scanSheet('s'); onCode('9999999999999');
    document.querySelector('#bcName').value = 'Test packet';
    document.querySelector('#bcK').value = '200';
    document.querySelector('#bcFb').value = '3';
    bcSaveTyped();
    g.typed = S.barcodes['9999999999999'] && S.barcodes['9999999999999'].fb === 3;
    // an unnamed product is refused rather than saved blank
    onCode('7777777777777');
    document.querySelector('#bcName').value = '';
    bcSaveTyped();
    g.refusesBlank = S.barcodes['7777777777777'] === undefined;
    // a wrong link is fixable, and the list shows what was learned
    barcodeList();
    g.listShows = /9999999999999/.test(document.querySelector('#sheetIn').textContent);
    barcodeForget('9999999999999');
    g.forgets = S.barcodes['9999999999999'] === undefined;
    // closing the sheet must always release the camera
    BC.stream = { getTracks: () => [{ stop: () => { window.__bcStopped = true; } }] };
    BC.timer = setInterval(() => {}, 1000);
    closeSheet();
    g.releasesCamera = window.__bcStopped === true && BC.stream === null && BC.timer === null;
    // nothing here touches the network
    g.offline = !/openfoodfacts|api\./i.test(scanSheet.toString() + onCode.toString() + bcAttach.toString());
    S.barcodes = {}; S.food = JSON.parse(savedFood); save();
    return g;
  });
  check('the food sheet offers a scan button', bc.entryPoint);
  check('a browser without a reader says so instead of hanging', bc.degrades);
  check('an unknown barcode asks what it is, showing the code', bc.asks);
  check('it can be linked to a food from the database', bc.searchHits >= 1 && bc.learned, bc);
  check('what is stored is a self-contained snapshot', bc.snapshot && bc.independent, bc);
  check('a known barcode goes straight to a quantity', bc.straightToQty);
  check('logging scales calories and fiber by quantity', bc.logged && bc.scaled && bc.quantityInName, bc);
  check('a product can be typed off the label instead', bc.typed);
  check('a blank product name is refused, not saved empty', bc.refusesBlank);
  check('learned products are listed and can be forgotten', bc.listShows && bc.forgets, bc);
  check('closing the sheet always releases the camera', bc.releasesCamera);
  check('no network call anywhere in the scan path', bc.offline);

  console.log('missed days, dangling references, milestones');
  const gaps = await page.evaluate(() => {
    const g = {};
    const savedSessions = JSON.stringify(S.sessions), savedPlan = JSON.stringify(S.plan),
          savedEx = JSON.stringify(S.exercises), savedRt = JSON.stringify(S.routines);
    // a planned day with nothing logged is a missed session
    S.sessions = S.sessions.filter((x) => x.date < dShift(today(), -8));
    S.skipped = [];
    save();
    const m = missedSessions(3);
    g.found = m.length >= 1;
    g.hasRoutine = !!(m[0] && m[0].routine && m[0].routine.name);
    g.agoSane = !!(m[0] && m[0].ago >= 1 && m[0].ago <= 3);
    g.card = /Missed/.test(catchUpCard());
    // a rest day is not a missed session
    const restDow = Object.keys(S.plan).find((k) => !S.plan[k]);
    g.restNotMissed = restDow === undefined || !m.some((x) => String(new Date(x.date + 'T12:00:00').getDay()) === restDow);
    // skipping removes it and does not touch the plan
    const planBefore = JSON.stringify(S.plan);
    skipMissed(m[0].date);
    g.skipWorks = !missedSessions(3).some((x) => x.date === m[0].date);
    g.planUntouched = JSON.stringify(S.plan) === planBefore;
    // a break is never a missed session
    S.skipped = [];
    const d2 = dShift(today(), -2);
    S.breaks = (S.breaks || []).concat([{ id: 'bk-t', from: d2, to: d2, label: 'Test break' }]);
    g.breakExcluded = !missedSessions(3).some((x) => x.date === d2);
    S.breaks = S.breaks.filter((x) => x.id !== 'bk-t');
    // short-group reporting uses the same 10-20 range as the volume screen
    const push = S.routines.find((r) => /Push: wrist/.test(r.name));
    const sg = shortGroups(push);
    g.shortShape = Array.isArray(sg) && sg.every((x) => 'group' in x && 'sets' in x);
    // deleting a routine clears the plan days pointing at it
    S.plan[1] = push.id;
    delRoutine(push.id);
    g.planCleared = !S.plan[1];
    g.planSurvives = (() => { try { todaysPlanRoutine(); return true; } catch (e) { return false; } })();
    // deleting an exercise removes it from every routine
    const r2 = S.routines.find((r) => r.exIds.length > 2);
    const exId = r2.exIds[0];
    delExercise(exId);
    g.routineCleaned = r2.exIds.indexOf(exId) === -1;
    g.noDeletedRows = !S.routines.some((r) => r.exIds.some((id) => exName(id) === '(deleted)'));
    S.sessions = JSON.parse(savedSessions); S.plan = JSON.parse(savedPlan);
    S.exercises = JSON.parse(savedEx); S.routines = JSON.parse(savedRt);
    S.skipped = []; save();
    // milestones now cover what the app measures
    const ach = achievements();
    g.achCount = ach.length;
    const txt = ach.map((a) => a.t.toLowerCase()).join(' ');
    g.achMissing = ['fiber', 'vo2max', 'zone-2', 'regularity', 'steam', 'daylight', 'checklist']
      .filter((k) => txt.indexOf(k) < 0);
    g.achShape = ach.every((a) => a.i && a.t && typeof a.ok === 'boolean');
    return g;
  });
  check('a planned day with nothing logged reads as missed', gaps.found && gaps.hasRoutine && gaps.agoSane, gaps);
  check('the catch-up card offers it', gaps.card);
  check('a rest day is never a missed session', gaps.restNotMissed);
  check('skipping dismisses it without touching the plan', gaps.skipWorks && gaps.planUntouched, gaps);
  check('a planned break is never a missed session', gaps.breakExcluded);
  check('short groups report against the same volume range', gaps.shortShape);
  check('deleting a routine clears the plan days pointing at it', gaps.planCleared && gaps.planSurvives, gaps);
  check('deleting an exercise removes it from every routine', gaps.routineCleaned && gaps.noDeletedRows, gaps);
  check('milestones cover the newer metrics too', gaps.achMissing.length === 0 && gaps.achCount >= 23, gaps);
  check('every milestone has an icon, a name and a state', gaps.achShape);

  console.log('Jaipur food coverage and the supplement schedule');
  const jai = await page.evaluate(() => {
    const g = {};
    const has = (q) => FOODDB.some((r) => r[0].toLowerCase().includes(q.toLowerCase()));
    g.missing = ['waffle', 'tres leches', 'cajun potatoes', 'ravioli', 'rabri ghewar', 'puri aloo',
      'samosa chaat', 'tandoori momos', 'afghani momos', 'kurkure momos', 'paneer momos',
      'cheesecake', 'croissant', 'pancakes', 'falafel', 'hummus', 'quesadilla', 'burrito',
      'latte', 'frappe', 'boba', 'smoothie', 'cold coffee'].filter((q) => !has(q));
    g.rows = FOODDB.length;
    g.allSix = FOODDB.every((r) => r.length === 6 && typeof r[5] === 'number');
    const names = FOODDB.map((r) => r[0]);
    g.dupes = names.filter((n, i) => names.indexOf(n) !== i);
    // muesli swap
    g.shakeName = (S.myFoods.find((m) => /post-workout shake/i.test(m.name)) || {}).name;
    g.massName = (S.quick.find((q) => /Mass shake/i.test(q.name)) || {}).name;
    // the double-count
    const shake = S.supps.find((x) => /post-workout shake/i.test(x.name));
    const whey = S.supps.find((x) => /^whey/i.test(x.name));
    const cre = S.supps.find((x) => /creatine/i.test(x.name));
    g.wheyNoLogFood = whey.logFood === false;
    const base = foodTotals(today());
    toggleSupp(shake.id);
    const after = foodTotals(today());
    g.shakeKcal = after.kcal - base.kcal;
    g.covered = String(S.suppLog[today()][whey.id]).indexOf('via:') === 0
      && String(S.suppLog[today()][cre.id]).indexOf('via:') === 0;
    const k = foodTotals(today()).kcal;
    toggleSupp(whey.id);
    g.noDouble = foodTotals(today()).kcal === k;
    toggleSupp(shake.id);
    g.released = S.suppLog[today()][whey.id] === undefined && S.suppLog[today()][cre.id] === undefined;
    g.baseline = foodTotals(today()).kcal === base.kcal;
    // doses and slots
    g.doses = S.supps.every((sp) => !!suppDose(sp));
    g.slots = ['morning', 'post', 'lunch', 'bed'].every((sl) => S.supps.some((sp) => suppPlan(sp.name).slot === sl));
    g.calciumLunch = suppPlan('Calcium: with lunch').slot === 'lunch';
    g.magBed = suppPlan('Magnesium: before bed').slot === 'bed';
    // an editable dose survives
    setSuppDose(cre.id, '3 g');
    g.doseEdit = suppDose(S.supps.find((x) => x.id === cre.id)) === '3 g';
    delete S.supps.find((x) => x.id === cre.id).dose;
    // the conflict check: quiet on this stack, loud when forced
    g.noConflictNow = suppConflicts().length === 0;
    // move calcium onto the evening slot and the check should object
    const cal = S.supps.find((x) => /calcium/i.test(x.name));
    g.calDefault = suppSlot(cal) === 'lunch';
    setSuppSlot(cal.id, 'bed');
    g.conflictFound = suppConflicts().some((c) => /two hours/.test(c));
    g.slotEdit = suppSlot(cal) === 'bed';
    delete cal.slot;
    g.conflictClears = suppConflicts().length === 0;
    // the grouped checklist and the 30-day grid render
    checklistSheet();
    const cl = document.querySelector('#sheetIn');
    g.grouped = /MORNING|Morning/.test(cl.textContent) && /Before bed/i.test(cl.textContent);
    g.showsDose = /2000 IU/.test(cl.textContent) && /500 mcg/.test(cl.textContent);
    g.showsWhy = /absorption rises about 32%/.test(cl.textContent);
    closeSheet();
    S.suppLog[today()] = S.suppLog[today()] || {};
    S.suppLog[today()][shake.id] = 1;
    suppGrid();
    const grid = document.querySelector('#sheetIn');
    g.gridCells = grid.querySelectorAll('.sgrid')[0].children.length;
    g.gridRows = grid.querySelectorAll('.sgrid').length;
    g.suppCount = S.supps.length;
    closeSheet();
    delete S.suppLog[today()][shake.id];
    save();
    return g;
  });
  check('every food the user listed is in the database', jai.missing.length === 0, jai.missing);
  check('315+ foods, all six fields, no duplicates', jai.rows >= 315 && jai.allSix && jai.dupes.length === 0, jai);
  check('the shake is muesli now, not oats', /muesli/i.test(jai.shakeName) && /muesli/i.test(jai.massName), jai);
  check('ticking the shake logs its calories once', jai.shakeKcal === 700, jai.shakeKcal);
  check('whey and creatine are marked as covered by it', jai.covered);
  check('whey no longer writes its own food entry', jai.wheyNoLogFood && jai.noDouble, jai);
  check('unticking the shake releases both, and food returns to baseline', jai.released && jai.baseline, jai);
  check('every supplement shows a dose', jai.doses);
  check('slots group morning, post-workout, lunch and bed', jai.slots && jai.calciumLunch && jai.magBed, jai);
  check('a dose you type is kept', jai.doseEdit);
  check('no conflict on this stack as scheduled', jai.noConflictNow && jai.calDefault, jai);
  check('moving calcium next to zinc is caught, and clears when moved back', jai.conflictFound && jai.slotEdit && jai.conflictClears, jai);
  check('the checklist groups by time and explains the gaps', jai.grouped && jai.showsDose && jai.showsWhy, jai);
  check('the 30-day grid renders a row per supplement', jai.gridCells === 30 && jai.gridRows === jai.suppCount, jai);

  console.log('VO2max interval training');
  const ivt = await page.evaluate(() => {
    const g = {};
    const rt = S.routines.find((r) => /VO2max intervals/.test(r.name));
    g.routine = !!rt;
    g.stats = routineStats(rt.exIds);
    const id = rt.exIds[0];
    const rx = prescribe(id);
    g.tag = rx.tag; g.sets = rx.sets.length;
    /* the plan no longer pre-fills reps: 4 minutes is the same every session and
       carries no information, so that column holds the peak heart rate now. The
       protocol still has to be stated in the copy. */
    g.mins = rx.sets[0].r;
    g.minsInWhy = /4 × 4 min hard/.test(rx.why);
    g.hrInWhy = /\b\d{3}-\d{3} bpm\b/.test(rx.why) && /full band is 167-177/.test(rx.why);
    g.hrMax = hrMax();
    // all four modalities carry the protocol
    g.modalities = ['bike', 'rower', 'SkiErg', 'incline walk'].map((m) => {
      const e = S.exercises.find((x) => x.name === 'VO2max 4×4 (' + m + ')');
      return !!(e && exIv(e.id));
    });
    // a plain cardio exercise is untouched
    g.plainCardio = prescribe(S.exercises.find((x) => x.name === 'Cycling').id).tag;
    // no age: fall back to words, never NaN
    const savedAge = S.settings.age; S.settings.age = '';
    const noAge = prescribe(id).why;
    g.noAgeSafe = !/NaN|undefined/.test(noAge) && /few words/.test(noAge);
    S.settings.age = savedAge;
    // the timer hand-off
    startIntervals(id);
    g.timer = document.querySelector('#hiWork').value + '/' + document.querySelector('#hiRest').value
      + '/' + document.querySelector('#hiRounds').value;
    g.subTab = (document.querySelector('[data-tv].on') || {}).dataset.tv;
    // Thursday reassigned, and a hand-edited plan protected
    g.thursday = (S.routines.find((r) => r.id === S.plan[4]) || {}).name;
    const savedPlan = S.plan[4], pull = S.routines.find((r) => /Pull: wrist/.test(r.name));
    S.plan[4] = pull.id; delete S.seedV22; seedV22();
    g.planRespected = S.plan[4] === pull.id;
    S.plan[4] = savedPlan; save();
    // logging: four intervals, none of it counted as zone 2
    const savedSessions = S.sessions;
    S.sessions = [{ id: 'iv1', name: 'VO2max intervals (4×4)', date: today(), dur: 1, vol: 0, prs: [],
      ex: [{ exId: id, sets: [{ w: 1.2, r: 4, done: true }, { w: 1.2, r: 4, done: true },
                              { w: 1.1, r: 4, done: true }, { w: 1.1, r: 4, done: true }] }] }];
    g.loggedSets = S.sessions[0].ex[0].sets.length;
    g.notZone2 = zone2Mins(7) === 0;
    S.sessions = savedSessions; save();
    // the layout regression: non-lift rows need all five cells on one line
    startSession(rt.id); closeSheet();
    const row = document.querySelector('#tab-workout .setrow');
    g.rowCols = row ? getComputedStyle(row).gridTemplateColumns.split(' ').length : 0;
    g.rowChildren = row ? row.children.length : 0;
    g.hasTimerButton = /startIntervals\(/.test(document.querySelector('#tab-workout').innerHTML);
    cancelSession(); closeSheet();
    return g;
  });
  check('the 4×4 routine exists', ivt.routine);
  check('it estimates ~28 min over 4 intervals, not a flat cardio guess', ivt.stats.mins >= 25 && ivt.stats.mins <= 32 && ivt.stats.sets === 4, ivt.stats);
  check('it prescribes 4 work bouts of 4 minutes', ivt.tag === 'intervals' && ivt.sets === 4 && ivt.minsInWhy, ivt.why);
  check('the reps column is left blank for the peak heart rate', ivt.mins === '', ivt.mins);
  check('heart-rate target from Tanaka (186 max, full band 167-177)', ivt.hrMax === 186 && ivt.hrInWhy, ivt.why);
  check('all four modalities carry the protocol', ivt.modalities.every(Boolean), ivt.modalities);
  check('ordinary cardio still gets the steady prescription', ivt.plainCardio === 'steady', ivt.plainCardio);
  check('no age falls back to words, never NaN', ivt.noAgeSafe);
  check('the timer preloads 240/180/4 and opens on Rounds', ivt.timer === '240/180/4' && ivt.subTab === 'hi', ivt);
  check('Thursday holds the interval session', /VO2max intervals/.test(ivt.thursday || ''), ivt.thursday);
  check('a hand-edited plan day is never overwritten', ivt.planRespected);
  check('four intervals log as four sets', ivt.loggedSets === 4, ivt.loggedSets);
  check('interval work is not counted as zone 2', ivt.notZone2);
  check('cardio set rows still fit on one line', ivt.rowCols === 5 && ivt.rowChildren === 5, ivt);
  check('the session offers the interval timer', ivt.hasTimerButton);

  console.log('discoverability: can you actually find these screens');
  const disc = await page.evaluate(() => {
    go('today'); renderToday();
    const html = document.querySelector('#tab-today').innerHTML;
    const txt = document.querySelector('#tab-today').textContent;
    // reachable straight from the dashboard, not buried behind a sheet
    const supp = (html.match(/suppEditor\(\)/g) || []).length;
    const proto = (html.match(/protocolsSheet\(\)/g) || []).length;
    // and the labels say what they are
    const labelled = /Stack & evidence/i.test(txt) && /What the research says/i.test(txt);
    // the two screens link to each other
    suppEditor();
    const fromSupp = /protocolsSheet\(\)/.test(document.querySelector('#sheetIn').innerHTML);
    closeSheet();
    protocolsSheet();
    const fromProto = /suppEditor\(\)/.test(document.querySelector('#sheetIn').innerHTML);
    closeSheet();
    // the old buried text link is gone
    checklistSheet();
    const checklistBtn = /suppEditor\(\)/.test(document.querySelector('#sheetIn').innerHTML);
    const noTinyLink = !/>Edit list</.test(document.querySelector('#sheetIn').innerHTML);
    closeSheet();
    return { supp, proto, labelled, fromSupp, fromProto, checklistBtn, noTinyLink };
  });
  check('supplements reachable from the dashboard', disc.supp >= 2, disc.supp);
  check('the protocols screen reachable from the dashboard', disc.proto >= 2, disc.proto);
  check('both are labelled so you know what they are', disc.labelled);
  check('the two screens link to each other', disc.fromSupp && disc.fromProto, disc);
  check('the checklist offers a real button, not a tiny link', disc.checklistBtn && disc.noTinyLink, disc);

  console.log('logging speed and feel');
  const ux = await page.evaluate(() => {
    const g = {};
    const savedFood = JSON.stringify(S.food);
    S.food = {};
    const mk = (n, k) => ({ id: uid(), name: n, kcal: k, p: 5, c: 10, f: 2, fb: 3 });
    for (let i = 1; i <= 10; i++) {
      S.food[dShift(today(), -i)] = { l: [mk('Dal tadka (bowl)', 150), mk('2× Roti', 200)] };
      if (i < 4) S.food[dShift(today(), -i)].s = [mk('Monaco (1 biscuit)', 25)];
    }
    save();
    const rec = recentFoods(8);
    g.recentOrder = rec.map((r) => r.name + '×' + r.n);
    g.mostFrequentFirst = rec[0].n === 10 && rec[rec.length - 1].n === 3;
    go('food'); addFoodForm('l');
    g.againRendered = /AGAIN/i.test(document.querySelector('#sheetIn').textContent);
    const before = ((S.food[foodDate] || {}).l || []).length;
    const idx = AGAIN.findIndex((f) => f.name === '2× Roti');
    logAgain('l', idx);
    const list = (S.food[foodDate] || {}).l || [];
    const e = list[list.length - 1];
    g.oneTap = list.length === before + 1 && e.name === '2× Roti' && e.kcal === 200 && e.fb === 3;
    addFoodForm('l');
    document.querySelector('#fdbQ').value = 'dal';
    fdbSearch('dal');
    g.searchRanked = FDRES[0] && FDRES[0].name === 'Dal tadka (bowl)';
    closeSheet();
    delFood('l', e.id);
    g.deletedFirst = !((S.food[foodDate] || {}).l || []).some((x) => x.id === e.id);
    const undo = document.querySelector('#toastAct');
    g.undoOffered = !!undo;
    if (undo) undo.click();
    g.restored = ((S.food[foodDate] || {}).l || []).some((x) => x.id === e.id);
    S.food = JSON.parse(savedFood); save();
    const leg = S.exercises.find((x) => x.name === 'Leg press').id;
    const lat = S.exercises.find((x) => x.name === 'Lateral raise').id;
    const latStart = +prescribe(lat).sets[0].w || 0;
    startSession(); closeSheet(); addExToSession(leg); addExToSession(lat);
    const w0 = +S.active.ex[0].sets[0].w;
    bump(0, 0, 'w', 1); g.legStep = +S.active.ex[0].sets[0].w - w0;
    bump(1, 0, 'w', 1); g.latStep = +S.active.ex[1].sets[0].w - latStart;
    const r0 = +S.active.ex[0].sets[0].r;
    bump(0, 0, 'r', -1); g.repStep = r0 - (+S.active.ex[0].sets[0].r);
    for (let i = 0; i < 40; i++) bump(0, 0, 'w', -1);
    g.floored = +S.active.ex[0].sets[0].w === 0;
    g.clearsPlan = S.active.ex[0].sets[0].plan === undefined;
    g.liftRows = (document.querySelector('#tab-workout').innerHTML.match(/class="setrow lift/g) || []).length;
    cancelSession(); closeSheet();
    startSession(); closeSheet();
    addExToSession(S.exercises.find((x) => x.name === 'Cycling').id);
    g.cardioNoStepper = !/class="setrow lift/.test(document.querySelector('#tab-workout').innerHTML);
    cancelSession(); closeSheet();
    g.noPrompt = !/[^a-zA-Z]prompt\(/.test(document.documentElement.innerHTML);
    go('food'); renderFood();
    g.swipeRows = document.querySelectorAll('#tab-food .swipe[data-sw]').length;
    g.swipeReady = typeof initSwipe === 'function';
    save();
    return g;
  });
  check('recents rank by how often you log them', ux.mostFrequentFirst, ux.recentOrder);
  check('the Again row renders above search', ux.againRendered);
  check('one tap re-logs verbatim, quantity and fiber included', ux.oneTap, ux);
  check('search puts what you actually eat first', ux.searchRanked);
  check('deleting a food offers undo, and undo restores it', ux.deletedFirst && ux.undoOffered && ux.restored, ux);
  check('weight steps by the movement increment (legs 5, raise 1.25)', ux.legStep === 5 && ux.latStep === 1.25, ux);
  check('reps step by one', ux.repStep === 1, ux.repStep);
  check('steppers never go below zero', ux.floored);
  check('using a stepper makes the prescription a real set', ux.clearsPlan);
  check('lifting rows get steppers, cardio rows do not', ux.liftRows >= 3 && ux.cardioNoStepper, ux);
  check('no native prompt() left anywhere', ux.noPrompt);
  check('swipe handling installed and rows carry a handle', ux.swipeReady && ux.swipeRows >= 0, ux);

  console.log('section navigation');
  const nav = await page.evaluate(() => {
    const out = {};
    go('workout'); WV = 'home'; renderWorkout();
    const bar = () => document.querySelector('#tab-workout .subnav');
    out.onWorkout = !!bar();
    out.labels = bar() ? [...bar().querySelectorAll('.chip')].map((b) => b.textContent) : [];
    out.sticky = bar() ? getComputedStyle(bar()).position : null;
    out.todayActive = bar().querySelector('.chip.on').textContent;
    // every destination reachable, and each marks itself
    const reach = {};
    ['progress', 'history', 'library', 'cardio'].forEach((v) => {
      goWV(v);
      const b = document.querySelector('#tab-workout .subnav');
      reach[v] = !!b && document.querySelector('#tab-workout').innerHTML.length > 200
        && !!b.querySelector('.chip.on');
    });
    out.reach = reach;
    // the old buried buttons are gone
    goWV('home');
    out.noOldButtons = !/WV=.progress.;renderWorkout\(\)">.*Progress/.test(document.querySelector('#tab-workout').innerHTML);
    out.routinesAnchor = !!document.getElementById('rtHead');
    // hidden while training
    startSession(); closeSheet();
    out.hiddenInSession = !document.querySelector('#tab-workout .subnav');
    cancelSession(); closeSheet();
    // body tab
    go('body'); goBV('weight');
    const bbar = () => document.querySelector('#tab-body .subnav');
    out.onBody = !!bbar();
    out.bodyLabels = bbar() ? [...bbar().querySelectorAll('.chip')].map((b) => b.textContent) : [];
    const breach = {};
    ['bmi', 'meas', 'photos', 'entries'].forEach((v) => {
      goBV(v);
      breach[v] = document.querySelector('#tab-body').innerHTML.length > 200
        && !!document.querySelector('#tab-body .subnav .chip.on');
    });
    out.bodyReach = breach;
    // each body section renders alone, not stacked
    goBV('meas');
    out.oneSectionOnly = (document.querySelector('#tab-body').innerHTML.match(/class="osec"/g) || []).length === 1;
    goBV('weight'); go('workout'); WV = 'home'; renderWorkout();
    return out;
  });
  check('workout tab has a pinned section row', nav.onWorkout && nav.sticky === 'sticky', nav.sticky);
  check('it lists every workout section', nav.labels.join('|') === 'Today|Routines|Progress|History|Exercises|Cardio|Plan', nav.labels);
  check('the current section is marked', nav.todayActive === 'Today', nav.todayActive);
  check('Progress, History and Exercises all reachable', Object.values(nav.reach).every(Boolean), nav.reach);
  check('the old buried buttons are gone', nav.noOldButtons);
  check('Routines chip has something to scroll to', nav.routinesAnchor);
  check('the row stays out of the way mid-workout', nav.hiddenInSession);
  check('body tab has the same row', nav.onBody && nav.bodyLabels.join('|') === 'Weight|BMI|Measurements|Photos|Entries', nav.bodyLabels);
  check('every body section reachable', Object.values(nav.bodyReach).every(Boolean), nav.bodyReach);
  check('body sections render one at a time', nav.oneSectionOnly);

  console.log('BMI analysis');
  const bmi = await page.evaluate(() => {
    const st = S.settings;
    const last = S.weights[S.weights.length - 1];
    go('body'); goBV('bmi');
    const txt = document.querySelector('#tab-body').textContent;
    const savedH = st.height;
    st.height = '';
    const noHeight = document.createElement('div');
    noHeight.innerHTML = bmiHTML();
    const missing = noHeight.textContent;
    st.height = savedH; save();
    return {
      value: bmiOf(last.kg, st.height),
      band: bmiBand(bmiOf(last.kg, st.height), BMI_IN),
      who: bmiBand(bmiOf(last.kg, st.height), BMI_WHO),
      goal: bmiOf(+st.goalWeight, st.height),
      lo: kgForBmi(18.5, st.height), hi: kgForBmi(22.9, st.height), hiWho: kgForBmi(24.9, st.height),
      shows: /20\.6/.test(txt) && /Normal/.test(txt),
      caveat: /muscle/.test(txt),
      bothStandards: /Indian/.test(txt) && /WHO/.test(txt),
      missingHandled: /height/i.test(missing) && !/NaN/.test(missing),
      // where the standards actually diverge: 72 kg at 176 cm is BMI 23.2,
      // overweight on Indian cutoffs but still normal on WHO; 80 kg is 25.8,
      // obese on Indian and merely overweight on WHO
      edge: [bmiBand(bmiOf(72, 176), BMI_IN), bmiBand(bmiOf(72, 176), BMI_WHO),
             bmiBand(bmiOf(80, 176), BMI_IN), bmiBand(bmiOf(80, 176), BMI_WHO)],
      under: bmiBand(17, BMI_IN),
    };
  });
  check('BMI computes 20.6 from 63.9 kg at 176 cm', bmi.value === 20.6, bmi.value);
  check('normal on both standards', bmi.band === 'Normal' && bmi.who === 'Normal', bmi);
  check('the goal of 68 kg reads BMI 22', bmi.goal === 22, bmi.goal);
  check('healthy range 57.3-70.9 (77.1 WHO)', bmi.lo === 57.3 && bmi.hi === 70.9 && bmi.hiWho === 77.1, bmi);
  check('the section shows the number and its band', bmi.shows);
  check('both standards are named', bmi.bothStandards);
  check('the muscle-mass caveat is stated', bmi.caveat);
  check('Indian cutoffs are stricter than WHO where it matters',
    bmi.edge.join('|') === 'Overweight|Normal|Obese|Overweight', bmi.edge);
  check('underweight band works', bmi.under === 'Underweight', bmi.under);
  check('missing height prompts instead of rendering NaN', bmi.missingHandled, bmi.missingHandled);

  console.log('VO2max intervals: the on-ramp, the recovery floor and the verdict');
  const iv = await page.evaluate(() => {
    const bike = S.exercises.find((e) => e.name === 'VO2max 4×4 (bike)').id;
    const ses = S.sessions.filter((s) => /VO2max/.test(s.name));
    const first = ses[0];
    const keep = S.sessions.slice();
    /* the ramp is driven by how many interval sessions are logged, so walk it */
    const bands = [];
    S.sessions = keep.filter((s) => !/VO2max/.test(s.name));
    for (let n = 0; n <= 4; n++) {
      const t = hrTarget();
      bands.push([t.lo, t.hi]);
      S.sessions = S.sessions.concat([{ id: 'x' + n, name: 'VO2max intervals (4×4)', date: today(), ex: [{ exId: bike, sets: [] }] }]);
    }
    S.sessions = keep;
    const rx = prescribe(bike);
    const t = hrTarget();
    return {
      logged: ses.length,
      /* per-interval peak HR, not a constant 4 minutes */
      hrs: first ? first.ex[0].sets.map((s) => s.r) : [],
      noFakeDistance: first ? first.ex[0].sets.every((s) => !s.w) : false,
      noteHonest: first ? /estimate/i.test(first.note) && /16\.42/.test(first.note) : false,
      bands,
      planBlank: rx.sets.every((s) => s.r === '' && s.w === ''),
      why: rx.why,
      verdicts: [hrVerdict(120).k, hrVerdict(145).k, hrVerdict(155).k, hrVerdict(200).k],
      recovery: [t.recLo, t.recHi],
      allHaveLever: Object.keys(EX_IV).every((k) => !!EX_IV[k].lever),
    };
  });
  check('the first VO2max session is logged with per-interval peak HR',
    iv.logged === 1 && iv.hrs.join(',') === '140,140,145,151', iv.hrs);
  check('no per-interval distance invented from a flywheel total', iv.noFakeDistance);
  check('the note says what was measured and what was estimated', iv.noteHonest);
  check('the target band ramps over four sessions, then holds at 90-95%',
    JSON.stringify(iv.bands) === JSON.stringify([[149, 162], [149, 162], [158, 167], [158, 167], [167, 177]]), iv.bands);
  check('the prescription leaves both columns blank to fill, not pre-filled with 4', iv.planBlank);
  check('the prescription names the recovery floor and the in-interval step-ups',
    /112-130/.test(iv.why) && /2:00/.test(iv.why) && /do not stop/.test(iv.why), iv.why.slice(0, 80));
  check('the prescription names the machine lever, not the console number',
    /[Rr]esistance, not speed/.test(iv.why) && /Ignore the distance/.test(iv.why));
  check('every interval machine has its own lever cue', iv.allHaveLever);
  check('recovery floor is 60-70% of max', iv.recovery.join('-') === '112-130', iv.recovery);
  check('the verdict reads under / near / in / over correctly',
    iv.verdicts.join(',') === 'under,near,in,over', iv.verdicts);

  /* The gap that prompted all this was not "the food is missing" — half the
     time the row existed and the search could not find it. So the assertion is
     on the SEARCH, driven from the words actually typed, not on the array. */
  console.log('food search: every word from the ask resolves');
  const searchWords = [
    'muesli', 'roti sabzi', 'loki ke gufte', 'lauki ke gufte', 'kachri', 'parwal', 'kande',
    'palak', 'methi', 'turai', 'bhindi masala', 'bhindi', 'aloo', 'kaddu', 'arbi',
    'sev bhaji', 'sev tomato', 'sev tamatar', 'dahi puri', 'idli sambhar', 'vada', 'dosa',
    'bhelpuri', 'bhel puri', 'sev puri', 'pani patashi', 'aloo tikki', 'momos', 'chips',
    'burger', 'yogurt', 'kheera', 'cucumber', 'achar', 'makhani', 'lasagna', 'gatte',
    'samosa', 'wrap', 'shake', 'coffee', 'ravioli', 'cajun', 'waffle', 'tres leches',
    'rabri ghewar', 'kachori', 'poha', 'thali', 'dal chawal', 'greek yogurt', 'espresso',
    'mocha', 'cold brew', 'matcha', 'lemonade', 'paneer roll', 'soya chaap', 'rajma',
  ];
  const search = await page.evaluate((words) => {
    const all = fdbAllFoods();
    const hits = (q) => all.filter((f) => foodMatches(f.name, foodTokens(q))).length;
    const names = FOODDB.map((r) => r[0]);
    /* fiber yields ~2 kcal/g, not 4, and alcohol is not in any macro column,
       so the Atwater check accounts for both or it flags correct rows */
    const outliers = FOODDB.filter((r) => {
      if (/beer|whisky|wine|rum|vodka/i.test(r[0])) return false;
      const est = 4 * r[2] + 4 * Math.max(0, r[3] - r[5]) + 2 * r[5] + 9 * r[4];
      return Math.abs(est - r[1]) > Math.max(30, r[1] * 0.18);
    }).map((r) => r[0]);
    return {
      rows: FOODDB.length,
      shape: FOODDB.every((r) => r.length === 6 && r.every((v, i) => (i ? typeof v === 'number' && isFinite(v) && v >= 0 : !!String(v).trim()))),
      dupes: names.filter((n, i) => names.indexOf(n) !== i),
      outliers,
      misses: words.filter((w) => hits(w) === 0),
      /* aliases doing real work: these words appear in NO row name, so a hit
         can only have come through the synonym layer */
      aliasReal: ['okra', 'pumpkin', 'cottage cheese', 'lady finger', 'ridge gourd', 'chickpeas']
        .map((w) => [w, hits(w), names.some((n) => n.toLowerCase().includes(w))])
        .filter((x) => x[1] === 0 || x[2]),
      stopwords: hits('loki ke gufte') === hits('lauki gufte'),
      /* a name that starts with the query beats a merely-frequent one */
      prefixFirst: (() => {
        const g = foodTokens('dal');
        const r = all.filter((f) => foodMatches(f.name, g))
          .sort((a, b) => (b.name.toLowerCase().indexOf('dal') === 0 ? 1 : 0) - (a.name.toLowerCase().indexOf('dal') === 0 ? 1 : 0));
        return r[0].name.toLowerCase().indexOf('dal') === 0;
      })(),
      /* everything added in this pass is vegetarian or vegan; a stray nonveg or
         egg tag would silently hide a sabzi from a vegetarian */
      badDiet: FOODDB.map((r) => r[0])
        .filter((n) => /sabzi|gufte|thali|muesli|chaat|roll|wrap|latte|shake|cooler|espresso/i.test(n))
        .filter((n) => !/chicken|mutton|fish|prawn|egg|anda/i.test(n))
        .filter((n) => ['nonveg', 'egg'].includes(foodDiet(n))),
      /* the substring trap that hid a vegetarian thali: "standard" contains
         "anda", "no ghee" contains "ghee", "kheera" contains "kheer" */
      substringTraps: [
        ['Veg thali (standard)', 'veg'], ['Rajasthani thali (full)', 'veg'],
        ['Atta roti / phulka, no ghee (1)', 'veg'], ['Peanut butter (1 tbsp)', 'veg'],
        ['Salad: kheera/tamatar/pyaaz (plate)', 'veg'], ['Anda bhurji pav (plate)', 'egg'],
        ['Paneer bhurji (bowl)', 'dairy'], ['Egg bhurji (bowl)', 'egg'],
      ].filter((t) => foodDiet(t[0]) !== t[1]).map((t) => t[0] + ' → ' + foodDiet(t[0])),
      milkIsDairy: ['Muesli + milk (bowl)', 'Caramel latte (cup)', 'Thick shake, any flavour (glass)']
        .every((n) => foodDiet(n) === 'dairy'),
      blackCoffeeVegan: foodDiet('Espresso (single shot)') === 'veg' && foodDiet('Cold brew black (glass)') === 'veg',
    };
  }, searchWords);
  check('470+ foods, all six fields, no duplicates',
    search.rows >= 470 && search.shape && search.dupes.length === 0, { rows: search.rows, dupes: search.dupes });
  check('every row\'s calories match its macros (fiber and alcohol aware)',
    search.outliers.length === 0, search.outliers);
  check('every word from the ask finds at least one food', search.misses.length === 0, search.misses);
  check('the alias layer is doing real work, not matching literal names',
    search.aliasReal.length === 0, search.aliasReal);
  check('joining words (ke/ki/ka) are ignored', search.stopwords);
  check('a name starting with the query sorts first', search.prefixFirst);
  check('no sabzi, wrap or cafe drink is tagged nonveg or egg', search.badDiet.length === 0, search.badDiet);
  check('milk-based cafe drinks and muesli count as dairy', search.milkIsDairy);
  check('black coffee stays vegan', search.blackCoffeeVegan);
  check('substring traps classify by meaning, not by letters',
    search.substringTraps.length === 0, search.substringTraps);

  console.log('food database + My Foods');
  const food = await page.evaluate(() => {
    function hits(q) {
      const t = q.toLowerCase().split(/\s+/);
      return fdbAllFoods().filter((f) => t.every((x) => f.name.toLowerCase().includes(x)));
    }
    return {
      kaju: hits('kaju shake').length, almond: hits('almond').length,
      gond: hits('gond').length, momos: hits('momos').length, total: fdbAllFoods().length,
    };
  });
  check('kaju shake findable', food.kaju >= 1, food.kaju);
  check('per-piece almond findable', food.almond >= 1);
  check('DB has 190+ foods', food.total >= 190, food.total);
  const brands = await page.evaluate(() => {
    function hits(q) {
      const t = q.toLowerCase().split(/\s+/);
      return fdbAllFoods().filter((f) => t.every((x) => f.name.toLowerCase().includes(x)));
    }
    return {
      monaco: hits('monaco').length, krackjack: hits('krackjack').length,
      perBiscuit: hits('1 biscuit').length, packet: hits('packet').length,
      paneerPiece: hits('paneer piece').length, dalPlain: hits('dal plain').length,
      dalTypes: hits('dal').length, oil: hits('cooking oil').length,
    };
  });
  check('Monaco and Krackjack findable', brands.monaco >= 2 && brands.krackjack >= 2, brands);
  check('biscuits loggable per piece and per packet', brands.perBiscuit >= 10 && brands.packet >= 5, brands);
  check('plate components (paneer piece, plain dal, oil)', brands.paneerPiece >= 1 && brands.dalPlain >= 1 && brands.oil >= 1, brands);
  check('multiple dal types', brands.dalTypes >= 8, brands.dalTypes);
  const my = await page.evaluate(() => {
    go('food'); addFoodForm('s');
    S.myFoods.push({ id: 'tmf1', name: 'Test kheer (bowl)', kcal: 111, p: 3, c: 20, f: 2 });
    save(); fdbSearch('test kheer');
    const found = FDRES.some((f) => f.id === 'tmf1');
    fdbPick(FDRES.findIndex((f) => f.id === 'tmf1'));
    document.querySelector('#fdbQty').value = '2';
    fdbAdd();
    const day = S.food[foodDate] || {};
    const entry = (day.s || []).find((e) => /Test kheer/.test(e.name));
    S.myFoods = S.myFoods.filter((m) => m.id !== 'tmf1');
    if (entry) day.s = day.s.filter((e) => e.id !== entry.id);
    save();
    return { found, kcal: entry && entry.kcal, name: entry && entry.name };
  });
  check('my food searchable', my.found);
  check('my food ×2 math', my.kcal === 222, my.kcal);

  console.log('workout: log → PR → finish → edit');
  const wo = await page.evaluate(() => {
    startSession(); closeSheet();
    addExToSession(S.exercises.find((e) => e.name === 'Bench press').id);
    setVal(0, 0, 'w', '70'); setVal(0, 0, 'r', '5'); toggleSet(0, 0); restSkip();
    finishSession();
    const s = S.sessions[S.sessions.length - 1];
    const out = { prs: (s.prs || []).length, vol: s.vol, sorted: S.sessions.every((x, i, a) => !i || a[i - 1].date <= x.date) };
    saveSesNote(s.id);
    editSession(s.id);
    const editing = !!S.active;
    setVal(0, 0, 'r', '6'); finishSession();
    const s2 = S.sessions.find((x) => x.id === s.id);
    out.editing = editing; out.editedRep = s2 && s2.ex[0].sets[0].r;
    S.sessions = S.sessions.filter((x) => x.id !== s.id); save(); closeSheet();
    return out;
  });
  check('PR detected (70kg bench)', wo.prs >= 1, wo.prs);
  check('volume computed', wo.vol === 350, wo.vol);
  check('history stays sorted', wo.sorted);
  check('edit session round-trip', wo.editing && wo.editedRep === '6', wo.editedRep);

  console.log('data safety: edit / discard / delete never lose a workout');
  const safety = await page.evaluate(() => {
    const out = {};
    // 1. a finished workout stays in history while it is being edited
    startSession(); closeSheet();
    addExToSession(S.exercises.find((e) => e.name === 'Squat').id);
    setVal(0, 0, 'w', '60'); setVal(0, 0, 'r', '8'); toggleSet(0, 0); restSkip();
    finishSession(); closeSheet();
    const s = S.sessions[S.sessions.length - 1];
    const id = s.id, vol = s.vol;
    editSession(id);
    out.stillInHistoryWhileEditing = S.sessions.some((x) => x.id === id);
    // 2. discarding an edit leaves the original untouched
    cancelSession();
    const after = S.sessions.find((x) => x.id === id);
    out.survivesDiscardedEdit = !!after && after.vol === vol && after.ex[0].sets[0].w === '60';
    out.notBinned = !(S.trash || []).some((t) => t.id === id);
    // 3. a real edit replaces in place rather than duplicating
    editSession(id);
    setVal(0, 0, 'w', '65'); finishSession(); closeSheet();
    out.editedInPlace = S.sessions.filter((x) => x.id === id).length === 1
      && S.sessions.find((x) => x.id === id).ex[0].sets[0].w === '65';
    // 4. deleting bins it, and restore brings it back identically
    delSession(id);
    out.goneFromHistory = !S.sessions.some((x) => x.id === id);
    out.inTrash = (S.trash || []).some((t) => t.id === id);
    restoreSession(id);
    const back = S.sessions.find((x) => x.id === id);
    out.restored = !!back && back.ex[0].sets[0].w === '65' && back.date === s.date;
    out.leftTrash = !(S.trash || []).some((t) => t.id === id);
    // 5. an empty session is binned, not silently dropped
    startSession(); closeSheet();
    addExToSession(S.exercises.find((e) => e.name === 'Squat').id);
    const emptyId = S.active.id;
    finishSession(); closeSheet();
    out.emptyBinned = (S.trash || []).some((t) => t.id === emptyId);
    // cleanup
    S.sessions = S.sessions.filter((x) => x.id !== id);
    S.trash = []; save(); WV = 'home'; renderWorkout();
    return out;
  });
  check('workout stays in history while being edited', safety.stillInHistoryWhileEditing);
  check('discarding an edit keeps the original workout', safety.survivesDiscardedEdit && safety.notBinned, safety);
  check('finishing an edit replaces in place (no duplicate)', safety.editedInPlace);
  check('delete moves to Recently deleted', safety.goneFromHistory && safety.inTrash, safety);
  check('restore brings the workout back intact', safety.restored && safety.leftTrash, safety);
  check('empty session is binned, not silently dropped', safety.emptyBinned);

  // A snapshot is written when the stored schema differs from this build's, so
  // exercise a real upgrade rather than relying on incidental save() timing.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('fitlog.v1'));
    raw.schemaVersion = 12;
    localStorage.setItem('fitlog.v1', JSON.stringify(raw));
    localStorage.removeItem('fitlog.v1.bak');
    localStorage.removeItem('fitlog.v1.bak.meta');
  });
  await page.reload(); await page.waitForTimeout(600);
  const snap = await page.evaluate(() => ({
    hasSnapshot: !!localStorage.getItem('fitlog.v1.bak'),
    meta: JSON.parse(localStorage.getItem('fitlog.v1.bak.meta') || 'null'),
    stampedNow: S.schemaVersion,
    persisted: (JSON.parse(localStorage.getItem('fitlog.v1') || '{}')).schemaVersion,
  }));
  check('an upgrade writes the pre-update snapshot', snap.hasSnapshot && snap.meta && snap.meta.to === SCHEMA && snap.meta.from === 12, snap.meta);
  check('the schema stamp is actually persisted, not left to chance', snap.persisted === SCHEMA && snap.stampedNow === SCHEMA, snap);

  const past = await page.evaluate(() => {
    const d = dShift(today(), -3);
    pastWorkoutForm();
    document.querySelector('#pwDate').value = d;
    document.querySelector('#pwMins').value = '40';
    document.querySelector('#pwName').value = 'Recovered session';
    startPastWorkout(); closeSheet();
    addExToSession(S.exercises.find((e) => e.name === 'Bench press').id);
    setVal(0, 0, 'w', '50'); setVal(0, 0, 'r', '10'); toggleSet(0, 0); restSkip();
    finishSession(); closeSheet();
    const s = S.sessions.find((x) => x.name === 'Recovered session');
    const out = {
      dated: s && s.date === d,
      sorted: S.sessions.every((x, i, a) => !i || a[i - 1].date <= x.date),
      mins: s && Math.round(s.dur / 60) >= 39 && Math.round(s.dur / 60) <= 41,
    };
    S.sessions = S.sessions.filter((x) => x.name !== 'Recovered session'); save();
    return out;
  });
  check('past workout logs on the chosen date', past.dated, past);
  check('past workout keeps history sorted', past.sorted);
  check('past workout keeps its duration', past.mins, past.mins);

  console.log('timed exercises (plank / holds)');
  const plankRow = await page.evaluate(() => {
    startSession(); closeSheet();
    addExToSession(S.exercises.find((e) => e.name === 'Plank').id);
    const html = document.querySelector('#tab-workout').innerHTML;
    const row = document.querySelector('#tab-workout .setrow');
    return {
      timed: isTimedEx(S.exercises.find((e) => e.name === 'Plank').id),
      holdBtn: /holdStart\(/.test(html),
      inputs: row.querySelectorAll('input[type="number"]').length,
      header: /secs/i.test(html) && /timer/i.test(html),
      deadHangFmt: fmtSet({ w: 0, r: 20 }, 'Mobility', true),
      benchStillReps: fmtSet({ w: 70, r: 5 }, 'Chest', false),
    };
  });
  check('Plank is timed', plankRow.timed);
  check('timed row: single secs input + ▶ hold button', plankRow.inputs === 1 && plankRow.holdBtn, plankRow);
  check('secs/timer column headers', plankRow.header);
  check('dead hang renders 20s (not 0×20)', plankRow.deadHangFmt === '20s' && plankRow.benchStillReps === '70×5', plankRow.deadHangFmt);

  await page.evaluate(() => holdStart(0, 0));
  await page.waitForTimeout(2300);
  const hold = await page.evaluate(() => {
    const open = document.querySelector('#hold').classList.contains('on');
    holdStop();
    const st = S.active.ex[0].sets[0];
    const restOpen = document.querySelector('#rest').classList.contains('on');
    restSkip();
    return { open, r: +st.r, done: st.done, closed: !document.querySelector('#hold').classList.contains('on'), restOpen };
  });
  check('hold count-up: stop writes secs + done', hold.open && hold.r >= 2 && hold.r <= 4 && hold.done && hold.closed, hold);
  check('hold on non-Mobility auto-starts rest', hold.restOpen);

  const timedPR = await page.evaluate(() => {
    finishSession(); closeSheet();
    const plankId = S.exercises.find((e) => e.name === 'Plank').id;
    const target = targetFor(plankId);
    startSession(); closeSheet();
    addExToSession(plankId);
    setVal(0, 0, 'r', '300'); toggleSet(0, 0); restSkip();
    finishSession(); closeSheet();
    const s = S.sessions[S.sessions.length - 1];
    const pr = (s.prs || []).find((p) => /longest hold/.test(p.txt));
    S.sessions = S.sessions.filter((x) => !x.ex.some((e) => e.exId === plankId)); save();
    WV = 'home'; renderWorkout();
    return { target, pr: pr ? pr.txt : null };
  });
  check('timed target prescribes a longer hold in seconds', /\d+s/.test(timedPR.target || '') && /five seconds longer/.test(timedPR.target || ''), timedPR.target);
  check('longest-hold PR detected', /300s: longest hold/.test(timedPR.pr || ''), timedPR.pr);

  console.log('coach logic');
  const coach = await page.evaluate(() => ({
    comeback: (function () {
      const rx = prescribe(S.exercises.find((e) => e.name === 'Squat').id);
      return rx.tag === 'comeback' && /days off/.test(rx.why) && /rebuild/.test(rx.why);
    })(),
    est: est1RM(100, 10) === 100 * (1 + 10 / 30),
    plates: (function () { go('timers'); document.querySelector('#plW').value = '62.5'; plates(); return document.querySelector('#plOut').textContent; })(),
  }));
  check('layoff → comeback target', coach.comeback);
  check('est1RM helper', coach.est);
  check('plate calculator', /20 \+ 1\.25/.test(coach.plates), coach.plates);

  console.log('daily trackers');
  const daily = await page.evaluate(() => {
    addWater(750);
    saveBreath(20); closeSheet();
    S.sleep[today()] = { bed: '23:30', wake: '06:45', hrs: 7.3, q: 'r' };
    save(); go('today');
    return {
      water: waterToday() >= 750,
      heroRing: document.querySelector('#tab-today .ring') !== null,
      quote: document.querySelector('#tab-today').textContent.includes('“'),
      tiles: document.querySelectorAll('#tab-today .tile').length,
      breathTile: document.querySelector('#tab-today').textContent.includes('Breathwork'),
    };
  });
  check('water logged', daily.water);
  check('hero day-ring renders', daily.heroRing);
  check('daily quote renders', daily.quote);
  check('4 metric tiles', daily.tiles === 4, daily.tiles);
  check('breathwork tile replaces steps', daily.breathTile);

  console.log('breathwork tracking');
  const breath = await page.evaluate(() => {
    S.breath = {}; save();
    saveBreath(20); closeSheet();
    const out = { manual: breathMins(today()) };
    // a timed Breathwork set inside a workout counts toward the same number
    startSession(); closeSheet();
    addExToSession(S.exercises.find((e) => e.name === 'Breathwork').id);
    setVal(0, 0, 'r', '600'); toggleSet(0, 0); restSkip();
    finishSession(); closeSheet();
    out.withSession = breathMins(today());
    // a stray 30s set must not manufacture a day of practice
    out.strayFloored = (function () {
      const d = dShift(today(), -4);
      S.sessions.push({ id: 'brstray', name: 'x', date: d, dur: 60, vol: 0,
        ex: [{ exId: S.exercises.find((e) => e.name === 'Breathwork').id, sets: [{ w: '', r: '30', done: true }] }] });
      const m = breathMins(d);
      S.sessions = S.sessions.filter((s) => s.id !== 'brstray');
      return m === 0;
    })();
    out.streak = breathStreak();
    S.breath[dShift(today(), -1)] = 15;
    out.streak2 = breathStreak();
    // chips add rather than replace — breathwork happens in two sittings
    addBreath(10); closeSheet();
    out.added = S.breath[today()];
    // cleanup: leave no breathwork session or log behind for later blocks
    S.sessions = S.sessions.filter((s) => !s.ex.some((e) => exName(e.exId) === 'Breathwork'));
    S.breath = {}; save(); go('today');
    return out;
  });
  check('manual breathwork logged (20 min)', breath.manual === 20, breath.manual);
  check('session-logged breathwork adds 10 min', breath.withSession === 30, breath.withSession);
  check('stray 30s set floors to 0 min', breath.strayFloored);
  check('streak counts today', breath.streak === 1 && breath.streak2 === 2, breath);
  check('quick chips add to the day', breath.added === 30, breath.added);

  console.log('v16 migration (planted pre-upgrade store)');
  const mig = await page.evaluate(() => {
    // rewind to a pre-v16 store so the migration body actually runs
    delete S.seedV16;
    S.steps = { [today()]: 9000 };
    S.settings.stepGoal = 8000;
    S.supps.push({ id: 'bwold', name: 'Breathwork (15–30 min)', kcal: 0, p: 0, c: 0, f: 0, logFood: false });
    S.suppLog[dShift(today(), -2)] = Object.assign(S.suppLog[dShift(today(), -2)] || {}, { bwold: 1 });
    S.breath = {};
    save();
    return { supps: S.supps.length };
  });
  await page.reload(); await page.waitForTimeout(900);
  const migAfter = await page.evaluate(() => ({
    steps: S.steps === undefined && S.settings.stepGoal === undefined,
    ticksConverted: S.breath[dShift(today(), -2)] === 15,
    suppGone: !S.supps.some((s) => s.name === 'Breathwork (15–30 min)'),
    supps: S.supps.length,
    checklistClean: (function () { checklistSheet(); const t = document.querySelector('#sheetIn').textContent; closeSheet(); return !/Breathwork/i.test(t); })(),
    schema: S.schemaVersion,
  }));
  check('steps state deleted by migration', migAfter.steps, migAfter);
  check('past ticks converted to logged minutes', migAfter.ticksConverted, migAfter.ticksConverted);
  check('breathwork supp retired from list + checklist', migAfter.suppGone && migAfter.checklistClean && migAfter.supps === mig.supps - 1, migAfter);
  check('migration stamps the current schema', migAfter.schema === SCHEMA, migAfter.schema);

  console.log('em-dash removal: parsers + v17 migration');
  const dash = await page.evaluate(() => ({
    // the four sites that parsed the em dash as a delimiter
    shortSupp: shortSuppName('Casein: before bed') === 'Casein'
            && shortSuppName('Casein — before bed') === 'Casein',
    phasePrefix: currentPhase().name.replace(PHASE_PREFIX, '') === 'Rebuild'
              && 'Phase 2 — Build'.replace(PHASE_PREFIX, '') === 'Build',
    heroShort: (function () { go('today'); const t = document.querySelector('#tab-today').textContent; return /Rebuild/.test(t) && !/Phase 0/.test(t); })(),
    // seeded names carry no em dash, and the plan lookups still resolve
    seedClean: !S.routines.some((r) => /—/.test(r.name)) && !S.supps.some((s) => /—/.test(s.name)),
    planFull: Object.keys(S.plan).filter((k) => S.plan[k]).length >= 6,
    noneInCopy: !document.querySelector('#tab-today').textContent.includes('—'),
  }));
  check('supplement short-name parser handles both forms', dash.shortSupp, dash.shortSupp);
  check('phase prefix strips old and new punctuation', dash.phasePrefix);
  check('Today hero shows short phase name', dash.heroShort);
  check('seeded routine/supplement names em-dash free', dash.seedClean);
  check('weekly plan lookups still resolve', dash.planFull, dash.planFull);
  check('no em dash rendered on Today', dash.noneInCopy);

  const v17 = await page.evaluate(() => {
    delete S.seedV17;
    S.supps.push({ id: 'oldsp', name: 'Zinc — before bed', kcal: 0, p: 0, c: 0, f: 0, logFood: false });
    S.routines.push({ id: 'oldrt', name: 'Push — my own routine', exIds: [] });
    S.sessions.push({ id: 'oldses', name: 'Return — full body (light)', date: dShift(today(), -9), dur: 60, vol: 10,
      ex: [], prs: [{ ex: 'Bench press', txt: '70×5 — heaviest ever' }] });
    S.lastPhase = 'Phase 0 — Rebuild';
    save();
    return true;
  });
  await page.reload(); await page.waitForTimeout(900);
  const v17After = await page.evaluate(() => {
    const ses = S.sessions.find((s) => s.id === 'oldses');
    const out = {
      supp: (S.supps.find((s) => s.id === 'oldsp') || {}).name,
      rt: (S.routines.find((r) => r.id === 'oldrt') || {}).name,
      ses: ses && ses.name,
      pr: ses && ses.prs[0].txt,
      lastPhase: S.lastPhase,
      // renaming phases must NOT look like a newly unlocked phase
      celebrated: document.querySelector('#phasemo') !== null,
      schema: S.schemaVersion,
    };
    S.supps = S.supps.filter((s) => s.id !== 'oldsp');
    S.routines = S.routines.filter((r) => r.id !== 'oldrt');
    S.sessions = S.sessions.filter((s) => s.id !== 'oldses');
    save();
    return out;
  });
  check('stored supplement renamed', v17After.supp === 'Zinc: before bed', v17After.supp);
  check('user-authored routine renamed, wording kept', v17After.rt === 'Push: my own routine', v17After.rt);
  check('stored session + PR text renamed', v17After.ses === 'Return: full body (light)' && v17After.pr === '70×5: heaviest ever', v17After);
  check('S.lastPhase migrated (no false phase celebration)', v17After.lastPhase === 'Phase 0: Rebuild' && !v17After.celebrated, v17After);
  check('migration stamps the current schema', v17After.schema === SCHEMA, v17After.schema);

  console.log('workout cards: preview before starting');
  const cards = await page.evaluate(() => {
    WV = 'home'; go('workout');
    const html = document.querySelector('#tab-workout').innerHTML;
    const r = S.routines.find((x) => /Rehab/.test(x.name));
    const st = routineStats(r.exIds);
    previewRoutine(r.id);
    const sheet = document.querySelector('#sheetIn').textContent;
    closeSheet();
    const push = S.routines.find((x) => x.name === 'Push day');
    return {
      thumbs: document.querySelectorAll('#tab-workout .exthumb').length,
      chips: document.querySelectorAll('#tab-workout .gchip').length,
      cards: document.querySelectorAll('#tab-workout .rcard').length,
      rehabMins: st.mins,
      previewHasEveryEx: r.exIds.every((id) => sheet.includes(exName(id))),
      previewHasTime: /min/.test(sheet) && /Sets/.test(sheet),
      lastDone: !!lastDoneOf(push.name, push.exIds),
    };
  });
  check('routine cards show exercise thumbnails', cards.thumbs >= 8, cards.thumbs);
  check('routine cards show muscle groups', cards.chips >= 6, cards.chips);
  check('every routine is a tappable card', cards.cards >= 10, cards.cards);
  check('rehab block estimates ~15 min, not 47', cards.rehabMins >= 10 && cards.rehabMins <= 22, cards.rehabMins);
  check('preview lists every exercise before starting', cards.previewHasEveryEx);
  check('preview shows time and set count', cards.previewHasTime);
  check('last-done resolves from training history', cards.lastDone);
  const thumbs = await page.evaluate(() => {
    WV = 'home'; go('workout');
    const root = document.querySelector('#tab-workout');
    const mob = S.exercises.filter((e) => e.group === 'Mobility');
    return {
      letters: root.querySelectorAll('.exthumb.ph').length,
      figures: root.querySelectorAll('.exthumb.fig svg').length,
      photos: root.querySelectorAll('.exthumb img').length,
      mobilityUncovered: mob.filter((e) => {
        if ((window.EXIMG || {})[e.name]) return false;
        const p = patternOf(e.name, e.group);
        return !(p && PATTERNS[p]);
      }).map((e) => e.name),
    };
  });
  check('no grey letter tiles left on routine cards', thumbs.letters === 0, thumbs.letters);
  check('exercises without photos show their own diagram', thumbs.figures >= 5, thumbs.figures);
  check('photo thumbnails still render', thumbs.photos >= 20, thumbs.photos);
  check('every mobility move resolves to a visual', thumbs.mobilityUncovered.length === 0, thumbs.mobilityUncovered);

  console.log('rest timer, including mobility');
  const rest = await page.evaluate(() => {
    const on = () => document.querySelector('#rest').classList.contains('on');
    const out = {};
    const mobId = S.exercises.find((e) => e.name === 'Dead hang').id;
    const legId = S.exercises.find((e) => e.name === 'Leg press').id;
    out.mobRest = exRest(mobId);
    out.liftRest = exRest(legId);

    startSession(); closeSheet(); addExToSession(legId);
    setVal(0, 0, 'w', '80'); setVal(0, 0, 'r', '10'); toggleSet(0, 0);
    out.liftStarts = on(); restSkip();
    setEffort(0, 0, 'ok'); out.survivesEffortTap = document.querySelector('#rest') !== null;
    cancelSession(); closeSheet();

    startSession(); closeSheet(); addExToSession(mobId);
    toggleSet(0, 0);
    out.mobStarts = on(); restSkip();
    // and via the hold timer, which is how mobility is normally completed
    S.active.ex[0].sets[1].plan = true;
    holdEi = 0; holdSi = 1; holdFinish(30);
    out.holdStarts = on();
    out.holdClearsPlan = S.active.ex[0].sets[1].plan === undefined;
    restSkip(); cancelSession(); closeSheet();

    // an all-mobility block must rest between moves. Pick it by name rather than
    // by today's plan, which is empty on rest days and made this date-dependent.
    const rt = S.routines.find((r) => /Rehab: knee/.test(r.name));
    out.allMobility = rt.exIds.every((id) => exGroupOf(id) === 'Mobility');
    startSession(rt.id); closeSheet(); toggleSet(0, 0);
    out.todayPlan = rt.name;
    out.todayStarts = on();
    restSkip(); cancelSession(); closeSheet();

    const stats = {};
    S.routines.forEach((r) => { if (/Rehab|Mobility &/.test(r.name)) stats[r.name] = routineStats(r.exIds).mins; });
    out.stats = stats;
    return out;
  });
  check('mobility rests briefly, lifts rest fully', rest.mobRest === 25 && rest.liftRest > 25, rest);
  check('a lift still starts the rest timer', rest.liftStarts);
  check('a mobility set now starts one too', rest.mobStarts);
  check('completing a hold starts a rest', rest.holdStarts);
  check('a completed hold leaves no plan flag behind', rest.holdClearsPlan);
  check('an all-mobility block rests between moves', rest.todayStarts && rest.allMobility, rest.todayPlan);
  check('rehab still estimates near its ~15 min label', rest.stats['Rehab: knee & wrist (~15 min)'] <= 25, rest.stats);
  check('mobility block still estimates near its ~20 min label', rest.stats['Mobility & flexibility (~20 min)'] <= 32, rest.stats);

  console.log('coaching engine: what to lift, and why');
  const rxEngine = await page.evaluate(() => {
    const saved = JSON.stringify(S.sessions);
    const legId = S.exercises.find((e) => e.name === 'Leg press').id;
    const latId = S.exercises.find((e) => e.name === 'Lateral raise').id;
    const d = (n) => dShift(today(), -n);
    const sess = (date, exId, sets) => ({ id: uid(), name: 'T', date, dur: 1, vol: 1, ex: [{ exId, sets }], prs: [] });
    const run = (list) => { S.sessions = list; return null; };
    const out = {};

    // hit every set at the top of the range -> earn the increase
    run([sess(d(3), legId, [{ w: 100, r: 12, done: true }, { w: 100, r: 12, done: true }, { w: 100, r: 12, done: true }])]);
    let rx = prescribe(legId);
    out.up = { tag: rx.tag, w: rx.sets[0].w, r: rx.sets[0].r, n: rx.sets.length, why: rx.why };

    // same, but every set called easy -> jump twice the increment
    run([sess(d(3), legId, [{ w: 100, r: 12, done: true, e: 'easy' }, { w: 100, r: 12, done: true, e: 'easy' }, { w: 100, r: 12, done: true, e: 'easy' }])]);
    out.easy = { tag: prescribe(legId).tag, w: prescribe(legId).sets[0].w };

    // top of range but the last set was a grind -> hold, don't add weight
    run([sess(d(3), legId, [{ w: 100, r: 12, done: true }, { w: 100, r: 12, done: true }, { w: 100, r: 12, done: true, e: 'hard' }])]);
    rx = prescribe(legId);
    out.hard = { tag: rx.tag, w: rx.sets[0].w, why: rx.why };

    // three sessions stuck at the same weight, never reaching the top -> deload
    run([sess(d(21), legId, [{ w: 100, r: 8, done: true }]), sess(d(14), legId, [{ w: 100, r: 9, done: true }]), sess(d(7), legId, [{ w: 100, r: 8, done: true }])]);
    rx = prescribe(legId);
    out.deload = { tag: rx.tag, w: rx.sets[0].w, why: rx.why };

    // reps collapsed across sets -> hold and say so
    run([sess(d(3), legId, [{ w: 100, r: 10, done: true }, { w: 100, r: 6, done: true }, { w: 100, r: 3, done: true }])]);
    rx = prescribe(legId);
    out.fell = { tag: rx.tag, w: rx.sets[0].w, why: rx.why };

    // increments are per-movement, not one number for everything
    run([sess(d(3), legId, [{ w: 100, r: 12, done: true }, { w: 100, r: 12, done: true }, { w: 100, r: 12, done: true }])]);
    const legJump = prescribe(legId).sets[0].w - 100;
    run([sess(d(3), latId, [{ w: 10, r: 12, done: true }, { w: 10, r: 12, done: true }, { w: 10, r: 12, done: true }])]);
    const latJump = prescribe(latId).sets[0].w - 10;
    out.increments = { legJump, latJump };

    // long layoff beats every other rule
    run([sess(d(90), legId, [{ w: 100, r: 12, done: true }, { w: 100, r: 12, done: true }, { w: 100, r: 12, done: true }])]);
    rx = prescribe(legId);
    out.comeback = { tag: rx.tag, w: rx.sets[0].w };

    S.sessions = JSON.parse(saved); save();
    return out;
  });
  check('hitting every set at the top earns a load increase', rxEngine.up.tag === 'up' && rxEngine.up.w === 105 && rxEngine.up.r === 8, rxEngine.up);
  check('prescribes the whole set scheme, not one set', rxEngine.up.n === 3, rxEngine.up.n);
  check('all-easy jumps a double increment', rxEngine.easy.tag === 'up' && rxEngine.easy.w === 110, rxEngine.easy);
  check('a hard set holds the weight instead of adding', rxEngine.hard.tag === 'reps' && rxEngine.hard.w === 100, rxEngine.hard);
  check('three stalled sessions trigger a 10% deload', rxEngine.deload.tag === 'deload' && rxEngine.deload.w === 90, rxEngine.deload);
  check('collapsing reps hold the weight and are named', rxEngine.fell.tag === 'reps' && /dropped off/.test(rxEngine.fell.why), rxEngine.fell);
  check('increment differs by movement (legs 5, raise 1.25)', rxEngine.increments.legJump === 5 && rxEngine.increments.latJump === 1.25, rxEngine.increments);
  check('a long layoff overrides progression', rxEngine.comeback.tag === 'comeback' && rxEngine.comeback.w === 60, rxEngine.comeback);

  const ready = await page.evaluate(() => {
    const savedS = JSON.stringify(S.sessions), savedSl = JSON.stringify(S.sleep), savedW = JSON.stringify(S.weights);
    const legId = S.exercises.find((e) => e.name === 'Leg press').id;
    const hangId = S.exercises.find((e) => e.name === 'Dead hang').id;
    const earned = () => { S.sessions = [{ id: uid(), name: 'T', date: dShift(today(), -3), dur: 1, vol: 1, prs: [],
      ex: [{ exId: legId, sets: [{ w: 100, r: 12, done: true }, { w: 100, r: 12, done: true }, { w: 100, r: 12, done: true }] }] }]; };
    const out = {};

    earned(); S.sleep = {}; S.weights = [];
    let rx = prescribe(legId);
    out.rested = { tag: rx.tag, w: rx.sets[0].w };

    // short sleep holds the earned increase
    S.sleep[dShift(today(), -1)] = { hrs: 5, q: 'p' };
    rx = prescribe(legId);
    out.tired = { tag: rx.tag, w: rx.sets[0].w, why: rx.why, banner: readinessBanner().length > 0 };

    // a full night does not
    S.sleep[dShift(today(), -1)] = { hrs: 8, q: 'g' };
    out.slept = { tag: prescribe(legId).tag, w: prescribe(legId).sets[0].w, banner: readinessBanner().length };

    // a sharp weekly weight drop holds it too
    S.sleep = {}; S.weights = [{ date: dShift(today(), -7), kg: 70 }, { date: today(), kg: 68.5 }];
    rx = prescribe(legId);
    out.cutting = { tag: rx.tag, w: rx.sets[0].w, why: rx.why };

    // day-to-day noise does not
    S.weights = [{ date: dShift(today(), -7), kg: 70 }, { date: today(), kg: 69.8 }];
    out.noise = { tag: prescribe(legId).tag, w: prescribe(legId).sets[0].w };

    // sparse weigh-ins: a 3 kg drop spread over ten weeks is not a crash diet.
    // Comparing two readings months apart once reported it as "this week".
    S.weights = [{ date: dShift(today(), -70), kg: 67 }, { date: dShift(today(), -2), kg: 63.9 }];
    out.sparse = { ch: bwChange(7), hold: readiness().hold, tag: prescribe(legId).tag };

    // a stale reading is no basis for holding anything
    S.weights = [{ date: dShift(today(), -200), kg: 70 }, { date: dShift(today(), -40), kg: 64 }];
    out.stale = { ch: bwChange(7), hold: readiness().hold };

    // gaining weight is never a reason to hold
    S.weights = [{ date: dShift(today(), -7), kg: 68 }, { date: today(), kg: 70 }];
    out.gaining = { tag: prescribe(legId).tag, w: prescribe(legId).sets[0].w };

    // Bodyweight movements say when your own weight changed the difficulty.
    // The drift has to sit outside the 7-day window, otherwise the deficit
    // rule fires first — which is correct, but a different behaviour.
    S.sleep = {};
    S.sessions = [{ id: uid(), name: 'T', date: dShift(today(), -19), dur: 1, vol: 1, prs: [],
      ex: [{ exId: hangId, sets: [{ r: 40, done: true }] }] }];
    S.weights = [{ date: dShift(today(), -60), kg: 72 }, { date: dShift(today(), -18), kg: 69 }];
    out.lighter = prescribe(hangId).why;
    out.lighterSteady = readiness().hold;      // the week itself is stable
    S.weights = [{ date: dShift(today(), -60), kg: 66 }, { date: dShift(today(), -18), kg: 69 }];
    out.heavier = prescribe(hangId).why;

    S.sessions = JSON.parse(savedS); S.sleep = JSON.parse(savedSl); S.weights = JSON.parse(savedW); save();
    return out;
  });
  check('rested and stable: the increase goes through', ready.rested.tag === 'up' && ready.rested.w === 105, ready.rested);
  check('5h sleep holds the earned increase at the old weight', ready.tired.tag === 'hold' && ready.tired.w === 100, ready.tired);
  check('the hold names both the earned jump and the reason', /earned \+5/.test(ready.tired.why) && /5h sleep/.test(ready.tired.why), ready.tired.why);
  check('a held increase is announced, never silent', ready.tired.banner);
  check('a full night lets the increase through, no banner', ready.slept.tag === 'up' && ready.slept.w === 105 && ready.slept.banner === 0, ready.slept);
  check('a sharp weekly weight drop holds the increase', ready.cutting.tag === 'hold' && /losing 1.5/.test(ready.cutting.why), ready.cutting);
  check('normal weight fluctuation is ignored', ready.noise.tag === 'up' && ready.noise.w === 105, ready.noise);
  check('gaining weight never holds a lift back', ready.gaining.tag === 'up' && ready.gaining.w === 105, ready.gaining);
  check('sparse weigh-ins measure a rate, not a raw gap', ready.sparse.ch && ready.sparse.ch.perWeek === -0.3 && ready.sparse.hold === false, ready.sparse);
  check('a gradual cut still lets the increase through', ready.sparse.tag === 'up', ready.sparse.tag);
  check('a stale weigh-in holds nothing back', ready.stale.ch === null && ready.stale.hold === false, ready.stale);
  check('bodyweight movements flag being lighter', /3 kg lighter/.test(ready.lighter) && /less work/.test(ready.lighter), ready.lighter);
  check('that note is not a readiness hold in disguise', ready.lighterSteady === false, ready.lighterSteady);
  check('bodyweight movements flag being heavier', /3 kg heavier/.test(ready.heavier) && /more work/.test(ready.heavier), ready.heavier);

  const planSafety = await page.evaluate(() => {
    const before = S.sessions.length;
    const r = S.routines.find((x) => /Push: wrist/.test(x.name));
    startSession(r.id);
    const prescribed = S.active.ex[0].sets.length;
    const allPlanned = S.active.ex.every((e) => e.sets.every((s) => s.plan === true));
    // perform only the first set of the first exercise
    S.active.ex[0].sets[0].w = 12.5; S.active.ex[0].sets[0].r = 10;
    toggleSet(0, 0);
    const eff = () => S.active.ex[0].sets[0].e;
    setEffort(0, 0, 'hard'); const setHard = eff();
    setEffort(0, 0, 'hard'); const cleared = eff();
    finishSession();
    const s = S.sessions[S.sessions.length - 1];
    const logged = s.ex.reduce((a, e) => a + e.sets.length, 0);
    const out = { prescribed, allPlanned, logged, exCount: s.ex.length, vol: s.vol, setHard, cleared: cleared === undefined, added: S.sessions.length - before };
    S.sessions.pop(); save(); closeSheet();
    return out;
  });
  check('a routine starts with every set prescribed', planSafety.prescribed === 3, planSafety.prescribed);
  check('prescribed sets are marked as plan, not performed', planSafety.allPlanned);
  check('untouched prescriptions are never logged as lifts', planSafety.logged === 1, planSafety);
  check('only the exercise actually trained is kept', planSafety.exCount === 1, planSafety.exCount);
  check('volume counts only the performed set', planSafety.vol === 125, planSafety.vol);
  check('effort tap records, and tapping again clears it', planSafety.setHard === 'hard' && planSafety.cleared, planSafety);

  console.log('plate builder: log a meal from its parts');
  const plate = await page.evaluate(() => {
    const d = foodDate, before = (S.food[d] && S.food[d].l ? S.food[d].l.length : 0);
    addFoodForm('l');
    const emptyOnOpen = PLATE.length === 0;
    function pick(q) {
      document.querySelector('#fdbQ').value = q;
      fdbSearch(q);
      fdbPick(0);
      return FDITEM.name;
    }
    pick('roti'); document.querySelector('#fdbQty').value = '2'; plateAdd();
    pick('dal plain'); plateAdd();
    pick('paneer cubes'); document.querySelector('#fdbQty').value = '6'; plateAdd();
    pick('curd katori'); plateAdd();
    const four = PLATE.length;
    plateDel(3);                       // drop the curd
    plateQty(0, 0.5);                  // roti 2 -> 2.5
    const three = PLATE.length;        // read before plateLog() clears it
    const t = plateTotals(), nm = plateName();
    const addBtnGone = !/onclick="fdbAdd\(\)"/.test(document.querySelector('#fdbSel').innerHTML || '');
    plateLog();
    const list = (S.food[d] || {}).l || [];
    const e = list[list.length - 1];
    return {
      emptyOnOpen, four, three, added: list.length - before,
      name: nm, entryName: e.name, kcal: e.kcal, p: e.p,
      sumKcal: Math.round(t.kcal), sumP: Math.round(t.p * 10) / 10,
      clearedAfterLog: PLATE.length === 0, addBtnGone,
    };
  });
  check('plate starts empty when the sheet opens', plate.emptyOnOpen);
  check('four components collect on the plate', plate.four === 4, plate.four);
  check('removing a component works', plate.three === 3, plate.three);
  check('logs exactly one entry, not four', plate.added === 1, plate.added);
  check('entry macros equal the sum of the parts', plate.kcal === plate.sumKcal && plate.p === plate.sumP, plate);
  check('entry is named from its parts', /Roti/i.test(plate.entryName) && /\+/.test(plate.entryName), plate.entryName);
  check('plain Add hidden while a plate is building', plate.addBtnGone);
  check('plate clears after logging', plate.clearedAfterLog);

  const plate2 = await page.evaluate(() => {
    addFoodForm('d');
    const leaked = PLATE.length;
    document.querySelector('#fdbQ').value = 'monaco'; fdbSearch('monaco'); fdbPick(0);
    const single = FDITEM.name;
    fdbAdd();
    const list = (S.food[foodDate] || {}).d || [];
    // save a plate to My Foods
    addFoodForm('d');
    document.querySelector('#fdbQ').value = 'dal plain'; fdbSearch('dal plain'); fdbPick(0); plateAdd();
    document.querySelector('#fdbQ').value = 'cooked rice'; fdbSearch('cooked rice'); fdbPick(0); plateAdd();
    const n = plateName();
    platesSave();
    const found = S.myFoods.some((m) => m.name === n);
    closeSheet();
    return { leaked, single, logged: list.length, savedName: n, found };
  });
  check('plate does not leak into the next meal', plate2.leaked === 0, plate2.leaked);
  check('single-item Add still logs one item and closes', plate2.logged === 1, plate2.logged);
  check('plate can be saved to My Foods', plate2.found, plate2.savedName);

  console.log('exercise visuals: every movement shows something accurate');
  const vis = await page.evaluate(() => {
    const noVisual = [], genericMobility = [];
    S.exercises.forEach((e) => {
      const img = (window.EXIMG || {})[e.name];
      const pat = patternOf(e.name, e.group);
      if (!img && !(pat && PATTERNS[pat])) noVisual.push(e.name);
      // a Mobility move falling back to the shared 'stretch' drawing is the
      // "old visuals" complaint: it is not a picture of that movement
      if (!img && e.group === 'Mobility' && pat === 'stretch') genericMobility.push(e.name);
    });
    // the nine hand-drawn ones resolve to their own diagram, not a group one
    const custom = Object.keys(PAT_EX).map((n) => {
      const p = patternOf(n, 'Mobility');
      return { n, ok: !!PATTERNS[p] && p === PAT_EX[n], label: PATTERNS[p] && PATTERNS[p].label };
    });
    return {
      noVisual, genericMobility,
      customOk: custom.every((c) => c.ok),
      labels: custom.map((c) => c.label),
      steps: Object.keys(PAT_EX).every((n) => (PATTERN_STEPS[PAT_EX[n]] || []).length === 3),
      newPhotos: ['Straight-leg raise', '90/90 hip switch', 'Couch stretch', 'Shoulder dislocates (stick)', 'Ankle rocks']
        .every((n) => !!(window.EXIMG || {})[n]),
    };
  });
  check('every exercise has a photo or a diagram', vis.noVisual.length === 0, vis.noVisual);
  check('no Mobility move left on the generic stretch drawing', vis.genericMobility.length === 0, vis.genericMobility);
  check('nine hand-drawn movements resolve to their own diagram', vis.customOk, vis.labels);
  check('each hand-drawn movement has how-to steps', vis.steps);
  check('five mobility photos mapped', vis.newPhotos);

  const proto = await page.evaluate(() => {
    startSession(); closeSheet();
    addExToSession(S.exercises.find((e) => e.name === 'Bench press').id);
    const html = document.querySelector('#tab-workout').innerHTML;
    const links = document.querySelectorAll('#tab-workout .exlink').length;
    cancelSession();
    return { links, hasWarm: /Warm-up/.test(html), hasCool: /Cool-down/.test(html) };
  });
  check('warm-up and cool-down lines are tappable', proto.links >= 3 && proto.hasWarm && proto.hasCool, proto);

  console.log('charts + report');
  const charts = await page.evaluate(() => {
    WV = 'progress'; go('workout');
    const svgs = document.querySelectorAll('#tab-workout svg').length;
    openReport();
    const rep = document.querySelector('#sheetIn').textContent;
    closeSheet(); WV = 'home';
    return { svgs, adherence: rep.includes('Plan adherence') || rep.includes('Workouts') };
  });
  check('progress charts render', charts.svgs >= 2, charts.svgs);
  check('weekly report renders', charts.adherence);

  console.log('escaping (hostile names)');
  const xss = await page.evaluate(() => {
    window.__xss = 0;
    const e = { id: 'xssx', name: '<img src=x onerror="window.__xss=1">', group: 'Chest' };
    S.exercises.push(e);
    S.routines.push({ id: 'xssr', name: 'Hostile <b>day</b>', exIds: [e.id] });
    S.plan[new Date().getDay()] = 'xssr';
    const wasTrainedToday = S.sessions.some((s) => s.date === today());
    go('today'); go('workout');
    const raw = document.querySelector('#tab-today').innerHTML + document.querySelector('#tab-workout').innerHTML;
    // cleanup
    S.exercises = S.exercises.filter((x) => x.id !== 'xssx');
    S.routines = S.routines.filter((x) => x.id !== 'xssr');
    return { fired: window.__xss, injected: raw.includes('<img src=x') };
  });
  check('no XSS from exercise/routine names', xss.fired === 0 && !xss.injected, xss);

  console.log('theme + phase moment');
  await page.evaluate(() => setTheme('light'));
  const th1 = await page.evaluate(() => document.body.classList.contains('light'));
  await page.reload(); await page.waitForTimeout(400);
  const th2 = await page.evaluate(() => ({ light: document.body.classList.contains('light'), stored: S.settings.theme }));
  check('light theme applies + persists', th1 && th2.light && th2.stored === 'light', th2);
  await page.evaluate(() => setTheme('dark'));
  const pm = await page.evaluate(() => {
    S.lastPhase = 'Phase 0: Rebuild';
    const real = currentPhase().name;
    S.lastPhase = 'Phase X: Fake old'; save();
    phaseMoment();
    const shown = !!document.querySelector('#phasemo.on');
    phaseBegin();
    return { shown, after: S.lastPhase === real, closed: !document.querySelector('#phasemo.on') };
  });
  check('phase transition moment fires + resolves', pm.shown && pm.after && pm.closed, pm);

  console.log('PR celebration (motion on)');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const cel = await page.evaluate(() => {
    startSession(); closeSheet();
    addExToSession(S.exercises.find((e) => e.name === 'Bench press').id);
    setVal(0, 0, 'w', '75'); setVal(0, 0, 'r', '3'); toggleSet(0, 0); restSkip();
    finishSession();
    return { overlay: !!document.querySelector('#celebrate.on') };
  });
  check('celebration overlay fires on PR', cel.overlay);
  await page.waitForTimeout(2700);
  const afterCel = await page.evaluate(() => {
    const sheetOpen = document.querySelector('#sheet').classList.contains('on');
    const overlayGone = !document.querySelector('#celebrate.on');
    const s = S.sessions[S.sessions.length - 1];
    S.sessions = S.sessions.filter((x) => x.id !== s.id); save(); closeSheet();
    return { sheetOpen, overlayGone };
  });
  check('summary sheet after celebration', afterCel.sheetOpen && afterCel.overlayGone, afterCel);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.waitForTimeout(300);
  check('zero page errors for entire run', pageErrors.length === 0, pageErrors.slice(0, 3));

  await browser.close();
  console.log(failures === 0 ? '\nALL GREEN' : '\n' + failures + ' FAILURE(S)');
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
