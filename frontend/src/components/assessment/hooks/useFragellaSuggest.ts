import { useState, useEffect } from "react";
import { apiPath } from "../../../services/api";

export type FragellaSuggestion = { name: string; brand?: string };

/**
 * Debounced hook that fetches autocomplete suggestions from the backend
 * Fragella proxy. Fires after 300 ms of no typing; min query length: 2.
 *
 * type="fragrance" → [{name, brand}]
 * type="brand"     → [{name}] (unique brand names)
 */
export function useFragellaSuggest(
  query: string,
  type: "fragrance" | "brand" = "fragrance",
) {
  const [suggestions, setSuggestions] = useState<FragellaSuggestion[]>([]);
  const [isLoading, setIsLoading]     = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const url = apiPath(
          `/fragrances/suggest?query=${encodeURIComponent(q)}&type=${type}`,
        );
        const res = await fetch(url);
        if (!res.ok) return;
        const data: { results: FragellaSuggestion[] } = await res.json();
        setSuggestions(data.results ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, type]);

  return { suggestions, isLoading };
}
