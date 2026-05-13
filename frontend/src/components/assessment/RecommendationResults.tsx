import { useEffect, useState } from "react";
import { Gem, Tag, Copy, FlaskConical, SearchX, RotateCcw, ExternalLink } from "lucide-react";
import type { FragranceRecommendation, FragranceType } from "./types";
import { AdUnit } from "../ads/AdUnit";
import { notinoLink, lykoLink } from "../../utils/affiliateLinks";
import { FeedbackModal } from "./FeedbackModal";
import { useLang } from "../../i18n";
import s from "./RecommendationResults.module.css";

function matchBadgeClass(score: number): string {
  if (score >= 85) return s.matchBadgeHigh;
  if (score >= 70) return s.matchBadgeMid;
  return s.matchBadgeLow;
}

type RecommendationResultsProps = {
  recommendations: FragranceRecommendation[];
  onRestart: () => void;
};

export function RecommendationResults({ recommendations, onRestart }: RecommendationResultsProps) {
  const { t } = useLang();
  const sorted = [...recommendations].sort((a, b) => b.matchScore - a.matchScore);

  const typeConfig: Record<FragranceType, { label: string; icon: React.ReactNode }> = {
    niche:    { label: t.niche,    icon: <Gem  size={12} strokeWidth={2} /> },
    designer: { label: t.designer, icon: <Tag  size={12} strokeWidth={2} /> },
    dupe:     { label: t.dupe,     icon: <Copy size={12} strokeWidth={2} /> },
  };

  const [showFeedback, setShowFeedback] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowFeedback(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
      <div className={s.page}>
        <div className={s.container}>
          <div className={s.header}>
            <div className={s.headerIcon}><Gem size={52} strokeWidth={1.25} /></div>
            <h1 className={s.headerTitle}>{t.resultsTitle}</h1>
            <p className={s.headerSubtitle}>{t.resultsSubtitle(recommendations.length)}</p>
          </div>

          {sorted.length === 0 ? (
            <div className={s.empty}>
              <div className={s.emptyIcon}><SearchX size={48} strokeWidth={1.25} /></div>
              <h2 className={s.emptyTitle}>{t.noResults}</h2>
              <p className={s.emptyText}>{t.noResultsText}</p>
              <button onClick={onRestart} className={s.restartButton}>
                <RotateCcw size={15} />
                <span>{t.restart}</span>
              </button>
            </div>
          ) : (
            <>
              <div className={s.grid}>
                {sorted.map((frag) => (
                  <article key={frag.id} className={s.card}>
                    <div className={s.imageArea}>
                      {frag.imageUrl ? (
                        <img src={frag.imageUrl} alt={frag.name} className={s.image} />
                      ) : (
                        <div className={s.imagePlaceholder}>
                          <FlaskConical size={48} strokeWidth={1} />
                        </div>
                      )}
                      <span className={`${s.matchBadge} ${matchBadgeClass(frag.matchScore)}`}>
                        {frag.matchScore}% {t.match}
                      </span>
                    </div>

                    <div className={s.cardBody}>
                      <div className={s.cardTop}>
                        <div>
                          <p className={s.brand}>{frag.brand}</p>
                          <h2 className={s.name}>{frag.name}</h2>
                        </div>
                        <span className={s.typeBadge}>
                          {typeConfig[frag.type].icon}
                          {typeConfig[frag.type].label}
                        </span>
                      </div>

                      <p className={s.description}>{frag.description}</p>
                      {frag.reason && <p className={s.reason}>"{frag.reason}"</p>}

                      <div>
                        <p className={s.notesLabel}>{t.notesHeading}</p>
                        {frag.notes.length > 0 ? (
                          <div className={s.notesList}>
                            {frag.notes.map((note) => (
                              <span key={note} className={s.noteChip}>{note}</span>
                            ))}
                          </div>
                        ) : (
                          <p className={s.notesEmpty}>{t.noNotes}</p>
                        )}
                      </div>

                      <div className={s.cardFooter}>
                        <span className={s.priceRange}>{frag.priceRange}</span>
                        <div className={s.buyLinks}>
                          <a href={notinoLink(frag.name, frag.brand)} target="_blank" rel="noopener noreferrer sponsored" className={s.buyButton}>
                            Notino <ExternalLink size={11} />
                          </a>
                          <a href={lykoLink(frag.name, frag.brand)} target="_blank" rel="noopener noreferrer sponsored" className={s.buyButton}>
                            Lyko <ExternalLink size={11} />
                          </a>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <AdUnit />

              <button onClick={onRestart} className={s.restartButton}>
                <RotateCcw size={15} />
                <span>{t.restart}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
