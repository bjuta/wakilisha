import {
  useMemo,
  useState,
} from "react";
import {
  getClaimantPhoneCountryOptions,
} from "@/utils/claimantPhone";

export function ClaimantPhoneFields({
  countryIso2,
  phoneNumber,
  onCountryChange,
  onPhoneNumberChange,
}: {
  countryIso2: string;
  phoneNumber: string;
  onCountryChange: (
    value: string,
  ) => void;
  onPhoneNumberChange: (
    value: string,
  ) => void;
}) {
  const [
    countryQuery,
    setCountryQuery,
  ] = useState("");
  const countries =
    useMemo(
      () =>
        getClaimantPhoneCountryOptions(),
      [],
    );
  const filteredCountries =
    useMemo(() => {
      const query =
        countryQuery
          .trim()
          .toLocaleLowerCase();

      if (!query) {
        return countries;
      }

      return countries.filter(
        (country) =>
          country.countryName
            .toLocaleLowerCase()
            .startsWith(query) ||
          country.iso2
            .toLocaleLowerCase()
            .startsWith(query) ||
          country.callingCode
            .startsWith(
              countryQuery.trim(),
            ),
      );
    }, [
      countries,
      countryQuery,
    ]);

  return (
    <fieldset>
      <legend className="sr-only">
        Phone Number
      </legend>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">
            Search Country
          </span>
          <input
            type="search"
            value={countryQuery}
            onChange={(event) =>
              setCountryQuery(
                event.target.value,
              )
            }
            autoComplete="off"
            placeholder="Start typing a country name"
            className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">
            Phone Country
          </span>
          <select
            value={countryIso2}
            onChange={(event) => {
              onCountryChange(
                event.target.value,
              );
              setCountryQuery("");
            }}
            autoComplete="country"
            required
            className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]"
          >
            <option value="">
              Choose Country
            </option>
            {filteredCountries.map(
              (country) => (
                <option
                  key={country.iso2}
                  value={country.iso2}
                >
                  {country.label}
                </option>
              ),
            )}
          </select>
          {countryQuery.trim() &&
          filteredCountries.length === 0 ? (
            <span className="mt-1.5 block text-[11px] leading-5 text-[var(--wk-text-muted)]">
              No matching countries.
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">
            Phone Number
          </span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={phoneNumber}
            onChange={(event) =>
              onPhoneNumberChange(
                event.target.value,
              )
            }
            maxLength={32}
            required
            className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]"
          />
          <span className="mt-1.5 block text-[11px] leading-5 text-[var(--wk-text-muted)]">
            We save this with its international calling code.
          </span>
        </label>
      </div>
    </fieldset>
  );
}
