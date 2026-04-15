import type { FragranceRecommendation, FragranceType } from "../components/assessment/types";

// ---------------------------------------------------------------------------
// Config — values come from .env.local (local) or Azure App Settings (prod)
// ---------------------------------------------------------------------------
const API_URL = import.meta.env.VITE_FRAGRANCE_API_URL as string;
const API_KEY = import.meta.env.VITE_FRAGRANCE_API_KEY as string;

// ---------------------------------------------------------------------------
// Fragella API response shape
// Docs: https://api.fragella.com
// GET /api/v1/fragrances?search={name}&limit=1
// Header: x-api-key: {key}
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function flattenNotes(notes: FragellaResult["Notes"] | null | undefined): string[] {
  if (!notes) return [];
  return [
    ...(notes.Top ?? []).map((n) => n.name),
    ...(notes.Middle ?? []).map((n) => n.name),
    ...(notes.Base ?? []).map((n) => n.name),
  ];
}

function formatPrice(price: string | null): string {
  if (!price) return "Pris ej tillgängligt";
  const num = parseFloat(price);
  if (isNaN(num)) return "Pris ej tillgängligt";
  return `${Math.round(num)} kr`;
}

function inferType(gender: string | null, popularity: string | null): FragranceType {
  // Fragella has no niche/designer field — infer from popularity as a proxy
  // This can be refined once AI integration is in place (AI returns type directly)
  if (popularity === "Low" || popularity === "Very Low") return "niche";
  return "designer";
}

// ---------------------------------------------------------------------------
// Fetch one fragrance by name — returns the best match or null
// ---------------------------------------------------------------------------
async function fetchFragranceByName(name: string): Promise<FragellaResult | null> {
  const url = `${API_URL}/v1/fragrances?search=${encodeURIComponent(name)}&limit=1`;
  console.log(`[fragranceApi] Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      "x-api-key": API_KEY,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[fragranceApi] HTTP ${response.status} for "${name}":`, body);
    return null;
  }

  const data: FragellaResult[] = await response.json();
  console.log(`[fragranceApi] Response for "${name}":`, data);
  return data[0] ?? null;
}

// ---------------------------------------------------------------------------
// Public — fetch a list of fragrance names and return enriched recommendations
// matchScores and types are passed in alongside names (AI will supply these later).
// ---------------------------------------------------------------------------
export async function fetchRecommendations(
  names: { name: string; matchScore: number; type?: FragranceType }[]
): Promise<FragranceRecommendation[]> {
  const results = await Promise.allSettled(
    names.map(({ name, matchScore, type }, index) =>
      fetchFragranceByName(name).then((data): FragranceRecommendation | null => {
        if (!data) return null;
        return {
          id: `${index}-${data.Name}`,
          name: data.Name,
          brand: data.Brand,
          description: `${data.OilType ?? ""}${data.Longevity ? ` · Lång tid: ${data.Longevity}` : ""}${data.Sillage ? ` · Spridning: ${data.Sillage}` : ""}`.trim() || "Ingen beskrivning tillgänglig.",
          notes: flattenNotes(data.Notes),
          imageUrl: data["Image URL"] ?? undefined,
          matchScore,
          type: type ?? inferType(data.Gender, data.Popularity),
          priceRange: formatPrice(data.Price),
        };
      })
    )
  );

  // Log any failures for debugging
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[fragranceApi] Request ${i} ("${names[i].name}") rejected:`, r.reason);
    }
  });

  return results
    .filter(
      (r): r is PromiseFulfilledResult<FragranceRecommendation> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);
}
