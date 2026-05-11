import { useState } from "react";
import { Star, X, CheckCircle, MessageSquare } from "lucide-react";
import { submitFeedback } from "../../services/feedbackApi";
import s from "./AssesmentForm.module.css";

type Phase = "prompt" | "form" | "done";

type Props = {
  onClose: () => void;
};

export function FeedbackModal({ onClose }: Props) {
  const [phase, setPhase]               = useState<Phase>("prompt");
  const [rating, setRating]             = useState<number | null>(null);
  const [hover, setHover]               = useState<number | null>(null);
  const [comments, setComments]         = useState("");
  const [name, setName]                 = useState("");
  const [gender, setGender]             = useState<"male" | "female" | "unspecified" | null>(null);
  const [age, setAge]                   = useState("");
  const [collectionSize, setCollection] = useState<"lt5" | "5to10" | "10plus" | null>(null);
  const [email, setEmail]               = useState("");
  const [submitting, setSubmitting]     = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await submitFeedback({
      rating,
      comments,
      name,
      gender,
      age: age ? parseInt(age, 10) : null,
      collectionSize,
      email,
    });
    setPhase("done");
    setSubmitting(false);
    setTimeout(onClose, 2500);
  };

  return (
    /* No overlay — fixed bottom banner, pointer-events only on the banner itself */
    <div className={s.feedbackBanner} role="dialog" aria-modal="false">
      {/* Close */}
      <button className={s.feedbackClose} onClick={onClose} aria-label="Stäng">
        <X size={16} />
      </button>

      {/* ── Phase: prompt ── */}
      {phase === "prompt" && (
        <div className={s.feedbackPrompt}>
          <MessageSquare size={18} className={s.feedbackIcon} strokeWidth={1.5} />
          <div className={s.feedbackPromptText}>
            <p className={s.feedbackTitle}>Vill du hjälpa oss förbättras?</p>
            <p className={s.feedbackSub}>Svara på ett kort formulär — tar under en minut.</p>
          </div>
          <div className={s.feedbackPromptButtons}>
            <button className={s.feedbackYesBtn} onClick={() => setPhase("form")}>
              Ja, gärna
            </button>
            <button className={s.feedbackNoBtn} onClick={onClose}>
              Nej tack
            </button>
          </div>
        </div>
      )}

      {/* ── Phase: form ── */}
      {phase === "form" && (
        <div className={s.feedbackForm}>
          <p className={s.feedbackTitle}>Berätta vad du tyckte</p>

          {/* Star rating */}
          <div className={s.feedbackRow}>
            <label className={s.feedbackLabel}>Betyg</label>
            <div className={s.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={s.starButton}
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setRating(star)}
                  aria-label={`${star} stjärnor`}
                >
                  <Star
                    size={26}
                    strokeWidth={1.5}
                    className={(hover ?? rating ?? 0) >= star ? s.starFilled : s.starEmpty}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div className={s.feedbackRow}>
            <label className={s.feedbackLabel}>Kommentarer</label>
            <textarea
              className={s.feedbackTextarea}
              placeholder="Vad tyckte du om rekommendationerna?"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={2}
            />
          </div>

          {/* Name + Age side by side */}
          <div className={s.feedbackGrid2}>
            <div className={s.feedbackRow}>
              <label className={s.feedbackLabel}>Namn</label>
              <input className={s.feedbackInput} type="text" placeholder="Ditt namn"
                value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className={s.feedbackRow}>
              <label className={s.feedbackLabel}>Ålder</label>
              <input className={s.feedbackInput} type="number" placeholder="Din ålder"
                min={0} max={99} value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
          </div>

          {/* Gender */}
          <div className={s.feedbackRow}>
            <label className={s.feedbackLabel}>Kön</label>
            <div className={s.feedbackChipRow}>
              {(["male", "female", "unspecified"] as const).map((g) => (
                <button key={g} type="button" onClick={() => setGender(g)}
                  className={`${s.feedbackChip} ${gender === g ? s.feedbackChipOn : ""}`}>
                  {g === "male" ? "Man" : g === "female" ? "Kvinna" : "Annat"}
                </button>
              ))}
            </div>
          </div>

          {/* Collection size */}
          <div className={s.feedbackRow}>
            <label className={s.feedbackLabel}>Antal parfymer i samlingen</label>
            <div className={s.feedbackChipRow}>
              {([["lt5","< 5"],["5to10","5–10"],["10plus","10+"]] as const).map(([val,lbl]) => (
                <button key={val} type="button" onClick={() => setCollection(val)}
                  className={`${s.feedbackChip} ${collectionSize === val ? s.feedbackChipOn : ""}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Email */}
          <div className={s.feedbackRow}>
            <label className={s.feedbackLabel}>E-post</label>
            <input className={s.feedbackInput} type="email" placeholder="din@email.se"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <button className={s.feedbackSubmitBtn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Skickar…" : "Skicka feedback"}
          </button>
        </div>
      )}

      {/* ── Phase: done ── */}
      {phase === "done" && (
        <div className={s.feedbackDone}>
          <CheckCircle size={28} strokeWidth={1.5} className={s.feedbackDoneIcon} />
          <div>
            <p className={s.feedbackTitle}>Tack för din feedback!</p>
            <p className={s.feedbackSub}>Det hjälper oss att bli bättre.</p>
          </div>
        </div>
      )}
    </div>
  );
}
