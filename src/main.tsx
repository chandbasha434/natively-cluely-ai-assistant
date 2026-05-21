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
        if (prop === "getRecognitionLanguages") {
          return () => Promise.resolve({
            'auto': { label: 'Auto Detect', code: 'auto', bcp47: 'auto', iso639: 'auto', group: 'Auto' },
            'english-us': { label: 'United States', code: 'english-us', bcp47: 'en-US', iso639: 'en', group: 'English', primary: 'en-US', alternates: ['en-GB', 'en-IN', 'en-AU', 'en-CA'] },
            'english-uk': { label: 'United Kingdom', code: 'english-uk', bcp47: 'en-GB', iso639: 'en', group: 'English', primary: 'en-GB', alternates: ['en-US', 'en-IN', 'en-AU', 'en-CA'] },
            'english-in': { label: 'India', code: 'english-in', bcp47: 'en-IN', iso639: 'en', group: 'English', primary: 'en-IN', alternates: ['en-US', 'en-GB', 'en-AU', 'en-CA'] },
            'english-au': { label: 'Australia', code: 'english-au', bcp47: 'en-AU', iso639: 'en', group: 'English', primary: 'en-AU', alternates: ['en-US', 'en-GB', 'en-IN', 'en-CA'] },
            'english-ca': { label: 'Canada', code: 'english-ca', bcp47: 'en-CA', iso639: 'en', group: 'English', primary: 'en-CA', alternates: ['en-US', 'en-GB', 'en-IN', 'en-AU'] },
            'indonesian': { label: 'Indonesian', code: 'indonesian', bcp47: 'id-ID', iso639: 'id', group: 'Indonesian' },
            'russian': { label: 'Russian', code: 'russian', bcp47: 'ru-RU', iso639: 'ru', group: 'Russian' },
            'spanish': { label: 'Spanish', code: 'spanish', bcp47: 'es-ES', iso639: 'es', group: 'Spanish' },
            'french': { label: 'French', code: 'french', bcp47: 'fr-FR', iso639: 'fr', group: 'French' },
            'german': { label: 'German', code: 'german', bcp47: 'de-DE', iso639: 'de', group: 'German' },
            'italian': { label: 'Italian', code: 'italian', bcp47: 'it-IT', iso639: 'it', group: 'Italian' },
            'portuguese': { label: 'Portuguese', code: 'portuguese', bcp47: 'pt-PT', iso639: 'pt', group: 'Portuguese' },
            'japanese': { label: 'Japanese', code: 'japanese', bcp47: 'ja-JP', iso639: 'ja', group: 'Japanese' },
            'korean': { label: 'Korean', code: 'korean', bcp47: 'ko-KR', iso639: 'ko', group: 'Korean' },
            'chinese': { label: 'Chinese (Simplified)', code: 'chinese', bcp47: 'zh-CN', iso639: 'zh', group: 'Chinese' },
            'turkish': { label: 'Turkish', code: 'turkish', bcp47: 'tr-TR', iso639: 'tr', group: 'Turkish' },
            'ukrainian': { label: 'Ukrainian', code: 'ukrainian', bcp47: 'uk-UA', iso639: 'uk', group: 'Ukrainian' }
          });
        }
        if (prop === "getAiResponseLanguages") {
          return () => Promise.resolve([
            { label: 'Auto (Detect)', code: 'auto' },
            { label: 'English', code: 'English' },
            { label: 'Indonesian', code: 'Indonesian' },
            { label: 'Russian', code: 'Russian' },
            { label: 'Spanish', code: 'Spanish' },
            { label: 'French', code: 'French' },
            { label: 'German', code: 'German' },
            { label: 'Italian', code: 'Italian' },
            { label: 'Portuguese', code: 'Portuguese' },
            { label: 'Japanese', code: 'Japanese' },
            { label: 'Korean', code: 'Korean' },
            { label: 'Chinese', code: 'Chinese' },
            { label: 'Turkish', code: 'Turkish' },
            { label: 'Ukrainian', code: 'Ukrainian' }
          ]);
        }
        if (prop === "getInputDevices") {
          return () => Promise.resolve([{ id: 'default', name: 'Default Microphone' }]);
        }
        if (prop === "getOutputDevices") {
          return () => Promise.resolve([{ id: 'default', name: 'Default Speaker' }]);
        }
        if (prop === "getSttLanguage") {
          return () => Promise.resolve('english-us');
        }
        if (prop === "getAiResponseLanguage") {
          return () => Promise.resolve('auto');
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
          if (prop.startsWith("get")) {
            // Return a safe mock array that acts as both an empty array (for iteration/array destructuring)
            // and an object (for property access/object destructuring) to prevent browser exceptions.
            const mockArr: any = [];
            mockArr.success = true;
            return Promise.resolve(mockArr);
          }
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
