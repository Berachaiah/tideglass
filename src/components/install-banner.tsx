import { useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const KEY = "tideglass.install";
const WEEK = 7 * 24 * 60 * 60 * 1000;

function standalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function snoozed() {
  try {
    const at = Number(localStorage.getItem(KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < WEEK;
  } catch {
    return false;
  }
}

function isIos() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
}

export function InstallBanner() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [gone, setGone] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    if (standalone() || snoozed()) return;
    function onPrompt(e: Event) {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setGone(false);
    }
    function onInstalled() {
      setGone(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (isIos()) {
      setIos(true);
      setGone(false);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function later() {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setGone(true);
  }

  async function install() {
    if (!event) return;
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === "dismissed") later();
      else setGone(true);
    } catch {
      later();
    }
  }

  if (gone || (!event && !ios)) return null;

  return (
    <div className="sheet pointer-events-auto mx-auto w-full max-w-md px-4 pb-2">
      <div className="flex items-center gap-3 rounded-2xl border border-foam/10 bg-ink/85 px-4 py-3 backdrop-blur-md">
        <img src="/icons/icon-192.png" alt="" width={40} height={40} className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foam">Install Tideglass</p>
          <p className="text-xs text-mist">
            {event ? "Play full screen from your home screen." : "Tap Share, then Add to Home Screen."}
          </p>
        </div>
        {event ? (
          <button
            type="button"
            className="min-h-11 rounded-full bg-ember px-4 text-sm font-semibold text-ink"
            onClick={() => void install()}
          >
            Install
          </button>
        ) : null}
        <button type="button" className="min-h-11 px-2 text-sm text-mist" onClick={later}>
          {event ? "Not now" : "Got it"}
        </button>
      </div>
    </div>
  );
}
