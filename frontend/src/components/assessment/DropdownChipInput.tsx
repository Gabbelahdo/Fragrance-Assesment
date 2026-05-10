/**
 * DropdownChipInput
 *
 * Reusable component that combines:
 *  - A text input with real-time suggestions shown in a dropdown
 *  - Selected items rendered as removable chips
 *  - Keyboard navigation: ↑ ↓ to highlight, Enter to select, Esc to close
 *
 * The caller owns data fetching / filtering and passes `suggestions` in.
 */
import { useRef, useEffect, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import s from "./AssesmentForm.module.css";

export type DropdownSuggestion = {
  primary: string;    // main display text
  secondary?: string; // subtitle (e.g. brand name under a fragrance)
};

type Props = {
  placeholder: string;
  chips: string[];
  input: string;
  setInput: (v: string) => void;
  addChip: () => void;
  removeChip: (c: string) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  suggestions: DropdownSuggestion[];
  isLoading?: boolean;
  /** Called when user picks a suggestion from the dropdown. */
  onSelectSuggestion: (s: DropdownSuggestion) => void;
  addButtonLabel?: string;
};

export function DropdownChipInput({
  placeholder,
  chips,
  input,
  setInput,
  addChip,
  removeChip,
  handleKeyDown,
  suggestions,
  isLoading = false,
  onSelectSuggestion,
  addButtonLabel = "Lägg till",
}: Props) {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [open, setOpen]           = useState(false);
  const wrapRef                   = useRef<HTMLDivElement>(null);

  // Close when clicking outside the component
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Open/close based on input & suggestions
  useEffect(() => {
    const shouldOpen = input.trim().length >= 1 && (isLoading || suggestions.length > 0);
    setOpen(shouldOpen);
    setActiveIdx(-1);
  }, [suggestions, input, isLoading]);

  const handleInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "Enter" && activeIdx >= 0) {
        e.preventDefault();
        onSelectSuggestion(suggestions[activeIdx]);
        setOpen(false);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
    }
    handleKeyDown(e);
  };

  const handleAdd = () => {
    addChip();
    setOpen(false);
  };

  const handleSuggestionClick = (sg: DropdownSuggestion) => {
    onSelectSuggestion(sg);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={s.dropdownWrapper}>
      {/* Input row */}
      <div className={s.customNoteRow}>
        <input
          type="text"
          placeholder={placeholder}
          value={input}
          autoComplete="off"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKey}
          onFocus={() => {
            if (input.trim().length >= 1 && suggestions.length > 0) setOpen(true);
          }}
          className={s.input}
        />
        <button type="button" onClick={handleAdd} className={s.addNoteButton}>
          <Plus size={14} />
          {addButtonLabel}
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className={s.suggestDropdown} role="listbox">
          {isLoading ? (
            <div className={s.suggestEmpty}>Söker…</div>
          ) : suggestions.length === 0 ? (
            <div className={s.suggestEmpty}>Inga förslag hittades</div>
          ) : (
            suggestions.map((sg, i) => (
              <button
                key={`${sg.primary}-${i}`}
                type="button"
                role="option"
                aria-selected={i === activeIdx}
                className={`${s.suggestItem} ${i === activeIdx ? s.suggestItemActive : ""}`}
                onMouseDown={(e) => {
                  // preventDefault so input doesn't blur before we handle click
                  e.preventDefault();
                  handleSuggestionClick(sg);
                }}
              >
                <span className={s.suggestPrimary}>{sg.primary}</span>
                {sg.secondary && (
                  <span className={s.suggestSecondary}>{sg.secondary}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {/* Selected chips */}
      {chips.length > 0 && (
        <div className={s.selectedTags}>
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => removeChip(chip)}
              aria-label={`Ta bort ${chip}`}
              className={s.selectedTag}
            >
              <span>{chip}</span>
              <X size={12} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
