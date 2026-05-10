import { useEffect, useRef } from "react";
import s from "./AdUnit.module.css";

/**
 * Google AdSense display unit.
 *
 * Requires in .env.local:
 *   VITE_ADSENSE_CLIENT = ca-pub-XXXXXXXXXXXXXXXXX   (your publisher ID)
 *   VITE_ADSENSE_SLOT   = XXXXXXXXXX                 (ad unit slot ID)
 *
 * The script tag in index.html must also reference your publisher ID.
 * Renders nothing when env vars are missing — safe to leave in the tree.
 */

declare global {
  interface Window {
    adsbygoogle: Record<string, unknown>[];
  }
}

const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
const SLOT   = import.meta.env.VITE_ADSENSE_SLOT   as string | undefined;

export function AdUnit() {
  const pushed = useRef(false);

  useEffect(() => {
    if (!CLIENT || !SLOT || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // AdSense not loaded yet or blocked — silently ignore
    }
  }, []);

  if (!CLIENT || !SLOT) return null;

  return (
    <div className={s.wrapper}>
      <p className={s.label}>Annonsering</p>
      <ins
        className={`adsbygoogle ${s.ins}`}
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
