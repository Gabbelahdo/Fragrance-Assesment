/**
 * User session service — JWT stored in localStorage.
 *
 * Flow:
 *   1. App mounts → loadSession() checks localStorage for a JWT.
 *   2. If found → GET /api/users/me → returns the saved profile → pre-fills Step 2.
 *   3. User submits Step 2 → saveSession() → POST /api/users/session → stores new JWT.
 *
 * The JWT is signed by the backend (python-jose) and contains the full profile.
 * No database is needed — the profile travels inside the token itself.
 */

import { apiPath } from "./api";

const SESSION_KEY = "fragrance_session_token";

// ── Token helpers ─────────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function clearStoredToken(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SavedProfile {
  name: string;
  age: number;
  gender: "male" | "female" | "unspecified";
  country: string;
  collectionSize: "lt5" | "5to10" | "10plus";
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * POST /api/users/session — encode the profile into a JWT and store it.
 * Called after Step 2 is submitted so the user is recognised on their next visit.
 */
export async function saveSession(profile: SavedProfile): Promise<void> {
  try {
    const response = await fetch(apiPath("/users/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });

    if (!response.ok) return;

    const data = await response.json();
    const token: string = data.sessionToken ?? data.session_token;
    if (token) localStorage.setItem(SESSION_KEY, token);
  } catch {
    // Session saving is best-effort — never block the main flow
  }
}

/**
 * GET /api/users/me — decode the stored JWT and return the profile.
 * Returns null if there is no token, it is expired, or the request fails.
 */
export async function loadSession(): Promise<SavedProfile | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const response = await fetch(apiPath(`/users/me?token=${encodeURIComponent(token)}`));

    if (!response.ok) {
      clearStoredToken();
      return null;
    }

    const profile = await response.json();
    // Backend sends camelCase (collectionSize) via alias_generator
    return profile as SavedProfile;
  } catch {
    clearStoredToken();
    return null;
  }
}
