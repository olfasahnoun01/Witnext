// Auto-update service worker: when a new build is deployed, the SW detects it,
// activates immediately, and reloads the page so every browser gets the new version.
import { registerSW } from "virtual:pwa-register";

export const initPWA = () => {
  if (typeof window === "undefined") return;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // New version available — activate it and reload right away.
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Poll for updates every 60s so long-open tabs catch new deploys.
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 1000);
    },
  });
};
