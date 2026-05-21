import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { version } from './package.json'

// Inject version so the React frontend can read it via import.meta.env.VITE_APP_VERSION
process.env.VITE_APP_VERSION = version;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    // Set the third parameter to '' to load all env variables regardless of prefix.
    const env = loadEnv(mode, process.cwd(), '');

    // Expose keys without VITE_ prefix as VITE_ prefixed keys for the browser bundle
    process.env.VITE_GEMINI_API_KEY = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '';
    process.env.VITE_GROQ_API_KEY = env.GROQ_API_KEY || env.VITE_GROQ_API_KEY || '';
    process.env.VITE_NVIDIA_API_KEY = env.NVIDIA_API_KEY || env.VITE_NVIDIA_API_KEY || '';
    process.env.VITE_OPENAI_API_KEY = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || '';
    process.env.VITE_CLAUDE_API_KEY = env.CLAUDE_API_KEY || env.VITE_CLAUDE_API_KEY || '';
    process.env.VITE_DEFAULT_MODEL = env.DEFAULT_MODEL || env.VITE_DEFAULT_MODEL || 'gemini-2.5-flash';

    return {
        plugins: [react()],
        base: './', // Use relative paths for Electron
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
                "@hooks": path.resolve(__dirname, "./src/hooks"),
                "@config": path.resolve(__dirname, "./src/config"),
            },
        },
        server: {
            port: 5180,
        },
        build: {
            chunkSizeWarningLimit: 1000,
            rollupOptions: {
                output: {
                    manualChunks: {
                        vendor: ['react', 'react-dom', 'framer-motion'],
                        ui: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-toast']
                    }
                }
            }
        }
    };
});
