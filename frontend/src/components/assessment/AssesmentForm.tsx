import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import s from "./AssesmentForm.module.css";

type Season = "spring" | "summer" | "autumn" | "winter" | "all_year";
type Gender = "male" | "female";
type CollectionSize = "lt5" | "5to10" | "10plus";

export type AssessmentFormValues = {
  budgetMin: number;
  budgetMax: number;
  season: Season;
  notesText: string;
  preferNiche: boolean;
  preferDesigner: boolean;
  preferDupe: boolean;
  // för dataanalys
  name?: string;
  age?: number;
  gender?: Gender;
  country?: string;
  collectionSize?: CollectionSize;
};

const seasons: { value: Season; label: string }[] = [
  { value: "spring", label: "🌸 Vår" },
  { value: "summer", label: "☀️ Sommar" },
  { value: "autumn", label: "🍂 Höst" },
  { value: "winter", label: "❄️ Vinter" },
  { value: "all_year", label: "🌍 Året runt" },
];

const fallbackCountries = [
  "Sverige",
  "Norge",
  "Danmark",
  "Finland",
  "Island",
  "Tyskland",
  "Frankrike",
  "Spanien",
  "Italien",
  "Nederländerna",
  "Belgien",
  "Polen",
  "Storbritannien",
  "USA",
  "Kanada",
  "Australien",
  "Japan",
  "Sydkorea",
  "Förenade Arabemiraten",
  "Saudiarabien",
];

export function AssessmentForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState<Partial<AssessmentFormValues>>({});
  const [countries, setCountries] = useState<string[]>([]);
  const [isCountriesLoading, setIsCountriesLoading] = useState(true);

  const defaultValues: AssessmentFormValues = useMemo(
    () => ({
      budgetMin: 0,
      budgetMax: 10000,
      season: "all_year",
      notesText: "",
      preferNiche: false,
      preferDesigner: false,
      preferDupe: false,
      name: "",
      age: undefined,
      gender: undefined,
      country: "",
      collectionSize: undefined,
    }),
    []
  );

  const { register, handleSubmit } = useForm<AssessmentFormValues>({
    defaultValues,
  });

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadCountries = async () => {
      try {
        const response = await fetch(
          "https://restcountries.com/v3.1/all?fields=name,translations",
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch countries: ${response.status}`);
        }

        const data = (await response.json()) as Array<{
          name?: { common?: string };
          translations?: { swe?: { common?: string } };
        }>;

        const countryList = data
          .map((item) => item.translations?.swe?.common || item.name?.common || "")
          .filter((country) => country.length > 0)
          .sort((a, b) => a.localeCompare(b, "sv"))
          .filter((country, index, arr) => index === 0 || country !== arr[index - 1]);

        if (!countryList.length) {
          throw new Error("No countries returned from API");
        }

        if (isMounted) {
          setCountries(countryList);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Could not load countries from API, using fallback list.", error);

        if (isMounted) {
          setCountries(fallbackCountries);
        }
      } finally {
        if (isMounted) {
          setIsCountriesLoading(false);
        }
      }
    };

    loadCountries();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const onStep1Submit = (data: AssessmentFormValues) => {
    setStep1Data(data);
    setStep(2);
  };

  const onStep2Submit = (data: AssessmentFormValues) => {
    const fullPayload = { ...step1Data, ...data };
    console.log("submit payload: ", fullPayload);
    alert("Submit (mock). Kolla console för payload.");
  };

  if (step === 2) {
    return (
      <div className={s.page}>
        <div className={s.container}>

          {/* Header */}
          <div className={s.header}>
            <div className={s.headerIcon}>👤</div>
            <h1 className={s.headerTitle}>Din profil</h1>
            <p className={s.headerSubtitle}>
              Lite om dig — hjälper oss ge bättre rekommendationer
            </p>
          </div>

          {/* Steg-indikator */}
          <div className={s.stepIndicator}>
            <div className={s.stepDone}>1</div>
            <div className={s.stepLine} />
            <div className={s.stepActive}>2</div>
          </div>

          <form onSubmit={handleSubmit(onStep2Submit)} className={s.form}>
            <div className={s.card}>
              <h2 className={s.sectionTitle}>Om dig</h2>

              <div className={s.field}>
                <label className={s.fieldLabel}>Namn</label>
                <input
                  type="text"
                  placeholder="Ditt namn"
                  {...register("name")}
                  className={s.input}
                />
              </div>

              <div className={s.grid2}>
                <div className={s.field}>
                  <label className={s.fieldLabel}>Ålder</label>
                  <input
                    type="number"
                    placeholder="25"
                    {...register("age", { valueAsNumber: true })}
                    className={s.input}
                  />
                </div>

                <div className={s.field}>
                  <label className={s.fieldLabel}>Kön</label>
                  <select {...register("gender")} className={s.select}>
                    <option value="">Välj...</option>
                    <option value="male">Man</option>
                    <option value="female">Kvinna</option>
                  </select>
                </div>
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel}>Land</label>
                <select
                  {...register("country")}
                  className={s.select}
                  disabled={isCountriesLoading && countries.length === 0}
                >
                  <option value="">
                    {isCountriesLoading && countries.length === 0
                      ? "Laddar länder..."
                      : "Välj land..."}
                  </option>
                  {countries.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel}>Antal parfymer i samlingen</label>
                <select {...register("collectionSize")} className={s.select}>
                  <option value="">Välj...</option>
                  <option value="lt5">Färre än 5</option>
                  <option value="5to10">5 – 10</option>
                  <option value="10plus">Mer än 10</option>
                </select>
              </div>
            </div>

            <div className={s.stepButtons}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className={s.backButton}
              >
                ← Tillbaka
              </button>
              <button type="submit" className={s.submitButton}>
                Skicka →
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <div className={s.container}>

        {/* Header */}
        <div className={s.header}>
          <div className={s.headerIcon}>🧴</div>
          <h1 className={s.headerTitle}>Doftanalys</h1>
          <p className={s.headerSubtitle}>
            Berätta vad du letar efter — vi hittar din perfekta doft
          </p>
        </div>

        {/* Steg-indikator */}
        <div className={s.stepIndicator}>
          <div className={s.stepActive}>1</div>
          <div className={s.stepLine} />
          <div className={s.stepInactive}>2</div>
        </div>

        <form onSubmit={handleSubmit(onStep1Submit)} className={s.form}>

          {/* Preferenser */}
          <div className={s.card}>
            <h2 className={s.sectionTitle}>
              Preferenser
            </h2>

            <div className={s.grid2}>
              <div className={s.field}>
                <label className={s.fieldLabel}>Budget min (kr)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="0"
                  {...register("budgetMin", { valueAsNumber: true })}
                  className={s.input}
                />
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel}>Budget max (kr)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="1 000"
                  {...register("budgetMax", { valueAsNumber: true })}
                  className={s.input}
                />
              </div>
            </div>

            <div className={s.field}>
              <label className={s.fieldLabel}>Säsong</label>
              <select
                {...register("season")}
                className={s.select}
              >
                {seasons.map((season) => (
                  <option key={season.value} value={season.value}>
                    {season.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={s.field}>
              <label className={s.fieldLabel}>Favoritnotes</label>
              <input
                type="text"
                placeholder="t.ex. vanilj, citrus, oud"
                {...register("notesText")}
                className={s.input}
              />
            </div>
          </div>

          {/* Typ av doft */}
          <div className={s.cardNoSpace}>
            <h2 className={s.sectionTitleMb}>
              Typ av doft
            </h2>
            <div className={s.grid3}>
              {([
                { name: "preferNiche", label: "Nisch", icon: "💎" },
                { name: "preferDesigner", label: "Designer", icon: "🏷️" },
                { name: "preferDupe", label: "Dupe", icon: "♻️" },
              ] as const).map(({ name, label, icon }) => (
                <label
                  key={name}
                  className={s.checkboxCard}
                >
                  <input
                    type="checkbox"
                    {...register(name)}
                    className={s.checkboxHidden}
                  />
                  <span className={s.checkboxIcon}>{icon}</span>
                  <span className={s.checkboxLabel}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className={s.submitButton}
          >
            Nästa →
          </button>

        </form>
      </div>
    </div>
  );
}

export default AssessmentForm;