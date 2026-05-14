import { z } from "zod";
import type { Translations } from "../../i18n/types";

const budgetField = () =>
  z
    .int({ error: "0–20 000" })
    .min(0, "Min 0")
    .max(20000, "Max 20 000");

/** Call this inside a useMemo with the current `t` so error messages
 *  reflect the active language. */
export function buildStep1Schema(t: Translations) {
  return z
    .object({
      budgetMin: budgetField(),
      budgetMax: budgetField(),
      season: z.enum(["spring", "summer", "autumn", "winter", "all_year"], {
        error: t.errSeason,
      }),
      fragranceGender: z.enum(["men", "women", "unisex"], {
        error: t.errGender,
      }),
      descriptionText: z.string(),
      likedBrandsText: z.string(),
      likedFragrancesText: z.string(),
      notesText: z.string(),
      preferNiche: z.boolean(),
      preferDesigner: z.boolean(),
      preferDupe: z.boolean(),
    })
    .refine(
      (data) => data.preferNiche || data.preferDesigner || data.preferDupe,
      { message: t.errCategory, path: ["preferNiche"] }
    )
    .refine((data) => data.budgetMin <= data.budgetMax, {
      message: t.errBudgetRange,
      path: ["budgetMax"],
    });
}

// Static schema used only for TypeScript type inference
const _schemaForTypes = buildStep1Schema({
  errSeason: "", errGender: "", errCategory: "", errBudgetRange: "",
} as unknown as Translations);

export const step2Schema = z.object({
  name: z
    .string()
    .min(1, "Namn är obligatoriskt")
    .regex(/^[\p{L}\s'-]+$/u, "Ange ett giltigt namn"),
  age: z
    .int({ error: "Ange en ålder" })
    .min(0, "Ålder kan inte vara negativ")
    .max(99, "Ange en ålder mellan 0 och 99"),
  gender: z.enum(["male", "female", "unspecified"], { error: "Välj kön" }),
  country: z.string().trim().min(1, "Välj land"),
  collectionSize: z.enum(["lt5", "5to10", "10plus"], {
    error: "Välj antal parfymer",
  }),
});

export type Step1Values = z.infer<typeof _schemaForTypes>;
export type Step2Values = z.infer<typeof step2Schema>;
export type AssessmentFormValues = Step1Values;
