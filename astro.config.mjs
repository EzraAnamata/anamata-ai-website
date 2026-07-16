import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://anamata.ai',
  // S5: /approach and /anna folded into /about. On a static build these emit
  // meta-refresh stubs (accepted deployed behaviour). S6: true HTTP 301s are a
  // one-time manual Caddyfile edit — see deploy/redirects.caddy (outside the
  // dist/-only deploy pipeline).
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
