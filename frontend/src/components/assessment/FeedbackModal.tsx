import { useState } from "react";
import { Star, X, CheckCircle, MessageSquare } from "lucide-react";
import { submitFeedback } from "../../services/feedbackApi";
import { useLang } from "../../i18n";
import s from "./AssesmentForm.module.css";

type Phase = "prompt" | "form" | "done";
type Props = { onClose: () => void };

export function FeedbackModal({ onClose }: Props) {
  const { t } = useLang();
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
    await submitFeedback({ rating, comments, name, gender, age: age ? parseInt(age, 10) : null, collectionSize, email });
    setPhase("done");
    setSubmitting(false);
    setTimeout(onClose, 2500);
  };

  return (
    <div className={s.feedbackBanner} role="dialog" aria-modal="false">
      <button className={s.feedbackClose} onClick={onClose} aria-label={t.fbClose}>
        <X size={16} />
      </button>

      {phase === "prompt" && (
        <div className={s.feedbackPrompt}>
          <MessageSquare size={18} className={s.feedbackIcon} strokeWidth={1.5} />
          <div className={s.feedbackPromptText}>
            <p className={s.feedbackTitle}>{t.fbWantHelp}</p>
            <p className={s.feedbackSub}>{t.fbShort}</p>
          </div>
          <div className={s.feedbackPromptButtons}>
            <button className={s.feedbackYesBtn} onClick={() => setPhase("form")}>{t.fbYes}</button>
            <button className={s.feedbackNoBtn} onClick={onClose}>{t.fbNo}</button>
          </div>
        </div>
      )}

      {phase === "form" && (
        <div className={s.feedbackForm}>
          <p className={s.feedbackTitle}>{t.fbTitle}</p>

          <div className={s.feedbackRow}>
            <label className={s.feedbackLabel}>{t.fbRating}</label>
            <div className={s.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" className={s.starButton}
                  onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(null)}
                  onClick={() => setRating(star)} aria-label={`${star}`}>
                  <Star size={26} strokeWidth={1.5}
                    className={(hover ?? rating ?? 0) >= star ? s.starFilled : s.starEmpty} />
                </button>
              ))}
            </div>
          </div>

          <div className={s.feedbackRow}>
            <label className={s.feedbackLabel}>{t.fbComments}</label>
            <textarea className={s.feedbackTextarea} placeholder={t.fbCommentsPh}
              value={comments} onChange={(e) => setComments(e.target.value)} rows={2} />
          </div>

          <div className={s.feedbackGrid2}>
            <div className={s.feedbackRow}>
              <label className={s.feedbackLabel}>{t.fbName}</label>
              <input className={s.feedbackInput} type="text" placeholder={t.fbNamePh}
                value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className={s.feedbackRow}>
              <label className={s.feedbackLabel}>{t.fbAge}</label>
              <input className={s.feedbackInput} type="number" placeholder={t.fbAgePh}
                min={0} max={99} value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
          </div>

          <div className={s.feedbackRow}>
            <label className={s.feedbackLabel}>{t.fbGender}</label>
            <div className={s.feedbackChipRow}>
              {([["male", t.fbMale], ["female", t.fbFemale], ["unspecified", t.fbOther]] as const).map(([g, lbl]) => (
                <button key={g} type="button" onClick={() => setGender(g)}
                  className={`${s.feedbackChip} ${gender === g ? s.feedbackChipOn : ""}`}>{lbl}</button>
              ))}
            </div>
          </div>

          <div className={s.feedbackRow}>
            <label className={s.feedbackLabel}>{t.fbCollection}</label>
            <div className={s.feedbackChipRow}>
              {([["lt5","< 5"],["5to10","5–10"],["10plus","10+"]] as const).map(([val, lbl]) => (
                <button key={val} type="button" onClick={() => setCollection(val)}
                  className={`${s.feedbackChip} ${collectionSize === val ? s.feedbackChipOn : ""}`}>{lbl}</button>
              ))}
            </div>
          </div>

          <div className={s.feedbackRow}>
            <label className={s.feedbackLabel}>{t.fbEmail}</label>
            <input className={s.feedbackInput} type="email" placeholder={t.fbEmailPh}
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <button className={s.feedbackSubmitBtn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? t.fbSubmitting : t.fbSubmit}
          </button>
        </div>
      )}

      {phase === "done" && (
        <div className={s.feedbackDone}>
          <CheckCircle size={28} strokeWidth={1.5} className={s.feedbackDoneIcon} />
          <div>
            <p className={s.feedbackTitle}>{t.fbThanks}</p>
            <p className={s.feedbackSub}>{t.fbThanksText}</p>
          </div>
        </div>
      )}
    </div>
  );
}
