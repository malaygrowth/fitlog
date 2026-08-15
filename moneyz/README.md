# MoneyZ — envelope budgeting

A private, single-user budgeting app. You give each envelope an amount for the
month, log what you spend in two taps, and the app answers the only question
that matters day to day: **how much can I spend today without breaking the
month?**

No accounts and no server by default. Everything lives in your phone's browser
storage. Sync is optional, off until you switch it on, and points at a backend
you own.

Built as a single-file progressive web app, the same shape as
[fitlog](../README.md): no build tooling, no dependencies, no framework.

## Features

- **Safe to spend today** — what is left, divided by the days remaining, minus
  what you have already spent today. One number, updated as you log.
- **Envelopes** — an amount per period per category, with a spend bar and what
  is left. Eight starter envelopes, add or rename freely.
- **Rollover** — per envelope. Leftover carries into the next period, and so
  does an overspend, which is the honest half people usually skip.
- **Two-tap logging** — a keypad sheet from the plus button, or one tap on a
  saved quick add on the home screen. Every log can be undone from the toast.
- **Move money** — take from one envelope, give to another, without it counting
  as spending. This is what makes envelopes work when life happens.
- **Custom period start** — if you are paid on the 5th, your month starts on
  the 5th. Everything reflows around it.
- **Log** — every entry grouped by day with a daily total, editable, deletable.
- **Insights** — six-period spending trend, where the money went as a share of
  the total, and what you kept against your income.
- **Backup** — export and import a JSON file. Nothing is locked in.
- **Optional sync** — see below. Off by default.

## Run it

No build step is needed to develop, but `index.html` is generated. Edit the
parts, never `index.html`:

```sh
./build.sh          # head.html + sync.html + core.html + tail.html -> index.html
npx http-server .   # then open the printed URL on your phone
```

`core.html` is the whole app: styles, markup and logic. `sync.html` is the
optional sync layer and can be deleted outright, the app only ever calls it
behind a check.

## Install on your phone

Any static host works, and GitHub Pages is the easy one: repo Settings, Pages,
deploy from branch, `/ (root)`. Open the Pages URL on your phone, then
**Android (Chrome):** menu, *Add to Home screen*.
**iPhone (Safari):** Share, *Add to Home Screen*.

Served over https it registers a service worker and works fully offline.

## Sync (optional)

Sync is for putting the same budget on your phone and your laptop, or sharing
one budget with a partner. Leave it off and MoneyZ never makes a network call.

Your **settings never sync**, only envelopes, entries and quick adds. That is
deliberate: it keeps the sync key itself off the wire, and lets each device
keep its own theme and currency.

Conflicts resolve **last write wins** per record, on `updated_at`. Deletes
travel as tombstones, so removing something on one device removes it on the
other. Starter envelopes you have never edited are never uploaded and always
lose to a remote copy, so a freshly installed device cannot wipe budgets you
set elsewhere.

### Setting up Supabase

Create a project, then run this in the SQL editor:

```sql
create table moneyz_records (
  id         text primary key,
  owner      text not null,
  coll       text not null,
  payload    jsonb not null,
  updated_at timestamptz not null,
  deleted    boolean not null default false
);
create index moneyz_records_owner_updated on moneyz_records (owner, updated_at);

alter table moneyz_records enable row level security;
```

Then decide who may read and write. The quickest workable policy, which trusts
anyone holding the anon key, is:

```sql
create policy "anon owns everything"
  on moneyz_records for all
  to anon
  using (true) with check (true);
```

That is fine for a private project where you control the key. If more than one
person will use the same project, put real auth in front of it and scope the
policy to `auth.uid()` instead of trusting `owner`, because `owner` is just a
string the client sends.

In the app: Settings, Sync. Paste the project URL and the **anon** key, set an
account tag (any string, it groups your rows), tick Enable sync, then **Sync
now**. Repeat on the second device with the same tag.

### Using something else

The adapter speaks PostgREST, but the contract is small. Any endpoint that
accepts `GET ?owner=eq.X&updated_at=gt.T` and an upserting `POST` of rows
shaped `{id, owner, coll, payload, updated_at, deleted}` will work. Swap the
two functions in `sync.html`.

## Tests

Playwright drives a real browser. Build first, the suites load `index.html`.

```sh
./build.sh
NODE_PATH=/opt/node22/lib/node_modules node test/smoke.cjs   # app behaviour
NODE_PATH=/opt/node22/lib/node_modules node test/sync.cjs    # two devices converging
```

`sync.cjs` starts a throwaway PostgREST-shaped server on localhost and runs two
browser contexts against it, so it never touches a real backend. It covers the
cases worth being sure about: a delete on one device reaching the other, an
untouched seed never overwriting a real budget, the sync key never leaving the
device, and a failed sync leaving local data alone.

## Notes and limits

- **Budgets are not versioned.** Change an envelope's amount and past periods
  are recalculated with the new number. Rollover history shifts with it. Worth
  knowing before you rewrite a budget mid-year.
- Money is stored in minor units (paise, cents) as integers, so no float drift.
- Browser storage is durable but not permanent. Clearing site data erases
  everything, so export a backup now and then, or turn sync on.
