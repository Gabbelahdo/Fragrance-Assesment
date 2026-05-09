import { z } from "zod";

const budgetField = () =>
  z
    .int({ error: "Ange ett heltal (0–20 000)" })
    .min(0, "Minst 0 kr")
    .max(20000, "Max 20 000 kr");

export const step1Schema = z
  .object({
    budgetMin: budgetField(),
    budgetMax: budgetField(),
    season: z.enum(["spring", "summer", "autumn", "winter", "all_year"]),
    fragranceGender: z.enum(["men", "women", "unisex"]),
    descriptionText: z.string().optional().default(""),
    likedFragrancesText: z.string().optional().default(""),
    notesText: z.string().refine(
      (value) =>
        value
          .split(",")
          .map((note) => note.trim())
          .filter(Boolean).length > 0,
      "Välj minst 1 not"
    ),
    preferNiche: z.boolean(),
    preferDesigner: z.boolean(),
    preferDupe: z.boolean(),
  })
  .refine(
    (data) => data.preferNiche || data.preferDesigner || data.preferDupe,
    { message: "Välj minst 1 kategori", path: ["preferNiche"] }
  )
  .refine((data) => data.budgetMin <= data.budgetMax, {
    message: "Min-budget kan inte överstiga max-budget",
    path: ["budgetMax"],
  });

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

export type Step1Values = z.infer<typeof step1Schema>;
export type Step2Values = z.infer<typeof step2Schema>;
export type AssessmentFormValues = Step1Values & Step2Values;
