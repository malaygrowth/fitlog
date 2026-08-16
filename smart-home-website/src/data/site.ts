/**
 * Every business-specific value lives here so copy changes never require
 * touching a template. Anything marked TODO is waiting on an answer from
 * the client — see the "What I need from you" section of docs/plan.html.
 */

export const site = {
  // TODO: real brand name and logo
  name: 'YOURBRAND',
  tagline: 'Wired for the way you actually live',
  description:
    'Smart switches, motorised curtains, room scenes, climate and voice control — designed room by room and installed in days, not weeks.',

  // TODO: real contact details
  phone: '+91 00000 00000',
  phoneHref: 'tel:+910000000000',
  whatsapp: '910000000000',
  email: 'hello@example.com',

  // TODO: confirm the cities you will genuinely send a van to.
  // These drive the city landing pages and the whole local SEO plan.
  cities: ['Your City'],
};

/** Pre-fills the WhatsApp message with the page the visitor was reading. */
export function whatsappLink(context?: string) {
  const msg = context
    ? `Hi, I'm looking at ${context} and would like an estimate.`
    : `Hi, I'd like an estimate for home automation.`;
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(msg)}`;
}

export type Package = {
  id: string;
  name: string;
  fits: string;
  price: string;
  blurb: string;
  includes: string[];
};

// TODO: real prices. Ranges are fine and beat "contact us" by a distance —
// the benchmarks in the plan are 1BHK ~Rs 80k, 2BHK ~Rs 1.3L, 3BHK ~Rs 1.8L.
export const packages: Package[] = [
  {
    id: 'essential',
    name: 'Essential',
    fits: '1BHK / 2BHK',
    price: 'from ₹—',
    blurb:
      'The core of a smart home without touching a wall. Retrofits into your existing wiring — no chiselling, no repainting.',
    includes: [
      'Smart switches on the main circuits',
      'Alexa and Google voice control',
      'One app for the whole house',
      'Three scenes configured on handover',
    ],
  },
  {
    id: 'comfort',
    name: 'Comfort',
    fits: '2BHK / 3BHK',
    price: 'from ₹—',
    blurb:
      'Everything in Essential, plus the parts of the house that move and breathe — curtains, climate and the sensors that drive them.',
    includes: [
      'Everything in Essential',
      'Motorised curtains and blinds',
      'Per-room climate and fan control',
      'Temperature, humidity and air quality sensing',
      'Scenes that run themselves on time and conditions',
    ],
  },
  {
    id: 'whole-home',
    name: 'Whole home',
    fits: 'Villa / new build',
    price: 'from ₹—',
    blurb:
      'Designed alongside your electrical contractor before the walls close, so nothing is a compromise afterwards.',
    includes: [
      'Everything in Comfort',
      'Full-home design with your electrician',
      'Every room scened',
      'Smart locks, cameras and entry',
      'A commissioning session with the family',
    ],
  },
];

export type Scene = {
  id: string;
  label: string;
  voice: string;
  desc: string;
  /** 0–1 artificial light level */
  level: number;
  /** how far the curtains are drawn back: 0% = closed, 100% = fully open */
  curtain: string;
  /** 0–1 daylight outside the window */
  sky: number;
  /** warm-to-cool glow colour */
  glow: string;
  readout: { lights: string; curtains: string; climate: string; status: string };
};

export const scenes: Scene[] = [
  {
    id: 'morning',
    label: 'Morning',
    voice: '"Alexa, good morning"',
    desc: 'Curtains open at 6:40. Lights stay off — there is enough sun.',
    level: 0.12,
    curtain: '86%',
    sky: 1.0,
    glow: '#FFE7B8',
    readout: { lights: 'Off', curtains: 'Open', climate: '26°C', status: 'Home' },
  },
  {
    id: 'evening',
    label: 'Evening',
    voice: '"Alexa, good evening"',
    desc: 'Warm light at sixty percent, curtains half drawn, AC holding twenty-four.',
    level: 0.62,
    curtain: '46%',
    sky: 0.45,
    glow: '#FFC978',
    readout: { lights: '60%', curtains: 'Half', climate: '24°C', status: 'Home' },
  },
  {
    id: 'movie',
    label: 'Movie',
    voice: '"Alexa, movie time"',
    desc: 'Lights to twenty percent, curtains fully closed, AC down a degree.',
    level: 0.2,
    curtain: '4%',
    sky: 0.1,
    glow: '#FF9E5E',
    readout: { lights: '20%', curtains: 'Closed', climate: '23°C', status: 'Do not disturb' },
  },
  {
    id: 'away',
    label: 'Away',
    voice: '"Alexa, I am leaving"',
    desc: 'Every load off, curtains closed, sensors armed. One tap at the door.',
    level: 0.03,
    curtain: '8%',
    sky: 0.18,
    glow: '#7FA6C4',
    readout: { lights: 'Off', curtains: 'Closed', climate: 'Off', status: 'Armed' },
  },
];
