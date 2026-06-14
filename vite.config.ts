import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

function buildConnectSrc(mode: string, isElectronTarget: boolean): string {
  const supabaseConnect = "https://*.supabase.co wss://*.supabase.co";

  if (mode === "development") {
    return `'self' ${supabaseConnect} ws://localhost:5173 ws://127.0.0.1:5173 http://localhost:5173 http://127.0.0.1:5173 http://127.0.0.1:7501`;
  }

  if (isElectronTarget) {
    return `'self' ${supabaseConnect}`;
  }

  return `'self' ${supabaseConnect} https://*.vercel.app`;
}

function buildContentSecurityPolicy(mode: string, isElectronTarget: boolean): string {
  const scriptSrc =
    mode === "development"
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";

  return [
    "default-src 'self'",
    scriptSrc,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.supabase.co https:",
    "frame-src 'self' blob: data:",
    `connect-src ${buildConnectSrc(mode, isElectronTarget)}`,
  ].join("; ");
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
  const supabaseAnon = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const appTarget = env.VITE_APP_TARGET?.trim() || "web";
  const isElectronTarget = appTarget === "electron";

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
    base: isElectronTarget ? "./" : "/",
    server: {
      host: "::",
      port: 5173,
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
      {
        name: "html-csp",
        transformIndexHtml(html) {
          const csp = buildContentSecurityPolicy(mode, isElectronTarget);
          return html.replace(
            /<meta http-equiv="Content-Security-Policy" content="[^"]*"\s*\/?>/,
            `<meta http-equiv="Content-Security-Policy" content="${csp}">`
          );
        },
      },
    ],
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
