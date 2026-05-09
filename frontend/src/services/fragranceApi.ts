import type { FragranceRecommendation } from "../components/assessment/types";
import type { AssessmentFormValues } from "../components/assessment/validation";

// ---------------------------------------------------------------------------
// submitAssessment — POST the full form payload to the FastAPI backend.
//
// The backend calls Claude (AI) for 5 fragrance suggestions, enriches each
// one with live Fragella API data, and returns a ready-to-render list.
// The Vite dev proxy forwards /api/* → http://localhost:8000 so CORS is not
// an issue during local development.
// ---------------------------------------------------------------------------
export async function submitAssessment(
  payload: AssessmentFormValues
): Promise<FragranceRecommendation[]> {
  const response = await fetch("/api/ai/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // The backend model has camelCase aliases so we can send the form
    // values as-is — no key conversion needed.
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Backend error ${response.status}: ${errorText}`);
  }

  const data: FragranceRecommendation[] = await response.json();
  return data;
}

// ---------------------------------------------------------------------------
// Legacy direct-Fragella helpers (kept for the /fragrances/search fallback
// and for any future standalone lookups).
// ---------------------------------------------------------------------------

const FRAGELLA_URL = import.meta.env.DEV
  ? "/fragrance-proxy"
  : (import.meta.env.VITE_FRAGRANCE_API_URL as string);

const FRAGELLA_KEY: string | null = import.meta.env.DEV
  ? null
  : (import.meta.env.VITE_FRAGRANCE_API_KEY as string);

interface FragellaNote {
  name: string;
  imageUrl: string;
}

interface FragellaResult {
  Name: string;
  Brand: string;
  "Image URL": string | null;
  "General Notes": string[];
  Notes: {
    Top: FragellaNote[];
    Middle: FragellaNote[];
    Base: FragellaNote[];
  };
  Price: string | null;
  OilType: string | null;
  Gender: string | null;
  Longevity: string | null;
  Sillage: string | null;
  Year: string | null;
  rating: string | null;
  Confidence: string | null;
  Popularity: string | null;
}

function flattenNotes(notes: FragellaResult["Notes"] | null | undefined): string[] {
  if (!notes) return [];
  return [
    ...(notes.Top ?? []).map((n) => n.name),
    ...(notes.Middle ?? []).map((n) => n.name),
    ...(notes.Base ?? []).map((n) => n.name),
  ];
}

function formatPrice(price: string | null): string {
  if (!price) return "Price not available";
  const num = parseFloat(price);
  if (isNaN(num)) return "Price not available";
  return `${Math.round(num)} kr`;
}

async function fetchFragranceByName(name: string): Promise<FragellaResult | null> {
  const url = `${FRAGELLA_URL}/v1/fragrances?search=${encodeURIComponent(name)}&limit=1`;
  const headers: Record<string, string> = {};
  if (FRAGELLA_KEY) headers["x-api-key"] = FRAGELLA_KEY;

  const response = await fetch(url, { headers });
  if (!response.ok) return null;

  const data: FragellaResult[] = await response.json();
  return data[0] ?? null;
}

/** @deprecated Use submitAssessment instead — this calls Fragella directly from the browser. */
export async function fetchRecommendations(
  names: { name: string; matchScore: number; type?: FragranceRecommendation["type"] }[]
): Promise<FragranceRecommendation[]> {
  const results = await Promise.allSettled(
    names.map(({ name, matchScore, type }, index) =>
      fetchFragranceByName(name).then((data): FragranceRecommendation | null => {
        if (!data) return null;
        return {
          id: `${index}-${data.Name}`,
          name: data.Name,
          brand: data.Brand,
          description:
            `${data.OilType ?? ""}${data.Longevity ? ` · Longevity: ${data.Longevity}` : ""}${data.Sillage ? ` · Sillage: ${data.Sillage}` : ""}`.trim() ||
            "No description available.",
          notes: flattenNotes(data.Notes),
          imageUrl: data["Image URL"] ?? undefined,
          matchScore,
          type: type ?? (data.Popularity === "Low" || data.Popularity === "Very Low" ? "niche" : "designer"),
          priceRange: formatPrice(data.Price),
        };
      })
    )
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<FragranceRecommendation> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);
}
