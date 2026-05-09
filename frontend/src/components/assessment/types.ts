export type Season = "spring" | "summer" | "autumn" | "winter" | "all_year";

export type Gender = "male" | "female" | "unspecified";

export type CollectionSize = "lt5" | "5to10" | "10plus";

export type PredefinedNote = {
  label: string;
  emoji: string;
};

export type FragranceType = "niche" | "designer" | "dupe";

export type FragranceRecommendation = {
  id: string;
  name: string;
  brand: string;
  description: string;
  notes: string[];
  imageUrl?: string;
  matchScore: number; // 0–100
  type: FragranceType;
  priceRange: string;
};
