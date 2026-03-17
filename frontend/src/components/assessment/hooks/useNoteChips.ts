import { useState, type KeyboardEvent } from "react";
import { normalizeNote } from "../noteUtils";

export function useNoteChips() {
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [customNoteInput, setCustomNoteInput] = useState("");

  const toggleNote = (note: string) => {
    const normalizedNote = normalizeNote(note);

    setSelectedNotes((previousNotes) => {
      const alreadySelected = previousNotes.some(
        (selectedNote) => normalizeNote(selectedNote) === normalizedNote
      );

      if (alreadySelected) {
        return previousNotes.filter(
          (selectedNote) => normalizeNote(selectedNote) !== normalizedNote
        );
      }

      return [...previousNotes, note];
    });
  };

  const addCustomNote = () => {
    const trimmedNote = customNoteInput.trim();

    if (!trimmedNote) {
      return;
    }

    const normalizedNote = normalizeNote(trimmedNote);

    setSelectedNotes((previousNotes) => {
      const exists = previousNotes.some(
        (selectedNote) => normalizeNote(selectedNote) === normalizedNote
      );

      return exists ? previousNotes : [...previousNotes, trimmedNote];
    });

    setCustomNoteInput("");
  };

  const removeNote = (noteToRemove: string) => {
    const normalizedNote = normalizeNote(noteToRemove);
    setSelectedNotes((previousNotes) =>
      previousNotes.filter((note) => normalizeNote(note) !== normalizedNote)
    );
  };

  const handleCustomNoteKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addCustomNote();
    }
  };

  const isNoteSelected = (note: string) =>
    selectedNotes.some((selectedNote) => normalizeNote(selectedNote) === normalizeNote(note));

  return {
    selectedNotes,
    customNoteInput,
    setCustomNoteInput,
    toggleNote,
    addCustomNote,
    removeNote,
    handleCustomNoteKeyDown,
    isNoteSelected,
  };
}
