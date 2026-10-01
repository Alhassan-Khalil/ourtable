import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// base './' keeps the build portable: works on Cloudflare Pages, GitHub Pages (sub-path), or any static host.
export default defineConfig({
  base: './',
  plugins: [preact()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
