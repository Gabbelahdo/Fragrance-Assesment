import { useState, type KeyboardEvent } from "react";

/**
 * Generic chip-input hook — no predefined options, just add/remove free-text chips.
 * Used for the "liked fragrances" field in Step 1.
 */
export function useChipInput() {
  const [chips, setChips]   = useState<string[]>([]);
  const [input, setInput]   = useState("");

  const addChip = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    setChips((prev) =>
      prev.some((c) => c.toLowerCase() === lower) ? prev : [...prev, trimmed],
    );
    setInput("");
  };

  const removeChip = (chip: string) => {
    setChips((prev) => prev.filter((c) => c.toLowerCase() !== chip.toLowerCase()));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addChip();
    }
  };

  /** Add a chip directly by value — bypasses input state (safe in onSelectSuggestion). */
  const addChipValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    setChips((prev) =>
      prev.some((c) => c.toLowerCase() === lower) ? prev : [...prev, trimmed],
    );
  };

  return { chips, input, setInput, addChip, addChipValue, removeChip, handleKeyDown };
}
