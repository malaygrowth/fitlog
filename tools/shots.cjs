/* Play Store phone screenshots, from the real public build.
   Run:  ./publish.sh && NODE_PATH=/opt/node22/lib/node_modules node tools/shots.cjs
   Out:  store/screenshots/NN-name.png

   1080×1920 is 9:16 and sits inside Play's 320–3840 per-side bound, so the
   files upload without resizing. Rendered at 360×640 CSS with a 3× device
   pixel ratio rather than at 1080 CSS pixels — a 1080px-wide viewport would
   lay the app out as a tablet and the screenshots would not look like the app
   anyone actually uses.

   THE DATA IN THESE SCREENSHOTS IS SYNTHETIC. A brand-new install shows empty
   rings and an onboarding sheet, which photographs badly and tells a visitor
   nothing. So a small fictional history is written into the public build's
   store before each shot. It is invented, it belongs to nobody, and it never
   touches a real store: the public build keys on `coachz.v1`, and the browser
   profile is thrown away when this script exits. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const OUT = path.join(ROOT, 'store', 'screenshots');
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const PORT = 8123;

/* Every shot: a name, and what to do to the page before the shutter. */
const SHOTS = [
  ['today', async (p) => { await p.evaluate(() => { closeSheet(); go('today'); }); }],
  ['workout', async (p) => {
    await p.evaluate(() => {
      closeSheet();
      const rt = S.routines.find((r) => r.name === 'Push day');
      startSession(rt.id); closeSheet();
      const e = S.active.ex[0];
      e.sets[0].w = 40; e.sets[0].r = 10; e.sets[0].done = true; e.sets[0].e = 'ok';
      e.sets[1].w = 40; e.sets[1].r = 9; e.sets[1].done = true;
      save(); renderWorkout();
    });
  }],
  ['intervals', async (p) => {
    await p.evaluate(() => {
      cancelSession(); closeSheet();
      const rt = S.routines.find((r) => /VO2max intervals/.test(r.name));
      startSession(rt.id); closeSheet();
      const e = S.active.ex[0];
      e.sets[0].r = 168; e.sets[0].done = true;
      e.sets[1].r = 172; e.sets[1].done = true;
      save(); renderWorkout();
    });
  }],
  ['food', async (p) => {
    await p.evaluate(() => {
      cancelSession(); closeSheet(); go('food'); addFoodForm('l');
      document.querySelector('#fdbQ').value = 'paneer';
      fdbSearch('paneer');
    });
  }],
  ['estimator', async (p) => {
    await p.evaluate(() => {
      document.querySelector('#fdbQ').value = 'pattod';
      fdbSearch('pattod');
      FDQ = 'pattod'; SABZI_PICK = { tpl: 'besan', g: 150 };
      sabziSheet();
    });
  }],
  /* last week, not this one: a Thursday screenshot of the current week is
     three days short by definition and photographs as a failing week */
  ['report', async (p) => { await p.evaluate(() => { closeSheet(); openReport(dShift(wkMonday(today()), -7)); }); }],
  ['longevity', async (p) => { await p.evaluate(() => { closeSheet(); assessSheet('longevity'); }); }],
  ['supplements', async (p) => { await p.evaluate(() => { closeSheet(); checklistSheet(); }); }],
  ['protocols', async (p) => { await p.evaluate(() => { closeSheet(); protocolsSheet(); }); }],
  ['body', async (p) => { await p.evaluate(() => { closeSheet(); go('body'); }); }],
];

/* Runs inside the page, before the app boots, so the app finds a populated
   store rather than a first run. Dates are relative to today so the screenshots
   never show a stale week. */
function seedDemo() {
  const K = 'coachz.v1';
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const back = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  const today = back(0);

  const store = {
    settings: {
      name: 'Alex', unit: 'kg', waterGoal: 3000, calGoal: 2600, proteinGoal: 130,
      carbGoal: 290, fatGoal: 78, rest: 90, fiberGoal: 30, diet: 'veg',
      height: '176', goalWeight: '70', age: '31', sex: 'm',
      waterRemind: true, waterEvery: 75, workoutRemind: '18:30',
      sleepRemind: '22:30', sleepGoal: 8, breathGoal: 15, theme: 'dark',
      onboarded: true,
    },
    water: {}, food: {}, sleep: {}, breath: {}, weights: [], tests: [], suppLog: {},
    programStart: back(84),
  };

  store.water[today] = 2250;
  store.food[today] = {
    b: [{ id: 'd1', name: 'Muesli + milk (bowl)', kcal: 340, p: 13, c: 45, f: 10, fb: 5 },
        { id: 'd2', name: 'Banana (1)', kcal: 105, p: 1, c: 27, f: 0, fb: 3 }],
    l: [{ id: 'd3', name: 'Roti + dal + sabzi (2 roti + 2 bowls)', kcal: 480, p: 17, c: 64, f: 16, fb: 17 },
        { id: 'd4', name: 'Curd / dahi (bowl, 200g)', kcal: 120, p: 7, c: 9, f: 6, fb: 0 }],
    s: [{ id: 'd5', name: 'Protein shake', kcal: 210, p: 26, c: 12, f: 5, fb: 1 }],
  };
  for (let i = 0; i < 21; i++) {
    const d = back(i);
    store.sleep[d] = { bed: i % 3 === 0 ? '22:50' : '22:35', wake: '06:35', hrs: i % 3 === 0 ? 7.7 : 8, q: 'good' };
    store.breath[d] = 10 + (i % 3) * 5;
    if (i % 4 === 0) store.weights.push({ date: d, kg: Math.round((71.4 - i * 0.05) * 10) / 10 });
  }
  store.weights.reverse();
  store.tests = [
    { date: back(9), key: 'hang', val: 58 },
    { date: back(9), key: 'balance', val: 26 },
    { date: back(9), key: 'sts', val: 27 },
    { date: back(9), key: 'gait', val: 1.42 },
    { date: back(9), key: 'ankle', val: 12 },
    { date: back(9), key: 'sitreach', val: 6 },
  ];
  store.vo2 = [{ date: back(60), val: 42, method: 'Rockport walk' },
               { date: back(11), val: 46, method: 'Cooper run' }];
  localStorage.setItem(K, JSON.stringify(store));
}

/* Sessions need real exercise ids, so they are written after boot.

   Placed by WEEKDAY inside a known Monday rather than by days-back. Days-back
   put half the week outside the Mon-Sun window whenever the script ran late in
   the week, and the five-pillar row then photographed as a failing week. Two
   full weeks are seeded so the report shot always has a complete one. */
function seedSessions() {
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const back = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  const byName = (n) => (S.exercises.find((e) => e.name === n) || {}).id;
  const mk = (date, name, rows, extra) => {
    const ex = rows.map((r) => ({
      exId: byName(r[0]),
      sets: [1, 2, 3].map((i) => ({ w: r[1], r: r[2] - (i === 3 ? 1 : 0), done: true, e: 'ok' })),
    })).filter((e) => e.exId);
    (extra || []).forEach((x) => { const id = byName(x[0]); if (id) ex.push({ exId: id, sets: x[1] }); });
    /* mirrors finishSession: cardio and power carry no tonnage, or a bike ride
       reports "828 kg" from kilometres times minutes */
    let vol = 0;
    ex.forEach((e) => {
      const g = exGroupOf(e.exId);
      if (g === 'Cardio' || g === 'Power') return;
      e.sets.forEach((s) => { vol += (+s.w || 0) * (+s.r || 0); });
    });
    return { id: 'demo' + date + name, name: name, date: date, dur: 3300, vol: vol, ex: ex, prs: [] };
  };
  const PUSH = [['Bench press', 52.5, 9], ['Overhead press', 32.5, 9], ['Incline dumbbell press', 20, 11], ['Triceps pushdown', 32.5, 13]];
  const PULL = [['Deadlift', 95, 6], ['Lat pulldown', 55, 10], ['Seated cable row', 50, 11], ['Hammer curl', 14, 12]];
  const LEGS = [['Squat', 75, 8], ['Romanian deadlift', 65, 10], ['Leg press', 130, 12], ['Calf raise', 40, 15]];
  const ride = ['Zone 2 (bike)', [{ w: 18.4, r: 45, done: true }]];
  const mob = ['Cat-cow', [{ r: 45, done: true }, { r: 45, done: true }]];
  const jump = ['Box jump', [{ w: 60, r: 4, done: true }, { w: 60, r: 4, done: true }]];

  /* Monday of this week, and of last week. dShift and wkMonday are the app's own. */
  const thisMon = wkMonday(today()), lastMon = dShift(thisMon, -7);
  const week = (mon, lighter) => {
    const d = (n) => dShift(mon, n);
    const out = [
      mk(d(0), 'Push day', PUSH.map((r) => [r[0], lighter ? r[1] - 2.5 : r[1], r[2]]), [ride]),
      mk(d(1), 'Power & agility (~20 min)', [], [jump, mob]),
      mk(d(2), 'Pull day', PULL.map((r) => [r[0], lighter ? r[1] - 5 : r[1], r[2]]), [ride]),
      mk(d(3), 'Zone 2 base (~45 min)', [], [ride, mob]),
      mk(d(4), 'Legs day', LEGS.map((r) => [r[0], lighter ? r[1] - 5 : r[1], r[2]]), [ride]),
    ];
    /* never seed a session dated in the future: a store screenshot showing
       Saturday's workout already logged on a Thursday is simply a lie */
    return out.filter((s) => s.date <= today());
  };
  S.sessions = week(lastMon, true).concat(week(thisMon, false));
  S.lastPhase = currentPhase().name;
  save();
}

(async () => {
  if (!fs.existsSync(SITE)) { console.error('run ./publish.sh first'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  /* Served in-process rather than by spawning a python server: a detached
     child in its own process group took this script down with it on cleanup. */
  const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
    '.webmanifest':'application/manifest+json', '.png':'image/png', '.jpg':'image/jpeg',
    '.svg':'image/svg+xml' };
  const server = require('http').createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(SITE, path.normalize(rel));
    if (!file.startsWith(SITE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));

  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,          /* 360×640 @3x = 1080×1920 */
    isMobile: true,
    hasTouch: true,
    /* granted, or the "turn on notifications" prompt headlines the first
       screenshot — that card is a nag, not the product */
    permissions: ['notifications'],
    origin: 'http://localhost:' + PORT,
  });
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.addInitScript(seedDemo);
  await page.goto('http://localhost:' + PORT + '/');
  await page.waitForTimeout(1800);
  await page.evaluate(seedSessions);
  await page.evaluate(() => { closeSheet(); render(); });
  await page.waitForTimeout(400);

  let n = 0;
  for (const [name, act] of SHOTS) {
    n++;
    await act(page);
    await page.waitForTimeout(550);
    const file = path.join(OUT, String(n).padStart(2, '0') + '-' + name + '.png');
    await page.screenshot({ path: file });
    console.log('  ' + path.relative(ROOT, file));
  }

  await browser.close();
  server.close();

  if (errors.length) { console.error('\npage errors:', errors); process.exit(1); }
  console.log('\n' + n + ' screenshots at 1080×1920 in store/screenshots/');
  console.log('Data is synthetic — see the note at the top of this file.');
  process.exit(0);
})();
