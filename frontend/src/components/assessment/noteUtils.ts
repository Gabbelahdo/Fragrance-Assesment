import { predefinedNotes } from "./constants";

export const normalizeNote = (value: string) => value.trim().toLocaleLowerCase("sv");

const noteEmojiByLabel = predefinedNotes.reduce<Record<string, string>>(
  (accumulator, note) => {
    accumulator[normalizeNote(note.label)] = note.emoji;
    return accumulator;
  },
  {}
);

export const getNoteEmoji = (note: string) =>
  noteEmojiByLabel[normalizeNote(note)] ?? "✨";
