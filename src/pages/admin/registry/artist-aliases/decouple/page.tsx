import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";

type SourceType = "charts" | "registry" | "provider_intake" | "artist_intake" | "manual";

interface RegistryArtistSearchResult {
  artist_id: string;
  artist_slug: string;
  display_name: string;
  status: string;
  origin_iso2: string | null;
  public_image_url: string | null;
  track_credit_count: number;
  release_credit_count: number;
}

interface DecoupleCredit {
  credit_id: string;
  track_id?: string | null;
  track_slug?: string | null;
  track_title?: string | null;
  release_id?: string | null;
  release_slug?: string | null;
  release_title?: string | null;
  role?: string | null;
  is_primary?: boolean | null;
  is_featured?: boolean | null;
  credit_order?: number | null;
  display_credit?: string | null;
  status?: string | null;
}

interface DecoupleChartEntry {
  entry_id: string;
  track_id?: string | null;
  track_slug?: string | null;
  track_title?: string | null;
  artist_name?: string | null;
  artist_slug?: string | null;
  rank?: number | null;
}

interface DecouplePreview {
  sourceArtist: RegistryArtistSearchResult;
  trackCredits: DecoupleCredit[];
  releaseCredits: DecoupleCredit[];
  chartEntries: DecoupleChartEntry[];
}

interface ArtistResolutionEvent {
  id: string;
  action: "alias_merge" | "artist_merge" | "artist_decouple";
  status: "success" | "failed" | "cancelled";
  source_artist_id: string | null;
  source_artist_slug: string | null;
  source_artist_name: string | null;
  replacement_artists: Array<Record<string, unknown>>;
  track_links: Array<Record<string, unknown>>;
  release_links: Array<Record<string, unknown>>;
  chart_entries: Array<Record<string, unknown>>;
  note: string | null;
  error_message: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
}

type DecoupleDecisionType = "split_combined_artist" | "split_raw_credit" | "block_alias" | "needs_follow_up" | "not_a_decouple";
type DecoupleDecisionStatus = "draft" | "ready" | "applied" | "blocked" | "failed" | "superseded";

interface DecoupleDecision {
  id: string;
  source_key: string;
  source_type: SourceType;
  source_table: string | null;
  source_id: string | null;
  source_label: string;
  source_snapshot: Record<string, unknown>;
  source_artist_id: string | null;
  raw_credit_text: string | null;
  parsed_tokens: Array<Record<string, unknown>>;
  selected_artists: Array<Record<string, unknown>>;
  chart_primary_artist_id: string | null;
  decision_type: DecoupleDecisionType;
  decision_status: DecoupleDecisionStatus;
  note: string | null;
  applied_at: string | null;
  apply_result_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface TokenDraft {
  token: string;
  query: string;
  loading: boolean;
  creating: boolean;
  results: RegistryArtistSearchResult[];
  selectedArtist: RegistryArtistSearchResult | null;
  role: string;
  displayCredit: string;
}

type Toast = { message: string; type: "success" | "error" } | null;

const INPUT_CLASS = "min-w-0 rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#85c441]";
const LABEL_CLASS = "mb-2 block text-[11px] font-black uppercase tracking-wider text-[#71796b]";

const ROLE_OPTIONS = [
  { value: "primary_artist", label: "Primary artist" },
  { value: "featured_artist", label: "Featured artist" },
  { value: "collaborator", label: "Collaborator" },
  { value: "producer", label: "Producer" },
  { value: "composer", label: "Composer" },
  { value: "remixer", label: "Remixer" },
  { value: "group_member", label: "Group member" },
  { value: "unknown", label: "Unknown" },
];

const SOURCE_OPTIONS: Array<{
  key: SourceType;
  label: string;
  eyebrow: string;
  description: string;
  status: string;
}> = [
  {
    key: "charts",
    label: "Charts",
    eyebrow: "Chart-origin coupled credits",
    description: "Start from chart rows, chart artist strings, and chart resolution decisions.",
    status: "Use Chart Artist Resolution",
  },
  {
    key: "registry",
    label: "Registry artist entities",
    eyebrow: "Bad combined registry artist",
    description: "Use when one registry artist entity is actually a coupled credit holding track or release links.",
    status: "Read-only preview",
  },
  {
    key: "provider_intake",
    label: "Provider / Apple intake",
    eyebrow: "Provider-origin ambiguity",
    description: "Use when Apple, Spotify, or other provider credits arrive as one coupled artist string.",
    status: "Phase 1B source queue",
  },
  {
    key: "artist_intake",
    label: "Artist Intake drawer",
    eyebrow: "Admin intake-origin ambiguity",
    description: "Use when an artist intake submission creates a multi-artist ambiguity before canonical matching.",
    status: "Phase 1B source queue",
  },
  {
    key: "manual",
    label: "Manual investigation",
    eyebrow: "Known risky case",
    description: "Use only when an admin already knows the exact bad source artist to inspect.",
    status: "Read-only preview",
  },
];

function asArtistRows(data: unknown): RegistryArtistSearchResult[] {
  return ((data as RegistryArtistSearchResult[]) ?? []).map((row) => ({
    ...row,
    track_credit_count: Number(row.track_credit_count ?? 0),
    release_credit_count: Number(row.release_credit_count ?? 0),
  }));
}

function asHistoryRows(data: unknown): ArtistResolutionEvent[] {
  return ((data as ArtistResolutionEvent[]) ?? []).map((row) => ({
    ...row,
    replacement_artists: row.replacement_artists ?? [],
    track_links: row.track_links ?? [],
    release_links: row.release_links ?? [],
    chart_entries: row.chart_entries ?? [],
  }));
}

function asDecisionRows(data: unknown): DecoupleDecision[] {
  return ((data as DecoupleDecision[]) ?? []).map((row) => ({
    ...row,
    parsed_tokens: row.parsed_tokens ?? [],
    selected_artists: row.selected_artists ?? [],
  }));
}

function decisionTypeLabel(value: DecoupleDecisionType): string {
  switch (value) {
    case "split_combined_artist": return "Split combined artist";
    case "split_raw_credit": return "Split raw credit";
    case "block_alias": return "Block alias";
    case "needs_follow_up": return "Needs follow-up";
    case "not_a_decouple": return "Not a decouple";
    default: return value;
  }
}

function decisionStatusClass(status: DecoupleDecisionStatus): string {
  if (status === "applied") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "ready") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "blocked") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-800";
  if (status === "superseded") return "border-gray-200 bg-gray-50 text-gray-700";
  return "border-[#dfe4d8] bg-white text-[#5d6557]";
}

function sourceKeyFor(sourceType: SourceType, artist: RegistryArtistSearchResult | null): string | null {
  if (!artist) return null;
  return `${sourceType}:${artist.artist_id}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function tokenTextForArtist(artist: RegistryArtistSearchResult): string {
  const displaySlug = slugify(artist.display_name);
  if (artist.artist_slug && artist.artist_slug !== displaySlug) {
    return artist.artist_slug.replace(/-/g, " x ");
  }
  return artist.display_name;
}

function parseCreditTokens(value: string | null | undefined): Array<Record<string, unknown>> {
  const clean = value?.trim() ?? "";
  if (!clean) return [];
  return clean
    .split(/\s+(?:x|X|and|with|feat\.?|ft\.?|featuring)\s+|[,/&+]+/g)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token, index) => ({ token, token_order: index + 1 }));
}

function artistFromSelectedPayload(value: Record<string, unknown> | undefined): RegistryArtistSearchResult | null {
  if (!value?.artist_id) return null;
  return {
    artist_id: String(value.artist_id),
    artist_slug: String(value.artist_slug ?? ""),
    display_name: String(value.display_name ?? value.artist_name ?? value.artist_slug ?? "Unknown artist"),
    status: String(value.status ?? "active"),
    origin_iso2: (value.origin_iso2 as string | null | undefined) ?? null,
    public_image_url: (value.public_image_url as string | null | undefined) ?? null,
    track_credit_count: Number(value.track_credit_count ?? 0),
    release_credit_count: Number(value.release_credit_count ?? 0),
  };
}

function selectedArtistsPayload(tokenDrafts: TokenDraft[]): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const selected: Array<Record<string, unknown>> = [];

  tokenDrafts.forEach((draft) => {
    if (!draft.selectedArtist) return;
    if (seen.has(draft.selectedArtist.artist_id)) return;

    seen.add(draft.selectedArtist.artist_id);

    selected.push({
      source_token: draft.token,
      artist_id: draft.selectedArtist.artist_id,
      artist_slug: draft.selectedArtist.artist_slug,
      display_name: draft.selectedArtist.display_name,
      status: draft.selectedArtist.status,
      role: draft.role,
      is_primary: draft.role === "primary_artist",
      is_featured: draft.role === "featured_artist",
      credit_order: selected.length + 1,
      display_credit: draft.displayCredit.trim() || draft.selectedArtist.display_name,
      origin_iso2: draft.selectedArtist.origin_iso2,
      public_image_url: draft.selectedArtist.public_image_url,
      track_credit_count: draft.selectedArtist.track_credit_count,
      release_credit_count: draft.selectedArtist.release_credit_count,
    });
  });

  return selected;
}

function asPreview(data: unknown): DecouplePreview | null {
  if (!data) return null;

  const preview = data as DecouplePreview;
  return {
    sourceArtist: preview.sourceArtist,
    trackCredits: preview.trackCredits ?? [],
    releaseCredits: preview.releaseCredits ?? [],
    chartEntries: preview.chartEntries ?? [],
  };
}

function truncate(value: string | null | undefined, max = 46): string {
  const clean = value?.trim() ?? "";
  if (!clean) return "Untitled";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function actionLabel(action: ArtistResolutionEvent["action"]): string {
  switch (action) {
    case "artist_decouple": return "Artist decouple";
    case "artist_merge": return "Artist merge";
    case "alias_merge": return "Alias merge";
    default: return action;
  }
}

function statusClass(status: ArtistResolutionEvent["status"]): string {
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function sourceTypeLabel(sourceType: SourceType): string {
  return SOURCE_OPTIONS.find((item) => item.key === sourceType)?.label ?? sourceType;
}

function SourceCard({
  active,
  option,
  onSelect,
}: {
  active: boolean;
  option: (typeof SOURCE_OPTIONS)[number];
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-2xl border p-4 text-left transition-colors ${
        active ? "border-[#85c441] bg-[#f0f7e8]" : "border-[#dfe4d8] bg-white hover:border-[#85c441]"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5f8f2f]">{option.eyebrow}</p>
          <p className="mt-1 text-[16px] font-black text-[#171712]">{option.label}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${
          active ? "bg-white text-[#5f8f2f]" : "bg-[#f0f3ec] text-[#71796b]"
        }`}>
          {option.status}
        </span>
      </div>
      <p className="text-[12px] leading-relaxed text-[#697062]">{option.description}</p>
    </button>
  );
}

function ArtistCandidateCard({
  artist,
  selected,
  decision,
  onSelect,
}: {
  artist: RegistryArtistSearchResult;
  selected: boolean;
  decision: DecoupleDecision | null;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${
        selected ? "border-[#85c441] bg-[#f0f7e8]" : "border-[#e8ece2] bg-white hover:border-[#85c441]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-black text-[#171712]">{artist.display_name}</p>
          <p className="truncate text-[11px] text-[#858c7e]">{artist.artist_slug}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] font-bold text-[#5d6557]">
          {artist.status}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#858c7e]">
          {artist.track_credit_count} track credits · {artist.release_credit_count} release credits
        </p>
        {decision && (
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${decisionStatusClass(decision.decision_status)}`}>
            {decision.decision_status}
          </span>
        )}
      </div>
    </button>
  );
}

function EmptySourceNotice({ selectedSource }: { selectedSource: SourceType }) {
  if (selectedSource === "charts") {
    return (
      <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
        <p className="text-[15px] font-black text-[#171712]">Charts begin in Chart Artist Resolution</p>
        <p className="mt-2 text-[13px] leading-relaxed text-[#697062]">
          Chart-origin coupled credits should be diagnosed from the chart row first. That surface already knows the edition,
          rank, raw artist string, parsed tokens, canonical track, and chart decision status.
        </p>
        <a
          href="/admin/charts/artist-resolution"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#5f8f2f] px-4 py-2 text-[12px] font-black text-white"
        >
          <WkIcon name="ArrowRight" size={13} />
          Open Chart Artist Resolution
        </a>
      </div>
    );
  }

  if (selectedSource === "provider_intake") {
    return (
      <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
        <p className="text-[15px] font-black text-[#171712]">Provider source queue comes next</p>
        <p className="mt-2 text-[13px] leading-relaxed text-[#697062]">
          Phase 1B will add a read-only queue for coupled credits entering through Apple, Spotify, and provider intake.
          No mutation is exposed from this placeholder.
        </p>
      </div>
    );
  }

  if (selectedSource === "artist_intake") {
    return (
      <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
        <p className="text-[15px] font-black text-[#171712]">Artist Intake source queue comes next</p>
        <p className="mt-2 text-[13px] leading-relaxed text-[#697062]">
          Phase 1B will add a read-only queue for ambiguity created inside the Artist Intake drawer.
          This page will not mutate artist credits until a decision is saved in Phase 2.
        </p>
      </div>
    );
  }

  return null;
}

function PreviewPanel({
  preview,
  loading,
  sourceArtist,
  decision,
  decisionType,
  setDecisionType,
  decisionNote,
  setDecisionNote,
  tokenDrafts,
  autoMatching,
  savingDecision,
  onLoadPreview,
  onSaveDecision,
  onAutoMatchArtists,
  onSearchTokenArtist,
  onCreateArtistForToken,
  onSelectTokenArtist,
  onUpdateTokenDraft,
  onClearTokenArtist,
}: {
  preview: DecouplePreview | null;
  loading: boolean;
  sourceArtist: RegistryArtistSearchResult | null;
  decision: DecoupleDecision | null;
  decisionType: DecoupleDecisionType;
  setDecisionType: (value: DecoupleDecisionType) => void;
  decisionNote: string;
  setDecisionNote: (value: string) => void;
  tokenDrafts: TokenDraft[];
  autoMatching: boolean;
  savingDecision: boolean;
  onLoadPreview: () => void;
  onSaveDecision: () => void;
  onAutoMatchArtists: () => void;
  onSearchTokenArtist: (index: number) => void;
  onCreateArtistForToken: (index: number) => void;
  onSelectTokenArtist: (index: number, artist: RegistryArtistSearchResult) => void;
  onUpdateTokenDraft: (index: number, patch: Partial<TokenDraft>) => void;
  onClearTokenArtist: (index: number) => void;
}) {
  if (!sourceArtist) {
    return (
      <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
        <p className="text-[15px] font-black text-[#171712]">Candidate drawer</p>
        <p className="mt-2 text-[13px] leading-relaxed text-[#697062]">
          Select a source artist to inspect provenance and impact. No replacement artists or decouple actions are exposed in Phase 1.
        </p>
      </div>
    );
  }

  const totalCredits = (preview?.trackCredits.length ?? 0) + (preview?.releaseCredits.length ?? 0);

  return (
    <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5f8f2f]">Read-only candidate</p>
          <p className="mt-1 text-[18px] font-black text-[#171712]">{sourceArtist.display_name}</p>
          <p className="text-[12px] text-[#858c7e]">{sourceArtist.artist_slug} · {sourceArtist.status}</p>
        </div>
        <button
          onClick={onLoadPreview}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5f8f2f] px-4 py-2 text-[12px] font-black text-white disabled:opacity-50"
        >
          <WkIcon name={loading ? "Loader2" : "Search"} size={13} className={loading ? "animate-spin" : ""} />
          {loading ? "Previewing…" : "Preview source impact"}
        </button>
      </div>

      {decision && (
        <div className="mt-4 rounded-2xl border border-[#dfe4d8] bg-[#fbfcf8] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${decisionStatusClass(decision.decision_status)}`}>
              {decision.decision_status}
            </span>
            <span className="text-[12px] font-bold text-[#171712]">{decisionTypeLabel(decision.decision_type)}</span>
          </div>
          {decision.note && <p className="mt-2 text-[12px] leading-relaxed text-[#697062]">{decision.note}</p>}
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-[#858c7e]">
            Saved {new Date(decision.updated_at).toLocaleString()}
          </p>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <WkIcon name="AlertTriangle" size={16} className="mt-0.5 shrink-0 text-amber-700" />
          <div>
            <p className="text-[12px] font-black text-amber-900">Phase 1 safety lock</p>
            <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
              This page is now inspection-only. Decouple decisions will be saved in Phase 2 and applied only from a ready decision in Phase 4.
            </p>
          </div>
        </div>
      </div>

      {preview && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[13px] font-black text-[#171712]">Canonical match builder</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#697062]">
                  Match each parsed token to a canonical artist. This only saves the decision. Apply stays locked until Phase 4.
                </p>
              </div>
              <button onClick={onAutoMatchArtists} disabled={autoMatching || tokenDrafts.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 text-[12px] font-black text-[#171712] disabled:opacity-50 hover:border-[#85c441]">
                <WkIcon name={autoMatching ? "Loader2" : "SearchCheck"} size={13} className={autoMatching ? "animate-spin" : ""} />
                {autoMatching ? "Matching…" : "Auto-match existing"}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {tokenDrafts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#dfe4d8] bg-[#fbfcf8] p-4 text-[13px] text-[#697062]">
                  No parsed tokens yet. Preview a source candidate first.
                </div>
              ) : tokenDrafts.map((draft, index) => (
                <div key={`${draft.token}-${index}`} className="rounded-2xl border border-[#e8ece2] bg-[#fbfcf8] p-4">
                  <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wider text-[#858c7e]">Parsed token #{index + 1}</p>
                      <p className="text-[16px] font-black text-[#171712]">{draft.token}</p>
                    </div>
                    {draft.selectedArtist && (
                      <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">
                        {draft.selectedArtist.display_name}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                    <input value={draft.query} onChange={(event) => onUpdateTokenDraft(index, { query: event.target.value })} className={INPUT_CLASS} placeholder="Search registry artist..." />
                    <button onClick={() => onSearchTokenArtist(index)} disabled={draft.loading || draft.creating} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 text-[12px] font-black text-[#171712] disabled:opacity-50">
                      <WkIcon name={draft.loading ? "Loader2" : "Search"} size={13} className={draft.loading ? "animate-spin" : ""} />
                      Search
                    </button>
                    <button onClick={() => onCreateArtistForToken(index)} disabled={draft.loading || draft.creating} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#171712] px-3 py-2 text-[12px] font-black text-white disabled:opacity-50">
                      <WkIcon name={draft.creating ? "Loader2" : "Plus"} size={13} className={draft.creating ? "animate-spin" : ""} />
                      Exact create
                    </button>
                  </div>

                  {draft.results.length > 0 && (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {draft.results.slice(0, 8).map((artist) => (
                        <button key={`${draft.token}-${artist.artist_id}`} onClick={() => onSelectTokenArtist(index, artist)} className={`rounded-xl border p-3 text-left ${draft.selectedArtist?.artist_id === artist.artist_id ? "border-[#85c441] bg-[#f0f7e8]" : "border-[#e8ece2] bg-white hover:border-[#85c441]"}`}>
                          <p className="truncate text-[13px] font-black text-[#171712]">{artist.display_name}</p>
                          <p className="truncate text-[11px] text-[#858c7e]">{artist.artist_slug} · {artist.status}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#858c7e]">{artist.track_credit_count} tracks · {artist.release_credit_count} releases</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {draft.selectedArtist && (
                    <div className="mt-3 grid gap-2 md:grid-cols-[0.8fr_1fr_auto]">
                      <select value={draft.role} onChange={(event) => onUpdateTokenDraft(index, { role: event.target.value })} className={INPUT_CLASS}>
                        {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                      </select>
                      <input value={draft.displayCredit} onChange={(event) => onUpdateTokenDraft(index, { displayCredit: event.target.value })} className={INPUT_CLASS} placeholder="Display credit override optional" />
                      <button onClick={() => onClearTokenArtist(index)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-black text-red-700">Clear</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
            <p className="text-[13px] font-black text-[#171712]">Decision capture</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#697062]">
              Save as draft while incomplete. Save as ready once at least two canonical artists are selected.
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_1fr]">
              <div>
                <label className={LABEL_CLASS}>Decision type</label>
                <select value={decisionType} onChange={(event) => setDecisionType(event.target.value as DecoupleDecisionType)} className={INPUT_CLASS}>
                  <option value="split_combined_artist">Split combined artist</option>
                  <option value="split_raw_credit">Split raw credit</option>
                  <option value="block_alias">Block alias</option>
                  <option value="needs_follow_up">Needs follow-up</option>
                  <option value="not_a_decouple">Not a decouple</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Decision note</label>
                <input value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} className={INPUT_CLASS} placeholder="Why is this source being staged?" />
              </div>
            </div>

            <button onClick={onSaveDecision} disabled={savingDecision} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#5f8f2f] px-4 py-2 text-[12px] font-black text-white disabled:opacity-50">
              <WkIcon name={savingDecision ? "Loader2" : "Save"} size={13} className={savingDecision ? "animate-spin" : ""} />
              {savingDecision ? "Saving decision…" : "Save decision"}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-[#fbfcf8] p-3">
              <p className="text-[20px] font-black text-[#171712]">{totalCredits}</p>
              <p className="text-[10px] font-black uppercase text-[#858c7e]">source credits</p>
            </div>
            <div className="rounded-xl bg-[#fbfcf8] p-3">
              <p className="text-[20px] font-black text-[#171712]">{preview.trackCredits.length}</p>
              <p className="text-[10px] font-black uppercase text-[#858c7e]">tracks</p>
            </div>
            <div className="rounded-xl bg-[#fbfcf8] p-3">
              <p className="text-[20px] font-black text-[#171712]">{preview.releaseCredits.length}</p>
              <p className="text-[10px] font-black uppercase text-[#858c7e]">releases</p>
            </div>
            <div className="rounded-xl bg-[#fbfcf8] p-3">
              <p className="text-[20px] font-black text-[#171712]">{preview.chartEntries.length}</p>
              <p className="text-[10px] font-black uppercase text-[#858c7e]">chart rows</p>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <div className="rounded-xl border border-[#e8ece2] bg-[#fbfcf8] p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#858c7e]">Track links</p>
              <div className="max-h-[180px] space-y-1.5 overflow-auto pr-1">
                {preview.trackCredits.length === 0 ? (
                  <p className="text-[12px] text-[#858c7e]">No track links found.</p>
                ) : preview.trackCredits.slice(0, 30).map((track) => (
                  <div key={track.credit_id} className="text-[12px]">
                    <span className="font-bold text-[#171712]">{truncate(track.track_title, 36)}</span>
                    <span className="text-[#858c7e]"> · {track.role ?? "unknown"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#e8ece2] bg-[#fbfcf8] p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#858c7e]">Release links</p>
              <div className="max-h-[180px] space-y-1.5 overflow-auto pr-1">
                {preview.releaseCredits.length === 0 ? (
                  <p className="text-[12px] text-[#858c7e]">No release links found.</p>
                ) : preview.releaseCredits.slice(0, 30).map((release) => (
                  <div key={release.credit_id} className="text-[12px]">
                    <span className="font-bold text-[#171712]">{truncate(release.release_title, 36)}</span>
                    <span className="text-[#858c7e]"> · {release.role ?? "unknown"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#e8ece2] bg-[#fbfcf8] p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#858c7e]">Chart rows</p>
              <div className="max-h-[180px] space-y-1.5 overflow-auto pr-1">
                {preview.chartEntries.length === 0 ? (
                  <p className="text-[12px] text-[#858c7e]">No chart rows found.</p>
                ) : preview.chartEntries.slice(0, 30).map((entry) => (
                  <div key={entry.entry_id} className="text-[12px]">
                    <span className="font-bold text-[#171712]">{truncate(entry.track_title, 34)}</span>
                    <span className="text-[#858c7e]"> · {entry.artist_slug ?? entry.artist_name ?? "unknown artist"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryPanel({
  events,
  loading,
  onRefresh,
}: {
  events: ArtistResolutionEvent[];
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[15px] font-black text-[#171712]">Resolution history</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#697062]">
            Existing merge and decouple history remains visible, but new decouples are locked behind the source-first workflow.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 text-[12px] font-bold text-[#5f8f2f] hover:border-[#85c441]"
        >
          <WkIcon name={loading ? "Loader2" : "RefreshCcw"} size={13} className={loading ? "animate-spin" : ""} />
          Refresh history
        </button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#dfe4d8] bg-[#fbfcf8] p-4 text-[13px] text-[#697062]">
          No artist resolution events recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {events.slice(0, 20).map((event) => (
            <div key={event.id} className="rounded-2xl border border-[#e8ece2] bg-[#fbfcf8] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${statusClass(event.status)}`}>
                      {event.status}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#5d6557]">
                      {actionLabel(event.action)}
                    </span>
                    <span className="text-[11px] text-[#858c7e]">{new Date(event.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-[14px] font-black text-[#171712]">
                    Source: {event.source_artist_slug ?? "unknown"}
                    {event.source_artist_name ? ` (${event.source_artist_name})` : ""}
                  </p>
                  {event.note && <p className="mt-2 text-[12px] text-[#697062]">{event.note}</p>}
                  {event.error_message && (
                    <p className="mt-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-[12px] font-bold text-red-700">
                      {event.error_message}
                    </p>
                  )}
                </div>

                <div className="grid shrink-0 grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[16px] font-black text-[#171712]">{event.track_links.length}</p>
                    <p className="text-[9px] font-black uppercase text-[#858c7e]">tracks</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[16px] font-black text-[#171712]">{event.release_links.length}</p>
                    <p className="text-[9px] font-black uppercase text-[#858c7e]">releases</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[16px] font-black text-[#171712]">{event.chart_entries.length}</p>
                    <p className="text-[9px] font-black uppercase text-[#858c7e]">charts</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminArtistDecouplePage() {
  const [selectedSource, setSelectedSource] = useState<SourceType>("registry");
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceResults, setSourceResults] = useState<RegistryArtistSearchResult[]>([]);
  const [sourceArtist, setSourceArtist] = useState<RegistryArtistSearchResult | null>(null);
  const [preview, setPreview] = useState<DecouplePreview | null>(null);
  const [searchingSource, setSearchingSource] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [history, setHistory] = useState<ArtistResolutionEvent[]>([]);
  const [decisions, setDecisions] = useState<DecoupleDecision[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [decisionsLoading, setDecisionsLoading] = useState(false);
  const [decisionType, setDecisionType] = useState<DecoupleDecisionType>("split_combined_artist");
  const [decisionNote, setDecisionNote] = useState("");
  const [tokenDrafts, setTokenDrafts] = useState<TokenDraft[]>([]);
  const [savingDecision, setSavingDecision] = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const canSearchSource = selectedSource === "registry" || selectedSource === "manual";

  const decisionsBySourceKey = useMemo(() => {
    const map = new Map<string, DecoupleDecision>();
    decisions.forEach((decision) => map.set(decision.source_key, decision));
    return map;
  }, [decisions]);

  const selectedDecision = useMemo(() => {
    const key = sourceKeyFor(selectedSource, sourceArtist);
    return key ? decisionsBySourceKey.get(key) ?? null : null;
  }, [decisionsBySourceKey, selectedSource, sourceArtist]);

  const buildTokenDrafts = useCallback((artist: RegistryArtistSearchResult, decision: DecoupleDecision | null = null): TokenDraft[] => {
    const selected = decision?.selected_artists ?? [];
    const decisionTokens = decision?.parsed_tokens ?? [];
    const sourceTokens = parseCreditTokens(tokenTextForArtist(artist));

    const tokenRows =
      sourceTokens.length > decisionTokens.length || (decisionTokens.length < 2 && sourceTokens.length >= 2)
        ? sourceTokens
        : decisionTokens.length
          ? decisionTokens
          : sourceTokens;

    const selectedByToken = new Map<string, Record<string, unknown>>();

    selected.forEach((artistPayload) => {
      const tokenKey = slugify(String(artistPayload.source_token ?? artistPayload.display_name ?? artistPayload.artist_slug ?? ""));
      if (tokenKey) selectedByToken.set(tokenKey, artistPayload);
    });

    return tokenRows.map((row, index) => {
      const token = String(row.token ?? row.source_token ?? "").trim() || artist.display_name;
      const matchedSelected = selectedByToken.get(slugify(token)) ?? selected[index];
      const selectedArtist = artistFromSelectedPayload(matchedSelected);

      return {
        token,
        query: token,
        loading: false,
        creating: false,
        results: [],
        selectedArtist,
        role: String(matchedSelected?.role ?? (index === 0 ? "primary_artist" : "featured_artist")),
        displayCredit: String(matchedSelected?.display_credit ?? selectedArtist?.display_name ?? ""),
      };
    });
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_get_artist_resolution_history", { p_limit: 100 });
      if (error) throw error;
      setHistory(asHistoryRows(data));
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadDecisions = useCallback(async () => {
    setDecisionsLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_get_artist_decouple_decisions", {
        p_source_type: null,
      });
      if (error) throw error;
      setDecisions(asDecisionRows(data));
    } catch {
      setDecisions([]);
    } finally {
      setDecisionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    loadDecisions();
  }, [loadHistory, loadDecisions]);

  const sourceCounts = useMemo(() => ({
    trackCredits: preview?.trackCredits.length ?? 0,
    releaseCredits: preview?.releaseCredits.length ?? 0,
    chartRows: preview?.chartEntries.length ?? 0,
    candidates: sourceResults.length,
    decisions: decisions.length,
    draftDecisions: decisions.filter((decision) => decision.decision_status === "draft").length,
  }), [decisions, preview, sourceResults.length]);

  const searchSourceArtists = useCallback(async () => {
    const clean = sourceQuery.trim();
    if (!clean) {
      setSourceResults([]);
      return;
    }

    if (!canSearchSource) {
      showToast("This source queue is staged for Phase 1B.", "error");
      return;
    }

    setSearchingSource(true);

    try {
      const { data, error } = await supabase.rpc("admin_search_registry_artists", {
        p_query: clean,
        p_limit: 25,
      });

      if (error) throw error;
      setSourceResults(asArtistRows(data));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Source artist search failed", "error");
      setSourceResults([]);
    } finally {
      setSearchingSource(false);
    }
  }, [canSearchSource, showToast, sourceQuery]);

  const selectSourceArtist = useCallback((artist: RegistryArtistSearchResult) => {
    setSourceArtist(artist);
    setPreview(null);
    const key = sourceKeyFor(selectedSource, artist);
    const existing = key ? decisionsBySourceKey.get(key) : null;
    setDecisionType(existing?.decision_type ?? "split_combined_artist");
    setDecisionNote(existing?.note ?? "");
    setTokenDrafts(buildTokenDrafts(artist, existing ?? null));
  }, [buildTokenDrafts, decisionsBySourceKey, selectedSource]);

  const loadPreview = useCallback(async () => {
    if (!sourceArtist) {
      showToast("Select a source artist first.", "error");
      return;
    }

    setPreviewLoading(true);

    try {
      const { data, error } = await supabase.rpc("admin_get_artist_decouple_preview", {
        p_source_artist_id: sourceArtist.artist_id,
      });

      if (error) throw error;

      setPreview(asPreview(data));
      if (tokenDrafts.length === 0) setTokenDrafts(buildTokenDrafts(sourceArtist, selectedDecision));
      showToast("Read-only source preview loaded", "success");
    } catch (err) {
      setPreview(null);
      showToast(err instanceof Error ? err.message : "Preview failed", "error");
    } finally {
      setPreviewLoading(false);
    }
  }, [buildTokenDrafts, selectedDecision, showToast, sourceArtist, tokenDrafts.length]);

  const updateTokenDraft = useCallback((index: number, patch: Partial<TokenDraft>) => {
    setTokenDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }, []);

  const searchTokenArtist = useCallback(async (index: number) => {
    const draft = tokenDrafts[index];
    if (!draft?.query.trim()) return;

    updateTokenDraft(index, { loading: true });

    try {
      const { data, error } = await supabase.rpc("admin_search_registry_artists", {
        p_query: draft.query.trim(),
        p_limit: 10,
      });

      if (error) throw error;
      updateTokenDraft(index, { loading: false, results: asArtistRows(data) });
    } catch (err) {
      updateTokenDraft(index, { loading: false, results: [] });
      showToast(err instanceof Error ? err.message : "Artist search failed", "error");
    }
  }, [showToast, tokenDrafts, updateTokenDraft]);

  const selectTokenArtist = useCallback((index: number, artist: RegistryArtistSearchResult) => {
    updateTokenDraft(index, {
      selectedArtist: artist,
      displayCredit: artist.display_name,
      results: [],
    });
  }, [updateTokenDraft]);

  const clearTokenArtist = useCallback((index: number) => {
    updateTokenDraft(index, {
      selectedArtist: null,
      displayCredit: "",
    });
  }, [updateTokenDraft]);

  const autoMatchArtists = useCallback(async () => {
    const unmatched = tokenDrafts.map((draft, index) => ({ draft, index })).filter(({ draft }) => !draft.selectedArtist && draft.token.trim());

    if (unmatched.length === 0) {
      showToast("All parsed tokens already have canonical matches.", "success");
      return;
    }

    setAutoMatching(true);

    let matched = 0;
    let uncertain = 0;
    const nextDrafts = [...tokenDrafts];

    for (const { draft, index } of unmatched) {
      try {
        const cleanToken = draft.token.trim();
        const tokenSlug = slugify(cleanToken);

        const { data, error } = await supabase.rpc("admin_search_registry_artists", {
          p_query: cleanToken,
          p_limit: 8,
        });

        if (error) throw error;

        const rows = asArtistRows(data);
        const exactSlug = rows.find((artist) => artist.artist_slug === tokenSlug);
        const exactName = rows.find((artist) => artist.display_name.toLowerCase() === cleanToken.toLowerCase());
        const picked = exactSlug ?? exactName ?? (rows.length === 1 ? rows[0] : null);

        nextDrafts[index] = {
          ...nextDrafts[index],
          results: rows,
          selectedArtist: picked,
          displayCredit: picked?.display_name ?? nextDrafts[index].displayCredit,
        };

        if (picked) matched += 1;
        else uncertain += 1;
      } catch {
        uncertain += 1;
      }
    }

    setTokenDrafts(nextDrafts);
    setAutoMatching(false);

    if (matched > 0 && uncertain === 0) showToast(`Auto-matched ${matched} token${matched === 1 ? "" : "s"}.`, "success");
    else if (matched > 0) showToast(`Auto-matched ${matched}; ${uncertain} need manual review.`, "success");
    else showToast("No confident canonical matches found.", "error");
  }, [showToast, tokenDrafts]);

  const createArtistForToken = useCallback(async (index: number) => {
    const draft = tokenDrafts[index];
    const suggestedName = draft?.token.trim() || draft?.query.trim();
    if (!draft || !suggestedName) return;

    const exactDisplayName = window.prompt("Exact artist display name. Preserve punctuation, dots, symbols, and casing.", suggestedName)?.trim();
    if (!exactDisplayName) return;

    const exactSlug = window.prompt("Artist slug. Keep display name exact; only normalize the URL slug.", slugify(exactDisplayName))?.trim();
    if (!exactSlug) return;

    updateTokenDraft(index, { creating: true });

    try {
      const { data: searchData, error: searchError } = await supabase.rpc("admin_search_registry_artists", {
        p_query: exactDisplayName,
        p_limit: 10,
      });

      if (searchError) throw searchError;

      const existing = asArtistRows(searchData).find((artist) => artist.artist_slug === exactSlug || artist.display_name.toLowerCase() === exactDisplayName.toLowerCase());

      if (existing) {
        selectTokenArtist(index, existing);
        updateTokenDraft(index, { creating: false });
        showToast("Existing artist attached instead of creating a duplicate.", "success");
        return;
      }

      const { data, error } = await supabase.rpc("admin_create_registry_artist_for_decouple", {
        p_display_name: exactDisplayName,
        p_slug: exactSlug,
        p_status: "needs_review",
        p_note: `Created from decouple canonical match token "${draft.token}"`,
      });

      if (error) throw error;

      const result = data as { artist?: RegistryArtistSearchResult; created?: boolean } | null;
      if (!result?.artist) throw new Error("Artist was not returned after create.");

      selectTokenArtist(index, asArtistRows([result.artist])[0]);
      updateTokenDraft(index, { creating: false });
      showToast(result.created ? "Artist created and attached" : "Existing artist attached", "success");
    } catch (err) {
      updateTokenDraft(index, { creating: false });
      showToast(err instanceof Error ? err.message : "Could not create artist", "error");
    }
  }, [selectTokenArtist, showToast, tokenDrafts, updateTokenDraft]);

  const saveSourceDecision = useCallback(async () => {
    if (!sourceArtist || !preview) {
      showToast("Preview a source candidate before saving a decision.", "error");
      return;
    }

    const selectedArtists = selectedArtistsPayload(tokenDrafts);
    const primaryArtist = selectedArtists.find((artist) => artist.role === "primary_artist") ?? selectedArtists[0] ?? null;

    const status: DecoupleDecisionStatus =
      decisionType === "not_a_decouple" || decisionType === "block_alias"
        ? "blocked"
        : selectedArtists.length >= 2 && (decisionType === "split_combined_artist" || decisionType === "split_raw_credit")
          ? "ready"
          : "draft";

    setSavingDecision(true);

    try {
      const sourceSnapshot = {
        sourceArtist,
        preview,
        sourceType: selectedSource,
        tokenDrafts,
        selectedArtists,
      };

      const { error } = await supabase.rpc("admin_upsert_artist_decouple_decision", {
        p_source_type: selectedSource,
        p_source_table: "registry_artists",
        p_source_id: sourceArtist.artist_id,
        p_source_label: `${sourceArtist.display_name} (${sourceArtist.artist_slug})`,
        p_source_artist_id: sourceArtist.artist_id,
        p_raw_credit_text: sourceArtist.display_name,
        p_source_snapshot: sourceSnapshot,
        p_parsed_tokens: tokenDrafts.map((draft, index) => ({
          token: draft.token,
          token_order: index + 1,
          selected_artist_id: draft.selectedArtist?.artist_id ?? null,
          role: draft.role,
        })),
        p_selected_artists: selectedArtists,
        p_chart_primary_artist_id: primaryArtist?.artist_id ?? null,
        p_decision_type: decisionType,
        p_decision_status: status,
        p_note: decisionNote || null,
      });

      if (error) throw error;

      await loadDecisions();
      showToast("Decouple source decision saved", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save decouple decision", "error");
    } finally {
      setSavingDecision(false);
    }
  }, [decisionNote, decisionType, loadDecisions, preview, selectedSource, showToast, sourceArtist, tokenDrafts]);

  const switchSource = useCallback((source: SourceType) => {
    setSelectedSource(source);
    setSourceQuery("");
    setSourceResults([]);
    setSourceArtist(null);
    setPreview(null);
    setDecisionType("split_combined_artist");
    setDecisionNote("");
    setTokenDrafts([]);
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f7f2] space-y-5">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-2xl border px-5 py-3 text-[13px] font-bold shadow-xl ${
          toast.type === "success" ? "border-emerald-200 bg-white text-emerald-800" : "border-red-200 bg-white text-red-800"
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">Registry</p>
          <h1 className="text-[26px] font-black tracking-tight text-[#171712]">Decouple Artist Credits</h1>
          <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-[#697062]">
            Source-first inspection for coupled artist credits. Pick where the problem came from, inspect the candidate,
            then save a decision in the next phase. Direct decouple mutation is intentionally disabled here.
          </p>
        </div>
        <a
          href="/admin/registry/artist-aliases"
          className="inline-flex items-center gap-2 rounded-2xl border border-[#dfe4d8] bg-white px-4 py-2.5 text-[13px] font-bold text-[#171712] hover:border-[#85c441]"
        >
          <WkIcon name="Link" size={13} />
          Back to aliases
        </a>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Current source</p>
          <p className="mt-1 text-[24px] font-black text-[#171712]">{sourceTypeLabel(selectedSource)}</p>
        </div>
        <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Candidates</p>
          <p className="mt-1 text-[28px] font-black text-[#171712]">{sourceCounts.candidates}</p>
        </div>
        <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Source credits</p>
          <p className="mt-1 text-[28px] font-black text-[#171712]">{sourceCounts.trackCredits + sourceCounts.releaseCredits}</p>
        </div>
        <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Chart rows</p>
          <p className="mt-1 text-[28px] font-black text-[#171712]">{sourceCounts.chartRows}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Saved decisions</p>
          <p className="mt-1 text-[28px] font-black text-[#171712]">{decisionsLoading ? "…" : sourceCounts.decisions}</p>
        </div>
        <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Draft source decisions</p>
          <p className="mt-1 text-[28px] font-black text-[#171712]">{decisionsLoading ? "…" : sourceCounts.draftDecisions}</p>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-5">
        {SOURCE_OPTIONS.map((option) => (
          <SourceCard
            key={option.key}
            option={option}
            active={selectedSource === option.key}
            onSelect={() => switchSource(option.key)}
          />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          {canSearchSource ? (
            <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
              <div className="mb-4">
                <p className="text-[15px] font-black text-[#171712]">1. Pick the coupled source</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#697062]">
                  Search only for the source artist/entity to inspect. Replacement matching is intentionally hidden until Phase 3.
                </p>
              </div>

              <label className={LABEL_CLASS}>Source candidate</label>
              <div className="flex gap-2">
                <input
                  value={sourceQuery}
                  onChange={(event) => setSourceQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") searchSourceArtists(); }}
                  placeholder={selectedSource === "manual" ? "Search exact bad source artist..." : "Search coupled registry artist..."}
                  className={`${INPUT_CLASS} flex-1`}
                />
                <button
                  onClick={searchSourceArtists}
                  disabled={searchingSource}
                  className="rounded-xl bg-[#171712] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50"
                >
                  {searchingSource ? "..." : "Search"}
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {sourceResults.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#dfe4d8] bg-[#fbfcf8] p-4 text-[13px] text-[#697062]">
                    Search for a source artist to inspect. This will not mutate registry data.
                  </div>
                ) : sourceResults.map((artist) => (
                  <ArtistCandidateCard
                    key={artist.artist_id}
                    artist={artist}
                    selected={sourceArtist?.artist_id === artist.artist_id}
                    decision={decisionsBySourceKey.get(`${selectedSource}:${artist.artist_id}`) ?? null}
                    onSelect={() => selectSourceArtist(artist)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <EmptySourceNotice selectedSource={selectedSource} />
          )}
        </div>

        <PreviewPanel
          preview={preview}
          loading={previewLoading}
          sourceArtist={sourceArtist}
          decision={selectedDecision}
          decisionType={decisionType}
          setDecisionType={setDecisionType}
          decisionNote={decisionNote}
          setDecisionNote={setDecisionNote}
          tokenDrafts={tokenDrafts}
          autoMatching={autoMatching}
          savingDecision={savingDecision}
          onLoadPreview={loadPreview}
          onSaveDecision={saveSourceDecision}
          onAutoMatchArtists={autoMatchArtists}
          onSearchTokenArtist={searchTokenArtist}
          onCreateArtistForToken={createArtistForToken}
          onSelectTokenArtist={selectTokenArtist}
          onUpdateTokenDraft={updateTokenDraft}
          onClearTokenArtist={clearTokenArtist}
        />
      </div>

      <HistoryPanel events={history} loading={historyLoading} onRefresh={loadHistory} />
    </div>
  );
}
