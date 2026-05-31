import { Link } from "react-router-dom";

const COUNTRY_FLAGS: Record<string, string> = {
  Nigeria: "🇳🇬",
  Ghana: "🇬🇭",
  "South Africa": "🇿🇦",
  Kenya: "🇰🇪",
  Uganda: "🇺🇬",
  Tanzania: "🇹🇿",
  Cameroon: "🇨🇲",
  Ethiopia: "🇪🇹",
  Rwanda: "🇷🇼",
  Zambia: "🇿🇲",
  Zimbabwe: "🇿🇼",
  Senegal: "🇸🇳",
  Mali: "🇲🇱",
  Congo: "🇨🇩",
  Angola: "🇦🇴",
  Botswana: "🇧🇼",
  Namibia: "🇳🇦",
  Morocco: "🇲🇦",
  Algeria: "🇩🇿",
  Tunisia: "🇹🇳",
  Egypt: "🇪🇬",
  Sudan: "🇸🇩",
  "Sierra Leone": "🇸🇱",
  Liberia: "🇱🇷",
  "Burkina Faso": "🇧🇫",
  Niger: "🇳🇪",
  Chad: "🇹🇩",
  Gabon: "🇬🇦",
  Guinea: "🇬🇳",
  "Guinea-Bissau": "🇬🇼",
  The_Gambia: "🇬🇲",
  Togo: "🇹🇬",
  Benin: "🇧🇯",
  Mozambique: "🇲🇿",
  Malawi: "🇲🇼",
  Madagascar: "🇲🇬",
  Mauritius: "🇲🇺",
  Seychelles: "🇸🇨",
  Djibouti: "🇩🇯",
  Somalia: "🇸🇴",
  Eritrea: "🇪🇷",
  "South Sudan": "🇸🇸",
  Eswatini: "🇸🇿",
  Lesotho: "🇱🇸",
};

function getFlag(country: string): string {
  return COUNTRY_FLAGS[country] || "🌍";
}

interface OriginArtist {
  slug: string;
  name: string;
  imageUrl?: string;
}

interface OriginGroup {
  country: string;
  flag: string;
  artistCount: number;
  chartCount: number;
  risingCount: number;
  artists: OriginArtist[];
}

interface OriginBentoProps {
  groups: OriginGroup[];
}

export function OriginBento({ groups }: OriginBentoProps) {
  if (groups.length === 0) return null;

  const sorted = [...groups].sort((a, b) => b.artistCount - a.artistCount);
  const primary = sorted[0];
  const secondary = sorted.slice(1);

  return (
    <section className="bg-[var(--wk-surface)]">
      <div className="wk-container px-6 py-14 md:py-20">
        <div className="mb-8">
          <div className="wk-eyebrow mb-3">By origin</div>
          <h3 className="text-[clamp(28px,3.5vw,48px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
            Where the sound comes from
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Primary country — wide tile */}
          {primary && (
            <Link
              to={`/artists?country=${primary.country}`}
              className="group relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] transition-all hover:border-[var(--wk-border-2)] md:col-span-2"
            >
              <div className="p-6 md:p-8">
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-[40px] leading-none">{primary.flag}</span>
                  <div>
                    <h4 className="text-[24px] font-bold text-[var(--wk-text)]">{primary.country}</h4>
                    <div className="flex items-center gap-3 text-[13px] text-[var(--wk-text-muted)]">
                      <span>{primary.artistCount} artists</span>
                      {primary.chartCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--wk-brand)]">
                          <i className="ri-bar-chart-line text-[10px]" />
                          {primary.chartCount} chart
                        </span>
                      )}
                      {primary.risingCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand-2-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--wk-brand-2)]">
                          <i className="ri-fire-line text-[10px]" />
                          {primary.risingCount} rising
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Artist faces strip */}
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {primary.artists.slice(0, 5).map((a) => (
                      <div
                        key={a.slug}
                        className="h-10 w-10 overflow-hidden rounded-full border-2 border-[var(--wk-bg)] bg-[var(--wk-surface-raised)]"
                      >
                        {a.imageUrl ? (
                          <img src={a.imageUrl} alt={a.name} className="h-full w-full object-cover object-top" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <i className="ri-user-3-line text-sm text-[var(--wk-text-faint)]" />
                          </div>
                        )}
                      </div>
                    ))}
                    {primary.artists.length > 5 && (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--wk-bg)] bg-[var(--wk-surface-raised)] text-[11px] font-bold text-[var(--wk-text-muted)]">
                        +{primary.artists.length - 5}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {primary.artists.slice(0, 4).map((a) => (
                      <span
                        key={a.slug}
                        className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-soft)]"
                      >
                        {a.name}
                      </span>
                    ))}
                    {primary.artists.length > 4 && (
                      <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-faint)]">
                        +{primary.artists.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Secondary countries */}
          {secondary.map((group) => (
            <Link
              key={group.country}
              to={`/artists?country=${group.country}`}
              className="group relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] transition-all hover:border-[var(--wk-border-2)]"
            >
              <div className="p-5">
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-[32px] leading-none">{group.flag}</span>
                  <div>
                    <h4 className="text-[18px] font-bold text-[var(--wk-text)]">{group.country}</h4>
                    <span className="text-[12px] text-[var(--wk-text-muted)]">{group.artistCount} artists</span>
                  </div>
                </div>

                <div className="flex -space-x-2">
                  {group.artists.slice(0, 4).map((a) => (
                    <div
                      key={a.slug}
                      className="h-9 w-9 overflow-hidden rounded-full border-2 border-[var(--wk-bg)] bg-[var(--wk-surface-raised)]"
                    >
                      {a.imageUrl ? (
                        <img src={a.imageUrl} alt={a.name} className="h-full w-full object-cover object-top" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <i className="ri-user-3-line text-xs text-[var(--wk-text-faint)]" />
                        </div>
                      )}
                    </div>
                  ))}
                  {group.artists.length > 4 && (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--wk-bg)] bg-[var(--wk-surface-raised)] text-[10px] font-bold text-[var(--wk-text-muted)]">
                      +{group.artists.length - 4}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {group.artists.slice(0, 3).map((a) => (
                    <span
                      key={a.slug}
                      className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-soft)]"
                    >
                      {a.name}
                    </span>
                  ))}
                  {group.artists.length > 3 && (
                    <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-faint)]">
                      +{group.artists.length - 3}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}