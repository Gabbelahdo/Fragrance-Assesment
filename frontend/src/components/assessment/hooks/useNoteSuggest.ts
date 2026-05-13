import { useMemo } from "react";
import { normalizeNote } from "../noteUtils";
import { useLang } from "../../../i18n";

export function useNoteSuggest(query: string, selectedNotes: string[]) {
  const { t } = useLang();

  const selectedNormalized = useMemo(
    () => new Set(selectedNotes.map(normalizeNote)),
    [selectedNotes],
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return t.allNotes
      .filter(
        (note) =>
          note.toLowerCase().includes(q) &&
          !selectedNormalized.has(normalizeNote(note)),
      )
      .slice(0, 8);
  }, [query, selectedNormalized, t.allNotes]);

  return suggestions;
}
