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
    <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f0f3ec]">
            <i className="ri-sparkling-line text-[18px] text-[#5f8f2f]" />
          </div>
          <div>
            <p className="text-[13px] font-black text-[#171712]">Enrich Artists</p>
            <p className="text-[11px] text-[#858c7e]">
              Preview provider evidence, review the exact batch, then admit only that reviewed evidence.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-2 py-1.5">
            <button
              onClick={() => setProviders((prev) => prev.includes("spotify") ? prev.filter((p) => p !== "spotify") : [...prev, "spotify"])}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${providers.includes("spotify") ? "bg-[#1DB954]/10 text-[#1DB954]" : "text-[#a8ad9e]"}`}
            >
              <i className="ri-spotify-line text-[13px]" />
              Spotify
            </button>
            <button
              onClick={() => setProviders((prev) => prev.includes("apple_music") ? prev.filter((p) => p !== "apple_music") : [...prev, "apple_music"])}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${providers.includes("apple_music") ? "bg-[#fa2d48]/10 text-[#fa2d48]" : "text-[#a8ad9e]"}`}
            >
              <i className="ri-apple-line text-[13px]" />
              Apple
            </button>
          </div>
          <WkSelect
            value={filterMode}
            onChange={setFilterMode}
            triggerClassName="h-8 rounded-lg border border-[#dfe4d8] bg-[#f8f9f4] px-2 text-[11px] font-bold text-[#697062] outline-none"
          >
            <option value="missing_image">Missing image</option>
            <option value="missing_bio">Missing bio</option>
            <option value="all">All artists</option>
          </WkSelect>
          <button
            onClick={() => setForce((value) => !value)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${force ? "border-[#5f8f2f] bg-[#e8f5dc] text-[#5f8f2f]" : "border-[#dfe4d8] bg-[#f8f9f4] text-[#a8ad9e]"}`}
          >
            <WkIcon name="RotateCcw" size={12} />
            Force proposal
          </button>
          <button
            onClick={preview}
            disabled={phase === "running"}
            className="rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 py-2 text-[12px] font-bold text-[#697062] hover:border-[#85c441] hover:text-[#5f8f2f] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <WkIcon name="Eye" size={13} />
            Preview
          </button>
          <button
            onClick={applyReviewed}
            disabled={phase === "running" || !result?.dry_run || !(result.reviewed_evidence_ids?.length)}
            className="rounded-xl bg-[#5f8f2f] px-3 py-2 text-[12px] font-black text-white hover:bg-[#4d7a26] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
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
              <span className={`inline-block h-2 w-2 rounded-full ${status.connected ? "bg-[#5f8f2f]" : "bg-[#f0a020]"}`} />
              <span className="font-bold text-[#697062] capitalize">{key.replace("_", " ")}</span>
              <span className={status.connected ? "text-[#5f8f2f]" : "text-[#f0a020]"}>
                {status.connected ? "evidence found" : "no evidence"}
              </span>
            </div>
          ))}
        </div>
      )}

      {phase === "error" && errorMsg && (
        <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[12px] font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      {phase === "done" && result && (
        <div className="mt-3 space-y-3">
          <SummaryGrid
            values={[
              ["Found", result.total_found, "text-[#697062]"],
              [result.dry_run ? "Proposed" : "Admitted", result.updated, "text-[#5f8f2f]"],
              ["Skipped", result.skipped, "text-[#858c7e]"],
              ["No data", result.no_data, "text-[#f0a020]"],
              ["Errors", result.errors, "text-red-600"],
            ]}
          />
          {result.dry_run ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] font-bold text-amber-700">
              Preview persisted immutable evidence only. Canonical Artist state is unchanged until “Apply reviewed batch”.
            </div>
          ) : (
            <div className="rounded-xl bg-[#e8f5dc] border border-[#85c441]/40 px-3 py-2 text-[12px] font-bold text-[#5f8f2f]">
              Applied the exact reviewed evidence set; provider data was not re-fetched.
            </div>
          )}
          {result.results.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded((value) => !value)}
                className="text-[11px] font-bold text-[#5f8f2f] hover:underline flex items-center gap-1"
              >
                <WkIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={12} />
                {expanded ? "Hide" : "Show"} details ({result.results.length} artists)
              </button>
              {expanded && (
                <div className="mt-2 max-h-[500px] overflow-y-auto rounded-xl border border-[#dfe4d8]">
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
    <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50">
            <i className="ri-user-voice-line text-[18px] text-sky-600" />
          </div>
          <div>
            <p className="text-[13px] font-black text-[#171712]">Enrich Type</p>
            <p className="text-[11px] text-[#858c7e]">
              Review exact identity-semantic type proposals before admission.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setUseMusicBrainz((value) => !value)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${useMusicBrainz ? "border-[#5f8f2f] bg-[#e8f5dc] text-[#5f8f2f]" : "border-[#dfe4d8] bg-[#f8f9f4] text-[#a8ad9e]"}`}
          >
            <i className="ri-database-2-line text-[12px]" />
            MusicBrainz
          </button>
          <button
            onClick={() => setForce((value) => !value)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${force ? "border-[#5f8f2f] bg-[#e8f5dc] text-[#5f8f2f]" : "border-[#dfe4d8] bg-[#f8f9f4] text-[#a8ad9e]"}`}
          >
            <WkIcon name="RotateCcw" size={12} />
            Force proposal
          </button>
          <button
            onClick={preview}
            disabled={phase === "running"}
            className="rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 py-2 text-[12px] font-bold text-[#697062] hover:border-[#85c441] hover:text-[#5f8f2f] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <WkIcon name="Eye" size={13} />
            Preview
          </button>
          <button
            onClick={applyReviewed}
            disabled={phase === "running" || !result?.dry_run || !(result.reviewed_evidence_ids?.length)}
            className="rounded-xl bg-[#5f8f2f] px-3 py-2 text-[12px] font-black text-white hover:bg-[#4d7a26] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
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
        <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[12px] font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      {phase === "done" && result && (
        <div className="mt-3 space-y-3">
          <SummaryGrid
            values={[
              ["Found", result.total_found, "text-[#697062]"],
              ["Name heuristic", heuristic, "text-[#5f8f2f]"],
              ["MusicBrainz", musicBrainz, "text-[#7c3aed]"],
              ["Skipped", result.skipped, "text-[#858c7e]"],
            ]}
          />
          {result.dry_run ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] font-bold text-amber-700">
              Preview persisted immutable type evidence only. Apply uses these exact evidence IDs without re-running classification.
            </div>
          ) : (
            <div className="rounded-xl bg-[#e8f5dc] border border-[#85c441]/40 px-3 py-2 text-[12px] font-bold text-[#5f8f2f]">
              Applied the exact reviewed type evidence set.
            </div>
          )}
          {typeRows.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded((value) => !value)}
                className="text-[11px] font-bold text-[#5f8f2f] hover:underline flex items-center gap-1"
              >
                <WkIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={12} />
                {expanded ? "Hide" : "Show"} details ({typeRows.length} artists)
              </button>
              {expanded && (
                <div className="mt-2 max-h-[500px] overflow-y-auto rounded-xl border border-[#dfe4d8]">
                  {typeRows.map((row, index) => (
                    <div key={`${row.slug ?? row.id ?? index}-${index}`} className="flex items-center gap-3 border-b border-[#f0f3ec] px-3 py-2.5 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-[#171712] truncate">{row.name ?? row.slug ?? row.id}</p>
                        <p className="text-[10px] text-[#a8ad9e] truncate">{row.typeChange?.heuristic || row.message || "No proposal"}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {row.typeChange?.source === "musicbrainz" && (
                          <span className="rounded-full bg-[#ede9fe] px-1.5 py-0.5 text-[10px] font-black text-[#7c3aed] uppercase">MB</span>
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
        <div key={label} className="rounded-xl border border-[#dfe4d8] p-2.5 text-center">
          <p className={`text-[18px] font-black ${className}`}>{value}</p>
          <p className="text-[10px] font-bold text-[#a8ad9e] uppercase tracking-wide">{label}</p>
        </div>
      ))}
    </div>
  );
}

function ProfileResultRow({ item }: { item: ArtistEnrichmentResponse["results"][number] }) {
  const changes = (item.changes ?? {}) as ProfileChange;
  return (
    <div className="flex items-center gap-3 border-b border-[#f0f3ec] px-3 py-2.5 last:border-b-0">
      {changes.image?.new ? (
        <img src={changes.image.new} alt={item.name ?? "Artist"} className="h-9 w-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="h-9 w-9 rounded-full bg-[#f0f3ec] shrink-0 flex items-center justify-center">
          <WkIcon name="Mic2" size={14} className="text-[#c8d0be]" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-[#171712] truncate">{item.name ?? item.slug ?? item.id}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {(item.providersFound ?? []).map((provider) => (
            <span key={provider} className="text-[10px] font-bold text-[#5f8f2f] bg-[#e8f5dc] rounded-full px-1.5 py-0.5">
              {provider}
            </span>
          ))}
          {changes.bio && <span className="text-[10px] font-bold text-[#697062] bg-[#f0f3ec] rounded-full px-1.5 py-0.5">bio</span>}
          {changes.genres && <span className="text-[10px] font-bold text-[#697062] bg-[#f0f3ec] rounded-full px-1.5 py-0.5">genres</span>}
          {item.message && <span className="text-[10px] text-[#a8ad9e] truncate">{item.message}</span>}
        </div>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
        item.status === "updated" ? "bg-[#e8f5dc] text-[#5f8f2f]" :
        item.status === "error" ? "bg-red-50 text-red-600" :
        item.status === "no_data" ? "bg-amber-50 text-amber-600" :
        "bg-[#f0f3ec] text-[#858c7e]"
      }`}>{item.status}</span>
    </div>
  );
}

function TypeBadge({ type }: { type: string | null | undefined }) {
  if (!type) return null;
  const colors: Record<string, string> = {
    solo: "bg-[#e8f5dc] text-[#5f8f2f]",
    group: "bg-[#ede9fe] text-[#7c3aed]",
    band: "bg-amber-50 text-amber-700",
    duo: "bg-rose-50 text-rose-600",
    collective: "bg-sky-50 text-sky-600",
    unknown: "bg-[#f0f3ec] text-[#858c7e]",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${colors[type] || "bg-[#f0f3ec] text-[#858c7e]"}`}>
      {type}
    </span>
  );
}
