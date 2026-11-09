import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves this repository under /NEXUS-/.
  // An absolute base prevents mobile browsers from resolving built JS
  // bundles against an unexpected relative path.
  base: '/NEXUS-/',
});
