# Smart home automation — website

Marketing site for the smart home automation business: smart switches,
motorised curtains, room scenes, climate and environment control, voice
integration, and security/entry.

> **Note on where this lives.** This folder is currently parked inside the
> `fitlog` repository because the GitHub App in the build environment could not
> create a new repository. It is meant to move to its own repo
> (`malaygrowth/smart-home-website`) — nothing here depends on `fitlog`, so the
> move is a straight copy of this directory plus `npm install`.

## Read this first

`docs/plan.html` is the research and design-direction document: market sizing,
buyer objections, the productized offer, the full site map, conversion
mechanics, the design research, and three visual directions. Open it in a
browser. Every decision in the code traces back to it.

## Running it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run preview  # serve the build
```

Astro, static output, no runtime server. Deploy `dist/` to Vercel, Netlify,
Cloudflare Pages or any static host.

## How it's put together

```
src/
  data/site.ts        brand, contact, packages, scene definitions
  data/services.ts    the six service pages, copy and objection answers
  data/pricing.ts     the estimator's price model
  data/projects.ts    case studies
  data/journal.ts     cost guides and comparisons
  layouts/Base.astro  head, header, footer, floating WhatsApp
  components/
    SceneDemo.astro   the interactive room
    Placeholder.astro loud marker for scaffolding content
  pages/
    index.astro            homepage
    estimate.astro         cost estimator
    contact.astro          WhatsApp / call / form
    how-it-works.astro     survey to handover, with days
    service-and-amc.astro  warranty and service plan
    for-designers.astro    the architect and builder channel
    privacy.astro          plain-language privacy
    404.astro
    sitemap.xml.ts         built from the data, never stale
    services/[slug].astro  six service pages
    projects/[slug].astro  case studies
    journal/[slug].astro   articles
    areas/[city].astro     one per service area
  styles/global.css   the Switchplate design system
public/fonts/         Oswald + Instrument Serif Italic, self-hosted
```

23 routes build in about a second.

**Content lives in `src/data`, not in templates.** Changing a price, a phone
number or a paragraph of service copy never means editing markup.

### The design system — "Switchplate"

Light, architectural, precise. Warm plaster ground, brass hairlines, condensed
signage typography borrowed from the switchgear itself. It deliberately avoids
the near-black glassmorphic look every other site in this category uses — see
the design research section of the plan for why.

- **Display / labels** — Oswald, condensed uppercase, tracked
- **Body** — system grotesk stack
- **Accent voice** — Instrument Serif Italic, used for the one line that matters
- **Accent colour** — brass `#9A6420`, spent once per view
- **Secondary** — teal `#0F5D58` for "connected" signals and WhatsApp

The one dark surface is `--night`, used for the scene demo and the footer,
where a room at dusk genuinely belongs.

### The estimator

`src/pages/estimate.astro` answers the objection that blocks most purchases —
cost — before anyone has to ring you. The maths runs in the browser from
`src/data/pricing.ts` and the finished estimate is handed to WhatsApp as a
pre-written message, so there is no backend and nothing to maintain.

**Every rate in `pricing.ts` is a placeholder** derived from published market
benchmarks. Replace them all before launch.

### The scene demo

`src/components/SceneDemo.astro` is the differentiator: a visitor taps Morning
/ Evening / Movie / Away and the room responds — lights dim, curtains travel,
readouts update. Driven entirely by the `scenes` array in `src/data/site.ts`,
so scene names and values are content, not code.

`--curtain` is how far the curtains are **drawn back**: `0%` closed, `100%`
fully open. `--sky` is daylight outside, separate from `--lvl` (artificial
light) so a dark room at midday and a lit room at night both read correctly.

## Still to do

Waiting on client input (see the plan's closing section):

- [ ] Real brand name, logo, contact details, service cities — all in `src/data/site.ts`, marked `TODO`
- [ ] Real package prices, currently `from ₹—`
- [ ] Project photography — the highest-value missing asset

Built, and needing real content before launch:

- [ ] Replace every rate in `src/data/pricing.ts` — all placeholders
- [ ] Replace the three case studies in `src/data/projects.ts` with real installs; they render a loud Placeholder banner until you do
- [ ] Fill the TODOs on `for-designers` with your real installation standards, and offer the spec as a downloadable PDF
- [ ] Put a real response-time commitment on `service-and-amc`
- [ ] Give each city page local specifics — a thin page per city hurts more than it helps
- [ ] Point the contact form at a real endpoint (it falls back to WhatsApp until then, so no enquiry is lost)
- [ ] Add the formal legal notice under the plain-language privacy page
- [ ] Set the real domain in `astro.config.mjs` and `public/robots.txt`

Not started:

- [ ] Emailed PDF of the estimate
- [ ] Analytics and call tracking
- [ ] More journal articles — the two here are the highest-intent queries
