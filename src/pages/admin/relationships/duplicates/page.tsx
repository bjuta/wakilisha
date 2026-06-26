import { useCallback, useEffect, useMemo, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { supabase } from "@/lib/supabase";

type AuditType = "all" | "provider_identity" | "apple_catalog_id" | "isrc" | "title_artist_numeric";

interface TrackAuditTrack {
  id: string;
  slug: string;
  title: string | null;
  status: string | null;
  isrc: string | null;
  releaseId: string | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  appleMusicCatalogId: string | null;
  primaryArtistSlugs: string | null;
  primaryArtistNames: string | null;
  allArtistSlugs: string | null;
  providerLinkCount: number;
  providers: string | null;
  chartRefCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface TrackDuplicateCandidate {
  candidateId: string;
  entityKind: "track";
  auditType: Exclude<AuditType, "all">;
  auditKey: string;
  riskBucket: "high" | "medium" | "low";
  confidence: number;
  reason: string;
  recommendedAction: string;
  trackCount: number;
  publicRefCount: number;
  tracks: TrackAuditTrack[];
}

interface TrackDuplicateAuditResponse {
  generatedAt: string;
  stats: {
    totalCandidates: number;
    highConfidence: number;
    mediumConfidence: number;
    publicRefs: number;
  };
  candidates: TrackDuplicateCandidate[];
}

interface RepairPreview {
  canonicalTrack: TrackAuditTrack;
  duplicateTracks: TrackAuditTrack[];
  confidenceBucket: "high" | "medium" | "blocked";
  blockers: string[];
  counts: {
    duplicateTracks: number;
    highIdentityMatches: number;
    mediumIdentityMatches: number;
    chartRowsToMove: number;
    providerLinksToMove: number;
    releaseTrackRowsTouched: number;
    releaseTrackRowsToArchive: number;
    trackArtistCreditsToMove: number;
    trackArtistCreditsToArchive: number;
  };
  chartRows?: Array<Record<string, unknown>>;
  providerLinks?: Array<Record<string, unknown>>;
  releaseTrackRows?: Array<Record<string, unknown>>;
}

const emptyAudit: TrackDuplicateAuditResponse = {
  generatedAt: "",
  stats: {
    totalCandidates: 0,
    highConfidence: 0,
    mediumConfidence: 0,
    publicRefs: 0,
  },
  candidates: [],
};

const AUDIT_LABELS: Record<Exclude<AuditType, "all">, string> = {
  provider_identity: "Provider identity",
  apple_catalog_id: "Apple Music ID",
  isrc: "ISRC",
  title_artist_numeric: "Title + artist + suffix",
};

const AUDIT_HELP: Record<Exclude<AuditType, "all">, string> = {
  provider_identity: "Same provider_key + provider_track_id appears on more than one registry track.",
  apple_catalog_id: "Same Apple Music catalog ID appears on more than one registry track.",
  isrc: "Same recording code appears on more than one registry track.",
  title_artist_numeric: "Same normalized title and primary artist, with at least one numeric suffix.",
};

function confidenceLabel(value: number) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function riskClasses(risk: string) {
  if (risk === "high") return "border-red-200 bg-red-50 text-red-800";
  if (risk === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function normalizeAuditPayload(data: unknown): TrackDuplicateAuditResponse {
  const payload = (data ?? {}) as Partial<TrackDuplicateAuditResponse>;
  const stats = payload.stats ?? emptyAudit.stats;
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];

  return {
    generatedAt: String(payload.generatedAt ?? ""),
    stats: {
      totalCandidates: Number(stats.totalCandidates ?? 0),
      highConfidence: Number(stats.highConfidence ?? 0),
      mediumConfidence: Number(stats.mediumConfidence ?? 0),
      publicRefs: Number(stats.publicRefs ?? 0),
    },
    candidates: candidates as TrackDuplicateCandidate[],
  };
}

function slugifyTrackTitle(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function canonicalSlugScore(track: TrackAuditTrack) {
  const slug = String(track.slug ?? "");
  const titleSlug = slugifyTrackTitle(track.title);
  const artistSlugs = String(track.primaryArtistSlugs || track.allArtistSlugs || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  let score = 0;

  // Best possible canonical: clean song-title slug.
  if (titleSlug && slug === titleSlug) score += 1000;

  // Avoid generated numeric suffixes.
  if (!/-[0-9]+$/.test(slug)) score += 120;
  else score -= 120;

  // Avoid repeating artist slug inside the track slug because public URLs already include artist slug.
  const repeatsArtistSlug = artistSlugs.some((artistSlug) => {
    return slug === `${titleSlug}-${artistSlug}` || slug.endsWith(`-${artistSlug}`) || slug.includes(`-${artistSlug}-`);
  });

  if (repeatsArtistSlug) score -= 90;
  else score += 60;

  // Identity/public references break ties only after slug cleanliness.
  if (track.chartRefCount > 0) score += 20;
  if (track.providerLinkCount > 0) score += 12;
  if (track.status === "active") score += 8;
  if (track.status === "needs_review") score += 4;

  // Shorter clean slugs win final ties.
  score -= slug.length / 100;

  return score;
}

function recommendedCanonicalTrack(candidate: TrackDuplicateCandidate): TrackAuditTrack | null {
  return [...candidate.tracks].sort((a, b) => {
    const scoreDiff = canonicalSlugScore(b) - canonicalSlugScore(a);
    if (scoreDiff !== 0) return scoreDiff;

    if ((b.chartRefCount ?? 0) !== (a.chartRefCount ?? 0)) return (b.chartRefCount ?? 0) - (a.chartRefCount ?? 0);
    if ((b.providerLinkCount ?? 0) !== (a.providerLinkCount ?? 0)) return (b.providerLinkCount ?? 0) - (a.providerLinkCount ?? 0);

    return String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? ""));
  })[0] ?? null;
}

export default function AdminDuplicateMergePage() {
  const [audit, setAudit] = useState<TrackDuplicateAuditResponse>(emptyAudit);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [auditType, setAuditType] = useState<AuditType>("all");
  const [includeLowConfidence, setIncludeLowConfidence] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [previewByCandidate, setPreviewByCandidate] = useState<Record<string, RepairPreview>>({});
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("admin_get_registry_track_duplicate_audit", {
        p_limit: 300,
        p_include_low_confidence: includeLowConfidence,
      });

      if (rpcError) throw new Error(rpcError.message);
      if (!data) {
        throw new Error("Track duplicate audit returned no data. Your admin session may be missing the manage_registry capability.");
      }

      setAudit(normalizeAuditPayload(data));
    } catch (err) {
      setAudit(emptyAudit);
      setError(err instanceof Error ? err.message : "Failed to load duplicate audit.");
    } finally {
      setLoading(false);
    }
  }, [includeLowConfidence]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return audit.candidates.filter((candidate) => {
      if (auditType !== "all" && candidate.auditType !== auditType) return false;
      if (!q) return true;

      const candidateBlob = [
        candidate.auditKey,
        candidate.reason,
        candidate.recommendedAction,
        candidate.auditType,
        ...candidate.tracks.flatMap((track) => [
          track.slug,
          track.title,
          track.isrc,
          track.appleMusicCatalogId,
          track.primaryArtistSlugs,
          track.primaryArtistNames,
          track.providers,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return candidateBlob.includes(q);
    });
  }, [audit.candidates, auditType, searchQuery]);

  const previewRepair = useCallback(async (candidate: TrackDuplicateCandidate) => {
    const canonical = recommendedCanonicalTrack(candidate);
    if (!canonical) {
      showToast("No canonical track could be selected for preview.", "error");
      return;
    }

    const duplicateIds = candidate.tracks
      .filter((track) => track.id !== canonical.id)
      .map((track) => track.id);

    if (duplicateIds.length === 0) {
      showToast("No duplicate tracks to repair.", "error");
      return;
    }

    setLoadingPreviewId(candidate.candidateId);

    try {
      const { data, error: rpcError } = await supabase.rpc("admin_preview_registry_track_duplicate_repair", {
        p_canonical_track_id: canonical.id,
        p_duplicate_track_ids: duplicateIds,
      });

      if (rpcError) throw new Error(rpcError.message);
      if (!data) throw new Error("Preview returned no data.");

      setPreviewByCandidate((prev) => ({
        ...prev,
        [candidate.candidateId]: data as RepairPreview,
      }));

      showToast("Repair preview loaded", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Repair preview failed", "error");
    } finally {
      setLoadingPreviewId(null);
    }
  }, [showToast]);

  const applyRepair = useCallback(async (candidate: TrackDuplicateCandidate) => {
    const preview = previewByCandidate[candidate.candidateId];
    if (!preview) {
      showToast("Preview this repair before applying it.", "error");
      return;
    }

    if (preview.blockers?.length) {
      showToast(`Repair blocked: ${preview.blockers.join(", ")}`, "error");
      return;
    }

    if (preview.confidenceBucket !== "high") {
      showToast("Apply is locked for medium/blocked repairs. Review manually first.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Apply track duplicate repair?\n\nKeep: ${preview.canonicalTrack.title} (${preview.canonicalTrack.slug})\nArchive: ${preview.duplicateTracks.map((track) => track.slug).join(", ")}\n\nThis will move chart rows/provider links and archive duplicate track rows.`
    );

    if (!confirmed) return;

    setApplyingId(candidate.candidateId);

    try {
      const { data, error: rpcError } = await supabase.rpc("admin_apply_registry_track_duplicate_repair", {
        p_canonical_track_id: preview.canonicalTrack.id,
        p_duplicate_track_ids: preview.duplicateTracks.map((track) => track.id),
        p_note: `Applied from Duplicate Merge admin candidate ${candidate.candidateId}`,
        p_allow_medium_confidence: false,
      });

      if (rpcError) throw new Error(rpcError.message);

      const result = (data ?? {}) as Record<string, unknown>;
      showToast(
        `Repair applied · ${Number(result.chartRowsMoved ?? 0)} chart rows, ${Number(result.providerLinksMoved ?? 0)} provider links moved`,
        "success"
      );

      setPreviewByCandidate((prev) => {
        const next = { ...prev };
        delete next[candidate.candidateId];
        return next;
      });

      await loadAudit();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Repair apply failed", "error");
    } finally {
      setApplyingId(null);
    }
  }, [loadAudit, previewByCandidate, showToast]);

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg ${
          toast.type === "success"
            ? "border-emerald-200 bg-white text-emerald-800"
            : "border-red-200 bg-white text-red-800"
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Relationships</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Duplicate Merge</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-wk-text-muted">
            Live track duplicate audit with safe preview and one-candidate repair. High-confidence repairs can be applied after preview; medium-confidence rows stay locked.
          </p>
        </div>

        <button
          onClick={loadAudit}
          disabled={loading}
          className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap disabled:opacity-50"
        >
          <WkIcon name={loading ? "Loader2" : "RefreshCcw"} size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <WkIcon name="AlertTriangle" size={16} className="mt-0.5 shrink-0 text-amber-700" />
          <div>
            <p className="text-[13px] font-black text-amber-900">Safe repair guard</p>
            <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
              Preview always comes first. Apply only unlocks for high-confidence track identity matches. No mass merge, no delete, no artist merge.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Candidates", value: audit.stats.totalCandidates, icon: "Copy" },
          { label: "High Confidence", value: audit.stats.highConfidence, icon: "CheckCircle2" },
          { label: "Medium Review", value: audit.stats.mediumConfidence, icon: "GitPullRequest" },
          { label: "Public Chart Refs", value: audit.stats.publicRefs, icon: "BarChart3" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-wk-border bg-wk-surface p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-wk-surface-raised text-wk-brand">
                <WkIcon name={stat.icon as never} size={14} />
              </span>
              <span className="text-[11px] font-black uppercase tracking-wide text-wk-text-muted">{stat.label}</span>
            </div>
            <div className="mt-2 text-[24px] font-black text-wk-text">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-wk-border bg-white px-3 py-2">
            <WkIcon name="Search" size={14} className="text-wk-text-faint" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by slug, title, artist, ISRC, Apple ID, provider..."
              className="w-full bg-transparent text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-wk-text-faint hover:text-wk-text">
                <WkIcon name="X" size={14} />
              </button>
            )}
          </div>

          <select
            value={auditType}
            onChange={(event) => setAuditType(event.target.value as AuditType)}
            className="rounded-lg border border-wk-border bg-white px-3 py-2 text-[13px] font-semibold text-wk-text outline-none"
          >
            <option value="all">All audit types</option>
            <option value="provider_identity">Provider identity</option>
            <option value="apple_catalog_id">Apple Music ID</option>
            <option value="isrc">ISRC</option>
            <option value="title_artist_numeric">Title + artist + suffix</option>
          </select>

          <label className="flex items-center gap-2 rounded-lg border border-wk-border bg-white px-3 py-2 text-[12px] font-bold text-wk-text-muted">
            <input
              type="checkbox"
              checked={includeLowConfidence}
              onChange={(event) => setIncludeLowConfidence(event.target.checked)}
            />
            Include lower-confidence title checks
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-[13px] font-black text-red-900">Could not load track duplicate audit</p>
          <p className="mt-1 text-[12px] text-red-800">{error}</p>
        </div>
      )}

      {!error && loading && (
        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-wk-border bg-wk-surface">
          <div className="flex flex-col items-center gap-3">
            <WkIcon name="Loader2" size={28} className="animate-spin text-wk-brand" />
            <p className="text-[13px] font-bold text-wk-text-muted">Scanning track identities...</p>
          </div>
        </div>
      )}

      {!error && !loading && filteredCandidates.length === 0 && (
        <div className="rounded-xl border border-wk-border bg-wk-surface p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <WkIcon name="CheckCircle2" size={28} />
          </div>
          <p className="mt-3 text-[16px] font-black text-wk-text">No matching track duplicate candidates</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-wk-text-muted">
            No rows match the current filters. Try enabling lower-confidence title checks.
          </p>
        </div>
      )}

      {!error && !loading && filteredCandidates.length > 0 && (
        <div className="space-y-4">
          <p className="text-[13px] font-bold text-wk-text-muted">
            Showing {filteredCandidates.length} of {audit.stats.totalCandidates} track duplicate candidates.
          </p>

          {filteredCandidates.map((candidate) => {
            const canonical = recommendedCanonicalTrack(candidate);
            const preview = previewByCandidate[candidate.candidateId];

            return (
              <div key={candidate.candidateId} className="overflow-hidden rounded-2xl border border-wk-border bg-wk-surface">
                <div className="border-b border-wk-border bg-wk-surface-raised p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${riskClasses(candidate.riskBucket)}`}>
                          {candidate.riskBucket} · {confidenceLabel(candidate.confidence)}
                        </span>
                        <span className="rounded-full border border-wk-border bg-white px-2.5 py-1 text-[11px] font-black text-wk-text-muted">
                          {AUDIT_LABELS[candidate.auditType]}
                        </span>
                        {candidate.publicRefCount > 0 && (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-black text-sky-800">
                            {candidate.publicRefCount} public chart refs
                          </span>
                        )}
                      </div>

                      <p className="text-[15px] font-black text-wk-text">{candidate.auditKey}</p>
                      <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-wk-text-muted">
                        {candidate.reason} {AUDIT_HELP[candidate.auditType]}
                      </p>
                      {canonical && (
                        <p className="mt-2 text-[12px] font-bold text-wk-text">
                          Recommended keep: {canonical.title} · {canonical.slug}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        onClick={() => previewRepair(candidate)}
                        disabled={loadingPreviewId === candidate.candidateId}
                        className="wk-button wk-button-secondary wk-button-sm justify-center whitespace-nowrap disabled:opacity-50"
                      >
                        <WkIcon name={loadingPreviewId === candidate.candidateId ? "Loader2" : "Eye"} size={14} className={loadingPreviewId === candidate.candidateId ? "animate-spin" : ""} />
                        Preview repair
                      </button>

                      <button
                        onClick={() => applyRepair(candidate)}
                        disabled={
                          applyingId === candidate.candidateId ||
                          !preview ||
                          preview.confidenceBucket !== "high" ||
                          Boolean(preview.blockers?.length)
                        }
                        className="wk-button wk-button-primary wk-button-sm justify-center whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <WkIcon name={applyingId === candidate.candidateId ? "Loader2" : "Wrench"} size={14} className={applyingId === candidate.candidateId ? "animate-spin" : ""} />
                        Apply repair
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-wk-border bg-white p-3">
                    <p className="text-[11px] font-black uppercase tracking-wide text-wk-text-muted">Recommended next step</p>
                    <p className="mt-1 text-[13px] font-semibold text-wk-text">{candidate.recommendedAction}</p>
                  </div>

                  {preview && (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-[12px] font-black text-emerald-900">Repair preview loaded</p>
                          <p className="mt-1 text-[12px] text-emerald-800">
                            Keep <strong>{preview.canonicalTrack.slug}</strong>. Archive{" "}
                            <strong>{preview.duplicateTracks.map((track) => track.slug).join(", ")}</strong>.
                          </p>
                          {preview.blockers?.length > 0 && (
                            <p className="mt-1 text-[12px] font-bold text-red-700">
                              Blocked: {preview.blockers.join(", ")}
                            </p>
                          )}
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${riskClasses(preview.confidenceBucket)}`}>
                          {preview.confidenceBucket}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-6">
                        {[
                          ["Chart rows", preview.counts.chartRowsToMove],
                          ["Provider links", preview.counts.providerLinksToMove],
                          ["Credits moved", preview.counts.trackArtistCreditsToMove],
                          ["Credits archived", preview.counts.trackArtistCreditsToArchive],
                          ["Release rows", preview.counts.releaseTrackRowsTouched],
                          ["Release rows archived", preview.counts.releaseTrackRowsToArchive],
                        ].map(([label, value]) => (
                          <div key={label as string} className="rounded-lg bg-white p-2">
                            <p className="text-[16px] font-black text-wk-text">{value as number}</p>
                            <p className="text-[10px] font-black uppercase text-wk-text-muted">{label as string}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="divide-y divide-wk-border">
                  {candidate.tracks.map((track) => (
                    <div key={track.id} className="grid gap-3 p-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          {track.artworkUrl ? (
                            <img src={track.artworkUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-wk-surface-raised text-wk-text-faint">
                              <WkIcon name="Music" size={18} />
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-black text-wk-text">{track.title ?? "Untitled track"}</p>
                            <p className="truncate text-[12px] text-wk-text-muted">{track.slug}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className="rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-bold text-wk-text-muted">
                                {track.status ?? "unknown"}
                              </span>
                              {canonical?.id === track.id && (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                  recommended keep
                                </span>
                              )}
                              {track.chartRefCount > 0 && (
                                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                                  chart refs {track.chartRefCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0 text-[12px]">
                        <p className="font-black uppercase tracking-wide text-wk-text-faint">Primary artist</p>
                        <p className="mt-1 truncate font-semibold text-wk-text">{track.primaryArtistNames || track.primaryArtistSlugs || "No primary credit"}</p>
                        {track.allArtistSlugs && (
                          <p className="mt-0.5 truncate text-wk-text-muted">{track.allArtistSlugs}</p>
                        )}
                      </div>

                      <div className="min-w-0 text-[12px]">
                        <p className="font-black uppercase tracking-wide text-wk-text-faint">Identity signals</p>
                        <p className="mt-1 truncate text-wk-text-muted">ISRC: <span className="font-semibold text-wk-text">{track.isrc || "none"}</span></p>
                        <p className="truncate text-wk-text-muted">Apple: <span className="font-semibold text-wk-text">{track.appleMusicCatalogId || "none"}</span></p>
                        <p className="truncate text-wk-text-muted">Providers: <span className="font-semibold text-wk-text">{track.providers || "none"}</span></p>
                      </div>

                      <a
                        href={`/admin/registry/tracks/${track.slug}`}
                        className="wk-button wk-button-secondary wk-button-sm justify-center whitespace-nowrap"
                      >
                        Open track
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
