import type { FragranceRecommendation, FragranceType } from "./types";
import s from "./RecommendationResults.module.css";

const typeConfig: Record<FragranceType, { label: string; icon: string }> = {
  niche: { label: "Nisch", icon: "💎" },
  designer: { label: "Designer", icon: "🏷️" },
  dupe: { label: "Dupe", icon: "♻️" },
};

function matchBadgeClass(score: number): string {
  if (score >= 85) return s.matchBadgeHigh;
  if (score >= 70) return s.matchBadgeMid;
  return s.matchBadgeLow;
}

type RecommendationResultsProps = {
  recommendations: FragranceRecommendation[];
  onRestart: () => void;
};

export function RecommendationResults({
  recommendations,
  onRestart,
}: RecommendationResultsProps) {
  const sorted = [...recommendations].sort((a, b) => b.matchScore - a.matchScore);

  return (
    <div className={s.page}>
      <div className={s.container}>
        <div className={s.header}>
          <div className={s.headerIcon}>✨</div>
          <h1 className={s.headerTitle}>Dina rekommendationer</h1>
          <p className={s.headerSubtitle}>
            Vi hittade {recommendations.length} doft
            {recommendations.length !== 1 ? "er" : ""} som matchar din profil
          </p>
        </div>

        {sorted.length === 0 ? (
          <div className={s.empty}>
            <div className={s.emptyIcon}>🔍</div>
            <h2 className={s.emptyTitle}>Inga dofter hittades</h2>
            <p className={s.emptyText}>
              Försök igen med andra preferenser.
            </p>
            <button onClick={onRestart} className={s.restartButton}>
              ← Gör om analysen
            </button>
          </div>
        ) : (
          <>
            <div className={s.grid}>
              {sorted.map((frag) => (
                <article key={frag.id} className={s.card}>
                  <div className={s.imageArea}>
                    {frag.imageUrl ? (
                      <img
                        src={frag.imageUrl}
                        alt={frag.name}
                        className={s.image}
                      />
                    ) : (
                      <span className={s.imagePlaceholderIcon}>🧴</span>
                    )}
                    <span className={`${s.matchBadge} ${matchBadgeClass(frag.matchScore)}`}>
                      {frag.matchScore}% match
                    </span>
                  </div>

                  <div className={s.cardBody}>
                    <div className={s.cardTop}>
                      <div>
                        <p className={s.brand}>{frag.brand}</p>
                        <h2 className={s.name}>{frag.name}</h2>
                      </div>
                      <span className={s.typeBadge}>
                        <span aria-hidden="true">{typeConfig[frag.type].icon}</span>
                        {typeConfig[frag.type].label}
                      </span>
                    </div>

                    <p className={s.description}>{frag.description}</p>

                    <div>
                      <p className={s.notesLabel}>NOTER</p>
                      <div className={s.notesList}>
                        {frag.notes.map((note) => (
                          <span key={note} className={s.noteChip}>
                            {note}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className={s.cardFooter}>
                      <span className={s.priceRange}>{frag.priceRange}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <button onClick={onRestart} className={s.restartButton}>
              ← Gör om analysen
            </button>
          </>
        )}
      </div>
    </div>
  );
}
