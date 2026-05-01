import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
  const supabaseAnon = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!supabaseUrl || !supabaseAnon) {
    throw new Error(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and set both (same values as in Supabase Dashboard → API)."
    );
  }

  let proxyTarget: string;
  try {
    proxyTarget = new URL(supabaseUrl).origin;
  } catch {
    throw new Error("VITE_SUPABASE_URL in .env.local must be a valid URL.");
  }

  return {
    base: "./",
    server: {
      host: "::",
      port: 8080,
      strictPort: true,
      proxy: {
        "/functions/v1": {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
        },
        "/rest/v1": {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
        },
        "/auth/v1": {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },

    plugins: [
      react(),
      mode === "development" && componentTagger(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "favicon.png", "robots.txt", "placeholder.svg"],
        manifest: {
          name: "Alpha",
          short_name: "Grosafe",
          description: "Système de gestion d'entreprise pour Grosafe Équipement.",
          theme_color: "#ffffff",
          icons: [
            {
              src: "favicon.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "favicon.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "favicon.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
      }),
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
            if (id.includes("node_modules")) {
              if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) {
                return "vendor";
              }
              if (id.includes("recharts")) {
                return "charts";
              }
              if (id.includes("@supabase/supabase-js")) {
                return "supabase";
              }
              if (
                id.includes("@radix-ui/react-dialog") ||
                id.includes("@radix-ui/react-dropdown-menu") ||
                id.includes("@radix-ui/react-popover") ||
                id.includes("@radix-ui/react-select")
              ) {
                return "ui";
              }
            }
          },
        },
      },
    },
  };
});
