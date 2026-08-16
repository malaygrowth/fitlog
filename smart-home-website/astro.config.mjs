// @ts-check
import { defineConfig } from 'astro/config';

// Static output — the whole site is prerendered. See docs/plan.html for why.
export default defineConfig({
  site: 'https://example.com', // TODO: real domain once chosen
  output: 'static',
  build: { inlineStylesheets: 'auto' },
});
