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
  check('10 supplements seeded', boot.supps === 10, boot.supps);
  check('routines seeded', boot.routines >= 10, boot.routines);
  check('weekly plan seeded', boot.planDays === 7, boot.planDays);
  check('wedding break seeded', boot.wedding);
  check('schemaVersion stamped', boot.schema === 18, boot.schema);
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

  const snap = await page.evaluate(() => ({
    hasSnapshot: !!localStorage.getItem('fitlog.v1.bak'),
    meta: JSON.parse(localStorage.getItem('fitlog.v1.bak.meta') || 'null'),
  }));
  check('pre-update snapshot written', snap.hasSnapshot && snap.meta && snap.meta.to === 18, snap.meta);

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
  check('timed target phrased in seconds', /s, five seconds longer/.test(timedPR.target || ''), timedPR.target);
  check('longest-hold PR detected', /300s: longest hold/.test(timedPR.pr || ''), timedPR.pr);

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
  check('migration stamps schema 18', migAfter.schema === 18, migAfter.schema);

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
  check('migration stamps schema 18', v17After.schema === 18, v17After.schema);

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
