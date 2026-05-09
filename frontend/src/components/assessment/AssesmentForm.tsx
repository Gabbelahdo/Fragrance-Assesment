import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles, User } from "lucide-react";
import { AssesmentStepOne } from "./AssesmentStepOne";
import { AssesmentStepTwo } from "./AssesmentStepTwo";
import { RecommendationResults } from "./RecommendationResults";
import { useCountries } from "./hooks/useCountries";
import { useNoteChips } from "./hooks/useNoteChips";
import { step1Schema, step2Schema } from "./validation";
import type { Step1Values, Step2Values } from "./validation";
import type { FragranceRecommendation } from "./types";
import { submitAssessment } from "../../services/fragranceApi";
import { loadSession, saveSession } from "../../services/userApi";
import s from "./AssesmentForm.module.css";

type AppView = "step1" | "transitioning" | "step2" | "loading-results" | "results";

export function AssessmentForm() {
  const [view, setView]                   = useState<AppView>("step1");
  const [recommendations, setRecommendations] = useState<FragranceRecommendation[]>([]);
  const [welcomeName, setWelcomeName]     = useState<string | undefined>(undefined);

  const { countries, isCountriesLoading } = useCountries();

  const {
    selectedNotes, customNoteInput, setCustomNoteInput,
    toggleNote, addCustomNote, removeNote,
    handleCustomNoteKeyDown, isNoteSelected,
  } = useNoteChips();

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      budgetMin: 0, budgetMax: 10000,
      season: "all_year", fragranceGender: "unisex",
      notesText: "", preferNiche: false, preferDesigner: false, preferDupe: false,
    },
  });

  const step2Form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: { name: "", age: undefined, gender: undefined, country: "", collectionSize: undefined },
  });

  const { setValue: setStep1Value, formState: { isSubmitted: isStep1Submitted } } = step1Form;

  // ── Sync selected notes into the hidden notesText field ────────────────────
  useEffect(() => {
    setStep1Value("notesText", selectedNotes.join(", "), { shouldValidate: isStep1Submitted });
  }, [selectedNotes, setStep1Value, isStep1Submitted]);

  // ── Load saved session on mount and pre-fill Step 2 ────────────────────────
  useEffect(() => {
    loadSession().then((profile) => {
      if (!profile) return;
      step2Form.setValue("name",           profile.name);
      step2Form.setValue("age",            profile.age);
      step2Form.setValue("gender",         profile.gender);
      step2Form.setValue("country",        profile.country);
      step2Form.setValue("collectionSize", profile.collectionSize);
      setWelcomeName(profile.name);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step navigation ────────────────────────────────────────────────────────
  const onStep1Submit = () => {
    setView("transitioning");
    setTimeout(() => setView("step2"), 600);
  };

  const onStep2Submit = async (step2Data: Step2Values) => {
    const fullPayload = { ...step1Form.getValues(), ...step2Data };

    // Save profile to session (best-effort, does not block)
    saveSession({
      name:           step2Data.name,
      age:            step2Data.age,
      gender:         step2Data.gender,
      country:        step2Data.country,
      collectionSize: step2Data.collectionSize,
    });

    setView("loading-results");
    try {
      const results = await submitAssessment(fullPayload);
      setRecommendations(results);
    } catch (err) {
      console.error("[AssesmentForm] Failed to get recommendations:", err);
    } finally {
      setView("results");
    }
  };

  // ── Views ──────────────────────────────────────────────────────────────────
  if (view === "transitioning") {
    return (
      <div className={s.loadingPage}>
        <div className={s.loadingContent}>
          <div className={s.loadingIcon}><User size={64} strokeWidth={1} /></div>
          <p className={s.loadingTitle}>Förbereder din profil…</p>
          <div className={s.loadingDots}>
            <span className={s.dot} /><span className={s.dot} /><span className={s.dot} />
          </div>
        </div>
      </div>
    );
  }

  if (view === "loading-results") {
    return (
      <div className={s.loadingPage}>
        <div className={s.loadingContent}>
          <div className={s.loadingIcon}><Sparkles size={64} strokeWidth={1} /></div>
          <p className={s.loadingTitle}>Analyserar dina preferenser…</p>
          <p className={s.loadingSubtitle}>Hittar dina perfekta dofter</p>
          <div className={s.loadingDots}>
            <span className={s.dot} /><span className={s.dot} /><span className={s.dot} />
          </div>
        </div>
      </div>
    );
  }

  if (view === "results") {
    return (
      <RecommendationResults
        recommendations={recommendations}
        onRestart={() => {
          step1Form.reset();
          step2Form.reset();
          setRecommendations([]);
          setView("step1");
        }}
      />
    );
  }

  if (view === "step2") {
    return (
      <AssesmentStepTwo
        register={step2Form.register}
        onSubmit={step2Form.handleSubmit(onStep2Submit)}
        onBack={() => setView("step1")}
        countries={countries}
        isCountriesLoading={isCountriesLoading}
        errors={step2Form.formState.errors}
        welcomeName={welcomeName}
      />
    );
  }

  return (
    <AssesmentStepOne
      register={step1Form.register}
      onSubmit={step1Form.handleSubmit(onStep1Submit)}
      selectedNotes={selectedNotes}
      customNoteInput={customNoteInput}
      setCustomNoteInput={setCustomNoteInput}
      toggleNote={toggleNote}
      addCustomNote={addCustomNote}
      removeNote={removeNote}
      handleCustomNoteKeyDown={handleCustomNoteKeyDown}
      isNoteSelected={isNoteSelected}
      errors={step1Form.formState.errors}
      initialBudgetMin={step1Form.getValues("budgetMin")}
      initialBudgetMax={step1Form.getValues("budgetMax")}
    />
  );
}

export default AssessmentForm;
