/* CoachZ persistent smoke suite.
   Run:  NODE_PATH=/opt/node22/lib/node_modules node test/smoke.cjs
   Env:  CHROME_PATH overrides the Chromium binary (default /opt/pw-browsers/chromium).
   Always run ./build.sh first — the suite loads index.html. */
const { chromium } = require('playwright');
const path = require('path');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

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
  check('38 imported sessions', boot.sessions === 38, boot.sessions);
  check('11 supplements seeded', boot.supps === 11, boot.supps);
  check('routines seeded', boot.routines >= 10, boot.routines);
  check('weekly plan seeded', boot.planDays === 7, boot.planDays);
  check('wedding break seeded', boot.wedding);
  check('schemaVersion stamped', boot.schema === 15, boot.schema);
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
  check('timed target phrased in seconds', /s — five seconds longer/.test(timedPR.target || ''), timedPR.target);
  check('longest-hold PR detected', /300s — longest hold/.test(timedPR.pr || ''), timedPR.pr);

  console.log('coach logic');
  const coach = await page.evaluate(() => ({
    comeback: /comeback/.test(targetFor(S.exercises.find((e) => e.name === 'Squat').id) || ''),
    est: est1RM(100, 10) === 100 * (1 + 10 / 30),
    plates: (function () { go('timers'); document.querySelector('#plW').value = '62.5'; plates(); return document.querySelector('#plOut').textContent; })(),
  }));
  check('layoff → comeback target', coach.comeback);
  check('est1RM helper', coach.est);
  check('plate calculator', /20 \+ 1\.25/.test(coach.plates), coach.plates);

  console.log('daily trackers');
  const daily = await page.evaluate(() => {
    addWater(750);
    S.steps[today()] = 9000;
    S.sleep[today()] = { bed: '23:30', wake: '06:45', hrs: 7.3, q: 'r' };
    save(); go('today');
    return {
      water: waterToday() >= 750,
      heroRing: document.querySelector('#tab-today .ring') !== null,
      quote: document.querySelector('#tab-today').textContent.includes('“'),
      tiles: document.querySelectorAll('#tab-today .tile').length,
    };
  });
  check('water logged', daily.water);
  check('hero day-ring renders', daily.heroRing);
  check('daily quote renders', daily.quote);
  check('4 metric tiles', daily.tiles === 4, daily.tiles);

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
    S.lastPhase = 'Phase 0 — Rebuild';
    const real = currentPhase().name;
    S.lastPhase = 'Phase X — Fake old'; save();
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
