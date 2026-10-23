import { WkIcon } from "@/components/design-system/Icon";

/** Bundled SVG + ISO code: stable across Apple, Windows, Android and browsers. */
export function CountryIdentityMark({
  code,
  compact = false,
}: {
  code: string | null | undefined;
  compact?: boolean;
}) {
  const countryCode = code?.trim().toUpperCase();
  const displayCode = countryCode && /^[A-Z]{2}$/.test(countryCode)
    ? countryCode
    : null;
  return (
    <span
      data-wk-country-identity-mark
      aria-hidden="true"
      className={[
        "inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] font-semibold text-[var(--wk-text-muted)]",
        compact ? "h-7 min-w-8 px-1 text-[10px]" : "h-8 min-w-11 px-1.5 text-[11px]",
      ].join(" ")}
    >
      <WkIcon name="Globe2" size={compact ? 12 : 14} aria-hidden="true" />
      {displayCode ? <span>{displayCode}</span> : null}
    </span>
  );
}
