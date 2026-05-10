import type { PredefinedNote, Season } from "./types";

export const seasons: { value: Season; label: string }[] = [
  { value: "spring",   label: "Vår" },
  { value: "summer",   label: "Sommar" },
  { value: "autumn",   label: "Höst" },
  { value: "winter",   label: "Vinter" },
  { value: "all_year", label: "Året runt" },
];

export const fallbackCountries = [
  "Sverige", "Norge", "Danmark", "Finland", "Island",
  "Tyskland", "Frankrike", "Spanien", "Italien", "Nederländerna",
  "Belgien", "Polen", "Storbritannien", "USA", "Kanada",
  "Australien", "Japan", "Sydkorea", "Förenade Arabemiraten", "Saudiarabien",
];

/** Quick-click chips shown in the notes grid — the most popular 30 notes. */
export const predefinedNotes: PredefinedNote[] = [
  { label: "Bergamott",   emoji: "🍋" },
  { label: "Citron",      emoji: "🍋" },
  { label: "Grapefrukt",  emoji: "🍊" },
  { label: "Apelsinblom", emoji: "🌼" },
  { label: "Neroli",      emoji: "🌿" },
  { label: "Lavendel",    emoji: "🪻" },
  { label: "Ros",         emoji: "🌹" },
  { label: "Jasmin",      emoji: "🌸" },
  { label: "Ylang-ylang", emoji: "🌺" },
  { label: "Iris",        emoji: "🌷" },
  { label: "Viol",        emoji: "💜" },
  { label: "Muguet",      emoji: "🌼" },
  { label: "Kardemumma",  emoji: "🫚" },
  { label: "Kanel",       emoji: "🪵" },
  { label: "Saffran",     emoji: "🧡" },
  { label: "Peppar",      emoji: "🌶️" },
  { label: "Ingefära",    emoji: "🫚" },
  { label: "Muskot",      emoji: "🌰" },
  { label: "Vanilj",      emoji: "🍦" },
  { label: "Tonkabona",   emoji: "🫘" },
  { label: "Barnsten",    emoji: "🟠" },
  { label: "Mysk",        emoji: "🫧" },
  { label: "Sandelträ",   emoji: "🪵" },
  { label: "Ceder",       emoji: "🌲" },
  { label: "Vetiver",     emoji: "🌱" },
  { label: "Patchouli",   emoji: "🍃" },
  { label: "Oud",         emoji: "🪵" },
  { label: "Rökelse",     emoji: "🕯️" },
  { label: "Läder",       emoji: "🧥" },
  { label: "Kokos",       emoji: "🥥" },
];

/**
 * Comprehensive searchable notes list — used for the dropdown in the custom note input.
 * ~180 notes covering all major perfumery families.
 * Names are in Swedish/international (Claude understands both).
 */
export const allNotes: string[] = [
  // ── Citrus / Fräsch ──────────────────────────────────────────────────────
  "Bergamott", "Citron", "Lime", "Grapefrukt", "Apelsin", "Mandarin",
  "Yuzu", "Clementine", "Pomelo", "Citronmeliss", "Petitgrain",
  "Citronverbena", "Kumquat", "Citronblad", "Finger Lime",

  // ── Blommig ──────────────────────────────────────────────────────────────
  "Ros", "Jasmin", "Ylang-ylang", "Iris", "Viol", "Muguet", "Liljekonvalj",
  "Pion", "Magnolia", "Gardenia", "Tuberos", "Freesia", "Lavendel",
  "Neroli", "Apelsinblom", "Mimosa", "Syren", "Nejlika", "Osmanthus",
  "Pelargon", "Heliotropium", "Lotus", "Hibiskus", "Orkidé", "Narciss",
  "Hyacint", "Akasia", "Rosenträ", "Immortelle", "Jasminabsolut",
  "Rosenvatten", "Damaskros", "Kaprifol", "Primula", "Vildros",

  // ── Fruktig ───────────────────────────────────────────────────────────────
  "Persika", "Päron", "Plommon", "Hallon", "Svartvinbär", "Litchi",
  "Fikon", "Mango", "Passionsfrukt", "Melon", "Aprikos", "Äpple",
  "Körsbär", "Jordgubbe", "Blåbär", "Ananas", "Banan", "Papaya",
  "Vattenmelon", "Granatäpple", "Nypon", "Vinbär", "Mullbär", "Kvitten",
  "Dadel", "Tamarind", "Kokum", "Guava",

  // ── Kryddig ──────────────────────────────────────────────────────────────
  "Kardemumma", "Kanel", "Saffran", "Svartpeppar", "Rosa peppar",
  "Ingefära", "Muskot", "Koriander", "Anis", "Fänkål", "Nellik",
  "Kummin", "Timjan", "Basilika", "Lagerblad", "Muskatblomma",
  "Szechuanpeppar", "Galangal", "Cubebpeppar", "Lång peppar",
  "Kalonji", "Sumak", "Tasmanskt peppar",

  // ── Trä / Woody ──────────────────────────────────────────────────────────
  "Sandelträ", "Ceder", "Vetiver", "Patchouli", "Oud", "Björkträ",
  "Guajak", "Cypress", "Enträd", "Teak", "Mahogny", "Cashmerewood",
  "Amyris", "Atlascedar", "Virginiacedar", "Hinoki", "Balsamcedar",
  "Rosenträ", "Agarwood", "Buddhawood", "Papyrus", "Bambu",

  // ── Hartsig / Balsamic ───────────────────────────────────────────────────
  "Rökelse", "Olibanum", "Myrra", "Benzoin", "Labdanum", "Tonkabona",
  "Vanilj", "Barnsten", "Opoponax", "Peru-balsam", "Tolu-balsam",
  "Elemi", "Copal", "Styrax", "Ambra", "Balsam", "Cistus",
  "Galbanum", "Storax", "Dammar",

  // ── Myskig / Animalisk ───────────────────────────────────────────────────
  "Mysk", "Vit mysk", "Läder", "Ambrette", "Cashmeran", "Castoreum",
  "Civett", "Hyraceum", "Iso E Super", "Galaxolide", "Habanolide",
  "Muscenone", "Exaltolide",

  // ── Skogsig / Mossy ──────────────────────────────────────────────────────
  "Ekmossa", "Trädmossa", "Ormbunke", "Björkmossa", "Löv",
  "Skogsjord", "Svamp", "Mylla", "Mossa",

  // ── Akvatisk / Marin ─────────────────────────────────────────────────────
  "Havsbris", "Saltvind", "Ozon", "Alger", "Regnvatten", "Sjöluft",
  "Havsvatten", "Akvatisk", "Korallagg", "Salina", "Calone",

  // ── Tobak / Gourmand ─────────────────────────────────────────────────────
  "Tobak", "Kaffe", "Kakao", "Choklad", "Honung", "Kola", "Socker",
  "Mandel", "Pistasch", "Hasselnöt", "Kokos", "Grädde", "Smör",
  "Karamell", "Pralin", "Marshmallow", "Rostad mandel", "Macaron",
  "Crème brûlée", "Mjölk", "Mjölkchoklad",

  // ── Grönt / Örtigt ───────────────────────────────────────────────────────
  "Gräs", "Grönt te", "Svart te", "Maté", "Salvia", "Rosmarin",
  "Mynta", "Pepparmynta", "Löverk", "Violblad", "Tomatlöv", "Fikonblad",
  "Eukalyptus", "Aromatisk", "Isop", "Lavandin", "Wormwood",
  "Absint", "Estragon", "Dill",

  // ── Orientalisk / Rökverk ────────────────────────────────────────────────
  "Rökelse", "Sandelträ", "Oud", "Ambra", "Mysk", "Myrra",
  "Benzoin", "Kardemumma", "Saffran", "Rosenvatten", "Orrisrot",
  "Davana", "Helichrysum", "Muskmålla",
];
