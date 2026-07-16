import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://anamata.ai',
  // S5: /approach and /anna folded into /about. On a static build these emit
  // meta-refresh stubs (accepted); server-level 301s are an S6 follow-up.
  redirects: {
    '/approach': '/about',
    '/anna': '/about',
  },
  integrations: [sitemap()],
  build: {
    // few small pages: inlining removes the render-blocking CSS request
    inlineStylesheets: 'always',
  },
});
