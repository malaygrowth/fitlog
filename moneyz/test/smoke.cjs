/* MoneyZ smoke suite.
   Run:  ./build.sh && NODE_PATH=/opt/node22/lib/node_modules node test/smoke.cjs
   Env:  CHROME_PATH overrides the Chromium binary (default /opt/pw-browsers/chromium). */
const { chromium } = require('playwright');
const path = require('path');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else { failures++; console.log('  FAIL ' + name + (detail !== undefined ? ' -> ' + JSON.stringify(detail) : '')); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());

  console.log('boot');
  await page.goto(APP);
  await page.waitForTimeout(300);
  const boot = await page.evaluate(() => ({
    envs: Object.keys(DB.env).length,
    tx: Object.keys(DB.tx).length,
    period: period,
    label: document.getElementById('periodLabel').textContent,
    syncOff: !Sync.enabled(),
  }));
  check('eight envelopes seeded', boot.envs === 8, boot.envs);
  check('no transactions on a fresh install', boot.tx === 0, boot.tx);
  check('period is the current month', boot.period === new Date().toISOString().slice(0, 7), boot.period);
  check('period label rendered', /\d{4}/.test(boot.label), boot.label);
  check('sync is off by default', boot.syncOff);

  console.log('budgets and the daily number');
  await page.evaluate(() => {
    const ids = Object.keys(DB.env);
    put('env', Object.assign(DB.env[ids[0]], { budget: 1000000, rollover: true })); // 10,000
    put('env', Object.assign(DB.env[ids[1]], { budget: 500000 }));                  // 5,000
    bust(); render();
  });
  const budgeted = await page.evaluate(() => totals(period));
  check('budget totals 15,000', budgeted.budget === 1500000, budgeted.budget);
  check('nothing spent yet', budgeted.spent === 0, budgeted.spent);
  check('all of it is available', budgeted.avail === 1500000, budgeted.avail);

  console.log('logging a spend through the keypad');
  await page.click('#fab');
  await page.waitForTimeout(150);
  for (const k of ['2', '5', '0']) await page.click(`[data-pad="${k}"]`);
  await page.click('#txSave');
  await page.waitForTimeout(200);
  const afterSpend = await page.evaluate(() => ({
    tx: Object.keys(DB.tx).length,
    amt: Object.values(DB.tx)[0].amt,
    kind: Object.values(DB.tx)[0].kind,
    totals: totals(period),
  }));
  check('one transaction stored', afterSpend.tx === 1, afterSpend.tx);
  check('250 captured as minor units', afterSpend.amt === 25000, afterSpend.amt);
  check('defaults to a spend', afterSpend.kind === 'out', afterSpend.kind);
  check('spent reflected in totals', afterSpend.totals.spent === 25000, afterSpend.totals.spent);
  check('available dropped by the spend', afterSpend.totals.avail === 1475000, afterSpend.totals.avail);

  console.log('undo');
  await page.click('#toastAct');
  await page.waitForTimeout(150);
  const undone = await page.evaluate(() => totals(period).spent);
  check('undo removes the spend', undone === 0, undone);

  console.log('unassigned spending still reduces what is left');
  await page.evaluate(() => {
    put('tx', { id: uid(), envId: null, amt: 100000, kind: 'out', note: 'cash', date: today(), deleted: false });
    bust();
  });
  const un = await page.evaluate(() => totals(period));
  check('unassigned counted as spend', un.spent === 100000, un.spent);
  check('unassigned counted against available', un.avail === 1400000, un.avail);

  console.log('rollover carries leftover forward');
  const carry = await page.evaluate(() => {
    const id = Object.keys(DB.env)[0];
    const e = DB.env[id];
    const prev = prevP(period);
    const d = periodStart(prev).toISOString().slice(0, 10);
    put('tx', { id: uid(), envId: id, amt: 200000, kind: 'out', note: 'last month', date: d, deleted: false });
    bust();
    return { carry: envStats(e, period).carry, avail: envStats(e, period).avail, rollover: e.rollover };
  });
  check('rollover flag held', carry.rollover === true);
  check('leftover of 8,000 carried in', carry.carry === 800000, carry.carry);
  check('this period has budget plus carry', carry.avail === 1800000, carry.avail);

  console.log('move money between envelopes');
  const moved = await page.evaluate(() => {
    const [a, b] = Object.keys(DB.env);
    put('tx', { id: uid(), envId: a, amt: -100000, kind: 'adj', note: 'out', date: today(), deleted: false });
    put('tx', { id: uid(), envId: b, amt: 100000, kind: 'adj', note: 'in', date: today(), deleted: false });
    bust();
    return { a: envStats(DB.env[a], period).avail, b: envStats(DB.env[b], period).avail, spent: totals(period).spent };
  });
  check('source envelope shrank', moved.a === 1700000, moved.a);
  check('destination envelope grew', moved.b === 600000, moved.b);
  check('a move is not spending', moved.spent === 100000, moved.spent);

  console.log('custom period start');
  const custom = await page.evaluate(() => {
    DB.settings.monthStart = 5;
    save();
    return { of5: periodOf('2026-03-05'), of4: periodOf('2026-03-04'), label: periodLabel('2026-03') };
  });
  check('the 5th opens the March period', custom.of5 === '2026-03', custom.of5);
  check('the 4th still belongs to February', custom.of4 === '2026-02', custom.of4);
  check('label spans two months', /to/.test(custom.label), custom.label);

  console.log('persistence across a reload');
  await page.evaluate(() => { DB.settings.monthStart = 1; save(); });
  await page.reload();
  await page.waitForTimeout(300);
  const reloaded = await page.evaluate(() => ({
    live: live('tx').length,
    all: Object.keys(DB.tx).length,
    envs: Object.keys(DB.env).length,
  }));
  check('four live transactions survived the reload', reloaded.live === 4, reloaded.live);
  check('the undone entry is kept as a tombstone for sync', reloaded.all === 5, reloaded.all);
  check('envelopes survived the reload', reloaded.envs === 8, reloaded.envs);

  console.log('tabs render');
  for (const t of ['env', 'log', 'ins', 'home']) {
    await page.click(`[data-tab="${t}"]`);
    await page.waitForTimeout(120);
    const filled = await page.evaluate((tab) => document.getElementById('tab-' + tab).innerHTML.length, t);
    check(`${t} tab renders`, filled > 100, filled);
  }

  console.log('settings sheet opens');
  await page.click('#btnSettings');
  await page.waitForTimeout(150);
  const sheet = await page.evaluate(() => ({
    open: document.getElementById('sheet').classList.contains('on'),
    hasSync: !!document.getElementById('yUrl'),
    keyMasked: document.getElementById('yKey').type === 'password',
  }));
  check('sheet opened', sheet.open);
  check('sync fields present', sheet.hasSync);
  check('sync key is masked', sheet.keyMasked);

  console.log('escaping');
  await page.evaluate(() => {
    document.getElementById('scrim').click();
    const id = Object.keys(DB.env)[0];
    put('env', Object.assign(DB.env[id], { name: '<img src=x onerror=alert(1)>' }));
    view = 'env'; bust(); render();
  });
  const injected = await page.evaluate(() => document.querySelectorAll('#tab-env img').length);
  check('envelope names cannot inject markup', injected === 0, injected);

  check('no uncaught page errors', errors.length === 0, errors);

  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
