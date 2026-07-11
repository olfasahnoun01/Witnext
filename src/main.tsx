import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// iOS Safari and some mobile browsers lack requestIdleCallback
if (typeof window.requestIdleCallback !== "function") {
  window.requestIdleCallback = (callback) =>
    window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 1);
  window.cancelIdleCallback = (id) => window.clearTimeout(id);
}

/** After a deploy, stale HTML can point at deleted hashed assets (404 text/plain). Reload once. */
const ASSET_RELOAD_KEY = "witnext-stale-asset-reload";

function reloadOnceForStaleAssets() {
  if (sessionStorage.getItem(ASSET_RELOAD_KEY)) return;
  sessionStorage.setItem(ASSET_RELOAD_KEY, "1");
  window.location.reload();
}

function hasBrokenHashedStylesheet() {
  const links = document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="/assets/"]');
  for (const link of links) {
    if (!link.sheet) return true;
  }
  return false;
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnceForStaleAssets();
});

const checkStylesAfterLoad = () => {
  if (hasBrokenHashedStylesheet()) reloadOnceForStaleAssets();
};

if (document.readyState === "complete") {
  checkStylesAfterLoad();
} else {
  window.addEventListener("load", checkStylesAfterLoad);
}

createRoot(document.getElementById("root")!).render(<App />);
