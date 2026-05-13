import type { PredefinedNote } from "../components/assessment/types";

export type Lang = "sv" | "en";

export type Translations = {
  lang: Lang;
  // Hero
  heroTitle: string;
  heroSubtitle: string;
  // Sections
  sectionPreferences: string;
  sectionFragranceType: string;
  fragranceTypeHelper: string;
  // Budget
  budget: string;
  budgetMin: string;
  budgetMax: string;
  // Season
  season: string;
  seasons: { spring: string; summer: string; autumn: string; winter: string; all_year: string };
  // Gender
  genderLabel: string;
  genderMen: string;
  genderWomen: string;
  genderUnisex: string;
  // Description
  descriptionLabel: string;
  descriptionHelper: string;
  descriptionPlaceholder: string;
  // Liked brands
  likedBrandsLabel: string;
  likedBrandsHelper: string;
  likedBrandsPh: string;
  likedBrandsAdd: string;
  // Liked fragrances
  likedFragsLabel: string;
  likedFragsHelper: string;
  likedFragsPh: string;
  likedFragsAdd: string;
  // Notes
  notesLabel: string;
  notesHelper: string;
  notesPh: string;
  notesAdd: string;
  // Type
  niche: string;
  designer: string;
  dupe: string;
  // Optional badge
  optional: string;
  // Submit
  next: string;
  // Loading messages
  loading: Array<{ title: string; subtitle: string }>;
  // Results
  resultsTitle: string;
  resultsSubtitle: (count: number) => string;
  notesHeading: string;
  noNotes: string;
  noResults: string;
  noResultsText: string;
  restart: string;
  retryBtn: string;
  backBtn: string;
  // Errors
  errSeason: string;
  errGender: string;
  errCategory: string;
  errBudgetRange: string;
  // Error page
  errTooMany: string;
  errServer: string;
  errConnect: string;
  // Feedback
  fbWantHelp: string;
  fbShort: string;
  fbYes: string;
  fbNo: string;
  fbTitle: string;
  fbRating: string;
  fbComments: string;
  fbCommentsPh: string;
  fbName: string;
  fbNamePh: string;
  fbAge: string;
  fbAgePh: string;
  fbGender: string;
  fbMale: string;
  fbFemale: string;
  fbOther: string;
  fbCollection: string;
  fbEmail: string;
  fbEmailPh: string;
  fbSubmit: string;
  fbSubmitting: string;
  fbThanks: string;
  fbThanksText: string;
  fbClose: string;
  // Country field (if used)
  fallbackCountries: string[];
  // Notes data
  predefinedNotes: PredefinedNote[];
  allNotes: string[];
  // Match badge
  match: string;
};
