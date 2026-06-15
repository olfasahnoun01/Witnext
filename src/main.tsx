import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// iOS Safari and some mobile browsers lack requestIdleCallback
if (typeof window.requestIdleCallback !== "function") {
  window.requestIdleCallback = (callback) =>
    window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 1);
  window.cancelIdleCallback = (id) => window.clearTimeout(id);
}

createRoot(document.getElementById("root")!).render(<App />);
