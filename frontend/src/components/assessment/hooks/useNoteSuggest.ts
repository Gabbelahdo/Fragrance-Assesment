import { useMemo } from "react";
import { allNotes } from "../constants";
import { normalizeNote } from "../noteUtils";

/**
 * Synchronous hook — filters the local allNotes list against a search query.
 * Returns up to 8 matches, excluding notes that are already selected.
 */
export function useNoteSuggest(query: string, selectedNotes: string[]) {
  const selectedNormalized = useMemo(
    () => new Set(selectedNotes.map(normalizeNote)),
    [selectedNotes],
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];

    return allNotes
      .filter(
        (note) =>
          note.toLowerCase().includes(q) &&
          !selectedNormalized.has(normalizeNote(note)),
      )
      .slice(0, 8);
  }, [query, selectedNormalized]);

  return suggestions;
}
