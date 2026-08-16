/**
 * Case studies.
 *
 * Every entry below is marked `placeholder: true` and carries no client name,
 * no quote and no photograph, because inventing those would put fabricated
 * testimonials on a live site. The templates are finished — swap in real
 * installs, drop `placeholder`, and the warning banner disappears by itself.
 *
 * What to capture on each job, from the plan: the brief, the kit installed,
 * the timeline, and the actual spend. One honest project page with a real
 * number on it beats twenty stock photographs.
 */

export type Project = {
  slug: string;
  /** Set false once this is a real install with real photography. */
  placeholder: boolean;
  name: string;
  homeType: string;
  area: string;
  /** Kept vague until real jobs land */
  spend: string;
  duration: string;
  brief: string;
  installed: string[];
  scenes: { name: string; what: string }[];
  outcome: string;
};

export const projects: Project[] = [
  {
    slug: 'two-bed-retrofit',
    placeholder: true,
    name: 'Two-bed retrofit',
    homeType: '2 BHK apartment',
    area: 'TODO — locality',
    spend: '₹—',
    duration: '2 days',
    brief:
      'A family already living in the flat, no appetite for chiselled walls or repainting. Everything had to go in behind the existing switch plates over a weekend.',
    installed: [
      'Retrofit switch modules on all lighting and fan circuits',
      'Rated module for the bedroom AC',
      'Voice control in the living room and main bedroom',
      'One app replacing three',
    ],
    scenes: [
      { name: 'Good morning', what: 'Bedroom lights off, living room on, fan to low' },
      { name: 'Evening', what: 'Warm lighting at 60%, balcony light on at sunset' },
      { name: 'Leaving', what: 'Every load off from the front door' },
    ],
    outcome:
      'TODO — what the family actually says they use daily, six weeks on. This is the most persuasive sentence on the page; get it from a real handover call.',
  },
  {
    slug: 'three-bed-curtains-and-climate',
    placeholder: true,
    name: 'Three-bed, curtains and climate',
    homeType: '3 BHK apartment',
    area: 'TODO — locality',
    spend: '₹—',
    duration: '4 days',
    brief:
      'Owners wanted the curtains and the air conditioning to run themselves. Bedrooms needed quiet motors — the tracks run directly above the beds.',
    installed: [
      'Motorised tracks on seven windows, quiet motors in all bedrooms',
      'Smart switches throughout',
      'Per-room climate control with temperature and humidity sensing',
      'Voice control in every room',
    ],
    scenes: [
      { name: 'Wake', what: 'Curtains open at 6:40, lights stay off' },
      { name: 'Afternoon', what: 'West-facing curtains close as the sun comes round' },
      { name: 'Movie', what: 'Lights to 20%, all curtains closed, AC down a degree' },
      { name: 'Away', what: 'Everything off, curtains closed, sensors armed' },
    ],
    outcome:
      'TODO — the afternoon curtain automation is usually the one people mention. Confirm before writing it up.',
  },
  {
    slug: 'villa-new-build',
    placeholder: true,
    name: 'Villa, designed before the walls closed',
    homeType: 'Villa, new build',
    area: 'TODO — locality',
    spend: '₹—',
    duration: '9 days across two site visits',
    brief:
      'Specified alongside the electrical contractor at the conduit stage, which meant deeper back boxes, a proper network rack, and no compromises made after the fact.',
    installed: [
      'Full touch-panel switching across every room',
      'Motorised curtains and blinds throughout',
      'Whole-home climate and environment sensing',
      'Smart locks, video door phone and cameras',
      'A commissioning session with the family',
    ],
    scenes: [
      { name: 'Welcome', what: 'Door unlocks, entrance and hall lights on' },
      { name: 'Entertaining', what: 'Ground floor lit, curtains open, music zones on' },
      { name: 'Good night', what: 'Whole house down, bedrooms dimmed, entry armed' },
      { name: 'Away', what: 'Everything off, cameras on, one tap at the door' },
    ],
    outcome:
      'TODO — for new builds the useful line is what specifying early saved versus retrofitting later. Get the electrician to say it.',
  },
];

export const projectBySlug = (slug: string) => projects.find((p) => p.slug === slug);
