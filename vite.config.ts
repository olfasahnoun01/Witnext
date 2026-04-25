import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: './',
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
    proxy: {
      '/functions/v1': {
        target: 'https://rnujsdxbkndvppjqjkdu.supabase.co',
        changeOrigin: true,
        secure: false,
      },
      '/rest/v1': {
        target: 'https://rnujsdxbkndvppjqjkdu.supabase.co',
        changeOrigin: true,
        secure: false,
      },
      '/auth/v1': {
        target: 'https://rnujsdxbkndvppjqjkdu.supabase.co',
        changeOrigin: true,
        secure: false,
      },
    }
  },

  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.png', 'robots.txt', 'placeholder.svg'],
      manifest: {
        name: 'Alpha',
        short_name: 'Grosafe',
        description: "Système de gestion d'entreprise pour Grosafe Équipement.",
        theme_color: '#ffffff',
        icons: [
          {
            src: 'favicon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'favicon.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor';
            }
            if (id.includes('recharts')) {
              return 'charts';
            }
            if (id.includes('@supabase/supabase-js')) {
              return 'supabase';
            }
            if (id.includes('@radix-ui/react-dialog') || id.includes('@radix-ui/react-dropdown-menu') || id.includes('@radix-ui/react-popover') || id.includes('@radix-ui/react-select')) {
              return 'ui';
            }
          }
        },
      },
    },
  },
}));
