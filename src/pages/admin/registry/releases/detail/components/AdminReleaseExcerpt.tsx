import { WkIcon } from "@/components/design-system/Icon";
import type { TrackItem, TrackArtistRecord } from "./AdminReleaseTracklist";

interface AdminReleaseExcerptProps {
  title: string;
  artistName: string;
  releaseType: string | null;
  labelName: string;
  releaseDate: string | null;
  releaseDatePrecision: string | null;
  tracks: TrackItem[];
  trackArtists: TrackArtistRecord[];
  description: string | null;
}

function releaseTypeLabel(type: string | null): string {
  const t = (type || "").toLowerCase();
  if (t === "album" || t === "studio album") return "studio album";
  if (t === "ep" || t === "extended play") return "Extended Play";
  if (t === "single") return "single";
  if (t === "compilation") return "compilation";
  if (t === "mixtape") return "mixtape";
  return t || "release";
}

function articleize(word: string): string {
  const first = word.charAt(0).toLowerCase();
  return "aeiou".includes(first) ? `an ${word}` : `a ${word}`;
}

function formatYear(date: string | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.getFullYear().toString();
}

function buildExcerpt(opts: AdminReleaseExcerptProps): string {
  const { title, artistName, releaseType, labelName, releaseDate, tracks } = opts;
  const rType = releaseTypeLabel(releaseType);
  const year = formatYear(releaseDate);
  const parts: string[] = [];

  let open = `"${title}" is ${articleize(rType)} by ${artistName}`;
  if (year) open += `, released in ${year}`;
  if (labelName && labelName !== "Independent" && labelName !== "Unknown" && labelName !== "WAKILISHA") {
    open += ` through ${labelName}`;
  }
  open += ".";
  parts.push(open);

  const sorted = [...tracks].sort((a, b) => a.track_number - b.track_number);
  const first = sorted[0]?.track_title;
  const last = sorted.length > 1 ? sorted[sorted.length - 1]?.track_title : "";

  if (sorted.length === 1 && first) {
    parts.push(`The release consists of a single track, "${first}."`);
  } else if (sorted.length > 1 && first) {
    let s = `The ${sorted.length}-track project opens with "${first}"`;
    if (last && last !== first) s += ` and concludes with "${last}"`;
    s += ".";
    parts.push(s);

    if (sorted.length >= 6) {
      const mid = sorted[Math.floor(sorted.length / 2)];
      if (mid && mid.track_title !== first && mid.track_title !== last) {
        parts.push(`At its midpoint, "${mid.track_title}" anchors the collection.`);
      }
    }
  }

  // Total duration
  const totalMs = sorted.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
  if (totalMs > 0) {
    const mins = Math.round(totalMs / 60000);
    if (sorted.length <= 4) {
      parts.push(`At approximately ${mins} minutes, the project delivers a concise statement.`);
    } else if (sorted.length <= 10) {
      parts.push(`Clocking in at approximately ${mins} minutes, the release balances breadth with cohesion.`);
    } else {
      parts.push(`At approximately ${mins} minutes, the project offers a substantial listening experience.`);
    }
  }

  // Featured artists highlight
  const allFeatured = new Set<string>();
  for (const ta of opts.trackArtists) {
    if (ta.is_featured) allFeatured.add(ta.artist_name_text);
  }
  if (allFeatured.size > 0) {
    const names = Array.from(allFeatured);
    if (names.length === 1) {
      parts.push(`The album features a guest appearance by ${names[0]}.`);
    } else if (names.length <= 4) {
      parts.push(`The album features guest appearances by ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}.`);
    } else {
      parts.push(`The album features guest appearances by ${names.slice(0, 3).join(", ")} and ${names.length - 3} other artists.`);
    }
  }

  parts.push(`"${title}" stands as a notable entry in ${artistName}'s discography, catalogued on WAKILISHA.`);

  return parts.join(" ");
}

export default function AdminReleaseExcerpt(props: AdminReleaseExcerptProps) {
  const text = buildExcerpt(props);

  if (!text) return null;

  const chips: string[] = [
    `${props.tracks.length} track${props.tracks.length !== 1 ? "s" : ""}`,
    releaseTypeLabel(props.releaseType),
    formatYear(props.releaseDate) || "",
    props.labelName !== "WAKILISHA" && props.labelName !== "Unknown" ? props.labelName : "",
  ].filter(Boolean);

  return (
    <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
      <div className="relative px-6 py-5 pl-8">
        <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full bg-[var(--wk-brand)]" />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <WkIcon name="FileText" size={14} className="text-[var(--wk-brand)]" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--wk-brand)]">
              Release Summary
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 justify-end">
            {chips.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--wk-text-muted)] whitespace-nowrap"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        <p className="text-[13px] leading-[1.8] text-[var(--wk-text-soft)]">
          {text}
        </p>

        <div className="mt-4 pt-4 border-t border-[var(--wk-border)]">
          <p className="text-[10px] text-[var(--wk-text-faint)] leading-relaxed">
            Auto-generated from WAKILISHA archive data. Updated as new information becomes available.
          </p>
        </div>
      </div>
    </div>
  );
}