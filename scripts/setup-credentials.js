/**
 * setup-credentials.js
 * One-time helper: injects API keys into Natively's encrypted credentials store.
 * Run with: node scripts/setup-credentials.js
 * 
 * This must run INSIDE Electron (not plain Node) because safeStorage requires Keychain.
 * We piggyback on Electron's main process by spawning it with this script.
 */

const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const GROQ_KEY = process.env.GROQ_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

app.whenReady().then(() => {
  const credPath = path.join(app.getPath('userData'), 'credentials.enc');
  const plainPath = credPath + '.json';

  let existing = {};

  // Load existing credentials
  try {
    if (fs.existsSync(credPath) && safeStorage.isEncryptionAvailable()) {
      const enc = fs.readFileSync(credPath);
      const dec = safeStorage.decryptString(enc);
      existing = JSON.parse(dec);
      console.log('[setup] Loaded existing credentials');
    } else if (fs.existsSync(plainPath)) {
      existing = JSON.parse(fs.readFileSync(plainPath, 'utf-8'));
      console.log('[setup] Loaded plaintext credentials');
    }
  } catch (e) {
    console.warn('[setup] Could not load existing credentials, starting fresh:', e.message);
  }

  // Inject keys
  if (GROQ_KEY && !GROQ_KEY.includes('your_')) {
    existing.groqApiKey = GROQ_KEY;
    existing.groqSttApiKey = GROQ_KEY;     // Use same key for STT
    existing.groqSttModel = 'whisper-large-v3-turbo';
    existing.sttProvider = 'groq';
    console.log('[setup] ✅ Groq API key set, STT provider = groq (whisper-large-v3-turbo)');
  } else {
    console.warn('[setup] ⚠️  GROQ_API_KEY not found or still placeholder in .env');
  }

  if (GEMINI_KEY && !GEMINI_KEY.includes('your_')) {
    existing.geminiApiKey = GEMINI_KEY;
    console.log('[setup] ✅ Gemini API key set');
  } else {
    console.warn('[setup] ⚠️  GEMINI_API_KEY not found or still placeholder — AI answers will use Groq LLaMA');
  }

  // Save back
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const enc = safeStorage.encryptString(JSON.stringify(existing));
      fs.writeFileSync(credPath, enc);
      console.log('[setup] ✅ Credentials saved (encrypted)');
    } else {
      fs.writeFileSync(plainPath, JSON.stringify(existing));
      console.log('[setup] ✅ Credentials saved (plaintext fallback)');
    }
  } catch (e) {
    console.error('[setup] ❌ Failed to save:', e.message);
  }

  console.log('\n[setup] Done! Restart the app with: npm start');
  app.quit();
});
