import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AssesmentStepOne } from "./AssesmentStepOne";
import { AssesmentStepTwo } from "./AssesmentStepTwo";
import { useCountries } from "./hooks/useCountries";
import { useNoteChips } from "./hooks/useNoteChips";
import { step1Schema, step2Schema } from "./validation";
import type { Step1Values, Step2Values } from "./validation";

export function AssessmentForm() {
  const [step, setStep] = useState<1 | 2>(1);

  const { countries, isCountriesLoading } = useCountries();
  const {
    selectedNotes,
    customNoteInput,
    setCustomNoteInput,
    toggleNote,
    addCustomNote,
    removeNote,
    handleCustomNoteKeyDown,
    isNoteSelected,
  } = useNoteChips();

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
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

  const step2Form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      name: "",
      age: undefined,
      gender: undefined,
      country: "",
      collectionSize: undefined,
    },
  });

  const {
    setValue: setStep1Value,
    formState: { isSubmitted: isStep1Submitted },
  } = step1Form;

  useEffect(() => {
    setStep1Value("notesText", selectedNotes.join(", "), {
      shouldValidate: isStep1Submitted,
    });
  }, [selectedNotes, setStep1Value, isStep1Submitted]);

  const onStep2Submit = (step2Data: Step2Values) => {
    const fullPayload = { ...step1Form.getValues(), ...step2Data };
    console.log("submit payload: ", fullPayload);
    alert("Submit (mock). Kolla console för payload.");
  };

  if (step === 2) {
    return (
      <AssesmentStepTwo
        register={step2Form.register}
        onSubmit={step2Form.handleSubmit(onStep2Submit)}
        onBack={() => setStep(1)}
        countries={countries}
        isCountriesLoading={isCountriesLoading}
        errors={step2Form.formState.errors}
      />
    );
  }

  return (
    <AssesmentStepOne
      register={step1Form.register}
      onSubmit={step1Form.handleSubmit(() => setStep(2))}
      selectedNotes={selectedNotes}
      customNoteInput={customNoteInput}
      setCustomNoteInput={setCustomNoteInput}
      toggleNote={toggleNote}
      addCustomNote={addCustomNote}
      removeNote={removeNote}
      handleCustomNoteKeyDown={handleCustomNoteKeyDown}
      isNoteSelected={isNoteSelected}
      errors={step1Form.formState.errors}
    />
  );
}

export default AssessmentForm;
