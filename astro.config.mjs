import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://penpenguin.github.io',
  base: '/suiren-aquarium/',
  trailingSlash: 'always',
});
