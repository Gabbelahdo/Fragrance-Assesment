import { useState } from "react";
import type { FormEventHandler } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { predefinedNotes, seasons } from "./constants";
import { getNoteEmoji } from "./noteUtils";
import type { Step1Values } from "./validation";
import s from "./AssesmentForm.module.css";

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
};

export function AssesmentStepOne({
  register,
  onSubmit,
  selectedNotes,
  customNoteInput,
  setCustomNoteInput,
  toggleNote,
  addCustomNote,
  removeNote,
  handleCustomNoteKeyDown,
  isNoteSelected,
  errors,
  initialBudgetMin,
  initialBudgetMax,
}: AssesmentStepOneProps) {
  const [displayMin, setDisplayMin] = useState(initialBudgetMin);
  const [displayMax, setDisplayMax] = useState(initialBudgetMax);

  const budgetMinField = register("budgetMin", { valueAsNumber: true });
  const budgetMaxField = register("budgetMax", { valueAsNumber: true });

  // Only show the custom-note chips — predefined notes already show selected state in the grid
  const predefinedLabels = new Set(predefinedNotes.map((n) => n.label.toLowerCase()));
  const customSelectedNotes = selectedNotes.filter(
    (n) => !predefinedLabels.has(n.toLowerCase())
  );

  return (
    <div className={s.page}>
      <div className={s.container}>
        <div className={s.header}>
          <div className={s.headerIcon}>🧴</div>
          <h1 className={s.headerTitle}>Doftanalys</h1>
          <p className={s.headerSubtitle}>
            Berätta vad du letar efter — vi hittar din perfekta doft!
          </p>
        </div>

        <div className={s.stepIndicator}>
          <div className={s.stepWithLabel}>
            <div className={s.stepActive}>1</div>
            <span className={s.stepLabel}>Preferenser</span>
          </div>
          <div className={s.stepLine} />
          <div className={s.stepWithLabel}>
            <div className={s.stepInactive}>2</div>
            <span className={s.stepLabel}>Din profil</span>
          </div>
        </div>

        <form onSubmit={onSubmit} className={s.form}>
          <div className={s.card}>
            <h2 className={s.sectionTitle}>Preferenser</h2>

            {/* Budget sliders */}
            <div className={s.field}>
              <div className={s.budgetRow}>
                <label className={s.fieldLabel}>Budget</label>
                <span className={s.budgetDisplay}>
                  {displayMin.toLocaleString("sv-SE")} –{" "}
                  {displayMax.toLocaleString("sv-SE")} kr
                </span>
              </div>
              <div className={s.sliderGroup}>
                <div className={s.sliderRow}>
                  <span className={s.sliderLabel}>Min</span>
                  <input
                    type="range"
                    min={0}
                    max={20000}
                    step={100}
                    className={s.slider}
                    {...budgetMinField}
                    onChange={(e) => {
                      budgetMinField.onChange(e);
                      setDisplayMin(Number(e.target.value));
                    }}
                  />
                </div>
                <div className={s.sliderRow}>
                  <span className={s.sliderLabel}>Max</span>
                  <input
                    type="range"
                    min={0}
                    max={20000}
                    step={100}
                    className={s.slider}
                    {...budgetMaxField}
                    onChange={(e) => {
                      budgetMaxField.onChange(e);
                      setDisplayMax(Number(e.target.value));
                    }}
                  />
                </div>
              </div>
              {(errors.budgetMin || errors.budgetMax) && (
                <p className={s.fieldError}>
                  {errors.budgetMax?.message ?? errors.budgetMin?.message}
                </p>
              )}
            </div>

            {/* Season — card tiles */}
            <div className={s.field}>
              <label className={s.fieldLabel}>Säsong</label>
              <div className={s.seasonGrid}>
                {seasons.map(({ value, label }) => (
                  <label key={value} className={s.checkboxCard}>
                    <input
                      type="radio"
                      value={value}
                      {...register("season")}
                      className={s.checkboxHidden}
                    />
                    <span className={s.checkboxLabel}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Fragrance gender */}
            <div className={s.field}>
              <label className={s.fieldLabel}>Kön</label>
              <div className={s.grid3}>
                {([
                  { value: "men", label: "Herr", icon: "🧔" },
                  { value: "women", label: "Dam", icon: "👩" },
                  { value: "unisex", label: "Unisex", icon: "🧑" },
                ] as const).map(({ value, label, icon }) => (
                  <label key={value} className={s.checkboxCard}>
                    <input
                      type="radio"
                      value={value}
                      {...register("fragranceGender")}
                      className={s.checkboxHidden}
                    />
                    <span className={s.checkboxIcon}>{icon}</span>
                    <span className={s.checkboxLabel}>{label}</span>
                  </label>
                ))}
              </div>
              {errors.fragranceGender && (
                <p className={s.fieldError}>{errors.fragranceGender.message}</p>
              )}
            </div>

            {/* Fragrance notes */}
            <div className={s.field}>
              <label className={s.fieldLabel}>Favoritnoter</label>
              <p className={s.helperText}>
                Välj bland färdiga noter eller lägg till egna.
              </p>

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

              <div className={s.customNoteRow}>
                <input
                  type="text"
                  placeholder="Valfri not…"
                  value={customNoteInput}
                  onChange={(event) => setCustomNoteInput(event.target.value)}
                  onKeyDown={handleCustomNoteKeyDown}
                  className={s.input}
                />
                <button type="button" onClick={addCustomNote} className={s.addNoteButton}>
                  Lägg till
                </button>
              </div>

              {/* Only custom notes shown here; predefined notes show selected state in the grid above */}
              {customSelectedNotes.length > 0 && (
                <div className={s.selectedTags}>
                  {customSelectedNotes.map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() => removeNote(note)}
                      aria-label={`Ta bort ${note}`}
                      className={s.selectedTag}
                    >
                      <span aria-hidden="true">{getNoteEmoji(note)}</span>
                      <span>{note}</span>
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              )}

              <input type="hidden" {...register("notesText")} />
              {errors.notesText && (
                <p className={s.fieldError}>{errors.notesText.message}</p>
              )}
            </div>
          </div>

          {/* Fragrance type */}
          <div className={s.cardNoSpace}>
            <h2 className={s.sectionTitleMb}>Typ av parfymmärke</h2>
            <div className={s.grid3}>
              {([
                { name: "preferNiche", label: "Nisch", icon: "💎" },
                { name: "preferDesigner", label: "Designer", icon: "🏷️" },
                { name: "preferDupe", label: "Dupe", icon: "♻️" },
              ] as const).map(({ name, label, icon }) => (
                <label key={name} className={s.checkboxCard}>
                  <input
                    type="checkbox"
                    {...register(name)}
                    className={s.checkboxHidden}
                  />
                  <span className={s.checkboxIcon}>{icon}</span>
                  <span className={s.checkboxLabel}>{label}</span>
                </label>
              ))}
            </div>
            {errors.preferNiche && (
              <p className={`${s.fieldError} ${s.fieldErrorMt}`}>
                {errors.preferNiche.message}
              </p>
            )}
          </div>

          <button type="submit" className={s.submitButton}>
            Nästa →
          </button>
        </form>
      </div>
    </div>
  );
}
