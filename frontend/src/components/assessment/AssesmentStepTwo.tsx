import type { FormEventHandler } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { Step2Values } from "./validation";
import s from "./AssesmentForm.module.css";

type AssesmentStepTwoProps = {
  register: UseFormRegister<Step2Values>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onBack: () => void;
  countries: string[];
  isCountriesLoading: boolean;
  errors: FieldErrors<Step2Values>;
};

export function AssesmentStepTwo({
  register,
  onSubmit,
  onBack,
  countries,
  isCountriesLoading,
  errors,
}: AssesmentStepTwoProps) {
  return (
    <div className={s.page}>
      <div className={s.container}>
        <div className={s.header}>
          <div className={s.headerIcon}>👤</div>
          <h1 className={s.headerTitle}>Din profil</h1>
          <p className={s.headerSubtitle}>
            Lite om dig — hjälper oss ge bättre rekommendationer
          </p>
        </div>

        <div className={s.stepIndicator}>
          <div className={s.stepDone}>1</div>
          <div className={s.stepLine} />
          <div className={s.stepActive}>2</div>
        </div>

        <form onSubmit={onSubmit} className={s.form}>
          <div className={s.card}>
            <h2 className={s.sectionTitle}>Om dig</h2>

            <div className={s.field}>
              <label className={s.fieldLabel}>Namn</label>
              <input
                type="text"
                placeholder="Ditt namn"
                {...register("name")}
                className={`${s.input} ${errors.name ? s.inputError : ""}`}
              />
              {errors.name && (
                <p className={s.fieldError}>{errors.name.message}</p>
              )}
            </div>

            <div className={s.grid2}>
              <div className={s.field}>
                <label className={s.fieldLabel}>Ålder</label>
                <input
                  type="number"
                  placeholder="25"
                  {...register("age", { valueAsNumber: true })}
                  className={`${s.input} ${errors.age ? s.inputError : ""}`}
                />
                {errors.age && (
                  <p className={s.fieldError}>{errors.age.message}</p>
                )}
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel}>Kön</label>
                <select
                  {...register("gender")}
                  className={`${s.select} ${errors.gender ? s.inputError : ""}`}
                >
                  <option value="">Välj...</option>
                  <option value="male">Man</option>
                  <option value="female">Kvinna</option>
                </select>
                {errors.gender && (
                  <p className={s.fieldError}>{errors.gender.message}</p>
                )}
              </div>
            </div>

            <div className={s.field}>
              <label className={s.fieldLabel}>Land</label>
              <select
                {...register("country")}
                className={`${s.select} ${errors.country ? s.inputError : ""}`}
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
              {errors.country && (
                <p className={s.fieldError}>{errors.country.message}</p>
              )}
            </div>

            <div className={s.field}>
              <label className={s.fieldLabel}>Antal parfymer i samlingen</label>
              <select
                {...register("collectionSize")}
                className={`${s.select} ${errors.collectionSize ? s.inputError : ""}`}
              >
                <option value="">Välj...</option>
                <option value="lt5">Färre än 5</option>
                <option value="5to10">5 – 10</option>
                <option value="10plus">Mer än 10</option>
              </select>
              {errors.collectionSize && (
                <p className={s.fieldError}>{errors.collectionSize.message}</p>
              )}
            </div>
          </div>

          <div className={s.stepButtons}>
            <button type="button" onClick={onBack} className={s.backButton}>
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
