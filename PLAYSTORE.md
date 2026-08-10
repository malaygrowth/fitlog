# Launching CoachZ on the Google Play Store — step by step

CoachZ is a PWA, so it goes to Play as a **Trusted Web Activity (TWA)** — a thin
Android wrapper around the hosted web app. The `public` branch is the build to
ship (onboarding, no personal data). Total cost: **$25 one-time** (Play Console).

## Phase 0 — Decide the public URL

The TWA points at a live HTTPS URL serving the **public build**. Options:
- **A (free):** a second GitHub Pages site — e.g. repo `coachz-app` (or Pages
  from the `public` branch at a separate repo) → `https://malaygrowth.github.io/coachz/`.
  Note: your personal app stays at `/fitlog/` untouched.
- **B (recommended before launch):** a custom domain (e.g. `coachz.fit`,
  ~₹800/yr) pointed at Pages. Looks professional on the listing and in the URL bar
  fallback.

## Phase 1 — Digital Asset Links (proves you own the site)

TWAs require `https://<ORIGIN>/.well-known/assetlinks.json`.
For `malaygrowth.github.io/...` the ORIGIN is `malaygrowth.github.io`, so:

1. Create a repo named exactly **`malaygrowth.github.io`** (this becomes your
   user site at that origin's root).
2. Add the file `.well-known/assetlinks.json` (content comes from Phase 2 —
   Bubblewrap prints it, including your app's SHA-256 signing fingerprint).
3. Enable Pages on that repo (main / root). Verify the file loads at
   `https://malaygrowth.github.io/.well-known/assetlinks.json`.

(With a custom domain, the file lives at that domain's root instead.)

## Phase 2 — Package the TWA with Bubblewrap (on your laptop)

Prereqs: Node 18+, and Bubblewrap will auto-install JDK + Android SDK on first run.

```bash
npm i -g @bubblewrap/cli
mkdir coachz-twa && cd coachz-twa
bubblewrap init --manifest https://<YOUR-PUBLIC-URL>/manifest.webmanifest
```
Answer the prompts:
- Application ID: `io.growleads.coachz` (reverse-domain, permanent — choose carefully)
- Name / short name: CoachZ
- Colors & icons: auto-read from the manifest (PNG icons are already in place)
- Signing key: let it **create a new keystore** — set real passwords and
  **BACK UP `android.keystore` + passwords somewhere safe. Lose it = you can
  never update the app again.**

```bash
bubblewrap build
```
Outputs: `app-release-signed.apk` (for local testing) and
**`app-release-bundle.aab`** (what you upload to Play). It also prints the
`assetlinks.json` content → put that into the Phase 1 repo now.
Test locally: `adb install app-release-signed.apk` — the app must open
full-screen with **no browser bar** (that's asset links working).

## Phase 3 — Play Console setup

1. https://play.google.com/console → create a **personal developer account**
   ($25, ID verification takes 1–2 days).
2. **Create app** → App name: CoachZ · Type: App · Free.
3. **Store listing:**
   - Short description (80 chars): "Workouts, food, water & sleep — coached from one private app."
   - Full description: features + "all data stays on your device".
   - App icon: `icon-512.png` · Feature graphic: 1024×500 (make from the brand)
   - Phone screenshots: at least 2 (use the app screenshots — dashboard,
     workout, progress, food).
4. **Privacy policy URL:** `https://<YOUR-PUBLIC-URL>/privacy.html` (already built).
5. **Data safety form:** "Does your app collect or share user data?" → **No**.
   (True: no accounts, no transmission, no analytics.)
6. **Content rating questionnaire:** Health & Fitness → all "No" → rated Everyone.
7. **Target audience:** 18+ (simplest for a fitness app).
8. App access: "All functionality available without special access".

## Phase 4 — Testing requirement (new personal accounts)

Google requires new personal accounts to run a **closed test with at least 12
testers opted-in for 14 consecutive days** before production access:
1. Release → Testing → Closed testing → create track, upload the `.aab`.
2. Add tester emails (friends/family/gym buddies — 12+), share the opt-in link.
3. After 14 days, apply for Production access in the console.

## Phase 5 — Production

Promote the tested release to Production → countries (India first or worldwide)
→ submit for review (typically 1–7 days). Done: CoachZ is on the Play Store.

## Updating the app after launch

Web content updates (features, fixes) ship instantly — just push to the public
branch; the TWA loads the live site. You only rebuild/re-upload the `.aab` when
the *wrapper* changes (icon, name, URL, or Play's target-API bumps ~once a year).

## Pre-launch checklist

- [ ] Public URL live, serves public build (onboarding on fresh device)
- [ ] `privacy.html` reachable
- [ ] `assetlinks.json` at origin root with correct SHA-256
- [ ] Keystore + passwords backed up (twice)
- [ ] `test/public.cjs` and `test/smoke.cjs` green
- [ ] Screenshots + feature graphic exported
- [ ] 12 testers lined up
