/* MoneyZ sync suite.
   Runs the app against a throwaway PostgREST-shaped server on localhost and
   checks that two devices converge. Nothing here talks to a real backend.
   Run:  ./build.sh && NODE_PATH=/opt/node22/lib/node_modules node test/sync.cjs */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const INDEX = path.resolve(__dirname, '..', 'index.html');
const TABLE = 'moneyz_records';

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else { failures++; console.log('  FAIL ' + name + (detail !== undefined ? ' -> ' + JSON.stringify(detail) : '')); }
}

/* ---- stand-in for Supabase: one table, upsert on id, filter on owner ---- */
const rows = new Map();
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(INDEX));
  }
  if (url.pathname !== '/rest/v1/' + TABLE) return send(404, { message: 'no such table' });
  if (req.method === 'GET') {
    const owner = (url.searchParams.get('owner') || '').replace(/^eq\./, '');
    const gt = (url.searchParams.get('updated_at') || '').replace(/^gt\./, '');
    const out = [...rows.values()].filter(
      (r) => r.owner === owner && (!gt || Date.parse(r.updated_at) > Date.parse(gt))
    );
    return send(200, out);
  }
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    return req.on('end', () => {
      let list;
      try { list = JSON.parse(body); } catch (e) { return send(400, { message: 'bad json' }); }
      list.forEach((r) => rows.set(r.id, r));
      send(201);
    });
  }
  send(405, { message: 'nope' });
});

async function configure(page, owner, port) {
  await page.evaluate(({ owner, port }) => {
    Object.assign(DB.settings, {
      syncOn: true,
      syncUrl: 'http://localhost:' + port,
      syncKey: 'test-anon-key',
      syncTable: 'moneyz_records',
      syncOwner: owner,
    });
    save();
  }, { owner, port });
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const APP = `http://localhost:${port}/index.html`;

  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const errors = [];

  // Two contexts means two separate localStorage stores: two devices.
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  [A, B].forEach((p) => p.on('pageerror', (e) => errors.push(e.message)));

  console.log('device A budgets and spends, then syncs');
  await A.goto(APP);
  await A.waitForTimeout(250);
  await configure(A, 'anuj', port);
  const upA = await A.evaluate(async () => {
    put('env', Object.assign(DB.env['seed-groceries'], { budget: 900000, rollover: true }));
    put('tx', { id: 'tx-milk', envId: 'seed-groceries', amt: 12000, kind: 'out', note: 'Milk', date: today(), deleted: false });
    return await Sync.run(true);
  });
  check('device A reports a successful sync', /Synced/.test(upA), upA);
  check('only the touched records went up', rows.size === 2, [...rows.keys()]);
  check('an untouched seed envelope stayed home', !rows.has('seed-bills'));

  console.log('nothing sensitive left the device');
  const uploaded = JSON.stringify([...rows.values()]);
  check('no settings row was uploaded', ![...rows.values()].some((r) => r.coll === 'settings'));
  check('the sync key was never uploaded', !/test-anon-key/.test(uploaded));

  console.log('device B pulls it down');
  await B.goto(APP);
  await B.waitForTimeout(250);
  await configure(B, 'anuj', port);
  const downB = await B.evaluate(async () => {
    const msg = await Sync.run(true);
    bust();
    return {
      msg: msg,
      envs: live('env').length,
      budget: DB.env['seed-groceries'].budget,
      rollover: DB.env['seed-groceries'].rollover,
      tx: live('tx').length,
      note: (DB.tx['tx-milk'] || {}).note,
      spent: totals(period).spent,
    };
  });
  check('device B synced', /Synced/.test(downB.msg), downB.msg);
  check('starter envelopes merged rather than duplicated', downB.envs === 8, downB.envs);
  check("device A's budget landed on B", downB.budget === 900000, downB.budget);
  check('the rollover flag came across', downB.rollover === true, downB.rollover);
  check('the transaction came across', downB.tx === 1 && downB.note === 'Milk', downB);
  check('B computes the same spend', downB.spent === 12000, downB.spent);

  console.log('an untouched seed never overwrites a real budget');
  const reA = await A.evaluate(async () => {
    await Sync.run(true);
    return DB.env['seed-groceries'].budget;
  });
  check("A's budget survived B's fresh install", reA === 900000, reA);

  console.log('a delete on B reaches A');
  await B.evaluate(async () => { drop('tx', 'tx-milk'); await Sync.run(true); });
  const afterDel = await A.evaluate(async () => {
    await Sync.run(true);
    bust();
    return { live: live('tx').length, spent: totals(period).spent };
  });
  check('A dropped the deleted entry', afterDel.live === 0, afterDel.live);
  check('A recomputed spending to zero', afterDel.spent === 0, afterDel.spent);

  console.log('an edit on A reaches B');
  await A.evaluate(async () => {
    put('env', Object.assign(DB.env['seed-fun'], { budget: 300000, name: 'Weekends' }));
    await Sync.run(true);
  });
  const afterEdit = await B.evaluate(async () => {
    await Sync.run(true);
    return { name: DB.env['seed-fun'].name, budget: DB.env['seed-fun'].budget };
  });
  check('the rename reached B', afterEdit.name === 'Weekends', afterEdit.name);
  check('the new budget reached B', afterEdit.budget === 300000, afterEdit.budget);

  console.log('failure is reported, not swallowed');
  const bad = await A.evaluate(async () => {
    const keep = DB.settings.syncTable;
    DB.settings.syncTable = 'does_not_exist';
    const msg = await Sync.run(true);
    DB.settings.syncTable = keep;
    save();
    return msg;
  });
  check('a missing table surfaces an error', /failed/i.test(bad), bad);
  const stillFine = await A.evaluate(() => live('env').length);
  check('a failed sync leaves the data alone', stillFine === 8, stillFine);

  console.log('sync off means no traffic');
  const before = rows.size;
  await A.evaluate(async () => {
    DB.settings.syncOn = false;
    save();
    put('tx', { id: 'tx-offline', envId: 'seed-groceries', amt: 5000, kind: 'out', note: 'offline', date: today(), deleted: false });
    await Sync.run(false);
  });
  check('nothing was uploaded while sync was off', rows.size === before, [before, rows.size]);

  check('no uncaught page errors', errors.length === 0, errors);

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
