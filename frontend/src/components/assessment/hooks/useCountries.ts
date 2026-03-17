import { useEffect, useState } from "react";
import { fallbackCountries } from "../constants";

export function useCountries() {
  const [countries, setCountries] = useState<string[]>([]);
  const [isCountriesLoading, setIsCountriesLoading] = useState(true);

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

  return { countries, isCountriesLoading };
}
