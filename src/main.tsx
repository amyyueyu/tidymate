import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAnalytics } from "./lib/analytics";
import { LanguageProvider } from "@/contexts/LanguageContext";

initAnalytics();

// Unregister any service workers when running inside the Lovable preview iframe
// or on a preview host — service workers cause stale-content issues there.
(() => {
  if (typeof window === "undefined") return;
  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }
  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") || host.includes("lovableproject.com");
  if ((inIframe || isPreviewHost) && "serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    }).catch(() => { /* noop */ });
  }
})();

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>
);
