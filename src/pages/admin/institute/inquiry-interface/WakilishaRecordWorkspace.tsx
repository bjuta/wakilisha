import { useEffect, useMemo, useState } from "react";
import type { EvidenceItem, InquiryDraft } from "./types";
import {
  fetchWakilishaRecordDetail,
  useWakilishaRecordSearch,
  wakilishaRecordEntityOptions,
  type WakilishaRecordDetail,
  type WakilishaRecordEntityType,
  type WakilishaRecordSearchResult,
} from "./useWakilishaRecordSearch";

const registryWorkModes = [
  { key: "use_existing_record", label: "Use existing record" },
  { key: "suggest_missing_record", label: "Suggest missing record" },
  { key: "suggest_correction", label: "Suggest correction" },
  { key: "suggest_merge_duplicate", label: "Suggest merge duplicate" },
  { key: "suggest_relationship", label: "Suggest relationship" },
  { key: "suggest_provider_media_credit_update", label: "Suggest provider/media/credit update" },
] as const;

type RegistryWorkMode = typeof registryWorkModes[number]["key"];

type RegistryReviewPayload = {
  workMode: RegistryWorkMode;
  fieldName?: string;
  currentValue?: string;
  proposedValue?: string;
  relationshipType?: string;
  relatedEntityLabel?: string;
  duplicateEntityLabel?: string;
  providerKey?: string;
  providerUrl?: string;
  supportingLinks?: string[];
  explanation?: string;
  confidence?: string;
  publicImpact?: string;
  culturalQaNote?: string;
  limitations?: string;
  suggestedEntityType?: WakilishaRecordEntityType;
  suggestedEntityLabel?: string;
  suggestedEntitySlug?: string;
  suggestedPublicUrl?: string;
};

function normalizeSupportingLinks(value: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => v.trim()).filter(Boolean);
  }
  return value
    .split(/\n+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function omitEmptyRegistryReviewFields(payload: RegistryReviewPayload): RegistryReviewPayload {
  const entries = Object.entries(payload).filter(([, value]) => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim() !== "";
    return true;
  });

  return Object.fromEntries(entries) as RegistryReviewPayload;
}

function buildRegistryReviewPayload(
  workMode: RegistryWorkMode,
  fields: {
    fieldName?: string;
    currentValue?: string;
    proposedValue?: string;
    relationshipType?: string;
    relatedEntityLabel?: string;
    duplicateEntityLabel?: string;
    providerKey?: string;
    providerUrl?: string;
    supportingLinks?: string | string[];
    explanation?: string;
    confidence?: string;
    publicImpact?: string;
    culturalQaNote?: string;
    limitations?: string;
    suggestedEntityType?: WakilishaRecordEntityType;
    suggestedEntityLabel?: string;
    suggestedEntitySlug?: string;
    suggestedPublicUrl?: string;
  }
): RegistryReviewPayload | undefined {
  if (workMode === "use_existing_record") {
    return { workMode };
  }
  if (workMode === "suggest_correction") {
    if (!fields.proposedValue?.trim() && !fields.explanation?.trim()) return undefined;
  }
  if (workMode === "suggest_merge_duplicate") {
    if (!fields.duplicateEntityLabel?.trim() && !fields.explanation?.trim()) return undefined;
  }
  if (workMode === "suggest_relationship") {
    if (!fields.relationshipType?.trim() && !fields.relatedEntityLabel?.trim() && !fields.explanation?.trim()) return undefined;
  }
  if (workMode === "suggest_provider_media_credit_update") {
    if (!fields.providerUrl?.trim() && !fields.proposedValue?.trim() && !fields.explanation?.trim()) return undefined;
  }

  const base: RegistryReviewPayload = {
    workMode,
    fieldName: fields.fieldName?.trim() || undefined,
    currentValue: fields.currentValue?.trim() || undefined,
    proposedValue: fields.proposedValue?.trim() || undefined,
    relationshipType: fields.relationshipType?.trim() || undefined,
    relatedEntityLabel: fields.relatedEntityLabel?.trim() || undefined,
    duplicateEntityLabel: fields.duplicateEntityLabel?.trim() || undefined,
    providerKey: fields.providerKey?.trim() || undefined,
    providerUrl: fields.providerUrl?.trim() || undefined,
    supportingLinks: fields.supportingLinks ? normalizeSupportingLinks(fields.supportingLinks) : undefined,
    explanation: fields.explanation?.trim() || undefined,
    confidence: fields.confidence?.trim() || undefined,
    publicImpact: fields.publicImpact?.trim() || undefined,
    culturalQaNote: fields.culturalQaNote?.trim() || undefined,
    limitations: fields.limitations?.trim() || undefined,
    suggestedEntityType: fields.suggestedEntityType,
    suggestedEntityLabel: fields.suggestedEntityLabel?.trim() || undefined,
    suggestedEntitySlug: fields.suggestedEntitySlug?.trim() || undefined,
    suggestedPublicUrl: fields.suggestedPublicUrl?.trim() || undefined,
  };

  return omitEmptyRegistryReviewFields(base);
}

function hasMeaningfulRegistryReviewPayload(payload: RegistryReviewPayload | undefined): boolean {
  if (!payload) return false;
  if (payload.workMode === "use_existing_record") return true;
  if (payload.workMode === "suggest_correction") {
    return !!(payload.proposedValue || payload.explanation);
  }
  if (payload.workMode === "suggest_merge_duplicate") {
    return !!(payload.duplicateEntityLabel || payload.explanation);
  }
  if (payload.workMode === "suggest_relationship") {
    return !!(payload.relationshipType || payload.relatedEntityLabel || payload.explanation);
  }
  if (payload.workMode === "suggest_provider_media_credit_update") {
    return !!(payload.providerUrl || payload.proposedValue || payload.explanation);
  }
  if (payload.workMode === "suggest_missing_record") {
    return true;
  }
  return false;
}

type Props = {
  draft: InquiryDraft;
  addEvidence: (inquiryId: string, evidence: Omit<EvidenceItem, "id" | "createdAt" | "updatedAt">) => Promise<EvidenceItem>;
  onSaved?: () => void;
};

type Confidence = "Low" | "Medium" | "High";

const evidenceRoles = [
  "Background context",
  "Direct evidence",
  "Comparison point",
  "Timeline marker",
  "Relationship evidence",
  "Correction or enrichment target",
  "Source trail",
];

const enrichmentTypes = [
  "No enrichment needed",
  "Add missing field",
  "Correct existing field",
  "Add relationship",
  "Add missing media",
  "Add source",
  "Add credits",
  "Add tracklist",
  "Add chart signal",
  "Merge duplicate",
  "Flag questionable data",
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "brand" | "success" | "warning" | "neutral" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black",
        tone === "brand" && "border-wk-brand/30 bg-wk-brand-soft text-wk-brand",
        tone === "success" && "border-wk-success/30 bg-wk-success-soft text-wk-success",
        tone === "warning" && "border-wk-warning/30 bg-wk-warning-soft text-wk-warning",
        tone === "neutral" && "border-wk-border bg-wk-surface text-wk-text-muted",
      )}
    >
      {children}
    </span>
  );
}

function entityLabel(value: WakilishaRecordEntityType) {
  return wakilishaRecordEntityOptions.find((option) => option.key === value)?.label ?? value.replaceAll("_", " ");
}

function firstUrl(value: string) {
  return value
    .split(/\s+/)
    .map((item) => item.trim())
    .find((item) => /^https?:\/\//i.test(item)) ?? "";
}

function selectedSnapshot(record: WakilishaRecordSearchResult, detail: WakilishaRecordDetail | null) {
  return {
    ...record.snapshot,
    ...(detail?.snapshotPatch ?? {}),
    richContext: {
      ...((record.snapshot.richContext && typeof record.snapshot.richContext === "object"
        ? record.snapshot.richContext
        : {}) as Record<string, unknown>),
      ...(detail?.richContext ?? {}),
    },
    detail: detail ?? {},
    capturedAt: new Date().toISOString(),
    capturedBy: "institute_wakilisha_record_workspace",
  };
}

function RecordPreview({
  record,
  detail,
  detailLoading,
}: {
  record: WakilishaRecordSearchResult;
  detail: WakilishaRecordDetail | null;
  detailLoading: boolean;
}) {
  const detailSnapshot = detail?.snapshotPatch ?? {};
  const detailRichContext =
    detail?.richContext && typeof detail.richContext === "object"
      ? detail.richContext
      : {};

  const baseRichContext =
    record.snapshot.richContext && typeof record.snapshot.richContext === "object"
      ? (record.snapshot.richContext as Record<string, unknown>)
      : {};

  const richContext = {
    ...baseRichContext,
    ...detailRichContext,
  };

  const richSections = Object.entries(richContext).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
    return String(value).trim().length > 0;
  });

  const snapshotEntries = Object.entries({ ...record.snapshot, ...detailSnapshot })
    .filter(([key, value]) => key !== "richContext" && value !== null && value !== undefined && String(value).trim() !== "")
    .slice(0, 24);

  const renderRichValue = (value: unknown) => {
    if (Array.isArray(value)) {
      if (!value.length) return null;

      return (
        <div className="grid gap-2 md:grid-cols-2">
          {value.slice(0, 8).map((item, index) => (
            <div key={index} className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2">
              <div className="text-[12px] leading-5 text-wk-text-muted">
                {typeof item === "object" && item !== null ? JSON.stringify(item) : String(item)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === "object" && value !== null) {
      const entries = Object.entries(value as Record<string, unknown>).filter(([, childValue]) => {
        if (childValue === null || childValue === undefined) return false;
        if (Array.isArray(childValue)) return childValue.length > 0;
        if (typeof childValue === "object") return Object.keys(childValue as Record<string, unknown>).length > 0;
        return String(childValue).trim().length > 0;
      });

      return (
        <div className="space-y-3">
          {entries.map(([childKey, childValue]) => (
            <div key={childKey} className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">{childKey}</div>
              <div className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                {Array.isArray(childValue)
                  ? childValue.length
                    ? JSON.stringify(childValue.slice(0, 8))
                    : "—"
                  : typeof childValue === "object" && childValue !== null
                    ? JSON.stringify(childValue)
                    : String(childValue)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return <p className="text-[12px] leading-5 text-wk-text-muted">{String(value)}</p>;
  };

  return (
    <section className="rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start gap-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-wk-border bg-wk-bg-subtle">
          {record.imageUrl ? (
            <img src={record.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
              No image
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="brand">{entityLabel(record.entityType)}</Pill>
            <Pill tone={record.health.status === "usable" ? "success" : record.health.status === "thin" ? "warning" : "warning"}>
              {record.health.status.replaceAll("_", " ")}
            </Pill>
          </div>
          <h3 className="mt-3 text-[26px] font-black tracking-[-0.055em] text-wk-text">{record.label}</h3>
          <p className="mt-1 text-[13px] font-bold leading-5 text-wk-text-muted">{record.subtitle}</p>
          {record.contextText ? <p className="mt-3 text-[13px] leading-6 text-wk-text-muted">{record.contextText}</p> : null}
          {record.href ? (
            <a href={record.href} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-[12px] font-black text-wk-brand">
              Open public record
            </a>
          ) : null}
        </div>
      </div>

      {record.health.missingFields.length ? (
        <div className="mt-4 rounded-xl border border-wk-warning/30 bg-wk-warning-soft p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-warning">Record health</div>
          <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
            This record is usable, but WAKILISHA is missing: {record.health.missingFields.join(", ")}.
          </p>
          {record.health.notes.length ? (
            <div className="mt-2 space-y-1">
              {record.health.notes.map((note) => (
                <p key={note} className="text-[11px] leading-4 text-wk-text-faint">{note}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {record.entityType === "release" ? (
        <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Release tracklist</div>
              <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                Loaded from registry_release_tracks and registry_tracks.
              </p>
            </div>
            {detailLoading ? <Pill>Loading</Pill> : <Pill>{detail?.tracklist?.length ?? 0} track(s)</Pill>}
          </div>

          {detail?.tracklist?.length ? (
            <div className="mt-3 divide-y divide-wk-border overflow-hidden rounded-lg border border-wk-border">
              {detail.tracklist.map((track) => (
                <div key={`${track.trackNumber}-${track.slug}`} className="grid grid-cols-[48px_1fr] gap-3 bg-wk-surface px-3 py-2.5">
                  <div className="text-[12px] font-black text-wk-text-faint">{track.trackNumber || "·"}</div>
                  <div>
                    <div className="text-[13px] font-black text-wk-text">{track.title}</div>
                    <div className="text-[11px] text-wk-text-muted">{track.artists.join(", ") || "Artist not linked"}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : !detailLoading ? (
            <p className="mt-3 text-[12px] leading-5 text-wk-text-muted">No tracklist rows were returned for this release.</p>
          ) : null}
        </div>
      ) : null}

      {richSections.length ? (
        <div className="mt-4 rounded-xl border border-wk-brand/20 bg-wk-brand-soft p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-brand">Rich WAKILISHA context</div>
          <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
            This is the record trail available to the inquiry assistant: bios, social links, provider IDs, discography, chart signals, relationships, media, and article context where present.
          </p>
          <div className="mt-4 space-y-3">
            {richSections.map(([sectionKey, sectionValue]) => (
              <div key={sectionKey} className="rounded-xl border border-wk-border bg-wk-bg p-3">
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">{sectionKey}</div>
                {renderRichValue(sectionValue)}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Snapshot fields</div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {snapshotEntries.map(([key, value]) => (
            <div key={key} className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">{key}</div>
              <div className="mt-1 truncate text-[12px] font-bold text-wk-text-muted">
                {Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function compactTextValues(values: unknown[]) {
  return values.map(textValue).filter(Boolean);
}

function entityShortCode(value: WakilishaRecordEntityType) {
  if (value === "chart_family") return "CH";
  return value.slice(0, 2).toUpperCase();
}

function readableEntityType(value: WakilishaRecordEntityType) {
  if (value === "chart_family") return "Chart";
  return entityLabel(value).replace(/s$/, "");
}

function metadataFrom(record: WakilishaRecordSearchResult) {
  return asRecord(record.snapshot.metadata);
}

function richSearchContextFrom(record: WakilishaRecordSearchResult) {
  const richContext = asRecord(record.snapshot.richContext);
  return asRecord(richContext.searchContext);
}

function knownProviderCount(record: WakilishaRecordSearchResult) {
  const metadata = metadataFrom(record);
  const providerKeys = [
    "spotify_url",
    "spotify_artist_id",
    "spotify_id",
    "apple_music_url",
    "apple_music_id",
    "instagram_url",
    "youtube_url",
    "tiktok_url",
    "twitter_url",
    "facebook_url",
    "website_url",
  ];

  return providerKeys.filter((key) => textValue(metadata[key])).length;
}

function recordMetricChips(record: WakilishaRecordSearchResult) {
  const snapshot = asRecord(record.snapshot);
  const metadata = metadataFrom(record);
  const searchContext = richSearchContextFrom(record);
  const chips: string[] = [];

  if (record.entityType === "artist") {
    const genres = asArray(snapshot.genres).map(textValue).filter(Boolean);
    const topSongs = asArray(metadata.top_songs);
    const youtubeVideos = asArray(metadata.youtube_videos);
    const providers = knownProviderCount(record);

    chips.push(...compactTextValues([
      snapshot.country || snapshot.originIso2,
      genres.length ? genres.slice(0, 2).join(", ") : "",
      snapshot.bio ? "Bio available" : "",
      providers ? `${providers} provider trail(s)` : "",
      topSongs.length ? `${topSongs.length} top song(s)` : "",
      youtubeVideos.length ? `${youtubeVideos.length} video signal(s)` : "",
    ]));
  }

  if (record.entityType === "track") {
    const artists = asArray(searchContext.artists);
    const release = asRecord(searchContext.release);
    const chartEntryCount = numberValue(searchContext.chartEntryCount);

    chips.push(...compactTextValues([
      artists.length ? `${artists.length} credit(s)` : "",
      release.title ? `Release: ${release.title}` : "",
      chartEntryCount ? `${chartEntryCount} chart signal(s)` : "",
      snapshot.isrc ? "ISRC present" : "",
      snapshot.previewUrl ? "Preview available" : "",
    ]));
  }

  if (record.entityType === "release") {
    const artists = asArray(searchContext.artists);
    const label = asRecord(searchContext.label);
    const trackCount = numberValue(searchContext.trackCount);

    chips.push(...compactTextValues([
      artists.length ? `${artists.length} artist credit(s)` : "",
      snapshot.releaseType,
      snapshot.releaseDate,
      trackCount ? `${trackCount} track(s)` : "",
      label.name ? `Label: ${label.name}` : "",
    ]));
  }

  if (record.entityType === "label") {
    chips.push(...compactTextValues([
      snapshot.countryCode,
      snapshot.description ? "Description available" : "",
      snapshot.status && snapshot.status !== "active" ? `Status: ${snapshot.status}` : "",
    ]));
  }

  if (record.entityType === "genre") {
    chips.push(...compactTextValues([
      snapshot.description ? "Description available" : "",
      snapshot.parentGenreId ? "Has parent genre" : "",
      snapshot.status && snapshot.status !== "active" ? `Status: ${snapshot.status}` : "",
    ]));
  }

  if (record.entityType === "article") {
    chips.push(...compactTextValues([
      snapshot.author ? `By ${snapshot.author}` : "",
      snapshot.status,
      snapshot.publishedAt,
      asArray(snapshot.categories).length ? `${asArray(snapshot.categories).length} categor${asArray(snapshot.categories).length === 1 ? "y" : "ies"}` : "",
      asArray(snapshot.tags).length ? `${asArray(snapshot.tags).length} tag(s)` : "",
    ]));
  }

  if (record.entityType === "author") {
    const profile = asRecord(asRecord(snapshot.richContext).profile);
    chips.push(...compactTextValues([
      snapshot.role,
      snapshot.location,
      profile.socialLinks ? "Social links present" : "",
      snapshot.bio ? "Bio available" : "",
    ]));
  }

  if (record.entityType === "chart_family") {
    const methodology = asRecord(asRecord(snapshot.richContext).methodology);
    const market = asRecord(asRecord(snapshot.richContext).market);

    chips.push(...compactTextValues([
      snapshot.marketLabel || market.marketLabel || snapshot.defaultRegion,
      snapshot.defaultChartSize ? `${snapshot.defaultChartSize} entries` : "",
      snapshot.periodType,
      methodology.ruleset,
      methodology.scoringModel,
    ]));
  }

  if (!chips.length) {
    chips.push(...compactTextValues([
      record.subtitle,
      record.href ? "Public route available" : "",
    ]));
  }

  return chips.slice(0, 6);
}

function recordEvidenceSignals(record: WakilishaRecordSearchResult) {
  const signals: string[] = [];
  const missingCount = record.health.missingFields.length;

  if (record.health.status === "usable") {
    signals.push("Ready for evidence");
  } else if (missingCount) {
    signals.push(`${missingCount} missing field(s)`);
  } else {
    signals.push(record.health.status.replaceAll("_", " "));
  }

  if (record.href) signals.push("Public record");
  if (record.imageUrl) signals.push("Visual attached");

  return signals.slice(0, 3);
}

function whyRecordMatched(record: WakilishaRecordSearchResult, query: string) {
  const clean = query.trim().toLowerCase();
  if (!clean) return "";

  if (record.label.toLowerCase() === clean) return "Exact title match";
  if (record.slug.toLowerCase() === clean) return "Exact slug match";
  if (record.label.toLowerCase().includes(clean)) return "Matched title";
  if (record.slug.toLowerCase().includes(clean)) return "Matched slug";
  if (record.subtitle.toLowerCase().includes(clean)) return "Matched record context";
  if (record.contextText.toLowerCase().includes(clean)) return "Matched summary";
  if (record.searchText.includes(clean)) return "Matched linked metadata";

  return "Relevant record match";
}

function RecordResultCard({
  record,
  selected,
  query,
  onSelect,
}: {
  record: WakilishaRecordSearchResult;
  selected: boolean;
  query: string;
  onSelect: () => void;
}) {
  const metricChips = recordMetricChips(record);
  const evidenceSignals = recordEvidenceSignals(record);
  const matchReason = whyRecordMatched(record, query);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        "w-full overflow-hidden rounded-2xl border text-left transition",
        selected ? "border-wk-brand bg-wk-brand-soft shadow-sm" : "border-wk-border bg-wk-bg hover:border-wk-brand/40 hover:bg-wk-surface",
      )}
    >
      <div className="grid gap-3 p-3 sm:grid-cols-[76px_1fr]">
        <div className="h-[76px] w-[76px] overflow-hidden rounded-xl border border-wk-border bg-wk-bg-subtle">
          {record.imageUrl ? (
            <img src={record.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center">
              <span className="text-[18px] font-black tracking-[-0.08em] text-wk-text-faint">{entityShortCode(record.entityType)}</span>
              <span className="text-[8px] font-black uppercase tracking-[0.12em] text-wk-text-faint">No image</span>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="brand">{readableEntityType(record.entityType)}</Pill>
            <Pill tone={record.health.status === "usable" ? "success" : "warning"}>
              {record.health.status.replaceAll("_", " ")}
            </Pill>
            {matchReason ? <Pill>{matchReason}</Pill> : null}
          </div>

          <div className="mt-2 truncate text-[15px] font-black tracking-[-0.02em] text-wk-text">{record.label}</div>
          <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-wk-text-muted">{record.subtitle}</p>

          {metricChips.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {metricChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-wk-border bg-wk-surface px-2 py-1 text-[10px] font-black text-wk-text-muted"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}

          {record.contextText ? (
            <p className="mt-3 line-clamp-2 text-[11px] leading-5 text-wk-text-faint">{record.contextText}</p>
          ) : null}
        </div>
      </div>

      <div className={cx(
        "flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2",
        selected ? "border-wk-brand/20 bg-wk-brand-soft" : "border-wk-border bg-wk-surface",
      )}>
        <div className="flex flex-wrap gap-1.5">
          {evidenceSignals.map((signal) => (
            <span key={signal} className="text-[10px] font-black uppercase tracking-[0.1em] text-wk-text-faint">
              {signal}
            </span>
          ))}
        </div>
        <span className="text-[10px] font-black text-wk-brand">
          {selected ? "Selected" : "Use record"}
        </span>
      </div>
    </button>
  );
}


export function WakilishaRecordWorkspace({ draft, addEvidence, onSaved }: Props) {
  const [entityType, setEntityType] = useState<"all" | WakilishaRecordEntityType>("all");
  const [query, setQuery] = useState("");
  const { records, loading, error, searchedQuery } = useWakilishaRecordSearch(entityType, query);

  const [selectedRecord, setSelectedRecord] = useState<WakilishaRecordSearchResult | null>(null);
  const [detail, setDetail] = useState<WakilishaRecordDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [evidenceRole, setEvidenceRole] = useState(evidenceRoles[0]);
  const [claimSupported, setClaimSupported] = useState("");
  const [limitations, setLimitations] = useState("");
  const [confidence, setConfidence] = useState<Confidence>("Medium");
  const [enrichmentType, setEnrichmentType] = useState(enrichmentTypes[0]);
  const [enrichmentNote, setEnrichmentNote] = useState("");

  const [workMode, setWorkMode] = useState<RegistryWorkMode>("use_existing_record");
  const [fieldName, setFieldName] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [proposedValue, setProposedValue] = useState("");
  const [relationshipType, setRelationshipType] = useState("");
  const [relatedEntityLabel, setRelatedEntityLabel] = useState("");
  const [duplicateEntityLabel, setDuplicateEntityLabel] = useState("");
  const [providerKey, setProviderKey] = useState("");
  const [providerUrl, setProviderUrl] = useState("");
  const [reviewSupportingLinks, setReviewSupportingLinks] = useState("");
  const [reviewExplanation, setReviewExplanation] = useState("");
  const [publicImpact, setPublicImpact] = useState("");
  const [culturalQaNote, setCulturalQaNote] = useState("");

  const [suggestedType, setSuggestedType] = useState<WakilishaRecordEntityType>("artist");
  const [suggestedTitle, setSuggestedTitle] = useState("");
  const [suggestedDetails, setSuggestedDetails] = useState("");
  const [supportingLinks, setSupportingLinks] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadDetail() {
      if (!selectedRecord) {
        setDetail(null);
        return;
      }

      setDetailLoading(true);
      try {
        const nextDetail = await fetchWakilishaRecordDetail(selectedRecord);
        if (alive) setDetail(nextDetail);
      } finally {
        if (alive) setDetailLoading(false);
      }
    }

    void loadDetail();

    return () => {
      alive = false;
    };
  }, [selectedRecord?.id]);

  const canSaveExisting = Boolean(
    selectedRecord &&
      evidenceRole.trim() &&
      claimSupported.trim().length >= 8 &&
      limitations.trim().length >= 4 &&
      !saving,
  );

  const canSaveSuggestion = Boolean(
    suggestedTitle.trim().length >= 2 &&
      suggestedDetails.trim().length >= 8 &&
      !saving,
  );

  const cleanQuery = query.trim();
  const searchHasSettled = searchedQuery === cleanQuery;
  const canSuggestMissingRecord = !loading && !error && searchHasSettled && cleanQuery.length >= 2 && records.length === 0;

  useEffect(() => {
    if (entityType !== "all") setSuggestedType(entityType);
  }, [entityType]);

  useEffect(() => {
    if (!canSuggestMissingRecord) return;
    setSuggestedTitle(cleanQuery);
  }, [canSuggestMissingRecord, cleanQuery]);

  const selectedRecordEvidenceTitle = selectedRecord
    ? `${selectedRecord.label} · WAKILISHA record evidence`
    : "WAKILISHA record evidence";

  const selectedSummary = useMemo(() => {
    if (!selectedRecord) return "";
    return claimSupported.trim() || selectedRecord.contextText || selectedRecord.subtitle;
  }, [claimSupported, selectedRecord]);

  type EvidenceMetadata = {
    workspaceVersion: number;
    workspaceFormat: string;
    workspaceType: string;
    savedFrom: string;
    recordEvidenceMode: string;
    entityType?: WakilishaRecordEntityType;
    entitySlug?: string;
    entityLabel?: string;
    entityHref?: string;
    recordSnapshot?: unknown;
    recordHealth?: unknown;
    evidenceRole?: string;
    claimSupported?: string;
    limitations?: string;
    confidence?: Confidence;
    enrichmentNeeded?: boolean;
    enrichmentType?: string;
    enrichmentNote?: string;
    inquiryCode?: string;
    inquiryQuestion?: string;
    registryReviewPayload?: RegistryReviewPayload;
  };

  const saveExistingRecordEvidence = async () => {
    if (!selectedRecord || !canSaveExisting) return;

    setSaving(true);
    setSavedNotice("");

    try {
      const enrichmentNeeded = enrichmentType !== "No enrichment needed";

      const registryReviewPayload = buildRegistryReviewPayload(workMode, {
        fieldName,
        currentValue,
        proposedValue,
        relationshipType,
        relatedEntityLabel,
        duplicateEntityLabel,
        providerKey,
        providerUrl,
        supportingLinks: reviewSupportingLinks,
        explanation: reviewExplanation,
        confidence,
        publicImpact,
        culturalQaNote,
        limitations,
      });

      if (workMode !== "use_existing_record" && !hasMeaningfulRegistryReviewPayload(registryReviewPayload)) {
        let msg = "Please complete the required registry review fields before saving.";
        if (workMode === "suggest_correction") {
          msg = "Add a proposed value or explanation before saving this correction.";
        } else if (workMode === "suggest_merge_duplicate") {
          msg = "Add a duplicate entity label or explanation before saving this merge suggestion.";
        } else if (workMode === "suggest_relationship") {
          msg = "Add a relationship type, related entity, or explanation before saving this relationship suggestion.";
        } else if (workMode === "suggest_provider_media_credit_update") {
          msg = "Add a provider URL, proposed value, or explanation before saving this update.";
        }
        setSavedNotice(msg);
        setSaving(false);
        return;
      }

      const metadata: EvidenceMetadata = {
        workspaceVersion: 2,
        workspaceFormat: "WAKILISHA record",
        workspaceType: "registry",
        savedFrom: "wakilisha_record_workspace",
        recordEvidenceMode: enrichmentNeeded ? "existing_record_enrichment" : "existing_record",
        entityType: selectedRecord.entityType,
        entitySlug: selectedRecord.slug,
        entityLabel: selectedRecord.label,
        entityHref: selectedRecord.href,
        recordSnapshot: selectedSnapshot(selectedRecord, detail),
        recordHealth: selectedRecord.health,
        evidenceRole,
        claimSupported: claimSupported.trim(),
        limitations: limitations.trim(),
        confidence,
        enrichmentNeeded,
        enrichmentType,
        enrichmentNote: enrichmentNote.trim(),
        inquiryCode: draft.code,
        inquiryQuestion: draft.workingQuestion,
      };
      if (registryReviewPayload) {
        metadata.registryReviewPayload = registryReviewPayload;
      }

      await addEvidence(draft.id, {
        title: selectedRecordEvidenceTitle,
        kind: "WAKILISHA record",
        source: `WAKILISHA ${entityLabel(selectedRecord.entityType)} record`,
        sourceUrl: selectedRecord.href,
        summary: selectedSummary,
        whyItMatters: evidenceRole,
        mediaMinutes: 0,
        reviewState: enrichmentNeeded || selectedRecord.health.status !== "usable" ? "Needs review" : "Draft",
        metadata,
      });

      setSavedNotice("Saved WAKILISHA record evidence.");
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  type MissingRecordEvidenceMetadata = {
    workspaceVersion: number;
    workspaceFormat: string;
    workspaceType: string;
    savedFrom: string;
    recordEvidenceMode: string;
    suggestedEntityType: WakilishaRecordEntityType;
    suggestedTitle: string;
    suggestedDetails: string;
    supportingLinks: string[];
    inquiryCode: string;
    inquiryQuestion: string;
    registryReviewPayload?: RegistryReviewPayload;
  };

  const saveMissingRecordSuggestion = async () => {
    if (!canSaveSuggestion) return;

    setSaving(true);
    setSavedNotice("");

    try {
      const registryReviewPayload = buildRegistryReviewPayload("suggest_missing_record", {
        supportingLinks,
        explanation: suggestedDetails,
        confidence,
        limitations,
        suggestedEntityType: suggestedType,
        suggestedEntityLabel: suggestedTitle,
      });

      const metadata: MissingRecordEvidenceMetadata = {
        workspaceVersion: 2,
        workspaceFormat: "WAKILISHA record",
        workspaceType: "registry",
        savedFrom: "wakilisha_record_workspace",
        recordEvidenceMode: "missing_record_suggestion",
        suggestedEntityType: suggestedType,
        suggestedTitle: suggestedTitle.trim(),
        suggestedDetails: suggestedDetails.trim(),
        supportingLinks: normalizeSupportingLinks(supportingLinks),
        inquiryCode: draft.code,
        inquiryQuestion: draft.workingQuestion,
      };
      if (registryReviewPayload) {
        metadata.registryReviewPayload = registryReviewPayload;
      }

      await addEvidence(draft.id, {
        title: `Suggested ${entityLabel(suggestedType)} record: ${suggestedTitle.trim()}`,
        kind: "WAKILISHA record",
        source: "Institute missing WAKILISHA record suggestion",
        sourceUrl: firstUrl(supportingLinks),
        summary: suggestedDetails.trim(),
        whyItMatters: "Missing WAKILISHA record needed for this inquiry.",
        mediaMinutes: 0,
        reviewState: "Needs review",
        metadata,
      });

      setSavedNotice("Saved missing record suggestion for editor review.");
      setSuggestedTitle("");
      setSuggestedDetails("");
      setSupportingLinks("");
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-5">
        <section className="rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-wk-brand">Search WAKILISHA</div>
          <h3 className="mt-2 text-[24px] font-black tracking-[-0.055em] text-wk-text">Use a real WAKILISHA record.</h3>
          <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">
            Search the live registry and content system. If the record is missing, suggest it for review instead of inventing it here.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
            <select
              value={entityType}
              onChange={(event) => {
                setEntityType(event.target.value as "all" | WakilishaRecordEntityType);
                setSelectedRecord(null);
              }}
              className="rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
            >
              {wakilishaRecordEntityOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search artist, track, release, label, genre, article, author, or chart..."
              className="rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {cleanQuery.length < 2 ? <Pill>Type 2+ characters to search</Pill> : <Pill>{records.length} match(es)</Pill>}
            {loading ? <Pill>Loading</Pill> : null}
            {error ? <Pill tone="warning">Some sources failed</Pill> : null}
          </div>

          {error ? (
            <div className="mt-3 rounded-lg border border-wk-warning/30 bg-wk-warning-soft px-3 py-2 text-[12px] leading-5 text-wk-text-muted">
              {error}
            </div>
          ) : null}
        </section>

        <section className="rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-wk-text-faint">Results</div>
              <h3 className="mt-1 text-[18px] font-black tracking-[-0.04em] text-wk-text">Pick one record</h3>
            </div>
            <Pill>{records.length} shown</Pill>
          </div>

          <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {cleanQuery.length < 2 ? (
              <div className="rounded-xl border border-dashed border-wk-border bg-wk-bg-subtle p-4">
                <div className="text-[13px] font-black text-wk-text">Start with the record, not the form</div>
                <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                  Type at least two characters. Results will show enough context to decide whether the registry already has what you need.
                </p>
              </div>
            ) : null}

            {loading && !records.length ? (
              <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                <div className="text-[13px] font-black text-wk-text">Searching WAKILISHA records...</div>
                <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                  Checking artists, tracks, releases, labels, genres, articles, authors, and charts.
                </p>
              </div>
            ) : null}

            {records.map((record) => (
              <RecordResultCard
                key={record.id}
                record={record}
                selected={selectedRecord?.id === record.id}
                query={cleanQuery}
                onSelect={() => {
                  setSelectedRecord(record);
                  setSavedNotice("");
                }}
              />
            ))}

            {!loading && !error && searchHasSettled && cleanQuery.length >= 2 && !records.length ? (
              <div className="rounded-xl border border-dashed border-wk-warning/40 bg-wk-warning-soft p-4">
                <div className="text-[13px] font-black text-wk-text">No matching WAKILISHA record found</div>
                <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                  The registry did not return a match for this search. You can now suggest a missing record for editor review.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        {canSuggestMissingRecord ? (
          <section className="rounded-[22px] border border-wk-warning/40 bg-wk-warning-soft p-5 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-wk-warning">No registry match</div>
            <h3 className="mt-2 text-[20px] font-black tracking-[-0.045em] text-wk-text">Suggest a missing WAKILISHA record.</h3>
            <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">
              This appears only after WAKILISHA search returns zero matches. It does not create public registry data. It creates an editor-reviewable suggestion attached to this inquiry.
            </p>

            <div className="mt-4 space-y-3">
              <select
                value={suggestedType}
                onChange={(event) => setSuggestedType(event.target.value as WakilishaRecordEntityType)}
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              >
                {wakilishaRecordEntityOptions
                  .filter((option) => option.key !== "all")
                  .map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
              </select>

              <input
                value={suggestedTitle}
                onChange={(event) => setSuggestedTitle(event.target.value)}
                placeholder="Name, title, chart family, article, or author..."
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />

              <textarea
                value={suggestedDetails}
                onChange={(event) => setSuggestedDetails(event.target.value)}
                rows={5}
                placeholder="What should WAKILISHA know, and why does this belong in the record?"
                className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />

              <textarea
                value={supportingLinks}
                onChange={(event) => setSupportingLinks(event.target.value)}
                rows={4}
                placeholder="Supporting links, one per line"
                className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />

              <button
                type="button"
                disabled={!canSaveSuggestion}
                onClick={() => void saveMissingRecordSuggestion()}
                className="rounded-lg bg-wk-text px-5 py-3 text-[13px] font-black text-wk-bg transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save missing record suggestion"}
              </button>
            </div>
          </section>
        ) : null}
      </div>

      <div className="space-y-5">
        {selectedRecord ? (
          <RecordPreview record={selectedRecord} detail={detail} detailLoading={detailLoading} />
        ) : (
          <section className="rounded-[22px] border border-dashed border-wk-border bg-wk-bg-subtle p-5">
            <div className="text-[16px] font-black text-wk-text">No record selected yet</div>
            <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">
              Pick a WAKILISHA record on the left to preserve it as structured evidence.
            </p>
          </section>
        )}

        <section className="rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-wk-brand">Evidence use</div>
          <h3 className="mt-2 text-[22px] font-black tracking-[-0.05em] text-wk-text">Explain what this record does.</h3>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Evidence role</span>
              <select
                value={evidenceRole}
                onChange={(event) => setEvidenceRole(event.target.value)}
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              >
                {evidenceRoles.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">What does this record support?</span>
              <textarea
                value={claimSupported}
                onChange={(event) => setClaimSupported(event.target.value)}
                rows={5}
                placeholder="Example: This release works as a timeline marker for..."
                className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">What does it not prove?</span>
              <textarea
                value={limitations}
                onChange={(event) => setLimitations(event.target.value)}
                rows={4}
                placeholder="Set the limits. A record can support context without proving the whole argument."
                className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Confidence</span>
              <select
                value={confidence}
                onChange={(event) => setConfidence(event.target.value as Confidence)}
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-wk-brand">Registry review</div>
          <h3 className="mt-2 text-[18px] font-black tracking-[-0.04em] text-wk-text">Registry work mode and details</h3>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Registry work mode</span>
              <select
                value={workMode}
                onChange={(event) => setWorkMode(event.target.value as RegistryWorkMode)}
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              >
                {registryWorkModes.map((mode) => (
                  <option key={mode.key} value={mode.key}>{mode.label}</option>
                ))}
              </select>
            </label>

            {(workMode === "suggest_correction" || workMode === "suggest_provider_media_credit_update") && (
              <>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Field name</span>
                  <input
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Current value</span>
                  <input
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Proposed value</span>
                  <input
                    value={proposedValue}
                    onChange={(e) => setProposedValue(e.target.value)}
                    className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                  />
                </label>
              </>
            )}

            {workMode === "suggest_relationship" && (
              <>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Relationship type</span>
                  <input
                    value={relationshipType}
                    onChange={(e) => setRelationshipType(e.target.value)}
                    className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Related entity label</span>
                  <input
                    value={relatedEntityLabel}
                    onChange={(e) => setRelatedEntityLabel(e.target.value)}
                    className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                  />
                </label>
              </>
            )}

            {workMode === "suggest_merge_duplicate" && (
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Duplicate entity label</span>
                <input
                  value={duplicateEntityLabel}
                  onChange={(e) => setDuplicateEntityLabel(e.target.value)}
                  className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                />
              </label>
            )}

            {workMode === "suggest_provider_media_credit_update" && (
              <>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Provider key</span>
                  <input
                    value={providerKey}
                    onChange={(e) => setProviderKey(e.target.value)}
                    className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Provider URL</span>
                  <input
                    value={providerUrl}
                    onChange={(e) => setProviderUrl(e.target.value)}
                    className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                  />
                </label>
              </>
            )}

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Supporting links</span>
              <textarea
                value={reviewSupportingLinks}
                onChange={(e) => setReviewSupportingLinks(e.target.value)}
                rows={2}
                placeholder="Paste links, one per line"
                className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Explanation</span>
              <textarea
                value={reviewExplanation}
                onChange={(e) => setReviewExplanation(e.target.value)}
                rows={2}
                placeholder="Explain the registry suggestion"
                className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Public impact</span>
              <input
                value={publicImpact}
                onChange={(e) => setPublicImpact(e.target.value)}
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Cultural QA note</span>
              <input
                value={culturalQaNote}
                onChange={(e) => setCulturalQaNote(e.target.value)}
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
            </label>
          </div>
          <div className="mt-4">
            <div className="text-[12px] font-bold text-wk-text-muted mb-2">Registry review summary</div>
            <div className="rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[12px] text-wk-text-muted">
              <ul className="list-disc pl-4">
                <li>Work mode: {workMode}</li>
                {fieldName && <li>Field: {fieldName}</li>}
                {currentValue && <li>Current: {currentValue}</li>}
                {proposedValue && <li>Proposed: {proposedValue}</li>}
                {relationshipType && <li>Relationship: {relationshipType}</li>}
                {relatedEntityLabel && <li>Related entity: {relatedEntityLabel}</li>}
                {duplicateEntityLabel && <li>Duplicate entity: {duplicateEntityLabel}</li>}
                {providerKey && <li>Provider key: {providerKey}</li>}
                {providerUrl && <li>Provider URL: {providerUrl}</li>}
                {reviewSupportingLinks && normalizeSupportingLinks(reviewSupportingLinks).length > 0 && (
                  <li>Links: {normalizeSupportingLinks(reviewSupportingLinks).join(", ")}</li>
                )}
                {reviewExplanation && <li>Explanation: {reviewExplanation}</li>}
                {publicImpact && <li>Public impact: {publicImpact}</li>}
                {culturalQaNote && <li>Cultural QA: {culturalQaNote}</li>}
                {limitations && <li>Limitations: {limitations}</li>}
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-wk-warning">Correction / enrichment</div>
          <h3 className="mt-2 text-[20px] font-black tracking-[-0.045em] text-wk-text">Does the record need work?</h3>

          <div className="mt-4 space-y-4">
            <select
              value={enrichmentType}
              onChange={(event) => setEnrichmentType(event.target.value)}
              className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
            >
              {enrichmentTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>

            <textarea
              value={enrichmentNote}
              onChange={(event) => setEnrichmentNote(event.target.value)}
              rows={5}
              placeholder="Describe the correction, missing field, missing media, relationship, source, credit, chart signal, or merge concern."
              className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
            />

            {savedNotice ? (
              <div className="rounded-lg border border-wk-success/30 bg-wk-success-soft px-3 py-2 text-[12px] font-bold text-wk-success">
                {savedNotice}
              </div>
            ) : null}

            <button
              type="button"
              disabled={!canSaveExisting}
              onClick={() => void saveExistingRecordEvidence()}
              className="rounded-lg bg-wk-brand px-6 py-3 text-[14px] font-black text-wk-brand-on transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save WAKILISHA record evidence"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
