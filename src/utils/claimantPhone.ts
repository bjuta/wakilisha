import {
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import {
  getCountryNameForIso2,
  getSortedCountryCodes,
} from "@/utils/countries";

export type ClaimantPhone = {
  countryIso2: string;
  callingCode: string;
  nationalNumber: string;
  e164: string;
};

export type ClaimantPhoneCountryOption = {
  iso2: string;
  countryName: string;
  callingCode: string;
  flag: string;
  label: string;
};

export function getCountryFlagEmoji(
  iso2: string,
) {
  const clean =
    iso2.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(clean)) {
    return "🌐";
  }

  return String.fromCodePoint(
    ...Array.from(clean).map(
      (letter) =>
        127397 +
        letter.charCodeAt(0),
    ),
  );
}

export function getClaimantPhoneCountryOptions(): ClaimantPhoneCountryOption[] {
  return getSortedCountryCodes().flatMap(
    (iso2) => {
      try {
        const countryName =
          getCountryNameForIso2(
            iso2,
          );
        const callingCode =
          `+${getCountryCallingCode(
            iso2 as CountryCode,
          )}`;

        return [
          {
            iso2,
            countryName,
            callingCode,
            flag:
              getCountryFlagEmoji(
                iso2,
              ),
            label:
              `${countryName} (${callingCode})`,
          },
        ];
      } catch {
        return [];
      }
    },
  );
}

export function findClaimantPhoneCountryOptions(
  query: string,
  limit = 12,
): ClaimantPhoneCountryOption[] {
  const clean =
    query.trim().toLocaleLowerCase();

  if (!clean) {
    return [];
  }

  return getClaimantPhoneCountryOptions()
    .filter(
      (country) =>
        country.countryName
          .toLocaleLowerCase()
          .startsWith(clean) ||
        country.iso2
          .toLocaleLowerCase()
          .startsWith(clean) ||
        country.callingCode
          .toLocaleLowerCase()
          .startsWith(clean),
    )
    .slice(
      0,
      Math.max(1, limit),
    );
}

export function normalizeClaimantPhone(
  countryIso2: string,
  rawNumber: string,
): ClaimantPhone {
  const cleanCountry =
    countryIso2
      .trim()
      .toUpperCase();
  const cleanNumber =
    rawNumber.trim();

  if (!cleanCountry) {
    throw new Error(
      "Choose your phone country.",
    );
  }

  if (!cleanNumber) {
    throw new Error(
      "Enter your phone number.",
    );
  }

  const parsed =
    parsePhoneNumberFromString(
      cleanNumber,
      cleanCountry as CountryCode,
    );

  if (
    !parsed ||
    !parsed.isValid()
  ) {
    throw new Error(
      "Enter a valid phone number for the selected country.",
    );
  }

  if (
    parsed.country &&
    parsed.country !== cleanCountry
  ) {
    throw new Error(
      "The phone number does not match the selected country.",
    );
  }

  return {
    countryIso2:
      cleanCountry,
    callingCode:
      `+${parsed.countryCallingCode}`,
    nationalNumber:
      parsed.nationalNumber,
    e164:
      parsed.number,
  };
}
