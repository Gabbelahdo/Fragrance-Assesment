//Importerar react hook useEffect för sido-effeker och useState för lokalt state
import { useEffect, useState } from "react";
//för formulärhantering och valideringskoppling.
import { useForm } from "react-hook-form";
// Importerar adaptern som kopplar Zod-schema till react-hook-form.
import { zodResolver } from "@hookform/resolvers/zod";
// Importerar UI-komponenten för formulärets första och andra steg.
import { AssesmentStepOne } from "./AssesmentStepOne";
import { AssesmentStepTwo } from "./AssesmentStepTwo";

// Importerar custom hook som hämtar och levererar länder till steg 2.
import { useCountries } from "./hooks/useCountries";

// Importerar custom hook som hanterar valda noter och egen not-input.
import { useNoteChips } from "./hooks/useNoteChips";

// Importerar Zod-scheman för steg 1 och steg 2.
import { step1Schema, step2Schema } from "./validation";

// Importerar TypeScript-typer som genereras från Zod-schemat.

import type { Step1Values, Step2Values } from "./validation";


export function AssessmentForm() {

    // Håller reda på vilket steg användaren befinner sig på: 1 eller 2.
  const [step, setStep] = useState<1 | 2>(1);

    // Hämtar landlista samt laddstatus från custom hook.
  const { countries, isCountriesLoading } = useCountries();
    
  // Hämtar all state och logik för val av noter från custom hook.
  const {
        // Lista över användarens valda noter.
    selectedNotes,

        // Texten som användaren just nu skriver in i egen not-input.
    customNoteInput,

        // Setter för att uppdatera texten i egen not-input.
    setCustomNoteInput,

        // Funktion som togglar en fördefinierad not av/på.
    toggleNote,

        // Funktion som lägger till en egen not från inputfältet.
    addCustomNote,

        // Funktion som tar bort en vald not.
    removeNote,

        // Funktion som fångar Enter eller komma i inputfältet för att snabbt lägga till not.
    handleCustomNoteKeyDown,

        // Hjälpfunktion som avgör om en not redan är vald.
    isNoteSelected,
  } = useNoteChips();

    // Skapar react-hook-form-instansen för steg 1 med Zod-validering.
  const step1Form = useForm<Step1Values>({

        // Kopplar steg 1-formuläret till Zod-schemat så att validering sker centralt.
    resolver: zodResolver(step1Schema),
  // Sätter startvärden för steg 1 så formuläret alltid börjar i ett förutsägbart läge.
    defaultValues: {
      budgetMin: 0,
      budgetMax: 10000,
      season: "all_year",
      notesText: "",
      preferNiche: false,
      preferDesigner: false,
      preferDupe: false,
    },
  });

    // Skapar react-hook-form-instansen för steg 2 med eget Zod-schema.
  const step2Form = useForm<Step2Values>({

      // Kopplar steg 2-formuläret till dess valideringsschema.
    resolver: zodResolver(step2Schema),

    //sätter startvärden
    defaultValues: {
      name: "",
      age: undefined,
      gender: undefined,
      country: "",
      collectionSize: undefined,
    },
  });


  // Plockar ut setValue för steg 1 samt info om formuläret redan har skickats minst en gång.
  const {
      // Används för att programmässigt skriva in notesText i form-state.
    setValue: setStep1Value,

        // Plockar ut isSubmitted från formState och döper om det för tydlighet.
    formState: { isSubmitted: isStep1Submitted },
  } = step1Form;

    // Synkar den separata note-state:en till det dolda fältet notesText i steg 1-formuläret.
  useEffect(() => {
        // Skriver in valda noter som en kommaseparerad sträng i form-state.
    setStep1Value("notesText", selectedNotes.join(", "), {
            // Om steg 1 redan försökt skickas, validera direkt när noterna ändras.
      shouldValidate: isStep1Submitted,
    });
        // Kör effekten när noter, setValue-funktionen eller submit-status ändras.
  }, [selectedNotes, setStep1Value, isStep1Submitted]);

    // Körs när steg 2 skickas och båda stegens data ska slås ihop.
  const onStep2Submit = (step2Data: Step2Values) => {
        // Hämtar värden från steg 1 och slår ihop dem med data från steg 2 till en gemensam payload.
    const fullPayload = { ...step1Form.getValues(), ...step2Data };
    console.log("submit payload: ", fullPayload);
    alert("Submit (mock). Kolla console för payload.");
  };


    // Om användaren är på steg 2 renderas bara steg 2-komponenten.
  if (step === 2) {
    return (
      // Renderar steg 2 och skickar med all data samt alla callbacks som behövs.
      <AssesmentStepTwo

      // Skickar register-funktionen från react-hook-form så fälten kan kopplas till form-state. 
        register={step2Form.register}

        // Kopplar submit till steg 2-formuläret och vidare till onStep2Submit.    
        onSubmit={step2Form.handleSubmit(onStep2Submit)}
               
        // Gör tillbaka-knappen ansvarig för att byta tillbaka till steg 1.
        onBack={() => setStep(1)}
       // Skickar landlistan till steg 2.
        countries={countries}

      // Skickar laddstatus så steg 2 kan visa rätt placeholder och disabled-state.
        isCountriesLoading={isCountriesLoading}
        errors={step2Form.formState.errors}
      />
    );
  }

  // Om vi inte är på steg 2 renderas steg 1.
  return (

        // Renderar steg 1 och skickar in all state samt alla handlers som komponenten behöver.
    <AssesmentStepOne
          // Kopplar steg 1-fälten till react-hook-form.
      register={step1Form.register}

      // När steg 1 skickas och valideras korrekt byter vi till steg 2.
      onSubmit={step1Form.handleSubmit(() => setStep(2))}

      // Skickar de noter användaren just nu har valt.
      selectedNotes={selectedNotes}

           // Skickar aktuell inputtext för egen not. 
      customNoteInput={customNoteInput}

      // Skickar setter för att uppdatera egen not-input.
      setCustomNoteInput={setCustomNoteInput}

      // Skickar funktion för att toggla en not.
      toggleNote={toggleNote}

            // Skickar funktion för att lägga till en egen not.
      addCustomNote={addCustomNote}

            // Skickar funktion för att ta bort en vald not.
      removeNote={removeNote}

            // Skickar tangentbordshanteraren för not-input.
      handleCustomNoteKeyDown={handleCustomNoteKeyDown}


        // Skickar hjälpfunktion som avgör om en not är vald.
      isNoteSelected={isNoteSelected}

      // Skickar valideringsfelen för steg 1.
      errors={step1Form.formState.errors}
    />
  );
}

export default AssessmentForm;
