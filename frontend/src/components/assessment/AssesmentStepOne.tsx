// Importerar typ för formulärets submit-handler.
import type { FormEventHandler } from "react";
// Importerar typer för register-funktion och felobjekt.
import type { FieldErrors, UseFormRegister } from "react-hook-form";
// Importerar fasta listor (noter och säsonger) som används i UI:t.
import { predefinedNotes, seasons } from "./constants";
// Importerar hjälpfunktion för att visa emoji till en vald not.
import { getNoteEmoji } from "./noteUtils";
// Importerar typen för steg 1-formulärets data.
import type { Step1Values } from "./validation";
// Importerar CSS-modulens klassnamn.
import s from "./AssesmentForm.module.css";


// Definierar vilka props komponenten behöver från parent.
type AssesmentStepOneProps = {

    // Funktion som kopplar varje input till react-hook-form.
  register: UseFormRegister<Step1Values>;
    // Handler som körs när formuläret skickas.
  onSubmit: FormEventHandler<HTMLFormElement>;
    // Lista med alla noter som användaren har valt.
  selectedNotes: string[];
    // Nuvarande text i inputen för egen not.
  customNoteInput: string;
    // Setter för att uppdatera texten i egen not-input.
  setCustomNoteInput: (value: string) => void;
    // Funktion som togglar en not mellan vald/inte vald.
  toggleNote: (note: string) => void;
    // Funktion som lägger till texten i customNoteInput som not.
  addCustomNote: () => void;
    // Funktion som tar bort en vald not.
  removeNote: (note: string) => void;
    // Keydown-handler för att t.ex. lägga till not med Enter/komma.
  handleCustomNoteKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    // Hjälpfunktion som returnerar om en not är vald.
  isNoteSelected: (note: string) => boolean;
    // Valideringsfel för steg 1.
  errors: FieldErrors<Step1Values>;
};

// Exporterar steg 1-komponenten.
export function AssesmentStepOne({

  //tar emot följande funktioner, typer osv
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

    // Returnerar hela UI:t för steg 1.
  return (

    // Yttersta wrapper med sidlayout.
    <div className={s.page}>
      <div className={s.container}>
        <div className={s.header}>
          <div className={s.headerIcon}>🧴</div>
          <h1 className={s.headerTitle}>Doftanalys</h1>
          <p className={s.headerSubtitle}>
            Berätta vad du letar efter vi hittar din perfekta doft!
          </p>
        </div>

        {/* Visuell stegindikator: aktivt steg 1, inaktivt steg 2. */}
        <div className={s.stepIndicator}>
          {/* Cirkeln för aktivt steg. */}
          <div className={s.stepActive}>1</div>

          {/* Linjen mellan stegen. */}
          <div className={s.stepLine} />

          {/* Cirkeln för nästa steg. */}
          <div className={s.stepInactive}>2</div>
        </div>

        {/* Formulär för steg 1. */}
        <form onSubmit={onSubmit} className={s.form}>

          {/* Sektion med preferensfält. */}
          <div className={s.card}>

            {/* Rubriken. */}
            <h2 className={s.sectionTitle}>Preferenser</h2>

            {/* Grid med två kolumner för budgetfälten. */}
            <div className={s.grid2}>

              {/* Fältgrupp för lägsta budget. */}
              <div className={s.field}>
                <label className={s.fieldLabel}>Budget min (kr)</label>
                {/* Numeric input. */}
                {/* Endast heltalssteg. */}
                {/* Placeholder för minbudget. */}
                {/* Registrerar fältet och konverterar värdet till number. */}
                {/* Lägger till felklass om valideringen misslyckas. */}
                <input
                  type="number"
                  step="1"
                  placeholder="0"
                  {...register("budgetMin", { valueAsNumber: true })}
                  className={`${s.input} ${errors.budgetMin ? s.inputError : ""}`}
                />
                {/* Renderar felmeddelande om budgetMin har fel. */}
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


                 // Returnerar en toggle-knapp för varje not.
                  return (
                  // Button för att välja/avvälja not.
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
