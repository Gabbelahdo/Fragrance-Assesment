/**
 * Build a full API URL for a given backend path.
 *
 * Local dev  : VITE_API_URL unset → prepend /api so Vite proxy matches /api/*
 *              and strips the prefix before forwarding to localhost:8000.
 *              e.g. apiPath("/ai/recommend") → "/api/ai/recommend"
 *
 * Production : VITE_API_URL = https://<container-app>.azurecontainerapps.io
 *              e.g. apiPath("/ai/recommend")
 *                   → "https://<container-app>.azurecontainerapps.io/ai/recommend"
 *
 * FastAPI routes are mounted at /ai/..., /users/..., /health — no /api prefix.
 */
const BACKEND = import.meta.env.VITE_API_URL as string | undefined;

export function apiPath(path: string): string {
  return BACKEND ? `${BACKEND}${path}` : `/api${path}`;
}
