import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env.local so we can read the API key in Node (never exposed to browser)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],

    server: {
      proxy: {
        // Any request to /api/* is forwarded to the FastAPI backend.
        // The /api prefix is stripped so /api/ai/recommend → /ai/recommend on the server.
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },

        // Any request to /fragrance-proxy/* is forwarded to the Fragella API.
        // The API key is injected here in Node — it never touches the browser.
        '/fragrance-proxy': {
          target: 'https://api.fragella.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/fragrance-proxy/, '/api'),
          headers: {
            'x-api-key': env.VITE_FRAGRANCE_API_KEY ?? '',
          },
        },
      },
    },
  }
})
