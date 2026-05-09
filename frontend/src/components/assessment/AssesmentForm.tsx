import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FlaskConical, Sparkles, User } from "lucide-react";
import { AssesmentStepOne } from "./AssesmentStepOne";
import { AssesmentStepTwo } from "./AssesmentStepTwo";
import { RecommendationResults } from "./RecommendationResults";
import { useCountries } from "./hooks/useCountries";
import { useNoteChips } from "./hooks/useNoteChips";
import { step1Schema, step2Schema } from "./validation";
import type { Step1Values, Step2Values } from "./validation";
import type { FragranceRecommendation } from "./types";
import { fetchRecommendations } from "../../services/fragranceApi";
import s from "./AssesmentForm.module.css";

// ─── TEST NAMES ────────────────────────────────────────────────────────────
// Temporary: manually enter fragrance names here to test the fragrance API.
// When the AI integration is ready, this array is replaced by the AI response.
// Format: { name: string, matchScore: 0-100, type?: "niche"|"designer"|"dupe" }
const TEST_FRAGRANCE_NAMES: { name: string; matchScore: number; type?: FragranceRecommendation["type"] }[] = [
  { name: "Red Tobacco", matchScore: 94, type: "niche" },
  { name: "Alexandria II", matchScore: 87, type: "niche" },
  { name: "afnan 9am dive", matchScore: 81, type: "dupe" },
];

type AppView = "step1" | "transitioning" | "step2" | "loading-results" | "results";

export function AssessmentForm() {
  const [view, setView] = useState<AppView>("step1");
  const [recommendations, setRecommendations] = useState<FragranceRecommendation[]>([]);

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
      fragranceGender: "unisex",
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

  const onStep1Submit = () => {
    setView("transitioning");
    setTimeout(() => setView("step2"), 600);
  };

  const onStep2Submit = async (step2Data: Step2Values) => {
    const fullPayload = { ...step1Form.getValues(), ...step2Data };
    console.log("submit payload:", fullPayload);
    setView("loading-results");
    try {
      // TODO (Phase 6): replace TEST_FRAGRANCE_NAMES with names returned by the AI API
      const results = await fetchRecommendations(TEST_FRAGRANCE_NAMES);
      setRecommendations(results);
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
    } finally {
      setView("results");
    }
  };

  if (view === "transitioning") {
    return (
      <div className={s.loadingPage}>
        <div className={s.loadingContent}>
          <div className={s.loadingIcon}>
            <User size={64} strokeWidth={1} />
          </div>
          <p className={s.loadingTitle}>Förbereder din profil…</p>
          <div className={s.loadingDots}>
            <span className={s.dot} />
            <span className={s.dot} />
            <span className={s.dot} />
          </div>
        </div>
      </div>
    );
  }

  if (view === "loading-results") {
    return (
      <div className={s.loadingPage}>
        <div className={s.loadingContent}>
          <div className={s.loadingIcon}>
            <Sparkles size={64} strokeWidth={1} />
          </div>
          <p className={s.loadingTitle}>Analyserar dina preferenser…</p>
          <p className={s.loadingSubtitle}>Hittar dina perfekta dofter</p>
          <div className={s.loadingDots}>
            <span className={s.dot} />
            <span className={s.dot} />
            <span className={s.dot} />
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
