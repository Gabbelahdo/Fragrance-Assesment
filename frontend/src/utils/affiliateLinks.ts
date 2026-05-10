/**
 * Affiliate link helpers — Awin network.
 *
 * Sign up at https://www.awin.com/se and apply to:
 *   - Notino  (search "Notino" in advertiser directory)
 *   - Lyko    (search "Lyko")
 *
 * Once approved, add to .env.local:
 *   VITE_AWIN_PUBLISHER_ID    = your Awin publisher ID (7-digit number)
 *   VITE_AWIN_NOTINO_MERCHANT = Notino merchant ID (found in their programme page)
 *   VITE_AWIN_LYKO_MERCHANT   = Lyko merchant ID
 *
 * If the env vars are missing, the links fall back to plain search URLs
 * (no commission, but the buttons still work).
 */

const PUBLISHER  = import.meta.env.VITE_AWIN_PUBLISHER_ID    as string | undefined;
const NOTINO_MID = import.meta.env.VITE_AWIN_NOTINO_MERCHANT as string | undefined;
const LYKO_MID   = import.meta.env.VITE_AWIN_LYKO_MERCHANT   as string | undefined;

/** Wrap a destination URL in an Awin tracking link. */
function awinLink(merchantId: string, destination: string): string {
  return (
    `https://www.awin1.com/cread.php` +
    `?awinmid=${merchantId}` +
    `&awinaffid=${PUBLISHER}` +
    `&clickref=fragrance-app` +
    `&p=${encodeURIComponent(destination)}`
  );
}

function searchQuery(name: string, brand: string): string {
  return encodeURIComponent(`${brand} ${name}`);
}

/** Returns a Notino search link — with Awin tracking if configured. */
export function notinoLink(name: string, brand: string): string {
  const q    = searchQuery(name, brand);
  const dest = `https://www.notino.se/search/?q=${q}`;
  return PUBLISHER && NOTINO_MID ? awinLink(NOTINO_MID, dest) : dest;
}

/** Returns a Lyko search link — with Awin tracking if configured. */
export function lykoLink(name: string, brand: string): string {
  const q    = searchQuery(name, brand);
  const dest = `https://lyko.com/sv/search?q=${q}`;
  return PUBLISHER && LYKO_MID ? awinLink(LYKO_MID, dest) : dest;
}

/** True once at least one Awin merchant is configured. */
export const affiliateConfigured =
  Boolean(PUBLISHER) && Boolean(NOTINO_MID || LYKO_MID);
