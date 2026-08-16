/**
 * Cost guides and comparisons — the pages with buying intent behind them.
 *
 * Each one funnels into the estimator. Write them to be genuinely the best
 * answer to the question, not to hit a keyword; the queries in this category
 * are winnable precisely because most competitor content is thin.
 *
 * Blocks are deliberately minimal: h2, p, ul, note. Add types only when a real
 * article needs one.
 */

export type Block =
  | { t: 'h2'; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'note'; text: string };

export type Article = {
  slug: string;
  title: string;
  /** The query this page is the answer to */
  question: string;
  summary: string;
  updated: string;
  readTime: string;
  body: Block[];
};

export const articles: Article[] = [
  {
    slug: 'home-automation-cost-india',
    title: 'What home automation actually costs in India',
    question: 'How much does home automation cost?',
    summary:
      'Real ranges by home size, what drives the number up, and the order to spend in if you cannot do everything at once.',
    updated: '2026-08-15',
    readTime: '6 min',
    body: [
      {
        t: 'p',
        text: 'The honest answer is that a core setup for a 2 BHK lands somewhere around ₹1.3 lakh, and that the number moves a long way in both directions depending on three things: how many rooms you actually automate, whether you want curtains, and whether you are retrofitting or wiring from scratch.',
      },
      {
        t: 'p',
        text: 'Published benchmarks across the Indian market put a core package — smart switch boards, a lock, motorised curtains and a video door phone — at roughly ₹80,000 for a 1 BHK, ₹1.3 lakh for a 2 BHK and ₹1.8 lakh for a 3 BHK. Full-villa work with everything specified runs ₹3–5 lakh. Those are useful anchors, not quotes.',
      },
      { t: 'h2', text: 'What actually drives the number' },
      {
        t: 'ul',
        items: [
          'Room count, not floor area. Automation is priced per circuit, so a compact 3 BHK with many small rooms can cost more than a large open-plan 2 BHK.',
          'Curtains. Motorised tracks are usually the single largest line after switching, and they are priced per window.',
          'Heavy loads. Geysers, air conditioners and pumps need correctly rated modules. This is not where to economise.',
          'Retrofit versus new wiring. Retrofit modules avoid civil work entirely. Touch panels look better and need deeper back boxes, which may mean chiselling in an existing home.',
          'Security. Locks, cameras and a video door phone add a meaningful chunk and are often better phased into year two.',
        ],
      },
      { t: 'h2', text: 'What is usually excluded' },
      {
        t: 'p',
        text: 'Almost every quote you receive will exclude civil and electrical work, false ceiling, and any rewiring your home turns out to need once a switch box is opened. Ask about this explicitly before you compare two quotes, because one of them has probably left it out and the other has not.',
      },
      { t: 'h2', text: 'The order to spend in' },
      {
        t: 'p',
        text: 'If the whole thing is more than you want to commit at once, this is the sequence that gives you the most for the least, in our experience:',
      },
      {
        t: 'ul',
        items: [
          'Lighting and fan switching in the rooms you use most. Cheapest, and it is what makes scenes possible at all.',
          'Voice and app consolidation. Almost free once the switches are in, and it is the part your family will actually notice.',
          'Curtains in the bedroom. The single most-used automation in most homes.',
          'Climate control. Starts paying for itself if you stop cooling empty rooms.',
          'Security and entry. Valuable, but it works fine as a later phase.',
        ],
      },
      {
        t: 'note',
        text: 'A word on cheap quotes: the two places corners get cut are load ratings on heavy appliances and the quality of curtain motors. Both are invisible on the invoice and obvious two years later.',
      },
      { t: 'h2', text: 'What about the running cost?' },
      {
        t: 'p',
        text: 'Budget for an annual service plan from year two. The industry benchmark for integrator service contracts is 5–8% of installed value per year, which on a ₹1.5 lakh install is roughly ₹8,000–12,000. Whether you need one depends mostly on whether you have things with batteries and moving parts — curtains and locks — rather than on the size of the house.',
      },
    ],
  },
  {
    slug: 'retrofit-modules-vs-touch-panels',
    title: 'Retrofit modules or touch panels?',
    question: 'Should I get smart switch panels or retrofit modules?',
    summary:
      'The decision that shapes cost, install time and how much of your home gets disturbed — explained without a sales pitch.',
    updated: '2026-08-15',
    readTime: '5 min',
    body: [
      {
        t: 'p',
        text: 'There are two ways to make the switches in an Indian home smart, and which one suits you is mostly decided by your back boxes rather than by your taste. It is worth understanding before anyone quotes you, because the two approaches are priced very differently.',
      },
      { t: 'h2', text: 'Retrofit modules' },
      {
        t: 'p',
        text: 'Small relay modules that sit inside your existing switch box, behind the plate you already have. Your switches look exactly the same and keep working the same way; they simply also answer to the app and to voice.',
      },
      {
        t: 'ul',
        items: [
          'No chiselling, no repainting, no plates to match',
          'Cheapest route, and the fastest — most homes in a day',
          'Works with the switch plates you already chose',
          'No scene buttons on the wall, so scenes run from the app, voice or schedule',
          'Needs enough depth behind the plate, which is the catch',
        ],
      },
      { t: 'h2', text: 'Touch panels' },
      {
        t: 'p',
        text: 'The whole plate is replaced with a glass touch panel. It looks like a smart home, and it gives you physical scene buttons on the wall, which matters more than people expect — guests and grandparents use wall buttons, not apps.',
      },
      {
        t: 'ul',
        items: [
          'Scene buttons on the wall, which is a real usability gain',
          'A deliberate, finished look, especially in a new build',
          'Needs a deeper back box — in an existing home that can mean chiselling',
          'Needs a neutral wire at every switch position',
          'More expensive per circuit, and slower to install',
        ],
      },
      { t: 'h2', text: 'How to decide in thirty seconds' },
      {
        t: 'p',
        text: 'If you are living in the home already and do not want the disruption, retrofit. If the walls are open, or you are renovating anyway, panels — you will never get a cheaper chance to do it properly. If you are somewhere in between, a common and sensible answer is panels in the living room and main bedroom where they are seen, retrofit everywhere else.',
      },
      {
        t: 'note',
        text: 'Whichever you choose, insist that the manual switch keeps working. Any installation that leaves your lights dependent on a working router has been done badly.',
      },
      { t: 'h2', text: 'The question to ask at survey' },
      {
        t: 'p',
        text: 'Ask the installer to open one of your switch boxes and measure the depth in front of you, and ask whether you have a neutral wire at that position. Anyone who will not do that before quoting is guessing, and the guess gets corrected on install day at your expense.',
      },
    ],
  },
];

export const articleBySlug = (slug: string) => articles.find((a) => a.slug === slug);
