import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://anamata.ai',
  integrations: [sitemap()],
  build: {
    // few small pages: inlining removes the render-blocking CSS request
    inlineStylesheets: 'always',
  },
});
