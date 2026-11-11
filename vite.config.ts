import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves this repository under /NEXUS-/.
  // An absolute base prevents mobile browsers from resolving built JS
  // bundles against an unexpected relative path.
  base: '/NEXUS-/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-vendor';
          if (id.includes('/node_modules/@supabase/')) return 'supabase-vendor';
          if (id.includes('/node_modules/lucide-react/')) return 'icons-vendor';
        },
      },
    },
  },
});
