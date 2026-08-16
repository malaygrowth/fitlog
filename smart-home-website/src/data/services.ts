/**
 * One page per service — the biggest structural lever on search traffic in
 * this category, because people search "smart curtains", not "home automation".
 *
 * Every page carries a `worries` block. Those five objections (cost, reliability,
 * obsolescence, privacy, complexity) are what actually block the purchase, and
 * almost no competitor site answers them. See docs/plan.html.
 */

export type Service = {
  slug: string;
  name: string;
  /** Shown in nav and cards */
  short: string;
  /** Page headline — kept to three lines or fewer at display size */
  headline: string;
  lede: string;
  /** The one line that reframes the service as an outcome */
  thesis: string;
  body: string[];
  detail: { label: string; value: string }[];
  worries: { q: string; a: string }[];
};

export const services: Service[] = [
  {
    slug: 'smart-switches',
    name: 'Smart switches',
    short: 'Switches',
    headline: 'Every switch in the house, still a switch',
    lede: 'Touch panels and retrofit modules that put your lights, fans and heavy loads on the app and on voice — while the wall switch keeps working exactly as it always did.',
    thesis: 'The best smart switch is the one your family never has to learn.',
    body: [
      'Two ways to do this. **Retrofit modules** sit behind your existing switch plates and leave the wiring, the plates and the paint untouched — the fastest route for a home you already live in. **Touch panels** replace the plate entirely with a glass front, which looks the part and gives you scene buttons on the wall, but wants a deeper back box and a little more planning.',
      'We survey before we quote, because the answer depends on your back boxes and your neutral wire, not on which product we would rather sell. If your boxes cannot take a panel, we will tell you at the survey rather than on install day.',
      'Heavy loads — geysers, air conditioners, water pumps — get rated modules sized for the current they actually draw. This is the part of a smart home that goes wrong when it is done cheaply, and it is not where to save money.',
    ],
    detail: [
      { label: 'Works with', value: 'Alexa, Google Assistant, one app' },
      { label: 'Wiring', value: 'Retrofit or full panel replacement' },
      { label: 'Install time', value: 'Most homes in a day' },
      { label: 'If the internet drops', value: 'Wall switches keep working' },
    ],
    worries: [
      {
        q: 'What happens when the Wi-Fi goes down?',
        a: 'The wall switch is still a wall switch. Every circuit we install keeps its manual control, so a dead router costs you the app and the voice control — never the lights.',
      },
      {
        q: 'Will this look like a gadget on my wall?',
        a: 'Come and see the finishes at survey. Panels are chosen to match your existing plate style and switch layout, not to announce themselves.',
      },
      {
        q: 'What if the brand stops supporting it in three years?',
        a: 'We lead with standards-based kit wherever it exists, so the switches keep talking to a hub even if the manufacturer’s own app disappears. Where a product is proprietary, we say so before you buy it.',
      },
    ],
  },
  {
    slug: 'smart-curtains',
    name: 'Smart curtains',
    short: 'Curtains',
    headline: 'Curtains that know what time it is',
    lede: 'Motorised tracks and rods for existing curtains and new ones — opening on a schedule, on a scene, on your voice, or on the sun itself.',
    thesis: 'The first automation guests notice, and the one owners use every single day.',
    body: [
      'Most homes can keep the curtains they already own. What changes is what they hang from: a motorised **track** for pleated and ripple-fold curtains, a motorised **rod** where the curtains are eyeleted, or a tubular motor for roller blinds. The fabric weight and the span decide the motor, which is why we measure rather than quote from a photograph.',
      'Noise is the thing people forget to ask about. A cheap motor is audible across a quiet bedroom at 6am, which is exactly when it runs. We specify quiet motors for bedrooms as a rule, not as an upgrade.',
      'Power is the other honest constraint. Battery tracks avoid new wiring and need charging once or twice a year; wired motors never need thinking about but want a point near the track. In a home you already live in, that choice is usually made for you by where the nearest socket is.',
    ],
    detail: [
      { label: 'Fits', value: 'Existing curtains, most tracks and rods' },
      { label: 'Power', value: 'Wired or rechargeable battery' },
      { label: 'Control', value: 'App, voice, schedule, sun position' },
      { label: 'Manual pull', value: 'Still works — a tug starts the motor' },
    ],
    worries: [
      {
        q: 'Do I have to replace my curtains?',
        a: 'Almost never. We motorise the track or rod underneath them. If your curtains are eyeleted onto a decorative rod, we will talk through the options at survey.',
      },
      {
        q: 'Will it wake the house up?',
        a: 'Bedrooms get quiet motors as standard. You are welcome to hear one running before you commit.',
      },
      {
        q: 'What if I just want to pull them by hand?',
        a: 'A gentle tug engages the motor and it takes over. Nobody in the house has to change how they open a curtain.',
      },
    ],
  },
  {
    slug: 'voice-and-app',
    name: 'Voice & app control',
    short: 'Voice & app',
    headline: 'One app. Or just say it out loud.',
    lede: 'Alexa and Google Assistant across the house, and every device you own gathered into a single app instead of the seven that came in the boxes.',
    thesis: 'A smart home with five apps is not a smart home. It is five remote controls.',
    body: [
      'The most common thing we fix in homes that already have some automation is app sprawl — lights in one app, the AC in another, the lock in a third, and nothing that can run all of them together. Consolidation is usually a bigger quality-of-life change than adding more devices.',
      'Voice is set up around how your family actually speaks. Room names match what you call the rooms, not what the installer typed. Scene names are the ones you would say out loud. We sit with you at handover and rename anything that does not come naturally.',
      'Where a device supports **Matter**, we use it, because it is the thing most likely to keep your house working when a brand changes its mind. Where a device does not, we will tell you what you are trading away.',
    ],
    detail: [
      { label: 'Assistants', value: 'Alexa and Google Assistant' },
      { label: 'Apps', value: 'Consolidated into one wherever possible' },
      { label: 'Standards', value: 'Matter-first where the device supports it' },
      { label: 'Handover', value: 'We rename anything that feels wrong' },
    ],
    worries: [
      {
        q: 'Is there a microphone listening to my house?',
        a: 'Only if you want speakers. Voice control is optional — the app and the wall switches do everything without a single microphone in the house. If you do want it, you choose which rooms.',
      },
      {
        q: 'My parents will never use an app.',
        a: 'They should not have to. The wall switches work, the scenes run on schedule, and voice needs no screen. The app is for the person in the house who enjoys it.',
      },
      {
        q: 'Can I keep the devices I already bought?',
        a: 'Usually yes. Bring the list to the survey and we will tell you honestly what integrates cleanly, what integrates awkwardly, and what is better replaced.',
      },
    ],
  },
  {
    slug: 'room-scenes',
    name: 'Room scenes',
    short: 'Scenes',
    headline: 'One tap. The whole room changes.',
    lede: 'Lights, curtains, fans and climate moving together on a single instruction — because nobody wants to operate eight devices to watch a film.',
    thesis: 'Nobody wants a smart switch. They want the house to already know it is evening.',
    body: [
      'A scene is the actual product. Everything else — the switches, the motors, the sensors — is how it gets built. **Good Morning** opens the curtains and leaves the lights off because there is enough sun. **Evening** warms the lights to sixty percent and half-draws the curtains. **Movie** drops to twenty and closes everything. **Leaving** kills every load in the house from a single tap at the door.',
      'We design scenes with you, in your home, after watching how you use the rooms. The list above is a starting point, not a menu — most families end up with four or five they use constantly and quietly delete the rest.',
      'Scenes can also run themselves. On a schedule, on sunset, on a sensor reading, or on the last person leaving. The best ones are the ones nobody remembers triggering, because they simply happen at the right time.',
    ],
    detail: [
      { label: 'Typical set', value: 'Four to six scenes per home' },
      { label: 'Triggers', value: 'Tap, voice, schedule, sunset, sensor' },
      { label: 'Designed', value: 'In your home, after the survey' },
      { label: 'Changed later', value: 'Any time — it is configuration, not wiring' },
    ],
    worries: [
      {
        q: 'What if we want to change a scene in six months?',
        a: 'Scenes are configuration, not wiring. Changing one takes minutes and does not need anybody in your house. It is covered under the service plan.',
      },
      {
        q: 'Will it do things we did not ask for?',
        a: 'Automatic triggers are opt-in, one at a time. Nothing runs on its own until you have said you want it to.',
      },
      {
        q: 'Is this just a fancy way of turning lights on?',
        a: 'It is the difference between eight actions and one. Try the demo on the homepage — that is a real scene, running.',
      },
    ],
  },
  {
    slug: 'climate-and-environment',
    name: 'Climate & environment',
    short: 'Climate',
    headline: 'A house that reacts to its own air',
    lede: 'Temperature, humidity and air quality measured room by room — and used to run the fans, the AC and the purifiers, not just to draw a graph.',
    thesis: 'A sensor that only reports is a thermometer. A sensor that acts is automation.',
    body: [
      'Most smart home sensors are decorative. They sit in an app showing a number nobody opens. The value is in wiring the reading to an action: the bedroom AC coming on when the room passes twenty-eight, the exhaust running when the kitchen humidity spikes, the purifier starting when the outdoor AQI climbs — and all of it stopping when the room is empty.',
      'Per-room control also happens to be the part of a smart home that pays for itself. Cooling the room somebody is in rather than the floor they are on is where the electricity bill actually moves, and it is a more honest saving than anything on a brochure.',
      'We will not promise you a percentage. What we will do is show you the consumption data after a month so you can see it for yourself.',
    ],
    detail: [
      { label: 'Measured', value: 'Temperature, humidity, air quality' },
      { label: 'Controls', value: 'AC, fans, exhausts, purifiers' },
      { label: 'Granularity', value: 'Per room, not per house' },
      { label: 'Reporting', value: 'Monthly consumption you can check' },
    ],
    worries: [
      {
        q: 'Does this actually cut the bill?',
        a: 'Per-room control usually does, because you stop conditioning empty rooms. We will not put a number on it before your install — we will show you the data after.',
      },
      {
        q: 'What if the automation gets it wrong?',
        a: 'Every automatic rule has a manual override on the wall and in the app, and we tune the thresholds with you over the first few weeks.',
      },
      {
        q: 'Do the sensors need the internet?',
        a: 'The rules run locally where the hardware allows it, so the house keeps behaving during an outage. Remote access and history are the parts that need a connection.',
      },
    ],
  },
  {
    slug: 'security-and-entry',
    name: 'Security & entry',
    short: 'Security',
    headline: 'Who is at the door, from wherever you are',
    lede: 'Smart locks, video door phones and cameras, tied into the same scenes as everything else — so leaving the house is one action, not a checklist.',
    thesis: 'Security is the reason most people start. Scenes are the reason they stay.',
    body: [
      'Entry is where automation earns trust fastest. A lock you can open for the maid without being home, a door phone that reaches your phone rather than a handset in the hallway, and a camera that only records when the house is empty — these are the features people describe to their friends.',
      'The best version of this is not a separate security system bolted on. It is entry tied to the scenes: the door unlocking runs **Welcome**, the last person leaving runs **Away** and arms everything behind them.',
      'Every smart lock we fit keeps a physical key or a keypad fallback. A lock that can be defeated by a flat battery is not a security product.',
    ],
    detail: [
      { label: 'Entry', value: 'Smart locks with key or keypad fallback' },
      { label: 'Door', value: 'Video door phone to your phone' },
      { label: 'Cameras', value: 'Local recording where you want it' },
      { label: 'Tied to', value: 'Welcome and Away scenes' },
    ],
    worries: [
      {
        q: 'Where does the camera footage go?',
        a: 'Wherever you choose. We will happily configure local-only recording with nothing leaving the house. If you want cloud clips for remote viewing, that is a decision you make, not a default we set.',
      },
      {
        q: 'What if the lock battery dies?',
        a: 'Every lock we fit has a physical key or keypad fallback, and the app warns you weeks before the battery is low.',
      },
      {
        q: 'Can it be hacked?',
        a: 'It is a fair question and the honest answer is that any connected device carries risk. We reduce it the boring way: a separate network for the devices, no default passwords, and firmware kept current under the service plan.',
      },
    ],
  },
];

export const serviceBySlug = (slug: string) => services.find((s) => s.slug === slug);
