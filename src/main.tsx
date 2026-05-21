import React from "react"
import ReactDOM from "react-dom/client"

// Inject a mock window.electronAPI if it doesn't exist (e.g. running in web browser)
if (typeof window !== "undefined" && !window.electronAPI) {
  const listeners: Record<string, Function[]> = {};

  // ── LocalStorage helpers ──────────────────────────────────────────
  const LS = {
    get: (key: string) => { try { return localStorage.getItem(key); } catch { return null; } },
    set: (key: string, val: string) => { try { localStorage.setItem(key, val); } catch {} },
    del: (key: string) => { try { localStorage.removeItem(key); } catch {} },
  };

  // Emit to all registered callbacks for an event
  const emit = (event: string, ...args: any[]) => {
    (listeners[event] || []).forEach(cb => { try { cb(...args); } catch (e) { console.error(e); } });
  };

  // ── Shared SSE reader helper ──────────────────────────────────────
  const readSSEStream = async (resp: Response, parseToken: (line: string) => string | null) => {
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const token = parseToken(line);
        if (token) emit('onGeminiStreamToken', token);
      }
    }
    emit('onGeminiStreamDone');
  };

  // ── Real Gemini streaming via fetch + SSE ─────────────────────────
  const streamGeminiReal = async (question: string, systemPrompt?: string) => {
    // Priority: user's own key (localStorage) → baked-in build key (GitHub Secret)
    const apiKey = LS.get('natively_gemini_key') || (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
    // Fall back to Groq if no Gemini key
    if (!apiKey) {
      const groqKey = LS.get('natively_groq_key') || (import.meta.env.VITE_GROQ_API_KEY as string) || '';
      if (groqKey) { await streamGroqReal(question, groqKey, systemPrompt); return; }
      const msg = '⚠️ No API key configured. Go to **Settings → AI Providers** and add your Gemini or Groq API key.';
      const tokens = msg.split(/(\s+)/);
      let i = 0;
      const iv = setInterval(() => {
        if (i < tokens.length) { emit('onGeminiStreamToken', tokens[i++]); }
        else { clearInterval(iv); emit('onGeminiStreamDone'); }
      }, 18);
      return;
    }

    const defaultModel = (import.meta.env.VITE_DEFAULT_MODEL as string) || 'gemini-2.5-flash';
    const model = LS.get('natively_current_model') || defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

    const contents: any[] = [];
    if (systemPrompt) {
      contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
      contents.push({ role: 'model', parts: [{ text: 'Understood. I will follow those instructions.' }] });
    }
    contents.push({ role: 'user', parts: [{ text: question }] });

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      });
      if (!resp.ok) {
        let errText = '';
        try { errText = await resp.text(); } catch {}
        emit('onGeminiStreamError', `Gemini API Error ${resp.status}: ${errText}`);
        return;
      }
      await readSSEStream(resp, (line) => {
        if (!line.startsWith('data: ')) return null;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') return null;
        try {
          const chunk = JSON.parse(jsonStr);
          return chunk?.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch { return null; }
      });
    } catch (err: any) {
      emit('onGeminiStreamError', `Network error: ${err?.message || err}`);
    }
  };

  // ── Real Groq streaming via fetch + SSE ──────────────────────────
  const streamGroqReal = async (question: string, apiKey: string, systemPrompt?: string) => {
    const model = 'llama-3.3-70b-versatile';
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: question });
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, stream: true }),
      });
      if (!resp.ok) {
        let errText = '';
        try { errText = await resp.text(); } catch {}
        emit('onGeminiStreamError', `Groq API Error ${resp.status}: ${errText}`);
        return;
      }
      await readSSEStream(resp, (line) => {
        if (!line.startsWith('data: ')) return null;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') return null;
        try {
          const chunk = JSON.parse(jsonStr);
          return chunk?.choices?.[0]?.delta?.content || null;
        } catch { return null; }
      });
    } catch (err: any) {
      emit('onGeminiStreamError', `Network error: ${err?.message || err}`);
    }
  };

  (window as any).electronAPI = new Proxy({}, {
    get(target: any, prop: string | symbol) {
      if (prop === "platform") return "web";
      if (prop in target) return target[prop];

      if (typeof prop === "string") {

        // ── Event listeners ────────────────────────────────────────
        if (prop.startsWith("on")) {
          return (cb: Function) => {
            if (!listeners[prop]) listeners[prop] = [];
            listeners[prop].push(cb);
            return () => { listeners[prop] = listeners[prop].filter(x => x !== cb); };
          };
        }

        // ── Credential storage backed by localStorage ──────────────
        if (prop === "getStoredCredentials") {
          return () => Promise.resolve({
            hasNativelyKey:   false,
            hasGeminiKey:     !!(LS.get('natively_gemini_key') || import.meta.env.VITE_GEMINI_API_KEY),
            hasGroqKey:       !!(LS.get('natively_groq_key')   || import.meta.env.VITE_GROQ_API_KEY),
            hasOpenaiKey:     !!LS.get('natively_openai_key'),
            hasClaudeKey:     !!LS.get('natively_claude_key'),
            hasNvidiaKey:     !!(import.meta.env.VITE_NVIDIA_API_KEY),
            googleServiceAccountPath: null,
            sttProvider:      "none",
            hasSttGroqKey:    !!(LS.get('natively_groq_key') || import.meta.env.VITE_GROQ_API_KEY),
            hasSttOpenaiKey:  false,
            hasDeepgramKey:   false,
            hasElevenLabsKey: false,
            hasAzureKey:      false,
            azureRegion:      "",
            hasIbmWatsonKey:  false,
            ibmWatsonRegion:  "",
          });
        }
        if (prop === "setGeminiApiKey") {
          return (key: string) => {
            key ? LS.set('natively_gemini_key', key) : LS.del('natively_gemini_key');
            return Promise.resolve({ success: true });
          };
        }
        if (prop === "setGroqApiKey") {
          return (key: string) => {
            key ? LS.set('natively_groq_key', key) : LS.del('natively_groq_key');
            return Promise.resolve({ success: true });
          };
        }
        if (prop === "setOpenaiApiKey") {
          return (key: string) => {
            key ? LS.set('natively_openai_key', key) : LS.del('natively_openai_key');
            return Promise.resolve({ success: true });
          };
        }
        if (prop === "setClaudeApiKey") {
          return (key: string) => {
            key ? LS.set('natively_claude_key', key) : LS.del('natively_claude_key');
            return Promise.resolve({ success: true });
          };
        }
        if (prop === "setNvidiaApiKey") {
          return () => Promise.resolve({ success: true });
        }

        // ── Test LLM connection ───────────────────────────────────
        if (prop === "testLlmConnection") {
          return async (provider: string, key?: string) => {
            const testKey = key || LS.get(`natively_${provider}_key`);
            if (!testKey) return { success: false, error: 'No API key provided' };
            if (provider === 'gemini') {
              try {
                const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${testKey}`);
                if (r.ok) return { success: true };
                const body = await r.json().catch(() => ({}));
                return { success: false, error: body?.error?.message || `HTTP ${r.status}` };
              } catch (e: any) { return { success: false, error: e?.message }; }
            }
            // For other providers just optimistically return success (no direct browser endpoint)
            return { success: true };
          };
        }

        // ── Real streaming chat ───────────────────────────────────
        if (prop === "streamGeminiChat") {
          return (question: string, _imagePaths?: string[], systemPrompt?: string) => {
            streamGeminiReal(question, systemPrompt);
            return Promise.resolve({ success: true });
          };
        }

        // ── Model selector / default model ────────────────────────
        if (prop === "toggleModelSelector")  return () => Promise.resolve();
        if (prop === "setDefaultModel") {
          return (model: string) => {
            LS.set('natively_current_model', model);
            return Promise.resolve({ success: true });
          };
        }
        if (prop === "getCurrentLlmConfig") {
          return () => {
            const envDefault = (import.meta.env.VITE_DEFAULT_MODEL as string) || 'gemini-2.5-flash';
            const m = LS.get('natively_current_model') || envDefault;
            const provider = m.startsWith('gemini') ? 'gemini' : m.startsWith('llama') || m.startsWith('mixtral') ? 'groq' : 'gemini';
            return Promise.resolve({ provider, model: m, isOllama: false });
          };
        }
        if (prop === "getDefaultModel") {
          const envDefault = (import.meta.env.VITE_DEFAULT_MODEL as string) || 'gemini-2.5-flash';
          return () => Promise.resolve({ model: LS.get('natively_current_model') || envDefault });
        }

        // ── Theme ─────────────────────────────────────────────────
        if (prop === "getThemeMode") return () => Promise.resolve({ mode: "dark", resolved: "dark" });

        // ── Permissions ───────────────────────────────────────────
        if (prop === "checkPermissions") {
          return () => Promise.resolve({ microphone: "granted", screen: "granted", platform: "web" });
        }

        // ── Meetings ──────────────────────────────────────────────
        if (prop === "getRecentMeetings") return () => Promise.resolve([]);
        if (prop === "getUpcomingEvents") return () => Promise.resolve([]);
        if (prop === "startMeeting")      return () => Promise.resolve({ success: true });
        if (prop === "endMeeting")        return () => Promise.resolve({ success: true });
        if (prop === "getMeetingActive")  return () => Promise.resolve(false);
        if (prop === "setWindowMode")     return () => Promise.resolve();
        if (prop === "finalizeMicSTT")    return () => Promise.resolve();

        // ── AI generation ─────────────────────────────────────────
        if (prop === "ragQueryLive")      return () => Promise.resolve({ success: false });
        if (prop === "generateClarify")   return () => Promise.resolve({ success: true });
        if (prop === "generateCodeHint")  return () => Promise.resolve({ success: true });
        if (prop === "generateBrainstorm") return () => Promise.resolve({ success: true });

        // ── Languages ─────────────────────────────────────────────
        if (prop === "getRecognitionLanguages") {
          return () => Promise.resolve({
            'auto':         { label: 'Auto Detect',          code: 'auto',         bcp47: 'auto',  iso639: 'auto', group: 'Auto' },
            'english-us':   { label: 'United States',        code: 'english-us',   bcp47: 'en-US', iso639: 'en',   group: 'English',    primary: 'en-US', alternates: ['en-GB','en-IN','en-AU','en-CA'] },
            'english-uk':   { label: 'United Kingdom',       code: 'english-uk',   bcp47: 'en-GB', iso639: 'en',   group: 'English',    primary: 'en-GB', alternates: ['en-US','en-IN','en-AU','en-CA'] },
            'english-in':   { label: 'India',                code: 'english-in',   bcp47: 'en-IN', iso639: 'en',   group: 'English',    primary: 'en-IN', alternates: ['en-US','en-GB','en-AU','en-CA'] },
            'english-au':   { label: 'Australia',            code: 'english-au',   bcp47: 'en-AU', iso639: 'en',   group: 'English',    primary: 'en-AU', alternates: ['en-US','en-GB','en-IN','en-CA'] },
            'english-ca':   { label: 'Canada',               code: 'english-ca',   bcp47: 'en-CA', iso639: 'en',   group: 'English',    primary: 'en-CA', alternates: ['en-US','en-GB','en-IN','en-AU'] },
            'indonesian':   { label: 'Indonesian',           code: 'indonesian',   bcp47: 'id-ID', iso639: 'id',   group: 'Indonesian' },
            'russian':      { label: 'Russian',              code: 'russian',      bcp47: 'ru-RU', iso639: 'ru',   group: 'Russian' },
            'spanish':      { label: 'Spanish',              code: 'spanish',      bcp47: 'es-ES', iso639: 'es',   group: 'Spanish' },
            'french':       { label: 'French',               code: 'french',       bcp47: 'fr-FR', iso639: 'fr',   group: 'French' },
            'german':       { label: 'German',               code: 'german',       bcp47: 'de-DE', iso639: 'de',   group: 'German' },
            'italian':      { label: 'Italian',              code: 'italian',      bcp47: 'it-IT', iso639: 'it',   group: 'Italian' },
            'portuguese':   { label: 'Portuguese',           code: 'portuguese',   bcp47: 'pt-PT', iso639: 'pt',   group: 'Portuguese' },
            'japanese':     { label: 'Japanese',             code: 'japanese',     bcp47: 'ja-JP', iso639: 'ja',   group: 'Japanese' },
            'korean':       { label: 'Korean',               code: 'korean',       bcp47: 'ko-KR', iso639: 'ko',   group: 'Korean' },
            'chinese':      { label: 'Chinese (Simplified)', code: 'chinese',      bcp47: 'zh-CN', iso639: 'zh',   group: 'Chinese' },
            'turkish':      { label: 'Turkish',              code: 'turkish',      bcp47: 'tr-TR', iso639: 'tr',   group: 'Turkish' },
            'ukrainian':    { label: 'Ukrainian',            code: 'ukrainian',    bcp47: 'uk-UA', iso639: 'uk',   group: 'Ukrainian' },
          });
        }
        if (prop === "getAiResponseLanguages") {
          return () => Promise.resolve([
            { label: 'Auto (Detect)', code: 'auto' },   { label: 'English',    code: 'English' },
            { label: 'Indonesian',    code: 'Indonesian' }, { label: 'Russian', code: 'Russian' },
            { label: 'Spanish',       code: 'Spanish' },  { label: 'French',    code: 'French' },
            { label: 'German',        code: 'German' },   { label: 'Italian',   code: 'Italian' },
            { label: 'Portuguese',    code: 'Portuguese' }, { label: 'Japanese', code: 'Japanese' },
            { label: 'Korean',        code: 'Korean' },   { label: 'Chinese',   code: 'Chinese' },
            { label: 'Turkish',       code: 'Turkish' },  { label: 'Ukrainian', code: 'Ukrainian' },
          ]);
        }
        if (prop === "getSttLanguage")        return () => Promise.resolve('english-us');
        if (prop === "getAiResponseLanguage") return () => Promise.resolve('auto');
        if (prop === "getSttProvider")        return () => Promise.resolve('none');

        // ── Devices ───────────────────────────────────────────────
        if (prop === "getInputDevices")  return () => Promise.resolve([{ id: 'default', name: 'Default Microphone' }]);
        if (prop === "getOutputDevices") return () => Promise.resolve([{ id: 'default', name: 'Default Speaker' }]);

        // ── Modes / profile ───────────────────────────────────────
        if (prop === "modesGetAll")       return () => Promise.resolve([]);
        if (prop === "modesGetActive")    return () => Promise.resolve(null);
        if (prop === "profileGetStatus")  return () => Promise.resolve({ hasProfile: false, profileMode: false });
        if (prop === "profileGetNotes")   return () => Promise.resolve({ success: true, content: "" });
        if (prop === "profileGetProfile") return () => Promise.resolve({ identity: {}, skills: [], activeJD: {} });

        // ── Calendar / audio ──────────────────────────────────────
        if (prop === "getCalendarStatus")    return () => Promise.resolve({ connected: false });
        if (prop === "getNativeAudioStatus") return () => Promise.resolve({ connected: false });

        // ── System ────────────────────────────────────────────────
        if (prop === "getArch")      return () => Promise.resolve("web");
        if (prop === "getOsVersion") return () => Promise.resolve("web");
        if (prop === "openExternal") return (url: string) => { window.open(url, "_blank"); return Promise.resolve(); };

        // ── Trial / license ───────────────────────────────────────
        if (prop === "getTrialStatus")    return () => Promise.resolve({ ok: true, expired: false, remaining_ms: 86400000 });
        if (prop === "getLocalTrial")     return () => Promise.resolve({ hasToken: false });
        if (prop === "getDonationStatus") return () => Promise.resolve({ shouldShow: false, hasDonated: false, lifetimeShows: 0 });
        if (prop === "licenseCheckPremium" || prop === "licenseCheckPremiumAsync") return () => Promise.resolve(false);
        if (prop === "licenseGetDetails")     return () => Promise.resolve({ isPremium: false });
        if (prop === "licenseGetHardwareId")  return () => Promise.resolve("web-hardware-id");

        // ── Settings / misc ───────────────────────────────────────
        if (prop === "getActionButtonMode")        return () => Promise.resolve("recap");
        if (prop === "getKeybinds")                return () => Promise.resolve([]);
        if (prop === "getCustomProviders")         return () => Promise.resolve([]);
        if (prop === "getGroqFastTextMode")        return () => Promise.resolve({ enabled: false });
        if (prop === "getAvailableOllamaModels")   return () => Promise.resolve([]);
        if (prop === "getNativelyUsage")           return () => Promise.resolve({ ok: false });
        if (prop === "getUndetectable")            return () => Promise.resolve(false);
        if (prop === "getOverlayMousePassthrough") return () => Promise.resolve(false);
        if (prop === "getOpenAtLogin")             return () => Promise.resolve(false);
        if (prop === "getVerboseLogging")          return () => Promise.resolve(false);
        if (prop === "getDisguise")                return () => Promise.resolve("none");
        if (prop === "getLogFilePath")             return () => Promise.resolve(null);

        // ── Window / UI control ───────────────────────────────────
        if (prop === "showWindow")                      return () => Promise.resolve();
        if (prop === "updateContentDimensionsCentered") return () => Promise.resolve();

        // ── Interactive misc ──────────────────────────────────────
        if (prop === "setUndetectable")      return () => Promise.resolve({ success: true });
        if (prop === "seedDemo")             return () => Promise.resolve({ success: true });
        if (prop === "stopAudioTest")        return () => Promise.resolve({ success: true });
        if (prop === "setGroqFastTextMode")  return () => Promise.resolve({ success: true });
        if (prop === "saveCustomProvider")   return () => Promise.resolve({ success: true });
        if (prop === "deleteCustomProvider") return () => Promise.resolve({ success: true });
        if (prop === "phoneMirrorGetInfo") {
          return () => Promise.resolve({ running: false, enabled: false, exposeOnLan: false, port: 0, loopbackUrl: null, primaryUrl: null, lanUrls: [], token: null, qrDataUrl: null, clients: 0 });
        }

        // ── Generic fallback ──────────────────────────────────────
        return (...args: any[]) => {
          console.warn(`[Electron API Mock] Called unhandled method: ${prop}`, args);
          if (prop.startsWith("get")) {
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
