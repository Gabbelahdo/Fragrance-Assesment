import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Clock, RotateCcw, Sparkles, User } from "lucide-react";
import { AssesmentStepOne } from "./AssesmentStepOne";
import { AssesmentStepTwo } from "./AssesmentStepTwo";
import { RecommendationResults } from "./RecommendationResults";
import { useCountries } from "./hooks/useCountries";
import { useChipInput } from "./hooks/useChipInput";
import { useNoteChips } from "./hooks/useNoteChips";
import { step1Schema, step2Schema } from "./validation";
import type { Step1Values, Step2Values } from "./validation";
import type { FragranceRecommendation } from "./types";
import { AssessmentError, submitAssessment } from "../../services/fragranceApi";
import { loadSession, saveSession } from "../../services/userApi";
import s from "./AssesmentForm.module.css";

// ── Loading messages — cycle through to show progress ─────────────────────────
const LOADING_MESSAGES = [
  { title: "Analyserar dina preferenser…",    subtitle: "Det här tar ungefär 30 sekunder" },
  { title: "Konsulterar AI-doftexperten…",    subtitle: "Går igenom tusentals dofter" },
  { title: "Matchar noter och säsonger…",     subtitle: "Snart klart" },
  { title: "Avslutar rekommendationerna…",    subtitle: "Nästan där" },
];
const LOADING_STEP_DELAYS = [8000, 16000, 24000]; // ms after start to advance step

type AppView = "step1" | "transitioning" | "step2" | "loading-results" | "results" | "error";

export function AssessmentForm() {
  const [view, setView]                       = useState<AppView>("step1");
  const [recommendations, setRecommendations] = useState<FragranceRecommendation[]>([]);
  const [welcomeName, setWelcomeName]         = useState<string | undefined>(undefined);
  const [errorInfo, setErrorInfo]             = useState<{ title: string; message: string } | null>(null);
  const [loadingStep, setLoadingStep]         = useState(0);
  const loadingTimers                         = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { countries, isCountriesLoading } = useCountries();

  const {
    selectedNotes, customNoteInput, setCustomNoteInput,
    toggleNote, addCustomNote, removeNote,
    handleCustomNoteKeyDown, isNoteSelected,
  } = useNoteChips();

  const {
    chips: likedFragrances,
    input: likedFragranceInput,
    setInput: setLikedFragranceInput,
    addChip: addLikedFragrance,
    removeChip: removeLikedFragrance,
    handleKeyDown: handleLikedFragranceKeyDown,
  } = useChipInput();

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      budgetMin: 0, budgetMax: 10000,
      season: "all_year", fragranceGender: "unisex",
      notesText: "", descriptionText: "", likedFragrancesText: "",
      preferNiche: false, preferDesigner: false, preferDupe: false,
    },
  });

  const step2Form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: { name: "", age: undefined, gender: undefined, country: "", collectionSize: undefined },
  });

  const { setValue: setStep1Value, formState: { isSubmitted: isStep1Submitted } } = step1Form;

  // ── Sync selected notes into hidden field ──────────────────────────────────
  useEffect(() => {
    setStep1Value("notesText", selectedNotes.join(", "), { shouldValidate: isStep1Submitted });
  }, [selectedNotes, setStep1Value, isStep1Submitted]);

  // ── Sync liked fragrances chips into hidden field ──────────────────────────
  useEffect(() => {
    setStep1Value("likedFragrancesText", likedFragrances.join(", "));
  }, [likedFragrances, setStep1Value]);

  // ── Load saved session and pre-fill Step 2 on mount ───────────────────────
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

  // ── Cycle loading messages while waiting for AI ────────────────────────────
  useEffect(() => {
    if (view !== "loading-results") {
      setLoadingStep(0);
      loadingTimers.current.forEach(clearTimeout);
      return;
    }
    loadingTimers.current = LOADING_STEP_DELAYS.map((delay, i) =>
      setTimeout(() => setLoadingStep(i + 1), delay),
    );
    return () => loadingTimers.current.forEach(clearTimeout);
  }, [view]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const onStep1Submit = () => {
    setView("transitioning");
    setTimeout(() => setView("step2"), 600);
  };

  const onStep2Submit = async (step2Data: Step2Values) => {
    // Save profile to session (fire-and-forget — never blocks the main flow)
    saveSession({
      name:           step2Data.name,
      age:            step2Data.age,
      gender:         step2Data.gender,
      country:        step2Data.country,
      collectionSize: step2Data.collectionSize,
    });

    setView("loading-results");

    try {
      const results = await submitAssessment({ ...step1Form.getValues(), ...step2Data });
      setRecommendations(results);
      setView("results");
    } catch (err) {
      if (err instanceof AssessmentError) {
        if (err.status === 429) {
          setErrorInfo({
            title:   "För många sökningar",
            message: err.detail,
          });
        } else {
          setErrorInfo({
            title:   "Något gick fel",
            message: "Servern svarade inte som förväntat. Försök igen om en stund.",
          });
        }
      } else {
        setErrorInfo({
          title:   "Kunde inte ansluta",
          message: "Kontrollera att backend körs på localhost:8000 och försök igen.",
        });
      }
      setView("error");
    }
  };

  // ── Restart — keep Step 2 pre-filled from saved session ───────────────────
  const handleRestart = () => {
    step1Form.reset();
    setRecommendations([]);
    setErrorInfo(null);
    // Re-populate Step 2 from session so the user doesn't retype personal info
    loadSession().then((profile) => {
      if (profile) {
        step2Form.setValue("name",           profile.name);
        step2Form.setValue("age",            profile.age);
        step2Form.setValue("gender",         profile.gender);
        step2Form.setValue("country",        profile.country);
        step2Form.setValue("collectionSize", profile.collectionSize);
        setWelcomeName(profile.name);
      } else {
        step2Form.reset();
        setWelcomeName(undefined);
      }
    });
    setView("step1");
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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
    const { title, subtitle } = LOADING_MESSAGES[Math.min(loadingStep, LOADING_MESSAGES.length - 1)];
    return (
      <div className={s.loadingPage}>
        <div className={s.loadingContent}>
          <div className={s.loadingIcon}><Sparkles size={64} strokeWidth={1} /></div>
          <p className={s.loadingTitle}>{title}</p>
          <p className={s.loadingSubtitle}>{subtitle}</p>
          <div className={s.loadingDots}>
            <span className={s.dot} /><span className={s.dot} /><span className={s.dot} />
          </div>
        </div>
      </div>
    );
  }

  if (view === "error") {
    return (
      <div className={s.errorPage}>
        <div className={s.errorContent}>
          <AlertTriangle size={52} strokeWidth={1.25} className={s.errorIcon} />
          <p className={s.errorTitle}>{errorInfo?.title ?? "Något gick fel"}</p>
          <p className={s.errorMessage}>{errorInfo?.message}</p>
          <div className={s.errorActions}>
            <button onClick={() => setView("step2")} className={s.retryButton}>
              <RotateCcw size={15} />
              <span>Försök igen</span>
            </button>
            <button onClick={handleRestart} className={s.errorBackButton}>
              <Clock size={15} />
              <span>Börja om från början</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "results") {
    return (
      <RecommendationResults
        recommendations={recommendations}
        onRestart={handleRestart}
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
      likedFragrances={likedFragrances}
      likedFragranceInput={likedFragranceInput}
      setLikedFragranceInput={setLikedFragranceInput}
      addLikedFragrance={addLikedFragrance}
      removeLikedFragrance={removeLikedFragrance}
      handleLikedFragranceKeyDown={handleLikedFragranceKeyDown}
    />
  );
}

export default AssessmentForm;
