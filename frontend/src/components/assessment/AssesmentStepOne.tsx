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
}: AssesmentStepOneProps) {
  return (
    <div className={s.page}>
      <div className={s.container}>
        <div className={s.header}>
          <div className={s.headerIcon}>🧴</div>
          <h1 className={s.headerTitle}>Doftanalys</h1>
          <p className={s.headerSubtitle}>
            Berätta vad du letar efter vi hittar din perfekta doft!
          </p>
        </div>

        <div className={s.stepIndicator}>
          <div className={s.stepActive}>1</div>
          <div className={s.stepLine} />
          <div className={s.stepInactive}>2</div>
        </div>

        <form onSubmit={onSubmit} className={s.form}>
          <div className={s.card}>
            <h2 className={s.sectionTitle}>Preferenser</h2>

            <div className={s.grid2}>
              <div className={s.field}>
                <label className={s.fieldLabel}>Budget min (kr)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="0"
                    {...register("budgetMin", { valueAsNumber: true })}
                    className={`${s.input} ${errors.budgetMin ? s.inputError : ""}`}
                />
                  {errors.budgetMin && (
                    <p className={s.fieldError}>{errors.budgetMin.message}</p>
                  )}
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel}>Budget max (kr)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="1 000"
                    {...register("budgetMax", { valueAsNumber: true })}
                    className={`${s.input} ${errors.budgetMax ? s.inputError : ""}`}
                />
                  {errors.budgetMax && (
                    <p className={s.fieldError}>{errors.budgetMax.message}</p>
                  )}
              </div>
            </div>

            <div className={s.field}>
              <label className={s.fieldLabel}>Säsong</label>
              <select {...register("season")} className={s.select}>
                {seasons.map((season) => (
                  <option key={season.value} value={season.value}>
                    {season.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={s.field}>
              <label className={s.fieldLabel}>Favoritnoter</label>
              <p className={s.helperText}>Välj bland färdiga noter eller lägg till egna.</p>

              <div className={s.noteTagGrid}>
                {predefinedNotes.map((note) => {
                  const isSelected = isNoteSelected(note.label);

                  return (
                    <button
                      key={note.label}
                      type="button"
                      onClick={() => toggleNote(note.label)}
                      className={`${s.noteTag} ${isSelected ? s.noteTagSelected : ""}`}
                    >
                      <span aria-hidden="true">{note.emoji}</span>
                      <span>{note.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className={s.customNoteRow}>
                <input
                  type="text"
                  placeholder="Skriv egen not och tryck Lägg till"
                  value={customNoteInput}
                  onChange={(event) => setCustomNoteInput(event.target.value)}
                  onKeyDown={handleCustomNoteKeyDown}
                  className={s.input}
                />
                <button type="button" onClick={addCustomNote} className={s.addNoteButton}>
                  Lägg till
                </button>
              </div>

              {!!selectedNotes.length && (
                <div className={s.selectedTags}>
                  {selectedNotes.map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() => removeNote(note)}
                      className={s.selectedTag}
                    >
                      <span>{getNoteEmoji(note)}</span>
                      <span>{note}</span>
                      <span aria-hidden="true">x</span>
                    </button>
                  ))}
                </div>
              )}

              <input type="hidden" {...register("notesText")} />
              {errors.notesText && <p className={s.fieldError}>{errors.notesText.message}</p>}
            </div>
          </div>

          <div className={s.cardNoSpace}>
            <h2 className={s.sectionTitleMb}>Typ av Parfym Märke</h2>
            <div className={s.grid3}>
              {([
                { name: "preferNiche", label: "Nisch", icon: "💎" },
                { name: "preferDesigner", label: "Designer", icon: "🏷️" },
                { name: "preferDupe", label: "Dupe", icon: "♻️" },
              ] as const).map(({ name, label, icon }) => (
                <label key={name} className={s.checkboxCard}>
                  <input type="checkbox" {...register(name)} className={s.checkboxHidden} />
                  <span className={s.checkboxIcon}>{icon}</span>
                  <span className={s.checkboxLabel}>{label}</span>
                </label>
              ))}
            </div>
            {errors.preferNiche && <p className={s.fieldError}>{errors.preferNiche.message}</p>}
          </div>

          <button type="submit" className={s.submitButton}>
            Nästa →
          </button>
        </form>
      </div>
    </div>
  );
}
