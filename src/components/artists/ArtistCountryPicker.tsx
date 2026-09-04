import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getCountryNameForIso2,
  getSortedCountryCodes,
} from "@/utils/countries";
import {
  getCountryFlagEmoji,
} from "@/utils/claimantPhone";

type ArtistCountryOption = {
  iso2: string;
  countryName: string;
  flag: string;
};

export function ArtistCountryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const rootRef =
    useRef<HTMLDivElement | null>(
      null,
    );
  const [open, setOpen] =
    useState(false);
  const [query, setQuery] =
    useState("");

  const countries =
    useMemo<ArtistCountryOption[]>(
      () =>
        getSortedCountryCodes().map(
          (iso2) => ({
            iso2,
            countryName:
              getCountryNameForIso2(
                iso2,
              ),
            flag:
              getCountryFlagEmoji(
                iso2,
              ),
          }),
        ),
      [],
    );

  const selected =
    useMemo(
      () =>
        countries.find(
          (country) =>
            country.iso2 === value,
        ) ?? null,
      [countries, value],
    );

  const matches =
    useMemo(() => {
      const clean =
        query
          .trim()
          .toLocaleLowerCase();

      if (!clean) return [];

      return countries
        .filter(
          (country) =>
            country.countryName
              .toLocaleLowerCase()
              .startsWith(clean) ||
            country.iso2
              .toLocaleLowerCase()
              .startsWith(clean),
        )
        .slice(0, 12);
    }, [countries, query]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(
      event: PointerEvent,
    ) {
      if (
        rootRef.current &&
        !rootRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
        setQuery("");
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
  }, [open]);

  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">
        Country
      </span>

      <div
        ref={rootRef}
        className="relative"
      >
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            setOpen(
              (current) => !current,
            );
            setQuery("");
          }}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-left text-[14px] text-[var(--wk-text)] transition-colors focus:border-[var(--wk-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--wk-brand)]/15"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="shrink-0 text-[19px]"
            >
              {selected?.flag ?? "🌐"}
            </span>
            <span className="truncate font-semibold">
              {selected?.countryName ??
                "Not Set"}
            </span>
          </span>

          <i className="ri-arrow-down-s-line shrink-0 text-[17px] text-[var(--wk-text-muted)]" />
        </button>

        {open ? (
          <div
            role="listbox"
            aria-label="Country"
            className="absolute left-0 top-[calc(100%+6px)] z-40 w-full rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-2 shadow-2xl"
          >
            <input
              type="search"
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value,
                )
              }
              autoFocus
              autoComplete="off"
              placeholder="Country"
              aria-label="Country"
              className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[14px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]"
            />

            {!query.trim() ? (
              <div className="px-2 py-3">
                <p className="text-[11px] leading-5 text-[var(--wk-text-muted)]">
                  Type a country name.
                </p>

                {selected ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChange("");
                      setOpen(false);
                      setQuery("");
                    }}
                    className="mt-2 text-[11px] font-black text-[var(--wk-brand)]"
                  >
                    Clear Country
                  </button>
                ) : null}
              </div>
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
                        value
                      }
                      onClick={() => {
                        onChange(
                          country.iso2,
                        );
                        setOpen(false);
                        setQuery("");
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
    </label>
  );
}
