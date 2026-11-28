import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSelect } from "@/components/design-system/primitives/Select";
import {
  applyReviewedArtistEnrichment,
  previewArtistEnrichment,
  type ArtistEnrichmentResponse,
} from "@/services/registry/admin/artistEnrichment";

type ProfileChange = {
  image?: { old: string | null; new: string | null; source: string };
  bio?: { old: string | null; new: string | null; source: string };
  genres?: { old: string[]; new: string[]; source: string };
};

type TypeChange = {
  old?: string | null;
  new?: string | null;
  source?: string;
  heuristic?: string;
  musicbrainzType?: string | null;
  score?: number | null;
};

export function ArtistEnrichPanel({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<ArtistEnrichmentResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [filterMode, setFilterMode] = useState("missing_image");
  const [providers, setProviders] = useState<string[]>(["spotify", "apple_music"]);
  const [force, setForce] = useState(false);

  async function preview() {
    setPhase("running");
    setResult(null);
    setErrorMsg(null);
    try {
      const data = await previewArtistEnrichment({
        mode: "profile",
        batchSize: 20,
        filter: filterMode,
        providers,
        force,
      });
      setResult(data);
      setPhase("done");
    } catch (error) {
      setPhase("error");
      setErrorMsg(error instanceof Error ? error.message : "Unknown error");
    }
  }

  async function applyReviewed() {
    if (!result?.dry_run || !(result.reviewed_evidence_ids?.length)) {
      setPhase("error");
      setErrorMsg("Preview an exact batch before applying it.");
      return;
    }
    setPhase("running");
    setErrorMsg(null);
    try {
      const applied = await applyReviewedArtistEnrichment(result);
      setResult({
        ...result,
        dry_run: false,
        approved: true,
        updated: applied.updated,
        errors: applied.errors,
      });
      setPhase("done");
      if (applied.updated > 0) onDone();
    } catch (error) {
      setPhase("error");
      setErrorMsg(error instanceof Error ? error.message : "Unknown error");
    }
  }

  return (
    <div data-wk-registry-artist-panel="enrichment" className="rounded-2xl border border-wk-border bg-wk-surface p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-wk-surface-raised">
            <i className="ri-sparkling-line text-[18px] text-wk-brand" />
          </div>
          <div>
            <p className="text-[13px] font-black text-wk-text">Enrich Artists</p>
            <p className="text-[11px] text-wk-text-muted">
              Preview provider evidence, review the exact batch, then admit only that reviewed evidence.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-xl border border-wk-border bg-wk-surface-raised px-2 py-1.5">
            <button
              onClick={() => setProviders((prev) => prev.includes("spotify") ? prev.filter((p) => p !== "spotify") : [...prev, "spotify"])}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${providers.includes("spotify") ? "bg-wk-brand-soft text-wk-brand" : "text-wk-text-muted"}`}
            >
              <i className="ri-spotify-line text-[13px]" />
              Spotify
            </button>
            <button
              onClick={() => setProviders((prev) => prev.includes("apple_music") ? prev.filter((p) => p !== "apple_music") : [...prev, "apple_music"])}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${providers.includes("apple_music") ? "bg-wk-brand-soft text-wk-brand" : "text-wk-text-muted"}`}
            >
              <i className="ri-apple-line text-[13px]" />
              Apple
            </button>
          </div>
          <WkSelect
            value={filterMode}
            onChange={setFilterMode}
            triggerClassName="h-8 rounded-lg border border-wk-border bg-wk-surface-raised px-2 text-[11px] font-bold text-wk-text-muted outline-none"
          >
            <option value="missing_image">Missing image</option>
            <option value="missing_bio">Missing bio</option>
            <option value="all">All artists</option>
          </WkSelect>
          <button
            onClick={() => setForce((value) => !value)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${force ? "border-wk-brand bg-wk-brand-soft text-wk-brand" : "border-wk-border bg-wk-surface-raised text-wk-text-muted"}`}
          >
            <WkIcon name="RotateCcw" size={12} />
            Force proposal
          </button>
          <button
            onClick={preview}
            disabled={phase === "running"}
            className="rounded-xl border border-wk-border bg-wk-surface-raised px-3 py-2 text-[12px] font-bold text-wk-text-muted hover:border-wk-brand hover:text-wk-brand disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <WkIcon name="Eye" size={13} />
            Preview
          </button>
          <button
            onClick={applyReviewed}
            disabled={phase === "running" || !result?.dry_run || !(result.reviewed_evidence_ids?.length)}
            className="rounded-xl bg-wk-brand px-3 py-2 text-[12px] font-black text-wk-brand-on hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            {phase === "running" ? (
              <><WkIcon name="Loader2" size={13} className="animate-spin" /> Running…</>
            ) : (
              <><WkIcon name="Check" size={13} /> Apply reviewed batch</>
            )}
          </button>
        </div>
      </div>

      {result?.provider_status && (
        <div className="mt-2 flex gap-3 flex-wrap">
          {Object.entries(result.provider_status).map(([key, status]) => (
            <div key={key} className="flex items-center gap-1.5 text-[11px]">
              <span className={`inline-block h-2 w-2 rounded-full ${status.connected ? "bg-wk-brand" : "bg-wk-warning-soft"}`} />
              <span className="font-bold text-wk-text-muted capitalize">{key.replace("_", " ")}</span>
              <span className={status.connected ? "text-wk-brand" : "text-wk-warning"}>
                {status.connected ? "evidence found" : "no evidence"}
              </span>
            </div>
          ))}
        </div>
      )}

      {phase === "error" && errorMsg && (
        <div className="mt-3 rounded-xl bg-wk-danger-soft border border-wk-danger px-3 py-2 text-[12px] font-bold text-wk-danger">
          {errorMsg}
        </div>
      )}

      {phase === "done" && result && (
        <div className="mt-3 space-y-3">
          <SummaryGrid
            values={[
              ["Found", result.total_found, "text-wk-text-muted"],
              [result.dry_run ? "Proposed" : "Admitted", result.updated, "text-wk-brand"],
              ["Skipped", result.skipped, "text-wk-text-muted"],
              ["No data", result.no_data, "text-wk-warning"],
              ["Errors", result.errors, "text-wk-danger"],
            ]}
          />
          {result.dry_run ? (
            <div className="rounded-xl bg-wk-warning-soft border border-wk-warning px-3 py-2 text-[12px] font-bold text-wk-warning">
              Preview persisted immutable evidence only. Canonical Artist state is unchanged until “Apply reviewed batch”.
            </div>
          ) : (
            <div className="rounded-xl bg-wk-brand-soft border border-wk-brand px-3 py-2 text-[12px] font-bold text-wk-brand">
              Applied the exact reviewed evidence set; provider data was not re-fetched.
            </div>
          )}
          {result.results.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded((value) => !value)}
                className="text-[11px] font-bold text-wk-brand hover:underline flex items-center gap-1"
              >
                <WkIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={12} />
                {expanded ? "Hide" : "Show"} details ({result.results.length} artists)
              </button>
              {expanded && (
                <div className="mt-2 max-h-[500px] overflow-y-auto rounded-xl border border-wk-border">
                  {result.results.map((item, index) => (
                    <ProfileResultRow key={`${item.slug ?? item.id ?? index}-${index}`} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ArtistTypePanel({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<ArtistEnrichmentResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [useMusicBrainz, setUseMusicBrainz] = useState(true);
  const [force, setForce] = useState(false);

  async function preview() {
    setPhase("running");
    setResult(null);
    setErrorMsg(null);
    try {
      const data = await previewArtistEnrichment({
        mode: "type",
        batchSize: 25,
        filter: "missing_type",
        force,
        useMusicBrainz,
      });
      setResult(data);
      setPhase("done");
    } catch (error) {
      setPhase("error");
      setErrorMsg(error instanceof Error ? error.message : "Unknown error");
    }
  }

  async function applyReviewed() {
    if (!result?.dry_run || !(result.reviewed_evidence_ids?.length)) {
      setPhase("error");
      setErrorMsg("Preview an exact type batch before applying it.");
      return;
    }
    setPhase("running");
    setErrorMsg(null);
    try {
      const applied = await applyReviewedArtistEnrichment(result);
      setResult({
        ...result,
        dry_run: false,
        approved: true,
        updated: applied.updated,
        errors: applied.errors,
      });
      setPhase("done");
      if (applied.updated > 0) onDone();
    } catch (error) {
      setPhase("error");
      setErrorMsg(error instanceof Error ? error.message : "Unknown error");
    }
  }

  const rows = result?.results ?? [];
  const typeRows = rows.map((item) => ({
    ...item,
    typeChange: (item.changes?.type ?? null) as TypeChange | null,
  }));
  const musicBrainz = typeRows.filter((row) => row.typeChange?.new && row.typeChange.source === "musicbrainz").length;
  const heuristic = typeRows.filter((row) => row.typeChange?.new && row.typeChange.source !== "musicbrainz").length;

  return (
    <div data-wk-registry-artist-panel="type" className="rounded-2xl border border-wk-border bg-wk-surface p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50">
            <i className="ri-user-voice-line text-[18px] text-sky-600" />
          </div>
          <div>
            <p className="text-[13px] font-black text-wk-text">Enrich Type</p>
            <p className="text-[11px] text-wk-text-muted">
              Review exact identity-semantic type proposals before admission.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setUseMusicBrainz((value) => !value)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${useMusicBrainz ? "border-wk-brand bg-wk-brand-soft text-wk-brand" : "border-wk-border bg-wk-surface-raised text-wk-text-muted"}`}
          >
            <i className="ri-database-2-line text-[12px]" />
            MusicBrainz
          </button>
          <button
            onClick={() => setForce((value) => !value)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${force ? "border-wk-brand bg-wk-brand-soft text-wk-brand" : "border-wk-border bg-wk-surface-raised text-wk-text-muted"}`}
          >
            <WkIcon name="RotateCcw" size={12} />
            Force proposal
          </button>
          <button
            onClick={preview}
            disabled={phase === "running"}
            className="rounded-xl border border-wk-border bg-wk-surface-raised px-3 py-2 text-[12px] font-bold text-wk-text-muted hover:border-wk-brand hover:text-wk-brand disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <WkIcon name="Eye" size={13} />
            Preview
          </button>
          <button
            onClick={applyReviewed}
            disabled={phase === "running" || !result?.dry_run || !(result.reviewed_evidence_ids?.length)}
            className="rounded-xl bg-wk-brand px-3 py-2 text-[12px] font-black text-wk-brand-on hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            {phase === "running" ? (
              <><WkIcon name="Loader2" size={13} className="animate-spin" /> Running…</>
            ) : (
              <><WkIcon name="Check" size={13} /> Apply reviewed types</>
            )}
          </button>
        </div>
      </div>

      {phase === "error" && errorMsg && (
        <div className="mt-3 rounded-xl bg-wk-danger-soft border border-wk-danger px-3 py-2 text-[12px] font-bold text-wk-danger">
          {errorMsg}
        </div>
      )}

      {phase === "done" && result && (
        <div className="mt-3 space-y-3">
          <SummaryGrid
            values={[
              ["Found", result.total_found, "text-wk-text-muted"],
              ["Name heuristic", heuristic, "text-wk-brand"],
              ["MusicBrainz", musicBrainz, "text-wk-info"],
              ["Skipped", result.skipped, "text-wk-text-muted"],
            ]}
          />
          {result.dry_run ? (
            <div className="rounded-xl bg-wk-warning-soft border border-wk-warning px-3 py-2 text-[12px] font-bold text-wk-warning">
              Preview persisted immutable type evidence only. Apply uses these exact evidence IDs without re-running classification.
            </div>
          ) : (
            <div className="rounded-xl bg-wk-brand-soft border border-wk-brand px-3 py-2 text-[12px] font-bold text-wk-brand">
              Applied the exact reviewed type evidence set.
            </div>
          )}
          {typeRows.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded((value) => !value)}
                className="text-[11px] font-bold text-wk-brand hover:underline flex items-center gap-1"
              >
                <WkIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={12} />
                {expanded ? "Hide" : "Show"} details ({typeRows.length} artists)
              </button>
              {expanded && (
                <div className="mt-2 max-h-[500px] overflow-y-auto rounded-xl border border-wk-border">
                  {typeRows.map((row, index) => (
                    <div key={`${row.slug ?? row.id ?? index}-${index}`} className="flex items-center gap-3 border-b border-wk-divider px-3 py-2.5 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-wk-text truncate">{row.name ?? row.slug ?? row.id}</p>
                        <p className="text-[10px] text-wk-text-muted truncate">{row.typeChange?.heuristic || row.message || "No proposal"}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {row.typeChange?.source === "musicbrainz" && (
                          <span className="rounded-full bg-wk-info-soft px-1.5 py-0.5 text-[10px] font-black text-wk-info uppercase">MB</span>
                        )}
                        <TypeBadge type={row.typeChange?.new} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryGrid({
  values,
}: {
  values: Array<[string, number, string]>;
}) {
  return (
    <div className={`grid gap-2 ${values.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
      {values.map(([label, value, className]) => (
        <div key={label} className="rounded-xl border border-wk-border p-2.5 text-center">
          <p className={`text-[18px] font-black ${className}`}>{value}</p>
          <p className="text-[10px] font-bold text-wk-text-muted uppercase tracking-wide">{label}</p>
        </div>
      ))}
    </div>
  );
}

function ProfileResultRow({ item }: { item: ArtistEnrichmentResponse["results"][number] }) {
  const changes = (item.changes ?? {}) as ProfileChange;
  return (
    <div className="flex items-center gap-3 border-b border-wk-divider px-3 py-2.5 last:border-b-0">
      {changes.image?.new ? (
        <img src={changes.image.new} alt={item.name ?? "Artist"} className="h-9 w-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="h-9 w-9 rounded-full bg-wk-surface-raised shrink-0 flex items-center justify-center">
          <WkIcon name="Mic2" size={14} className="text-wk-text-faint" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-wk-text truncate">{item.name ?? item.slug ?? item.id}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {(item.providersFound ?? []).map((provider) => (
            <span key={provider} className="text-[10px] font-bold text-wk-brand bg-wk-brand-soft rounded-full px-1.5 py-0.5">
              {provider}
            </span>
          ))}
          {changes.bio && <span className="text-[10px] font-bold text-wk-text-muted bg-wk-surface-raised rounded-full px-1.5 py-0.5">bio</span>}
          {changes.genres && <span className="text-[10px] font-bold text-wk-text-muted bg-wk-surface-raised rounded-full px-1.5 py-0.5">genres</span>}
          {item.message && <span className="text-[10px] text-wk-text-muted truncate">{item.message}</span>}
        </div>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
        item.status === "updated" ? "bg-wk-brand-soft text-wk-brand" :
        item.status === "error" ? "bg-wk-danger-soft text-wk-danger" :
        item.status === "no_data" ? "bg-wk-warning-soft text-wk-warning" :
        "bg-wk-surface-raised text-wk-text-muted"
      }`}>{item.status}</span>
    </div>
  );
}

function TypeBadge({ type }: { type: string | null | undefined }) {
  if (!type) return null;
  const colors: Record<string, string> = {
    solo: "bg-wk-brand-soft text-wk-brand",
    group: "bg-wk-info-soft text-wk-info",
    band: "bg-wk-warning-soft text-wk-warning",
    duo: "bg-wk-danger-soft text-wk-danger",
    collective: "bg-sky-50 text-sky-600",
    unknown: "bg-wk-surface-raised text-wk-text-muted",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${colors[type] || "bg-wk-surface-raised text-wk-text-muted"}`}>
      {type}
    </span>
  );
}
