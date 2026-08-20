# Shipping CoachZ to Google Play

CoachZ is a PWA, so it goes to Play as a **Trusted Web Activity** — a thin
Android wrapper around a hosted web app. Total cost: **$25 once** (Play Console).

**Decisions already made, and baked into the files:**

| | |
|---|---|
| Origin | `https://malaygrowth.github.io/` — a repo named exactly `malaygrowth.github.io` |
| Application ID | `fit.coachz.app` — **permanent**, cannot change after publication |
| Storage key | the public build uses `coachz.v1`, the personal one `fitlog.v1` |

The origin has to be a **root**, not a subfolder: a TWA only reads
`.well-known/assetlinks.json` from the origin root, so `…github.io/fitlog/`
could not host its own. That is also why the storage keys differ — localStorage
is scoped to the origin, not the path, so the public app at `/` and the personal
app at `/fitlog/` would otherwise share one store.

---

## What is already done

- `./publish.sh` builds `site/` — the exact folder to serve. Public build,
  manifest, icons, privacy page, service worker, 125 exercise photos,
  `.nojekyll`, `.well-known/assetlinks.json`, and the screenshots the manifest
  references. No source files.
- `./tools/assetlinks.sh` writes the real asset-links file from your keystore.
- `./tools/shots.cjs` regenerates the ten store screenshots at 1080×1920.
- `store/screenshots/` — ten screenshots, ready to upload.
- Listing copy, data-safety and content-rating answers — below, ready to paste.

## What only you can do

Play Console account, the signing keystore, the GitHub repo, the upload, and the
twelve testers. None of it can be done from here.

**Still needed and not built:** a **1024×500 feature graphic**. Play will not
accept a store listing without one.

---

## 1. Put the site live

```bash
./publish.sh
```

Create a repo named **exactly** `malaygrowth.github.io` under your account, copy
the *contents* of `site/` into its root, commit, push. Settings → Pages → deploy
from `main` / root.

Check, in a browser:
- `https://malaygrowth.github.io/` — the app, opening on the onboarding sheet
- `https://malaygrowth.github.io/privacy.html`
- `https://malaygrowth.github.io/.well-known/assetlinks.json`

Your personal app at `/fitlog/` is untouched and keeps its own storage.

## 2. Build the Android wrapper

```bash
npm i -g @bubblewrap/cli
mkdir coachz-twa && cd coachz-twa
bubblewrap init --manifest https://malaygrowth.github.io/manifest.webmanifest
```

At the prompts: Application ID **`fit.coachz.app`**, name CoachZ, and let it
**create a new keystore**.

> **Back up `android.keystore` and its passwords in two places before going
> further.** Lose them and you can never update the app again — not a re-upload,
> not a support ticket. A new key means a new listing.

```bash
bubblewrap build
```

Produces `app-release-signed.apk` (local testing) and `app-release-bundle.aab`
(what Play wants).

## 3. Asset links — the step that fails silently

```bash
cd ../fitlog
./tools/assetlinks.sh ~/coachz-twa/android.keystore android
./publish.sh
```

Push the site repo again. The fingerprint is 32 hex pairs; get one character
wrong and nothing errors anywhere — the app just opens with a browser address
bar forever. That is why the script extracts it rather than asking you to type it.

If you enable **Play App Signing** (the default), Play re-signs with *its* key,
so the fingerprint that matters is the one under **Setup → App signing** in the
console. Take it from there and run:

```bash
./tools/assetlinks.sh --fingerprint "AA:BB:…"
```

Test before uploading: `adb install app-release-signed.apk`. The app must open
full-screen with **no browser bar**. A browser bar means asset links are wrong.

## 4. Play Console

Create app → CoachZ · App · Free.

**Short description** (80 max, this is 74):

```
Workouts, food, water and sleep — coached, private, all on your phone.
```

**Full description:**

```
CoachZ is a coach, not a spreadsheet. It reads what you have already done and
tells you what to do next — every set, every weight, every rep.

TRAINING THAT PROGRESSES ITSELF
Each set arrives with a target weight and rep range worked out from your own
history. Sleep badly or drop weight and it holds the load steady instead of
pushing. Miss a day and it tells you whether the week still needs that session.

THE FIVE QUALITIES, NOT JUST THE ONE
Strength is the easy one to track, so most apps stop there. CoachZ also covers
aerobic base and VO2max intervals, power and agility, flexibility you can
measure, and four longevity field tests — grip, balance, sit-to-stand and
walking speed — read against your age band. The weekly report shows all five at
a glance, so you can see the quality you have been quietly skipping.

FOOD THAT KNOWS WHAT YOU ACTUALLY EAT
550+ foods with an Indian-first database: sabzis, dals, thalis, street food,
café menus, branded packets. Search in whichever name you use — cucumber finds
kheera, okra finds bhindi, pattod finds it however you spell it. Nothing
matched? Estimate it from six dish shapes in two taps, and it is marked as an
estimate so you always know which numbers you measured.

EVIDENCE, GRADED HONESTLY
Every protocol and supplement carries an evidence tier, including the ones that
do not hold up. Where a popular protocol is weaker than its reputation, it says
so.

ALSO: water, sleep and sleep regularity, breathwork, morning daylight, caffeine
timing, a supplement schedule with doses and the gaps that matter, BMI on both
ICMR and WHO cutoffs, measurements, progress photos, barcode scanning, timers
and a plate calculator.

COMPLETELY PRIVATE
No account. No sign-up. No servers. Nothing leaves your phone — there is no
analytics, no tracking, and nowhere for your data to go. Export a backup any
time; it is a file on your device that only you can read.

Not medical advice. If something hurts, see a doctor.
```

**Assets:**
- App icon: `icon-512.png`
- Feature graphic: 1024×500 — **still to make**
- Phone screenshots: `store/screenshots/` (upload at least 2 of the 10)

**Privacy policy URL:** `https://malaygrowth.github.io/privacy.html`

**Data safety form** — every answer is "no", and it is true:

| Question | Answer |
|---|---|
| Does your app collect or share any user data? | **No** |
| Is all user data encrypted in transit? | N/A — nothing is transmitted |
| Can users request data deletion? | N/A — Settings → Erase all data, held only on device |

**Content rating:** category Health & Fitness. No violence, no sexual content,
no profanity, no gambling, no user-generated content, no data sharing. Comes out
as Everyone / PEGI 3.

**Target audience:** 18+ — simplest for a fitness app, and it avoids the extra
families-policy requirements.

**App access:** all functionality available without special access.

**Ads:** no.

## 5. Twelve testers, fourteen days

New personal developer accounts must run a closed test with **at least 12
testers opted in for 14 consecutive days** before production access unlocks.

Release → Testing → Closed testing → create a track → upload the `.aab` → add
12+ tester emails → share the opt-in link. They must actually opt in and keep
the app installed for the full fourteen days.

## 6. Production

Promote the tested release → pick countries → submit. Review is typically 1–7
days.

---

## Updating after launch

Web changes ship instantly — `./publish.sh`, push the site repo, done. The TWA
loads the live site, so features and fixes need no Play release at all.

Rebuild and re-upload the `.aab` only when the *wrapper* changes: icon, name,
origin, or Play's annual target-API bump.

## Checklist

- [ ] `site/` live at the origin root, opening on onboarding on a fresh phone
- [ ] `privacy.html` and `.well-known/assetlinks.json` both load
- [ ] Keystore and passwords backed up twice
- [ ] APK installs and opens with **no browser bar**
- [ ] `node test/smoke.cjs` and `node test/public.cjs` green
- [ ] Feature graphic made
- [ ] 12 testers lined up

## Not covered

**iOS.** A different route — Safari's PWA support is weaker, and Apple
scrutinises health apps more heavily. Worth treating as a separate project once
Play is live.
