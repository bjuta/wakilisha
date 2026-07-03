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

  const saveExistingRecordEvidence = async () => {
    if (!selectedRecord || !canSaveExisting) return;

    setSaving(true);
    setSavedNotice("");

    try {
      const enrichmentNeeded = enrichmentType !== "No enrichment needed";

      await addEvidence(draft.id, {
        title: selectedRecordEvidenceTitle,
        kind: "WAKILISHA record",
        source: `WAKILISHA ${entityLabel(selectedRecord.entityType)} record`,
        sourceUrl: selectedRecord.href,
        summary: selectedSummary,
        whyItMatters: evidenceRole,
        mediaMinutes: 0,
        reviewState: enrichmentNeeded || selectedRecord.health.status !== "usable" ? "Needs review" : "Draft",
        metadata: {
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
        },
      });

      setSavedNotice("Saved WAKILISHA record evidence.");
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const saveMissingRecordSuggestion = async () => {
    if (!canSaveSuggestion) return;

    setSaving(true);
    setSavedNotice("");

    try {
      await addEvidence(draft.id, {
        title: `Suggested ${entityLabel(suggestedType)} record: ${suggestedTitle.trim()}`,
        kind: "WAKILISHA record",
        source: "Institute missing WAKILISHA record suggestion",
        sourceUrl: firstUrl(supportingLinks),
        summary: suggestedDetails.trim(),
        whyItMatters: "Missing WAKILISHA record needed for this inquiry.",
        mediaMinutes: 0,
        reviewState: "Needs review",
        metadata: {
          workspaceVersion: 2,
          workspaceFormat: "WAKILISHA record",
          workspaceType: "registry",
          savedFrom: "wakilisha_record_workspace",
          recordEvidenceMode: "missing_record_suggestion",
          suggestedEntityType: suggestedType,
          suggestedTitle: suggestedTitle.trim(),
          suggestedDetails: suggestedDetails.trim(),
          supportingLinks: supportingLinks
            .split(/\n+/)
            .map((item) => item.trim())
            .filter(Boolean),
          inquiryCode: draft.code,
          inquiryQuestion: draft.workingQuestion,
        },
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
            {records.map((record) => {
              const selected = selectedRecord?.id === record.id;

              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => {
                    setSelectedRecord(record);
                    setSavedNotice("");
                  }}
                  className={cx(
                    "grid w-full grid-cols-[56px_1fr] gap-3 rounded-xl border p-3 text-left transition",
                    selected ? "border-wk-brand bg-wk-brand-soft shadow-sm" : "border-wk-border bg-wk-bg hover:border-wk-brand/40",
                  )}
                >
                  <div className="h-14 w-14 overflow-hidden rounded-lg border border-wk-border bg-wk-bg-subtle">
                    {record.imageUrl ? (
                      <img src={record.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[9px] font-black uppercase text-wk-text-faint">
                        {record.entityType.slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone="brand">{entityLabel(record.entityType)}</Pill>
                      <Pill tone={record.health.status === "usable" ? "success" : "warning"}>{record.health.status.replaceAll("_", " ")}</Pill>
                    </div>
                    <div className="mt-2 truncate text-[14px] font-black text-wk-text">{record.label}</div>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-wk-text-muted">{record.subtitle}</p>
                  </div>
                </button>
              );
            })}

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
