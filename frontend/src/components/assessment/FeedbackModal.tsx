import { useState } from "react";
import { Star, X, CheckCircle } from "lucide-react";
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
    // Auto-close after thank-you message
    setTimeout(onClose, 2500);
  };

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div
        className={s.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Close button */}
        <button className={s.modalClose} onClick={onClose} aria-label="Stäng">
          <X size={18} />
        </button>

        {/* ── Phase: prompt ── */}
        {phase === "prompt" && (
          <div className={s.modalPrompt}>
            <p className={s.modalTitle}>Vill du hjälpa oss förbättras?</p>
            <p className={s.modalSub}>Svara på ett kort formulär — det tar under en minut.</p>
            <div className={s.modalPromptButtons}>
              <button className={s.modalYesButton} onClick={() => setPhase("form")}>
                Ja, gärna!
              </button>
              <button className={s.modalNoButton} onClick={onClose}>
                Nej tack
              </button>
            </div>
          </div>
        )}

        {/* ── Phase: form ── */}
        {phase === "form" && (
          <div className={s.modalForm}>
            <p className={s.modalTitle}>Berätta vad du tyckte</p>

            {/* Star rating */}
            <div className={s.modalField}>
              <label className={s.modalLabel}>Betyg på rekommendationerna</label>
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
                      size={28}
                      strokeWidth={1.5}
                      className={
                        (hover ?? rating ?? 0) >= star ? s.starFilled : s.starEmpty
                      }
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div className={s.modalField}>
              <label className={s.modalLabel}>Kommentarer <span className={s.optionalBadge}>valfritt</span></label>
              <textarea
                className={s.modalTextarea}
                placeholder="Vad tyckte du om rekommendationerna?"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
              />
            </div>

            {/* Name */}
            <div className={s.modalField}>
              <label className={s.modalLabel}>Namn <span className={s.optionalBadge}>valfritt</span></label>
              <input
                className={s.modalInput}
                type="text"
                placeholder="Ditt namn"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Gender */}
            <div className={s.modalField}>
              <label className={s.modalLabel}>Kön <span className={s.optionalBadge}>valfritt</span></label>
              <div className={s.modalRadioRow}>
                {(["male", "female", "unspecified"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`${s.modalChip} ${gender === g ? s.modalChipSelected : ""}`}
                  >
                    {g === "male" ? "Man" : g === "female" ? "Kvinna" : "Annat"}
                  </button>
                ))}
              </div>
            </div>

            {/* Age */}
            <div className={s.modalField}>
              <label className={s.modalLabel}>Ålder <span className={s.optionalBadge}>valfritt</span></label>
              <input
                className={s.modalInput}
                type="number"
                placeholder="Din ålder"
                min={0}
                max={99}
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>

            {/* Collection size */}
            <div className={s.modalField}>
              <label className={s.modalLabel}>Antal parfymer i samlingen <span className={s.optionalBadge}>valfritt</span></label>
              <div className={s.modalRadioRow}>
                {([
                  ["lt5",    "Färre än 5"],
                  ["5to10",  "5–10"],
                  ["10plus", "Fler än 10"],
                ] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCollection(val)}
                    className={`${s.modalChip} ${collectionSize === val ? s.modalChipSelected : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Email */}
            <div className={s.modalField}>
              <label className={s.modalLabel}>E-post <span className={s.optionalBadge}>valfritt</span></label>
              <input
                className={s.modalInput}
                type="email"
                placeholder="din@email.se"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button
              className={s.modalSubmitButton}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Skickar…" : "Skicka feedback"}
            </button>
          </div>
        )}

        {/* ── Phase: done ── */}
        {phase === "done" && (
          <div className={s.modalDone}>
            <CheckCircle size={44} strokeWidth={1.25} className={s.modalDoneIcon} />
            <p className={s.modalTitle}>Tack för din feedback!</p>
            <p className={s.modalSub}>Det hjälper oss att bli bättre.</p>
          </div>
        )}
      </div>
    </div>
  );
}
