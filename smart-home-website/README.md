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
  data/services.ts    all six service pages, copy and objection answers
  layouts/Base.astro  head, header, footer, floating WhatsApp
  components/         SceneDemo — the interactive room
  pages/
    index.astro
    services/[slug].astro   generates all six service pages from data
  styles/global.css   the Switchplate design system
public/fonts/         Oswald + Instrument Serif Italic, self-hosted
```

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

Built but not yet started:

- [ ] Cost estimator with email capture and PDF
- [ ] Projects / case studies
- [ ] How it works, Service & AMC, Privacy
- [ ] For architects & interior designers
- [ ] City landing pages, journal / cost guides
