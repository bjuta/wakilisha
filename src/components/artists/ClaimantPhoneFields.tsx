import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  findClaimantPhoneCountryOptions,
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
  const rootRef =
    useRef<HTMLDivElement | null>(
      null,
    );
  const [countryOpen, setCountryOpen] =
    useState(false);
  const [countryQuery, setCountryQuery] =
    useState("");

  const countries =
    useMemo(
      () =>
        getClaimantPhoneCountryOptions(),
      [],
    );

  const selectedCountry =
    useMemo(
      () =>
        countries.find(
          (country) =>
            country.iso2 ===
            countryIso2,
        ) ?? null,
      [
        countries,
        countryIso2,
      ],
    );

  const matches =
    useMemo(
      () =>
        findClaimantPhoneCountryOptions(
          countryQuery,
          12,
        ),
      [countryQuery],
    );

  useEffect(() => {
    if (!countryOpen) return;

    function closeOnOutsidePointer(
      event: PointerEvent,
    ) {
      if (
        rootRef.current &&
        !rootRef.current.contains(
          event.target as Node,
        )
      ) {
        setCountryOpen(false);
        setCountryQuery("");
      }
    }

    window.addEventListener(
      "pointerdown",
      closeOnOutsidePointer,
    );

    return () =>
      window.removeEventListener(
        "pointerdown",
        closeOnOutsidePointer,
      );
  }, [countryOpen]);

  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">
        Phone Number
      </span>

      <div
        ref={rootRef}
        className="relative"
      >
        <div className="flex min-h-12 overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] focus-within:border-[var(--wk-brand)] focus-within:ring-2 focus-within:ring-[var(--wk-brand)]/15">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={countryOpen}
            onClick={() => {
              setCountryOpen(
                (current) => !current,
              );
              setCountryQuery("");
            }}
            className="flex min-w-[108px] shrink-0 items-center justify-center gap-2 px-3 text-[14px] font-bold text-[var(--wk-text)]"
          >
            <span
              aria-hidden="true"
              className="text-[18px]"
            >
              {selectedCountry?.flag ??
                "🌐"}
            </span>
            <span>
              {selectedCountry
                ?.callingCode ??
                "+ Code"}
            </span>
            <i className="ri-arrow-down-s-line text-[16px] text-[var(--wk-text-muted)]" />
          </button>

          <div className="my-2 w-px shrink-0 bg-[var(--wk-divider)]" />

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
            placeholder="Phone number"
            className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[14px] text-[var(--wk-text)] outline-none"
          />
        </div>

        {countryOpen ? (
          <div
            role="listbox"
            aria-label="Country"
            className="absolute left-0 top-[calc(100%+6px)] z-30 w-full max-w-sm rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-2 shadow-2xl"
          >
            <input
              type="search"
              value={countryQuery}
              onChange={(event) =>
                setCountryQuery(
                  event.target.value,
                )
              }
              autoFocus
              autoComplete="off"
              placeholder="Country"
              aria-label="Country"
              className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[14px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]"
            />

            {!countryQuery.trim() ? (
              <p className="px-2 py-3 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                Type a country name or calling code.
              </p>
            ) : matches.length > 0 ? (
              <div className="mt-1 max-h-64 overflow-y-auto overscroll-contain">
                {matches.map(
                  (country) => (
                    <button
                      key={country.iso2}
                      type="button"
                      role="option"
                      aria-selected={
                        country.iso2 ===
                        countryIso2
                      }
                      onClick={() => {
                        onCountryChange(
                          country.iso2,
                        );
                        setCountryOpen(
                          false,
                        );
                        setCountryQuery(
                          "",
                        );
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--wk-surface-raised)]"
                    >
                      <span
                        aria-hidden="true"
                        className="text-[19px]"
                      >
                        {country.flag}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--wk-text)]">
                        {
                          country.countryName
                        }
                      </span>
                      <span className="shrink-0 text-[12px] font-semibold text-[var(--wk-text-muted)]">
                        {
                          country.callingCode
                        }
                      </span>
                    </button>
                  ),
                )}
              </div>
            ) : (
              <p className="px-2 py-3 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                No matching countries.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <span className="mt-1.5 block text-[11px] leading-5 text-[var(--wk-text-muted)]">
        We save this with its international calling code.
      </span>
    </label>
  );
}
