import type { FormEventHandler } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import {
  UserCircle, User, User2, Users,
  Package, Layers, Boxes,
  ArrowLeft, ArrowRight,
} from "lucide-react";
import type { Step2Values } from "./validation";
import s from "./AssesmentForm.module.css";

export function AssesmentStepTwo({
  register, onSubmit, onBack, countries, isCountriesLoading, errors,
}: {
  register: UseFormRegister<Step2Values>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onBack: () => void;
  countries: string[];
  isCountriesLoading: boolean;
  errors: FieldErrors<Step2Values>;
}) {
  return (
    <div className={s.page}>
      <div className={s.container}>
        <div className={s.header}>
          <div className={s.headerIcon}>
            <UserCircle size={52} strokeWidth={1.25} />
          </div>
          <h1 className={s.headerTitle}>Din profil</h1>
          <p className={s.headerSubtitle}>
            Lite om dig hjälper oss ge bättre rekommendationer
          </p>
        </div>

        <div className={s.stepIndicator}>
          <div className={s.stepWithLabel}>
            <div className={s.stepDone}>✓</div>
            <span className={s.stepLabel}>Preferenser</span>
          </div>
          <div className={s.stepLine} />
          <div className={s.stepWithLabel}>
            <div className={s.stepActive}>2</div>
            <span className={s.stepLabel}>Din profil</span>
          </div>
        </div>

        <form onSubmit={onSubmit} className={s.form}>
          <div className={s.card}>
            <h2 className={s.sectionTitle}>Om dig</h2>
            <p className={s.privacyNote}>
              Vi använder dessa uppgifter enbart för att anpassa dina rekommendationer.
            </p>

            <div className={s.field}>
              <label className={s.fieldLabel}>Namn</label>
              <input type="text" placeholder="Ditt namn" {...register("name")}
                className={`${s.input} ${errors.name ? s.inputError : ""}`} />
              {errors.name && <p className={s.fieldError}>{errors.name.message}</p>}
            </div>

            <div className={s.field}>
              <label className={s.fieldLabel}>Ålder</label>
              <input type="number" placeholder="25" {...register("age", { valueAsNumber: true })}
                className={`${s.input} ${errors.age ? s.inputError : ""}`} />
              {errors.age && <p className={s.fieldError}>{errors.age.message}</p>}
            </div>

            {/* Gender — colorful card tiles */}
            <div className={s.field}>
              <label className={s.fieldLabel}>Kön</label>
              <div className={s.grid3}>
                {([
                  { value: "male",        label: "Man",      icon: <User  size={22} strokeWidth={1.5} />, color: "#93c5fd" },
                  { value: "female",      label: "Kvinna",   icon: <User2 size={22} strokeWidth={1.5} />, color: "#f9a8d4" },
                  { value: "unspecified", label: "Anger ej", icon: <Users size={22} strokeWidth={1.5} />, color: "#94a3b8" },
                ] as const).map(({ value, label, icon, color }) => (
                  <label key={value} className={s.checkboxCard} style={{ "--icon-color": color } as React.CSSProperties}>
                    <input type="radio" value={value} {...register("gender")} className={s.checkboxHidden} />
                    <span className={s.checkboxIcon}>{icon}</span>
                    <span className={s.checkboxLabel}>{label}</span>
                  </label>
                ))}
              </div>
              {errors.gender && <p className={s.fieldError}>{errors.gender.message}</p>}
            </div>

            <div className={s.field}>
              <label className={s.fieldLabel}>Land</label>
              <select {...register("country")}
                className={`${s.select} ${errors.country ? s.inputError : ""}`}
                disabled={isCountriesLoading && countries.length === 0}
              >
                <option value="">
                  {isCountriesLoading && countries.length === 0 ? "Laddar länder..." : "Välj land..."}
                </option>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.country && <p className={s.fieldError}>{errors.country.message}</p>}
            </div>

            {/* Collection size — colorful card tiles */}
            <div className={s.field}>
              <label className={s.fieldLabel}>Antal parfymer i samlingen</label>
              <div className={s.grid3}>
                {([
                  { value: "lt5",    label: "Färre än 5", icon: <Package size={22} strokeWidth={1.5} />, color: "#86efac" },
                  { value: "5to10",  label: "5 – 10",     icon: <Layers  size={22} strokeWidth={1.5} />, color: "#6ee7b7" },
                  { value: "10plus", label: "Mer än 10",  icon: <Boxes   size={22} strokeWidth={1.5} />, color: "#5eead4" },
                ] as const).map(({ value, label, icon, color }) => (
                  <label key={value} className={s.checkboxCard} style={{ "--icon-color": color } as React.CSSProperties}>
                    <input type="radio" value={value} {...register("collectionSize")} className={s.checkboxHidden} />
                    <span className={s.checkboxIcon}>{icon}</span>
                    <span className={s.checkboxLabel}>{label}</span>
                  </label>
                ))}
              </div>
              {errors.collectionSize && <p className={s.fieldError}>{errors.collectionSize.message}</p>}
            </div>
          </div>

          <div className={s.stepButtons}>
            <button type="button" onClick={onBack} className={s.backButton}>
              <ArrowLeft size={16} />
              <span>Tillbaka</span>
            </button>
            <button type="submit" className={s.submitButton}>
              <span>Skicka</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
