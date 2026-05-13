import { useState } from "react";
import type { FormEventHandler } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import {
  FlaskConical, Flower2, Sun, Leaf, Snowflake, Globe,
  User, User2, Users, Gem, Tag, Copy, ArrowRight,
} from "lucide-react";
import { normalizeNote } from "./noteUtils";
import { DropdownChipInput } from "./DropdownChipInput";
import { useFragellaSuggest } from "./hooks/useFragellaSuggest";
import { useNoteSuggest } from "./hooks/useNoteSuggest";
import { useLang } from "../../i18n";
import type { Season } from "./types";
import type { Step1Values } from "./validation";
import s from "./AssesmentForm.module.css";

const seasonIcons: Record<Season, { icon: React.ReactNode; color: string }> = {
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
  likedBrands: string[];
  likedBrandInput: string;
  setLikedBrandInput: (value: string) => void;
  addLikedBrand: () => void;
  addLikedBrandValue: (value: string) => void;
  removeLikedBrand: (chip: string) => void;
  handleLikedBrandKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
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
  const { t } = useLang();
  const [displayMin, setDisplayMin] = useState(initialBudgetMin);
  const [displayMax, setDisplayMax] = useState(initialBudgetMax);

  const budgetMinField = register("budgetMin", { valueAsNumber: true });
  const budgetMaxField = register("budgetMax", { valueAsNumber: true });

  const predefinedLabels = new Set(t.predefinedNotes.map((n) => normalizeNote(n.label)));
  const customSelectedNotes = selectedNotes.filter((n) => !predefinedLabels.has(normalizeNote(n)));

  const brandSuggest    = useFragellaSuggest(likedBrandInput, "brand");
  const fragSuggest     = useFragellaSuggest(likedFragranceInput, "fragrance");
  const noteSuggestions = useNoteSuggest(customNoteInput, selectedNotes);

  const seasonEntries = (["spring", "summer", "autumn", "winter", "all_year"] as Season[]).map(
    (value) => ({ value, label: t.seasons[value] }),
  );

  return (
    <div className={s.page}>
      <div className={s.container}>
        <div className={s.header}>
          <div className={s.headerIcon}>
            <FlaskConical size={52} strokeWidth={1.25} />
          </div>
          <h1 className={s.headerTitle}>{t.heroTitle}</h1>
          <p className={s.headerSubtitle}>{t.heroSubtitle}</p>
        </div>

        <form onSubmit={onSubmit} className={s.form}>
          <div className={s.card}>
            <h2 className={s.sectionTitle}>{t.sectionPreferences}</h2>

            {/* Budget */}
            <div className={s.field}>
              <div className={s.budgetRow}>
                <label className={s.fieldLabel}>{t.budget}</label>
                <span className={s.budgetDisplay}>
                  {displayMin.toLocaleString("sv-SE")} – {displayMax.toLocaleString("sv-SE")} kr
                </span>
              </div>
              <div className={s.sliderGroup}>
                <div className={s.sliderRow}>
                  <span className={s.sliderLabel}>{t.budgetMin}</span>
                  <input type="range" min={0} max={20000} step={100} className={s.slider}
                    {...budgetMinField}
                    onChange={(e) => { budgetMinField.onChange(e); setDisplayMin(Number(e.target.value)); }}
                  />
                </div>
                <div className={s.sliderRow}>
                  <span className={s.sliderLabel}>{t.budgetMax}</span>
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

            {/* Season */}
            <div className={s.field}>
              <label className={s.fieldLabel}>{t.season}</label>
              <div className={s.seasonGrid}>
                {seasonEntries.map(({ value, label }) => {
                  const { icon, color } = seasonIcons[value];
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

            {/* Gender */}
            <div className={s.field}>
              <label className={s.fieldLabel}>{t.genderLabel}</label>
              <div className={s.grid3}>
                {([
                  { value: "men",    label: t.genderMen,    icon: <User  size={22} strokeWidth={1.5} />, color: "#93c5fd" },
                  { value: "women",  label: t.genderWomen,  icon: <User2 size={22} strokeWidth={1.5} />, color: "#f9a8d4" },
                  { value: "unisex", label: t.genderUnisex, icon: <Users size={22} strokeWidth={1.5} />, color: "#d8b4fe" },
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

            {/* Description */}
            <div className={s.field}>
              <label className={s.fieldLabel}>
                {t.descriptionLabel}
                <span className={s.optionalBadge}>{t.optional}</span>
              </label>
              <p className={s.helperText}>{t.descriptionHelper}</p>
              <textarea
                placeholder={t.descriptionPlaceholder}
                {...register("descriptionText")}
                className={s.textarea}
              />
            </div>

            {/* Liked brands */}
            <div className={s.field}>
              <label className={s.fieldLabel}>
                {t.likedBrandsLabel}
                <span className={s.optionalBadge}>{t.optional}</span>
              </label>
              <p className={s.helperText}>{t.likedBrandsHelper}</p>
              <DropdownChipInput
                placeholder={t.likedBrandsPh}
                chips={likedBrands}
                input={likedBrandInput}
                setInput={setLikedBrandInput}
                addChip={addLikedBrand}
                removeChip={removeLikedBrand}
                handleKeyDown={handleLikedBrandKeyDown}
                suggestions={brandSuggest.suggestions.map((sg) => ({ primary: sg.name }))}
                isLoading={brandSuggest.isLoading}
                onSelectSuggestion={(sg) => { addLikedBrandValue(sg.primary); setLikedBrandInput(""); }}
                addButtonLabel={t.likedBrandsAdd}
              />
              <input type="hidden" {...register("likedBrandsText")} />
            </div>

            {/* Liked fragrances */}
            <div className={s.field}>
              <label className={s.fieldLabel}>
                {t.likedFragsLabel}
                <span className={s.optionalBadge}>{t.optional}</span>
              </label>
              <p className={s.helperText}>{t.likedFragsHelper}</p>
              <DropdownChipInput
                placeholder={t.likedFragsPh}
                chips={likedFragrances}
                input={likedFragranceInput}
                setInput={setLikedFragranceInput}
                addChip={addLikedFragrance}
                removeChip={removeLikedFragrance}
                handleKeyDown={handleLikedFragranceKeyDown}
                suggestions={fragSuggest.suggestions.map((sg) => ({ primary: sg.name, secondary: sg.brand }))}
                isLoading={fragSuggest.isLoading}
                onSelectSuggestion={(sg) => { addLikedFragranceValue(sg.primary); setLikedFragranceInput(""); }}
                addButtonLabel={t.likedFragsAdd}
              />
              <input type="hidden" {...register("likedFragrancesText")} />
            </div>

            {/* Notes */}
            <div className={s.field}>
              <label className={s.fieldLabel}>
                {t.notesLabel}
                <span className={s.optionalBadge}>{t.optional}</span>
              </label>
              <p className={s.helperText}>{t.notesHelper}</p>

              <div className={s.noteTagGrid}>
                {t.predefinedNotes.map((note) => (
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

              <DropdownChipInput
                placeholder={t.notesPh}
                chips={customSelectedNotes}
                input={customNoteInput}
                setInput={setCustomNoteInput}
                addChip={addCustomNote}
                removeChip={removeNote}
                handleKeyDown={handleCustomNoteKeyDown}
                suggestions={noteSuggestions.map((n) => ({ primary: n }))}
                onSelectSuggestion={(sg) => { toggleNote(sg.primary); setCustomNoteInput(""); }}
                addButtonLabel={t.notesAdd}
              />

              <input type="hidden" {...register("notesText")} />
              {errors.notesText && <p className={s.fieldError}>{errors.notesText.message}</p>}
            </div>
          </div>

          {/* Fragrance type */}
          <div className={s.cardNoSpace}>
            <h2 className={s.sectionTitleMb}>{t.sectionFragranceType}</h2>
            <p className={s.helperText} style={{ marginBottom: "1rem", marginTop: "-0.75rem" }}>
              {t.fragranceTypeHelper}
            </p>
            <div className={s.grid3}>
              {([
                { name: "preferNiche",    label: t.niche,    icon: <Gem  size={22} strokeWidth={1.5} />, color: "#e879f9" },
                { name: "preferDesigner", label: t.designer, icon: <Tag  size={22} strokeWidth={1.5} />, color: "#fde68a" },
                { name: "preferDupe",     label: t.dupe,     icon: <Copy size={22} strokeWidth={1.5} />, color: "#86efac" },
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
            <span>{t.next}</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
