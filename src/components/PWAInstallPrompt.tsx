import { useEffect, useRef, useState } from "react";
import { Share, X } from "lucide-react";
import posthog from "posthog-js";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISSED_KEY = "pwa_install_dismissed";

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
};

const isMobile = () => typeof window !== "undefined" && window.innerWidth < 768;

const isIOS = () =>
  typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

const PWAInstallPrompt = () => {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosMode, setIosMode] = useState(false);
  const promptedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY) === "1") return;
    if (!isMobile()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setIosMode(false);
      setVisible(true);
      if (!promptedRef.current) {
        promptedRef.current = true;
        try {
          posthog.capture("pwa_install_prompted");
        } catch {
          /* analytics not initialized */
        }
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS fallback — no beforeinstallprompt support
    if (isIOS()) {
      setIosMode(true);
      setVisible(true);
      if (!promptedRef.current) {
        promptedRef.current = true;
        try {
          posthog.capture("pwa_install_prompted");
        } catch {
          /* noop */
        }
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const handleAdd = async () => {
    const dp = deferredPromptRef.current;
    if (!dp) return;
    try {
      posthog.capture("pwa_install_accepted");
    } catch {
      /* noop */
    }
    try {
      await dp.prompt();
      await dp.userChoice;
    } catch {
      /* user closed prompt */
    }
    deferredPromptRef.current = null;
    setVisible(false);
  };

  const handleDismiss = () => {
    try {
      posthog.capture("pwa_install_dismissed");
    } catch {
      /* noop */
    }
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* noop */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 px-3 pb-3 pointer-events-none"
      role="dialog"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto mx-auto max-w-md w-full rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: "#4a7c59", color: "white" }}
      >
        <span className="text-2xl flex-shrink-0" aria-hidden>
          🐱
        </span>
        <div className="flex-1 min-w-0 text-sm font-semibold leading-snug">
          {iosMode ? (
            <span className="flex items-center gap-1.5 flex-wrap">
              Tap <Share className="w-4 h-4 inline-block" /> Share → "Add to Home Screen"
            </span>
          ) : (
            <span>Add TidyMate to your home screen</span>
          )}
        </div>
        {!iosMode && (
          <button
            onClick={handleAdd}
            className="flex-shrink-0 rounded-full bg-white text-[#4a7c59] font-bold text-xs px-4 py-2 active:scale-95 transition-transform"
          >
            Add
          </button>
        )}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
