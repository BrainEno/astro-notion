import { defineConfig } from 'astro/config';
import netlify from "@astrojs/netlify";
import icon from 'astro-icon'

import react from "@astrojs/react";
import { CUSTOM_DOMAIN, BASE_PATH } from './src/server-constants';
import CoverImageDownloader from './src/integrations/cover-image-downloader'
import FeaturedImageDownloader from './src/integrations/cover-image-downloader'
import PublicNotionCopier from './src/integrations/public-notion-copier'
import CustomIconDownloader from './src/integrations/custom-icon-downloader';

const getSite = function () {
  if (CUSTOM_DOMAIN) {
    return new URL(BASE_PATH, `https://${CUSTOM_DOMAIN}`).toString();
  }

  if (process.env.VERCEL && process.env.VERCEL_URL) {
    return new URL(BASE_PATH, `https://${process.env.VERCEL_URL}`).toString();
  }

  if (process.env.CF_PAGES) {
    if (process.env.CF_PAGES_BRANCH !== 'main') {
      return new URL(BASE_PATH, process.env.CF_PAGES_URL).toString();
    }

    return new URL(
      BASE_PATH,
      `https://${new URL(process.env.CF_PAGES_URL).host
        .split('.')
        .slice(1)
        .join('.')}`
    ).toString();
  }
  return new URL(BASE_PATH, 'http://localhost:4321').toString()
}


// https://astro.build/config
export default defineConfig({
  site: getSite(),
  base: BASE_PATH,
  publicDir: './public',
  outDir: './dist',
  vite: {
    plugins: [{
      name: 'import.meta.url-transformer',
      transform: (code, id) => {
        if (id.endsWith('.astro')) return code.replace(/import.meta.url/g, `"${id}"`);
      }
    }],
    ssr: {
      external: ['svgo']
    }
  },
  integrations: [
    icon(),
    react(),
    CoverImageDownloader(),
    CustomIconDownloader(),
    FeaturedImageDownloader(),
    PublicNotionCopier()
  ],
  output: "server",
  adapter: netlify({
    edgeMiddleware: true
  })
});