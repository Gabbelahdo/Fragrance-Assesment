import { useState } from "react";
import type { FormEventHandler } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import {
  FlaskConical, Flower2, Sun, Leaf, Snowflake, Globe,
  User, User2, Users, Gem, Tag, Copy, ArrowRight,
} from "lucide-react";
import { predefinedNotes, seasons } from "./constants";
import { normalizeNote } from "./noteUtils";
import { DropdownChipInput } from "./DropdownChipInput";
import { useFragellaSuggest } from "./hooks/useFragellaSuggest";
import { useNoteSuggest } from "./hooks/useNoteSuggest";
import type { Season } from "./types";
import type { Step1Values } from "./validation";
import s from "./AssesmentForm.module.css";

// Each season gets its own icon and colour
const seasonConfig: Record<Season, { icon: React.ReactNode; color: string }> = {
  spring:   { icon: <Flower2   size={22} strokeWidth={1.5} />, color: "#f9a8d4" },
  summer:   { icon: <Sun       size={22} strokeWidth={1.5} />, color: "#fde68a" },
  autumn:   { icon: <Leaf      size={22} strokeWidth={1.5} />, color: "#fdba74" },
  winter:   { icon: <Snowflake size={22} strokeWidth={1.5} />, color: "#93c5fd" },
  all_year: { icon: <Globe     size={22} strokeWidth={1.5} />, color: "#6ee7b7" },
};

type AssesmentStepOneProps = {
  register: UseFormRegister<Step1Values>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  selectedNotes: string[];
  customNoteInput: string;
  setCustomNoteInput: (value: string) => void;
  toggleNote: (note: string) => void;
  addCustomNote: () => void;
  removeNote: (note: string) => void;
  handleCustomNoteKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  isNoteSelected: (note: string) => boolean;
  errors: FieldErrors<Step1Values>;
  initialBudgetMin: number;
  initialBudgetMax: number;
  // Liked brands chip field
  likedBrands: string[];
  likedBrandInput: string;
  setLikedBrandInput: (value: string) => void;
  addLikedBrand: () => void;
  addLikedBrandValue: (value: string) => void;
  removeLikedBrand: (chip: string) => void;
  handleLikedBrandKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  // Liked fragrances chip field
  likedFragrances: string[];
  likedFragranceInput: string;
  setLikedFragranceInput: (value: string) => void;
  addLikedFragrance: () => void;
  addLikedFragranceValue: (value: string) => void;
  removeLikedFragrance: (chip: string) => void;
  handleLikedFragranceKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

export function AssesmentStepOne({
  register, onSubmit,
  selectedNotes, customNoteInput, setCustomNoteInput,
  toggleNote, addCustomNote, removeNote, handleCustomNoteKeyDown, isNoteSelected,
  errors, initialBudgetMin, initialBudgetMax,
  likedBrands, likedBrandInput, setLikedBrandInput,
  addLikedBrand, addLikedBrandValue, removeLikedBrand, handleLikedBrandKeyDown,
  likedFragrances, likedFragranceInput, setLikedFragranceInput,
  addLikedFragrance, addLikedFragranceValue, removeLikedFragrance, handleLikedFragranceKeyDown,
}: AssesmentStepOneProps) {
  const [displayMin, setDisplayMin] = useState(initialBudgetMin);
  const [displayMax, setDisplayMax] = useState(initialBudgetMax);

  const budgetMinField = register("budgetMin", { valueAsNumber: true });
  const budgetMaxField = register("budgetMax", { valueAsNumber: true });

  const predefinedLabels = new Set(predefinedNotes.map((n) => normalizeNote(n.label)));
  const customSelectedNotes = selectedNotes.filter((n) => !predefinedLabels.has(normalizeNote(n)));

  // ── Live suggestions from Fragella ───────────────────────────────────────────
  const brandSuggest    = useFragellaSuggest(likedBrandInput, "brand");
  const fragSuggest     = useFragellaSuggest(likedFragranceInput, "fragrance");
  const noteSuggestions = useNoteSuggest(customNoteInput, selectedNotes);

  return (
    <div className={s.page}>
      <div className={s.container}>
        <div className={s.header}>
          <div className={s.headerIcon}>
            <FlaskConical size={52} strokeWidth={1.25} />
          </div>
          <h1 className={s.headerTitle}>Doftanalys</h1>
          <p className={s.headerSubtitle}>
            Berätta vad du letar efter, vi hittar din perfekta doft!
          </p>
        </div>


        <form onSubmit={onSubmit} className={s.form}>
          <div className={s.card}>
            <h2 className={s.sectionTitle}>Preferenser</h2>

            {/* Budget sliders */}
            <div className={s.field}>
              <div className={s.budgetRow}>
                <label className={s.fieldLabel}>Budget</label>
                <span className={s.budgetDisplay}>
                  {displayMin.toLocaleString("sv-SE")} – {displayMax.toLocaleString("sv-SE")} kr
                </span>
              </div>
              <div className={s.sliderGroup}>
                <div className={s.sliderRow}>
                  <span className={s.sliderLabel}>Min</span>
                  <input type="range" min={0} max={20000} step={100} className={s.slider}
                    {...budgetMinField}
                    onChange={(e) => { budgetMinField.onChange(e); setDisplayMin(Number(e.target.value)); }}
                  />
                </div>
                <div className={s.sliderRow}>
                  <span className={s.sliderLabel}>Max</span>
                  <input type="range" min={0} max={20000} step={100} className={s.slider}
                    {...budgetMaxField}
                    onChange={(e) => { budgetMaxField.onChange(e); setDisplayMax(Number(e.target.value)); }}
                  />
                </div>
              </div>
              {(errors.budgetMin || errors.budgetMax) && (
                <p className={s.fieldError}>{errors.budgetMax?.message ?? errors.budgetMin?.message}</p>
              )}
            </div>

            {/* Season — colorful card tiles */}
            <div className={s.field}>
              <label className={s.fieldLabel}>Säsong</label>
              <div className={s.seasonGrid}>
                {seasons.map(({ value, label }) => {
                  const { icon, color } = seasonConfig[value];
                  return (
                    <label
                      key={value}
                      className={s.checkboxCard}
                      style={{ "--icon-color": color } as React.CSSProperties}
                    >
                      <input type="radio" value={value} {...register("season")} className={s.checkboxHidden} />
                      <span className={s.checkboxIcon}>{icon}</span>
                      <span className={s.checkboxLabel}>{label}</span>
                    </label>
                  );
                })}
              </div>
              {errors.season && <p className={s.fieldError}>{errors.season.message}</p>}
            </div>

            {/* Fragrance gender — colorful tiles */}
            <div className={s.field}>
              <label className={s.fieldLabel}>Kön</label>
              <div className={s.grid3}>
                {([
                  { value: "men",    label: "Herr",   icon: <User  size={22} strokeWidth={1.5} />, color: "#93c5fd" },
                  { value: "women",  label: "Dam",    icon: <User2 size={22} strokeWidth={1.5} />, color: "#f9a8d4" },
                  { value: "unisex", label: "Unisex", icon: <Users size={22} strokeWidth={1.5} />, color: "#d8b4fe" },
                ] as const).map(({ value, label, icon, color }) => (
                  <label key={value} className={s.checkboxCard} style={{ "--icon-color": color } as React.CSSProperties}>
                    <input type="radio" value={value} {...register("fragranceGender")} className={s.checkboxHidden} />
                    <span className={s.checkboxIcon}>{icon}</span>
                    <span className={s.checkboxLabel}>{label}</span>
                  </label>
                ))}
              </div>
              {errors.fragranceGender && <p className={s.fieldError}>{errors.fragranceGender.message}</p>}
            </div>

            {/* Free description — optional */}
            <div className={s.field}>
              <label className={s.fieldLabel}>
                Vad söker du?
                <span className={s.optionalBadge}>valfritt</span>
              </label>
              <p className={s.helperText}>Beskriv fritt vad du har i åtanke.</p>
              <textarea
                placeholder="T.ex. en varm och kryddig doft för höst och vinter, inte för söt…"
                {...register("descriptionText")}
                className={s.textarea}
              />
            </div>

            {/* Liked brands — optional, with Fragella dropdown */}
            <div className={s.field}>
              <label className={s.fieldLabel}>
                Märken du gillar
                <span className={s.optionalBadge}>valfritt</span>
              </label>
              <p className={s.helperText}>
                Sök efter doftmärken, välj från listan eller tryck Enter för att lägga till.
              </p>
              <DropdownChipInput
                placeholder="T.ex. Creed, Maison Margiela, Dior…"
                chips={likedBrands}
                input={likedBrandInput}
                setInput={setLikedBrandInput}
                addChip={addLikedBrand}
                removeChip={removeLikedBrand}
                handleKeyDown={handleLikedBrandKeyDown}
                suggestions={brandSuggest.suggestions.map((s) => ({ primary: s.name }))}
                isLoading={brandSuggest.isLoading}
                onSelectSuggestion={(sg) => {
                  addLikedBrandValue(sg.primary);
                  setLikedBrandInput("");
                }}
                addButtonLabel="Lägg till"
              />
              <input type="hidden" {...register("likedBrandsText")} />
            </div>

            {/* Liked fragrances — optional, with Fragella dropdown */}
            <div className={s.field}>
              <label className={s.fieldLabel}>
                Parfymer du gillar
                <span className={s.optionalBadge}>valfritt</span>
              </label>
              <p className={s.helperText}>
                Sök efter specifika parfymer, välj från listan eller tryck Enter för att lägga till.
              </p>
              <DropdownChipInput
                placeholder="T.ex. Sauvage, Black Afgano, Aventus…"
                chips={likedFragrances}
                input={likedFragranceInput}
                setInput={setLikedFragranceInput}
                addChip={addLikedFragrance}
                removeChip={removeLikedFragrance}
                handleKeyDown={handleLikedFragranceKeyDown}
                suggestions={fragSuggest.suggestions.map((s) => ({
                  primary: s.name,
                  secondary: s.brand,
                }))}
                isLoading={fragSuggest.isLoading}
                onSelectSuggestion={(sg) => {
                  addLikedFragranceValue(sg.primary);
                  setLikedFragranceInput("");
                }}
                addButtonLabel="Lägg till"
              />
              <input type="hidden" {...register("likedFragrancesText")} />
            </div>

            {/* Notes — predefined chips + custom dropdown */}
            <div className={s.field}>
              <label className={s.fieldLabel}>
                Favoritnoter
                <span className={s.optionalBadge}>valfritt</span>
              </label>
              <p className={s.helperText}>Välj bland färdiga noter eller sök efter fler.</p>

              {/* Quick-click predefined note chips */}
              <div className={s.noteTagGrid}>
                {predefinedNotes.map((note) => (
                  <button
                    key={note.label}
                    type="button"
                    onClick={() => toggleNote(note.label)}
                    className={`${s.noteTag} ${isNoteSelected(note.label) ? s.noteTagSelected : ""}`}
                  >
                    <span aria-hidden="true">{note.emoji}</span>
                    <span>{note.label}</span>
                  </button>
                ))}
              </div>

              {/* Custom note input with dropdown */}
              <DropdownChipInput
                placeholder="Sök eller skriv en valfri not…"
                chips={customSelectedNotes}
                input={customNoteInput}
                setInput={setCustomNoteInput}
                addChip={addCustomNote}
                removeChip={removeNote}
                handleKeyDown={handleCustomNoteKeyDown}
                suggestions={noteSuggestions.map((n) => ({ primary: n }))}
                onSelectSuggestion={(sg) => {
                  toggleNote(sg.primary);
                  setCustomNoteInput("");
                }}
                addButtonLabel="Lägg till"
              />

              <input type="hidden" {...register("notesText")} />
              {errors.notesText && <p className={s.fieldError}>{errors.notesText.message}</p>}
            </div>
          </div>

          {/* Fragrance type — colorful tiles */}
          <div className={s.cardNoSpace}>
            <h2 className={s.sectionTitleMb}>Typ av parfymmärke</h2>
            <p className={s.helperText} style={{ marginBottom: "1rem", marginTop: "-0.75rem" }}>
              Välj en eller flera.
            </p>
            <div className={s.grid3}>
              {([
                { name: "preferNiche",    label: "Nisch",    icon: <Gem  size={22} strokeWidth={1.5} />, color: "#e879f9" },
                { name: "preferDesigner", label: "Designer", icon: <Tag  size={22} strokeWidth={1.5} />, color: "#fde68a" },
                { name: "preferDupe",     label: "Dupe",     icon: <Copy size={22} strokeWidth={1.5} />, color: "#86efac" },
              ] as const).map(({ name, label, icon, color }) => (
                <label key={name} className={s.checkboxCard} style={{ "--icon-color": color } as React.CSSProperties}>
                  <input type="checkbox" {...register(name)} className={s.checkboxHidden} />
                  <span className={s.checkboxIcon}>{icon}</span>
                  <span className={s.checkboxLabel}>{label}</span>
                </label>
              ))}
            </div>
            {errors.preferNiche && (
              <p className={`${s.fieldError} ${s.fieldErrorMt}`}>{errors.preferNiche.message}</p>
            )}
          </div>

          <button type="submit" className={s.submitButton}>
            <span>Nästa</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
