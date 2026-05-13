import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Clock, RotateCcw, Sparkles } from "lucide-react";
import { AssesmentStepOne } from "./AssesmentStepOne";
import { RecommendationResults } from "./RecommendationResults";
import { useChipInput } from "./hooks/useChipInput";
import { useNoteChips } from "./hooks/useNoteChips";
import { step1Schema } from "./validation";
import type { Step1Values } from "./validation";
import type { FragranceRecommendation } from "./types";
import { AssessmentError, submitAssessment } from "../../services/fragranceApi";
import s from "./AssesmentForm.module.css";

// ── Loading messages — cycle through to show progress ─────────────────────────
const LOADING_MESSAGES = [
  { title: "Analyserar dina preferenser…",    subtitle: "Det här tar ungefär 30 sekunder" },
  { title: "Konsulterar AI-doftexperten…",    subtitle: "Går igenom tusentals dofter" },
  { title: "Matchar noter och säsonger…",     subtitle: "Snart klart" },
  { title: "Avslutar rekommendationerna…",    subtitle: "Nästan där" },
];
const LOADING_STEP_DELAYS = [8000, 16000, 24000]; // ms after start to advance step

type AppView = "step1" | "loading-results" | "results" | "error";

export function AssessmentForm() {
  const [view, setView]                       = useState<AppView>("step1");
  const [recommendations, setRecommendations] = useState<FragranceRecommendation[]>([]);
  const [errorInfo, setErrorInfo]             = useState<{ title: string; message: string } | null>(null);
  const [loadingStep, setLoadingStep]         = useState(0);
  const loadingTimers                         = useRef<ReturnType<typeof setTimeout>[]>([]);

  const {
    selectedNotes, customNoteInput, setCustomNoteInput,
    toggleNote, addCustomNote, removeNote,
    handleCustomNoteKeyDown, isNoteSelected,
  } = useNoteChips();

  // Liked brands chip input
  const {
    chips: likedBrands,
    input: likedBrandInput,
    setInput: setLikedBrandInput,
    addChip: addLikedBrand,
    addChipValue: addLikedBrandValue,
    removeChip: removeLikedBrand,
    handleKeyDown: handleLikedBrandKeyDown,
  } = useChipInput();

  // Liked fragrances chip input
  const {
    chips: likedFragrances,
    input: likedFragranceInput,
    setInput: setLikedFragranceInput,
    addChip: addLikedFragrance,
    addChipValue: addLikedFragranceValue,
    removeChip: removeLikedFragrance,
    handleKeyDown: handleLikedFragranceKeyDown,
  } = useChipInput();

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      budgetMin: 0, budgetMax: 10000,
      notesText: "", descriptionText: "",
      likedBrandsText: "", likedFragrancesText: "",
      preferNiche: false, preferDesigner: false, preferDupe: false,
    },
  });

  const { setValue: setStep1Value, formState: { isSubmitted: isStep1Submitted } } = step1Form;

  // ── Sync selected notes into hidden field ──────────────────────────────────
  useEffect(() => {
    setStep1Value("notesText", selectedNotes.join(", "), { shouldValidate: isStep1Submitted });
  }, [selectedNotes, setStep1Value, isStep1Submitted]);

  // ── Sync liked brands chips into hidden field ─────────────────────────────
  useEffect(() => {
    setStep1Value("likedBrandsText", likedBrands.join(", "));
  }, [likedBrands, setStep1Value]);

  // ── Sync liked fragrances chips into hidden field ──────────────────────────
  useEffect(() => {
    setStep1Value("likedFragrancesText", likedFragrances.join(", "));
  }, [likedFragrances, setStep1Value]);

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

  // ── Submit — no Step 2, go straight to AI ─────────────────────────────────
  const onStep1Submit = async (step1Data: Step1Values) => {
    setView("loading-results");

    try {
      const results = await submitAssessment(step1Data);
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

  // ── Restart ────────────────────────────────────────────────────────────────
  const handleRestart = () => {
    step1Form.reset();
    setRecommendations([]);
    setErrorInfo(null);
    setView("step1");
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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
            <button onClick={() => setView("step1")} className={s.retryButton}>
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
      likedBrands={likedBrands}
      likedBrandInput={likedBrandInput}
      setLikedBrandInput={setLikedBrandInput}
      addLikedBrand={addLikedBrand}
      addLikedBrandValue={addLikedBrandValue}
      removeLikedBrand={removeLikedBrand}
      handleLikedBrandKeyDown={handleLikedBrandKeyDown}
      likedFragrances={likedFragrances}
      likedFragranceInput={likedFragranceInput}
      setLikedFragranceInput={setLikedFragranceInput}
      addLikedFragrance={addLikedFragrance}
      addLikedFragranceValue={addLikedFragranceValue}
      removeLikedFragrance={removeLikedFragrance}
      handleLikedFragranceKeyDown={handleLikedFragranceKeyDown}
    />
  );
}

export default AssessmentForm;
