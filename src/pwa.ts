// Auto-update service worker: when a new build is deployed, the SW detects it,
// activates immediately, and reloads the page so every browser gets the new version.
import { registerSW } from "virtual:pwa-register";

let registrationPollId: ReturnType<typeof setInterval> | null = null;
let pageHideListenerAttached = false;

const clearRegistrationPoll = () => {
  if (registrationPollId != null) {
    clearInterval(registrationPollId);
    registrationPollId = null;
  }
};

export const initPWA = () => {
  if (typeof window === "undefined") return;

  if (!pageHideListenerAttached) {
    pageHideListenerAttached = true;
    window.addEventListener("pagehide", clearRegistrationPoll);
  }

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      clearRegistrationPoll();
      registrationPollId = setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 1000);
    },
  });
};
