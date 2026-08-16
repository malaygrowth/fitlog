/**
 * The estimator's price model.
 *
 * IMPORTANT — every rate below is a PLACEHOLDER derived from published Indian
 * market benchmarks (1BHK ~Rs 80k, 2BHK ~Rs 1.3L, 3BHK ~Rs 1.8L core scope).
 * They exist so the estimator can be built and tested before the client's real
 * numbers arrive. Replace every `low`/`high` in this file before launch.
 *
 * The estimator deliberately quotes a RANGE, never a single figure. A range is
 * honest about what a survey has not yet seen, and it still answers the
 * question that stops most visitors from enquiring at all.
 */

export type HomeSize = {
  id: string;
  label: string;
  /** sensible starting points the visitor can override */
  rooms: number;
  windows: number;
};

export const homeSizes: HomeSize[] = [
  { id: '1bhk', label: '1 BHK', rooms: 3, windows: 3 },
  { id: '2bhk', label: '2 BHK', rooms: 4, windows: 5 },
  { id: '3bhk', label: '3 BHK', rooms: 6, windows: 7 },
  { id: '4bhk', label: '4 BHK', rooms: 8, windows: 9 },
  { id: 'villa', label: 'Villa / duplex', rooms: 11, windows: 13 },
];

export type Unit = 'room' | 'window' | 'home';

export type Item = {
  id: string;
  label: string;
  note: string;
  unit: Unit;
  low: number;
  high: number;
  /** ticked when the estimator first loads */
  default: boolean;
  /** matching service page */
  slug?: string;
};

// TODO: replace every low/high with real figures.
export const items: Item[] = [
  {
    id: 'switches',
    label: 'Smart switches',
    note: 'Touch panels or retrofit modules on the main circuits',
    unit: 'room',
    low: 11000,
    high: 17000,
    default: true,
    slug: 'smart-switches',
  },
  {
    id: 'voice',
    label: 'Voice & app control',
    note: 'Alexa and Google across the house, one app, scenes configured',
    unit: 'home',
    low: 9000,
    high: 15000,
    default: true,
    slug: 'voice-and-app',
  },
  {
    id: 'curtains',
    label: 'Motorised curtains',
    note: 'Per window — motor, track and commissioning',
    unit: 'window',
    low: 17000,
    high: 27000,
    default: false,
    slug: 'smart-curtains',
  },
  {
    id: 'climate',
    label: 'Climate & fan control',
    note: 'Per room — AC and fan control with a sensor',
    unit: 'room',
    low: 5500,
    high: 9000,
    default: false,
    slug: 'climate-and-environment',
  },
  {
    id: 'environment',
    label: 'Environment sensing',
    note: 'Per room — temperature, humidity and air quality driving scenes',
    unit: 'room',
    low: 3000,
    high: 5000,
    default: false,
    slug: 'climate-and-environment',
  },
  {
    id: 'security',
    label: 'Security & entry',
    note: 'Smart lock, video door phone and two cameras',
    unit: 'home',
    low: 26000,
    high: 46000,
    default: false,
    slug: 'security-and-entry',
  },
];

/** Design, commissioning and handover, as a share of hardware. */
export const installShare = { low: 0.12, high: 0.18 };

/** Annual service plan, benchmarked at 5–8% of installed value. */
export const amcShare = { low: 0.05, high: 0.08 };

export type Selection = {
  rooms: number;
  windows: number;
  chosen: string[];
};

export type Line = { label: string; qty: number; low: number; high: number };

export type Estimate = {
  lines: Line[];
  hardware: { low: number; high: number };
  install: { low: number; high: number };
  total: { low: number; high: number };
  amc: { low: number; high: number };
};

export function estimate({ rooms, windows, chosen }: Selection): Estimate {
  const lines: Line[] = [];

  for (const item of items) {
    if (!chosen.includes(item.id)) continue;
    const qty = item.unit === 'room' ? rooms : item.unit === 'window' ? windows : 1;
    if (qty <= 0) continue;
    lines.push({
      label: item.label,
      qty,
      low: item.low * qty,
      high: item.high * qty,
    });
  }

  const hardware = lines.reduce(
    (acc, l) => ({ low: acc.low + l.low, high: acc.high + l.high }),
    { low: 0, high: 0 },
  );
  const install = {
    low: Math.round(hardware.low * installShare.low),
    high: Math.round(hardware.high * installShare.high),
  };
  const total = {
    low: hardware.low + install.low,
    high: hardware.high + install.high,
  };
  const amc = {
    low: Math.round(total.low * amcShare.low),
    high: Math.round(total.high * amcShare.high),
  };

  return { lines, hardware, install, total, amc };
}

/** Indian digit grouping, no decimals — 130000 becomes "1,30,000". */
export function inr(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
