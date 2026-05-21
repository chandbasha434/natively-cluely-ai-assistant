import React from "react"
import ReactDOM from "react-dom/client"

// Inject a mock window.electronAPI if it doesn't exist (e.g. running in web browser)
if (typeof window !== "undefined" && !window.electronAPI) {
  const dummyUnsubscribe = () => () => {};

  (window as any).electronAPI = new Proxy({}, {
    get(target: any, prop: string | symbol) {
      if (prop === "platform") {
        return "web";
      }

      if (prop in target) {
        return target[prop];
      }

      if (typeof prop === "string") {
        // Event listeners starting with 'on' return an unsubscribe function
        if (prop.startsWith("on")) {
          return dummyUnsubscribe;
        }

        // Return suitable defaults for getters/functions returning state
        if (prop === "getThemeMode") {
          return () => Promise.resolve({ mode: "dark", resolved: "dark" });
        }
        if (prop === "checkPermissions") {
          return () => Promise.resolve({
            microphone: "granted",
            screen: "granted",
            platform: "web"
          });
        }
        if (prop === "getRecentMeetings") {
          return () => Promise.resolve([]);
        }
        if (prop === "getUpcomingEvents") {
          return () => Promise.resolve([]);
        }
        if (prop === "getStoredCredentials") {
          return () => Promise.resolve({
            hasNativelyKey: false,
            hasGeminiKey: false,
            hasGroqKey: false,
            hasOpenaiKey: false,
            hasClaudeKey: false,
            hasNvidiaKey: false,
            googleServiceAccountPath: null,
            sttProvider: "none",
            hasSttGroqKey: false,
            hasSttOpenaiKey: false,
            hasDeepgramKey: false,
            hasElevenLabsKey: false,
            hasAzureKey: false,
            azureRegion: "",
            hasIbmWatsonKey: false,
            ibmWatsonRegion: ""
          });
        }
        if (prop === "modesGetAll") {
          return () => Promise.resolve([]);
        }
        if (prop === "modesGetActive") {
          return () => Promise.resolve(null);
        }
        if (prop === "getCalendarStatus") {
          return () => Promise.resolve({ connected: false });
        }
        if (prop === "getNativeAudioStatus") {
          return () => Promise.resolve({ connected: false });
        }
        if (prop === "openExternal") {
          return (url: string) => {
            window.open(url, "_blank");
            return Promise.resolve();
          };
        }
        if (prop === "getArch") {
          return () => Promise.resolve("web");
        }
        if (prop === "getOsVersion") {
          return () => Promise.resolve("web");
        }
        if (prop === "getActionButtonMode") {
          return () => Promise.resolve("recap");
        }
        if (prop === "getTrialStatus") {
          return () => Promise.resolve({ ok: true, expired: false, remaining_ms: 86400000 });
        }
        if (prop === "getLocalTrial") {
          return () => Promise.resolve({ hasToken: false });
        }
        if (prop === "getDonationStatus") {
          return () => Promise.resolve({ shouldShow: false, hasDonated: false, lifetimeShows: 0 });
        }
        if (prop === "getKeybinds") {
          return () => Promise.resolve([]);
        }
        if (prop === "profileGetStatus") {
          return () => Promise.resolve({ hasProfile: false, profileMode: false });
        }
        if (prop === "profileGetNotes") {
          return () => Promise.resolve({ success: true, content: "" });
        }
        if (prop === "getCustomProviders") {
          return () => Promise.resolve([]);
        }
        if (prop === "getGroqFastTextMode") {
          return () => Promise.resolve({ enabled: false });
        }
        if (prop === "getDefaultModel") {
          return () => Promise.resolve({ model: "" });
        }
        if (prop === "licenseCheckPremium" || prop === "licenseCheckPremiumAsync") {
          return () => Promise.resolve(false);
        }
        if (prop === "licenseGetDetails") {
          return () => Promise.resolve({ isPremium: false });
        }
        if (prop === "licenseGetHardwareId") {
          return () => Promise.resolve("web-hardware-id");
        }

        // Generic fallback for any other method
        return (...args: any[]) => {
          console.warn(`[Electron API Mock] Called unhandled method: ${prop}`, args);
          return Promise.resolve({ success: true });
        };
      }
    }
  });
}

import App from "./App"
import "./index.css"

const THEME_CACHE_KEY = 'natively_resolved_theme';

// Set platform attribute synchronously — before React renders — so CSS selectors
// like html[data-platform="win32"] work immediately without a flash on first paint.
document.documentElement.setAttribute(
  'data-platform',
  window.electronAPI?.platform ?? (typeof process !== 'undefined' ? process?.platform : 'web')
);

// Step 1: Apply cached theme synchronously — before React renders.
// This ensures useResolvedTheme()'s initial useState read sees the correct value.
const cachedTheme = localStorage.getItem(THEME_CACHE_KEY) as 'light' | 'dark' | null;
document.documentElement.setAttribute('data-theme', cachedTheme ?? 'dark');

// Step 2: Confirm/correct from main process (authoritative) and keep cache in sync.
if (window.electronAPI?.getThemeMode) {
  window.electronAPI.getThemeMode().then(({ resolved }) => {
    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem(THEME_CACHE_KEY, resolved);
  });

  window.electronAPI?.onThemeChanged?.(({ resolved }) => {
    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem(THEME_CACHE_KEY, resolved);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
