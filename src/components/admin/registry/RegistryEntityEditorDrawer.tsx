import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { releaseUrl } from "@/utils/releaseUrl";
import {
  type RegistryEntityType,
  type RegistryEntitySchema,
  type RegistryFieldSchema,
  type RegistrySaveResult,
} from "@/services/registry/admin/types";
import {
  buildChangesPayload,
  saveRegistryEntityPatch,
} from "@/services/registry/admin/client";
import { normalizeSlug, validateField } from "@/services/registry/admin/fieldNormalization";
import { calculateCompleteness, completenessLabel, completenessTone } from "@/services/registry/admin/completeness";
import { supabase } from "@/lib/supabase";

interface RegistryEntityEditorDrawerProps {
  entityType: RegistryEntityType;
  entity: Record<string, unknown>;
  schema: RegistryEntitySchema;
  onClose: () => void;
  onSaved: (updatedEntity: Record<string, unknown>) => void;
}

/* ─── Release rich-data types ─── */

interface RichTrackItem {
  track_id: string;
  track_slug: string;
  track_title: string;
  track_number: number;
  disc_number: number;
  duration_ms: number;
  isrc: string | null;
  track_artwork_url: string | null;
  track_status: string;
}

interface RichTrackArtist {
  track_id: string;
  artist_id: string;
  artist_slug: string;
  artist_name_text: string;
  is_primary: boolean;
  is_featured: boolean;
  credit_order: number;
}

interface RichReleaseArtist {
  artist_id: string;
  artist_slug: string;
  artist_name_text: string;
  role: string;
  is_primary: boolean;
}

interface RichLabel {
  id: string;
  slug: string;
  name: string;
}

interface ReleaseRichData {
  tracks: RichTrackItem[];
  trackArtists: RichTrackArtist[];
  releaseArtists: RichReleaseArtist[];
  label: RichLabel | null;
}

const FIELD_GROUPS: Record<string, string[]> = {
  Identity: ["display_name", "title", "slug", "sort_name"],
  Classification: [
    "origin_iso2",
    "artist_type",
    "gender",
    "release_type",
    "track_number",
    "disc_number",
    "explicit",
  ],
  Content: [
    "bio",
    "description",
    "artwork_url",
    "public_image_url",
    "preview_url",
  ],
  Metadata: ["isrc", "upc", "duration_ms", "release_date"],
  Publishing: ["status"],
};

const SHORT_FIELD_TYPES = new Set(["text", "select", "number", "date", "boolean"]);

function groupEditableFields(
  fields: RegistryFieldSchema[],
): Array<{ label: string; fields: RegistryFieldSchema[] }> {
  const assigned = new Set<string>();
  const groups: Array<{ label: string; fields: RegistryFieldSchema[] }> = [];

  for (const [label, keys] of Object.entries(FIELD_GROUPS)) {
    const groupFields: RegistryFieldSchema[] = [];
    for (const key of keys) {
      const field = fields.find((f) => f.key === key);
      if (field) {
        groupFields.push(field);
        assigned.add(key);
      }
    }
    if (groupFields.length > 0) {
      groups.push({ label, fields: groupFields });
    }
  }

  const unassigned = fields.filter((f) => !assigned.has(f.key));
  if (unassigned.length > 0) {
    groups.push({ label: "Other", fields: unassigned });
  }

  return groups;
}

function formatDurationMs(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getFeaturedForTrack(trackId: string, allArtists: RichTrackArtist[]): RichTrackArtist[] {
  return allArtists
    .filter((a) => a.track_id === trackId && a.is_featured)
    .sort((a, b) => a.credit_order - b.credit_order);
}

export default function RegistryEntityEditorDrawer({
  entityType,
  entity,
  schema,
  onClose,
  onSaved,
}: RegistryEntityEditorDrawerProps) {
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({ ...entity }));
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<RegistrySaveResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showSystemFields, setShowSystemFields] = useState(false);
  const [richData, setRichData] = useState<ReleaseRichData | null>(null);
  const [richDataLoading, setRichDataLoading] = useState(false);
  const [showRichPanel, setShowRichPanel] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Trap focus and handle Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Fetch release rich data
  useEffect(() => {
    if (entityType !== "release") return;
    const releaseId = String(entity.id ?? "");
    const labelId = entity.label_id ? String(entity.label_id) : null;

    let cancelled = false;
    async function load() {
      setRichDataLoading(true);
      try {
        // Step 1: Get release tracks
        const { data: tracksData, error: tracksErr } = await supabase
          .from("registry_release_tracks")
          .select("track_number, disc_number, status, track_id")
          .eq("release_id", releaseId)
          .order("disc_number")
          .order("track_number");

        if (tracksErr || !tracksData) { if (!cancelled) setRichDataLoading(false); return; }

        const trackIds = tracksData.map((t) => t.track_id);

        // Step 2: Load track details, track artists, release artists, label
        const [trackDetailsRes, trackArtistsRes, releaseArtistsRes, labelRes] = await Promise.all([
          trackIds.length > 0
            ? supabase
                .from("registry_tracks")
                .select("id, slug, title, duration_ms, isrc, artwork_url, status")
                .in("id", trackIds)
            : Promise.resolve({ data: [], error: null }),
          trackIds.length > 0
            ? supabase
                .from("registry_track_artists")
                .select("track_id, artist_id, artist_slug, artist_name_text, is_primary, is_featured, credit_order")
                .in("track_id", trackIds)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from("registry_release_artists")
            .select("artist_id, artist_slug, artist_name_text, role, is_primary")
            .eq("release_id", releaseId),
          labelId
            ? supabase.from("registry_labels").select("id, slug, name").eq("id", labelId).maybeSingle()
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        // Merge tracks
        const detailMap = new Map((trackDetailsRes.data ?? []).map((td: Record<string, unknown>) => [td.id, td]));
        const tracks: RichTrackItem[] = tracksData.map((rt) => {
          const td = detailMap.get(rt.track_id);
          return {
            track_id: rt.track_id,
            track_slug: (td?.slug as string) ?? "",
            track_title: (td?.title as string) ?? "(Unknown)",
            track_number: rt.track_number ?? 0,
            disc_number: rt.disc_number ?? 1,
            duration_ms: (td?.duration_ms as number) ?? 0,
            isrc: (td?.isrc as string) ?? null,
            track_artwork_url: (td?.artwork_url as string) ?? null,
            track_status: (td?.status as string) ?? "draft",
          };
        });

        setRichData({
          tracks,
          trackArtists: (trackArtistsRes.data ?? []) as RichTrackArtist[],
          releaseArtists: (releaseArtistsRes.data ?? []) as RichReleaseArtist[],
          label: labelRes?.data ? (labelRes.data as RichLabel) : null,
        });
      } catch (err) {
        console.error("[RegistryDrawer] rich data error:", err);
      } finally {
        if (!cancelled) setRichDataLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [entityType, entity.id, entity.label_id]);

  const displayName = String(entity[schema.displayNameField] ?? "Untitled");
  const quality = useMemo(() => calculateCompleteness(entity, schema), [entity, schema]);

  const dirtyFields = useMemo(() => {
    const result = buildChangesPayload(entity, draft, schema);
    return result.savedFields.map((f) => f.key);
  }, [entity, draft, schema]);

  const hasChanges = dirtyFields.length > 0;
  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  const groupedFields = useMemo(
    () => groupEditableFields(schema.editableFields.filter((f) => f.access === "editable")),
    [schema],
  );

  const updateField = useCallback(
    (key: string, value: unknown) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
      setSaveResult(null);

      const fieldDef = schema.editableFields.find((f) => f.key === key);
      if (fieldDef) {
        const error = validateField(value, fieldDef);
        setValidationErrors((prev) => {
          const next = { ...prev };
          if (error) {
            next[key] = error;
          } else {
            delete next[key];
          }
          return next;
        });
      }
    },
    [schema],
  );

  async function handleSave() {
    if (!hasChanges) return;

    const errors: Record<string, string> = {};
    for (const field of schema.editableFields) {
      const error = validateField(draft[field.key], field);
      if (error) errors[field.key] = error;
    }
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    setSaveResult(null);

    const { changes } = buildChangesPayload(entity, draft, schema);
    const result = await saveRegistryEntityPatch(
      entityType,
      String(entity[schema.idField]),
      changes,
      String(entity.updated_at ?? ""),
    );

    setSaveResult(result);
    setSaving(false);

    if (result.ok && result.updatedEntity) {
      onSaved(result.updatedEntity);
    }
  }

  function handleDiscard() {
    setDraft({ ...entity });
    setSaveResult(null);
    setValidationErrors({});
  }

  function handleGenerateNewSlug() {
    const nextSlug = normalizeSlug(displayName) + "-" + Date.now().toString().slice(-4);
    updateField("slug", nextSlug);
  }

  const updatedAt = entity.updated_at
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(String(entity.updated_at)))
    : "—";

  const saveResultIcon = saveResult
    ? saveResult.ok
      ? saveResult.savedFields.length > 0
        ? "ri-checkbox-circle-fill"
        : "ri-information-fill"
      : saveResult.errorCode === "stale_update"
        ? "ri-history-fill"
        : saveResult.errorCode === "permission_denied"
          ? "ri-shield-user-fill"
          : saveResult.errorCode === "duplicate_key"
            ? "ri-error-warning-fill"
            : "ri-close-circle-fill"
    : null;

  const getResultColors = () => {
    if (!saveResult) return "";
    if (saveResult.ok) {
      return saveResult.warnings.length > 0
        ? "border-amber-300 bg-amber-50 text-amber-800"
        : "border-emerald-300 bg-emerald-50 text-emerald-800";
    }
    if (saveResult.errorCode === "stale_update") {
      return "border-orange-300 bg-orange-50 text-orange-800";
    }
    if (saveResult.errorCode === "duplicate_key") {
      return "border-red-300 bg-red-50 text-red-800";
    }
    return "border-red-300 bg-red-50 text-red-800";
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm transition-opacity">
      <button
        type="button"
        aria-label="Close editor"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <aside
        ref={drawerRef}
        className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl animate-[slideIn_240ms_ease-out]"
      >
        {/* Header */}
        <header className="shrink-0 border-b border-[#e8ece2] bg-[#fbfcf8]">
          <div className="h-1 bg-[#85c441]" />
          <div className="px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#c5dd9e] bg-[#eef7df] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#5f8f2f]">
                    <i className="ri-database-2-line text-xs" />
                    {entityType}
                  </span>
                  {hasChanges && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Unsaved
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-black tracking-tight text-[#171712] sm:text-2xl truncate">
                  {displayName}
                </h2>
                <p className="mt-1 font-mono text-[11px] text-[#858c7e] truncate">
                  {String(entity[schema.idField] ?? "")}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#dfe4d8] bg-white text-[#71796b] hover:border-[#85c441] hover:text-[#171712] transition-colors"
                aria-label="Close editor"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 sm:px-6">

            {/* Quality summary */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-6">
              <div className="rounded-2xl border border-[#dfe4d8] bg-[#fbfcf8] px-4 py-3.5 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#85c441]" />
                <div className="flex items-center gap-2 mb-1">
                  <i className="ri-pie-chart-2-fill text-[#85c441] text-sm" />
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#71796b]">Complete</p>
                </div>
                <p className="text-2xl font-black text-[#171712]">{quality.completeness}%</p>
              </div>
              <div className="rounded-2xl border border-[#dfe4d8] bg-[#fbfcf8] px-4 py-3.5 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400" />
                <div className="flex items-center gap-2 mb-1">
                  <i className="ri-alert-fill text-amber-500 text-sm" />
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#71796b]">Missing</p>
                </div>
                <p className="text-2xl font-black text-[#171712]">{quality.missingFields.length}</p>
              </div>
              <div className="rounded-2xl border border-[#dfe4d8] bg-[#fbfcf8] px-4 py-3.5 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400" />
                <div className="flex items-center gap-2 mb-1">
                  <i className="ri-flag-fill text-emerald-500 text-sm" />
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#71796b]">Status</p>
                </div>
                <p className="text-lg font-black text-[#171712] truncate">
                  {String(draft.status ?? "active")}
                </p>
              </div>
              <div className="rounded-2xl border border-[#dfe4d8] bg-[#fbfcf8] px-4 py-3.5 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#9aa292]" />
                <div className="flex items-center gap-2 mb-1">
                  <i className="ri-time-fill text-[#9aa292] text-sm" />
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#71796b]">Updated</p>
                </div>
                <p className="text-xs font-bold text-[#5d6557]">{updatedAt}</p>
              </div>
            </div>

            {/* Quality state badge + progress */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-black ${completenessTone(quality.completeness)}`}
                >
                  {completenessLabel(quality.state)}
                </span>
                {quality.missingFields.length > 0 && (
                  <span className="text-xs text-[#8a9283]">
                    Missing: {quality.missingFields.join(", ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-36">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef1e8]">
                  <div
                    className="h-full rounded-full bg-[#85c441] transition-all duration-500"
                    style={{ width: `${quality.completeness}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-[#8a9283] tabular-nums w-8 text-right">
                  {quality.completeness}%
                </span>
              </div>
            </div>

            {/* Save result */}
            {saveResult && (
              <div
                className={`mb-5 rounded-2xl border p-4 animate-[slideIn_200ms_ease-out] ${getResultColors()}`}
              >
                <div className="flex items-start gap-3">
                  {saveResultIcon && (
                    <i className={`${saveResultIcon} text-lg shrink-0 mt-0.5`} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black">
                      {saveResult.ok
                        ? saveResult.savedFields.length > 0
                          ? `Saved ${displayName}`
                          : "No changes to save"
                        : saveResult.errorCode === "stale_update"
                          ? "Someone else edited this record"
                          : saveResult.errorCode === "duplicate_key"
                            ? "Duplicate key conflict"
                            : saveResult.errorCode === "not_authenticated"
                              ? "Session expired"
                              : saveResult.errorCode === "permission_denied"
                                ? "Permission denied"
                                : "Save failed"}
                    </p>
                    {saveResult.savedFields.length > 0 && (
                      <p className="mt-1 text-xs opacity-80">
                        Updated: {saveResult.savedFields.map((f) => f.label).join(", ")}
                      </p>
                    )}
                    {saveResult.warnings.length > 0 && (
                      <p className="mt-1 text-xs opacity-80">
                        {saveResult.warnings.join(" ")}
                      </p>
                    )}
                    {saveResult.errorCode === "stale_update" && (
                      <div className="mt-2">
                        <p className="text-xs opacity-80">
                          This record was modified by another user since you loaded it. Your changes cannot be saved to avoid overwriting their work.
                        </p>
                        {saveResult.currentEntity && (
                          <button
                            type="button"
                            onClick={() => {
                              setDraft({ ...saveResult.currentEntity! });
                              setSaveResult(null);
                              setValidationErrors({});
                              onSaved(saveResult.currentEntity!);
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-orange-300 bg-white px-4 py-2 text-xs font-black text-orange-800 hover:border-orange-400 transition-colors"
                          >
                            <i className="ri-refresh-line" />
                            Load latest version
                          </button>
                        )}
                      </div>
                    )}
                    {saveResult.errorCode === "duplicate_key" && (
                      <div className="mt-2">
                        <p className="text-xs opacity-80">
                          {saveResult.duplicateField && saveResult.duplicateValue
                            ? `"${saveResult.duplicateValue}" is already used by another ${entityType}.`
                            : "A unique value conflict occurred."}
                        </p>
                        {saveResult.conflictingEntity && (
                          <div className="mt-2 rounded-xl border border-red-200 bg-white px-3 py-2.5">
                            <p className="text-[11px] font-bold text-[#71796b]">
                              Conflicting {entityType}
                            </p>
                            <p className="text-sm font-bold text-[#171712]">
                              {String(saveResult.conflictingEntity.title ?? "Unknown")}
                            </p>
                            {saveResult.conflictingEntity.slug && (
                              <p className="text-xs font-mono text-[#858c7e]">
                                {String(saveResult.conflictingEntity.slug)}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const slug = saveResult.conflictingEntity?.slug;
                                  if (slug) {
                                    navigate(`/admin/registry/${entityType}s/${slug}`);
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#dfe4d8] bg-white px-3 py-1.5 text-xs font-bold text-[#171712] hover:border-[#85c441] transition-colors"
                              >
                                <i className="ri-external-link-line" />
                                View existing
                              </button>
                              <button
                                type="button"
                                onClick={handleGenerateNewSlug}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#dfe4d8] bg-white px-3 py-1.5 text-xs font-bold text-[#171712] hover:border-[#85c441] transition-colors"
                              >
                                <i className="ri-sparkling-line" />
                                Generate new slug
                              </button>
                              <button
                                type="button"
                                onClick={() => setSaveResult(null)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#dfe4d8] bg-white px-3 py-1.5 text-xs font-bold text-[#71796b] hover:border-[#85c441] transition-colors"
                              >
                                <i className="ri-pencil-line" />
                                Keep editing
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {saveResult.message && !saveResult.ok && saveResult.errorCode !== "stale_update" && saveResult.errorCode !== "duplicate_key" && (
                      <p className="mt-1 text-xs opacity-80">{saveResult.message}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Editable fields by group */}
            <div className="space-y-6">
              {groupedFields.map((group) => {
                const shortFields = group.fields.filter((f) => SHORT_FIELD_TYPES.has(f.type));
                const longFields = group.fields.filter((f) => !SHORT_FIELD_TYPES.has(f.type));

                return (
                  <fieldset key={group.label}>
                    <legend className="mb-3 flex items-center gap-2">
                      <span className="h-4 w-1 rounded-full bg-[#85c441]" />
                      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#71796b]">
                        {group.label}
                      </span>
                    </legend>

                    <div className="space-y-4">
                      {shortFields.length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {shortFields.map((field) => (
                            <FieldCard
                              key={field.key}
                              field={field}
                              value={draft[field.key]}
                              onChange={(v) => updateField(field.key, v)}
                              displayName={displayName}
                              isDirty={dirtyFields.includes(field.key)}
                              error={validationErrors[field.key] || (saveResult?.errorCode === "duplicate_key" && saveResult?.duplicateField === field.key ? "Already in use" : undefined)}
                            />
                          ))}
                        </div>
                      )}

                      {longFields.map((field) => (
                        <FieldCard
                          key={field.key}
                          field={field}
                          value={draft[field.key]}
                          onChange={(v) => updateField(field.key, v)}
                          displayName={displayName}
                          isDirty={dirtyFields.includes(field.key)}
                          error={validationErrors[field.key] || (saveResult?.errorCode === "duplicate_key" && saveResult?.duplicateField === field.key ? "Already in use" : undefined)}
                        />
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>

            {/* System fields (collapsible) */}
            {schema.readonlyFields.length > 0 && (
              <div className="mt-8 border-t border-[#e8ece2] pt-6">
                <button
                  type="button"
                  onClick={() => setShowSystemFields(!showSystemFields)}
                  className="flex w-full items-center justify-between group"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-[#9aa292]" />
                    <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#71796b]">
                      System fields
                    </span>
                    <span className="rounded-full bg-[#eef1e8] px-1.5 py-0.5 text-[9px] font-bold text-[#8a9283]">
                      {schema.readonlyFields.length}
                    </span>
                  </span>
                  <i
                    className={`ri-arrow-down-s-line text-[#9aa292] transition-transform duration-200 ${
                      showSystemFields ? "rotate-180" : ""
                    } group-hover:text-[#71796b]`}
                  />
                </button>

                {showSystemFields && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 animate-[slideIn_200ms_ease-out]">
                    {schema.readonlyFields.map((field) => (
                      <div key={field.key}>
                        <label className="grid gap-1">
                          <span className="text-[10px] font-black uppercase tracking-wide text-[#8a9283]">
                            {field.label}
                          </span>
                          <div className="flex h-10 items-center rounded-xl border border-[#dfe4d8] bg-[#f0f3ec] px-3">
                            <span className="truncate font-mono text-xs text-[#858c7e]">
                              {field.type === "date" && entity[field.key]
                                ? new Intl.DateTimeFormat("en-GB", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  }).format(new Date(String(entity[field.key])))
                                : String(entity[field.key] ?? "—")}
                            </span>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── Release Rich-Data Panel ─── */}
            {entityType === "release" && (
              <div className="mt-8 border-t border-[#e8ece2] pt-6">
                <button
                  type="button"
                  onClick={() => setShowRichPanel(!showRichPanel)}
                  className="flex w-full items-center justify-between group"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-[#85c441]" />
                    <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#71796b]">
                      Release Content
                    </span>
                    {richData && (
                      <span className="rounded-full bg-[#eef7df] px-1.5 py-0.5 text-[9px] font-bold text-[#5f8f2f]">
                        {richData.tracks.length} tracks
                      </span>
                    )}
                  </span>
                  <i
                    className={`ri-arrow-down-s-line text-[#9aa292] transition-transform duration-200 ${
                      showRichPanel ? "rotate-180" : ""
                    } group-hover:text-[#71796b]`}
                  />
                </button>

                {showRichPanel && (
                  <div className="mt-4 space-y-4 animate-[slideIn_200ms_ease-out]">
                    {richDataLoading && (
                      <div className="flex items-center gap-2 text-xs text-[#858c7e]">
                        <i className="ri-loader-4-line animate-spin" />
                        Loading tracks and artists…
                      </div>
                    )}

                    {!richDataLoading && !richData && (
                      <p className="text-xs text-[#858c7e]">No track data available.</p>
                    )}

                    {richData && (
                      <>
                        {/* ─── Release snapshot chips ─── */}
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Artwork */}
                          {entity.artwork_url ? (
                            <img
                              src={String(entity.artwork_url)}
                              alt=""
                              className="h-16 w-16 shrink-0 rounded-xl object-cover border border-[#dfe4d8]"
                            />
                          ) : (
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[#dfe4d8] bg-[#f0f3ec] text-xs font-black text-[#8a9283]">
                              <i className="ri-album-line text-lg" />
                            </div>
                          )}

                          <div className="min-w-0 space-y-1">
                            {/* Release type + date */}
                            <div className="flex items-center gap-2">
                              {entity.release_type && (
                                <span className="inline-flex items-center rounded-full bg-[#eef7df] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#5f8f2f]">
                                  {String(entity.release_type)}
                                </span>
                              )}
                              {entity.release_date && (
                                <span className="text-[10px] font-semibold text-[#858c7e]">
                                  {String(entity.release_date)}
                                </span>
                              )}
                            </div>

                            {/* Label */}
                            {richData.label && (
                              <div className="flex items-center gap-1.5">
                                <i className="ri-building-2-line text-[10px] text-[#9aa292]" />
                                <a
                                  href={`/admin/registry/labels/${richData.label.slug}`}
                                  className="text-xs font-bold text-[#171712] hover:text-[#5f8f2f] transition-colors truncate"
                                >
                                  {richData.label.name}
                                </a>
                              </div>
                            )}

                            {/* Primary artist */}
                            {(() => {
                              const primary = richData.releaseArtists.find((ra) => ra.is_primary) || richData.releaseArtists[0];
                              if (!primary) return null;
                              return (
                                <div className="flex items-center gap-1.5">
                                  <i className="ri-user-line text-[10px] text-[#9aa292]" />
                                  <a
                                    href={`/admin/registry/artists/${primary.artist_slug}`}
                                    className="text-xs font-bold text-[#171712] hover:text-[#5f8f2f] transition-colors truncate"
                                  >
                                    {primary.artist_name_text}
                                  </a>
                                </div>
                              );
                            })()}

                            {/* Track count + total duration */}
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#697062]">
                                <i className="ri-list-check text-xs" />
                                {richData.tracks.length} track{richData.tracks.length !== 1 ? "s" : ""}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#697062]">
                                <i className="ri-timer-line text-xs" />
                                {formatDurationMs(richData.tracks.reduce((sum, t) => sum + t.duration_ms, 0))}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* View public page + detail page links */}
                        <div className="flex flex-wrap items-center gap-2">
                          {entity.slug && (
                            <a
                              href={releaseUrl({ slug: String(entity.slug), artist: String(entity.display_name || entity.title || "") })}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 text-[11px] font-bold text-[#171712] hover:border-[#85c441] hover:text-[#5f8f2f] transition-colors"
                            >
                              <i className="ri-external-link-line text-xs" />
                              View Public Page
                            </a>
                          )}
                          <a
                            href={`/admin/registry/releases/${entity.slug || entity.id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 text-[11px] font-bold text-[#171712] hover:border-[#85c441] hover:text-[#5f8f2f] transition-colors"
                          >
                            <i className="ri-file-list-3-line text-xs" />
                            Full Detail Page
                          </a>
                        </div>

                        {/* Description / NLG excerpt */}
                        {entity.description && (
                          <div className="rounded-xl border border-[#dfe4d8] bg-[#fbfcf8] px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-wide text-[#71796b] mb-1.5">
                              Description
                            </p>
                            <p className="text-xs text-[#5d6557] leading-relaxed line-clamp-4">
                              {String(entity.description)}
                            </p>
                          </div>
                        )}

                        {/* Provider metadata */}
                        {entity.metadata && typeof entity.metadata === "object" && (
                          <ProviderMetadataChips metadata={entity.metadata as Record<string, unknown>} />
                        )}

                        {/* Featured artists summary */}
                        {richData.releaseArtists.filter((ra) => !ra.is_primary).length > 0 && (
                          <div className="rounded-xl border border-[#dfe4d8] bg-[#fbfcf8] px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-wide text-[#71796b] mb-2">
                              Featured Artists
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {richData.releaseArtists
                                .filter((ra) => !ra.is_primary)
                                .map((ra) => (
                                  <a
                                    key={ra.artist_id}
                                    href={`/admin/registry/artists/${ra.artist_slug}`}
                                    className="inline-flex items-center gap-1 rounded-full border border-[#dfe4d8] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2d3329] hover:border-[#85c441] hover:text-[#5f8f2f] transition-colors"
                                  >
                                    {ra.artist_name_text}
                                    <span className="text-[9px] text-[#9aa292]">{ra.role}</span>
                                  </a>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Mini tracklist */}
                        <div className="rounded-xl border border-[#dfe4d8] overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#fbfcf8] border-b border-[#e8ece2]">
                            <i className="ri-list-ordered text-xs text-[#9aa292]" />
                            <span className="text-[10px] font-black uppercase tracking-wide text-[#71796b]">
                              Tracklist
                            </span>
                          </div>
                          <div className="divide-y divide-[#eef1ea]">
                            {richData.tracks.slice(0, 20).map((track) => {
                              const featured = getFeaturedForTrack(track.track_id, richData.trackArtists);
                              return (
                                <div
                                  key={track.track_id}
                                  className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#fbfcf8] transition-colors"
                                >
                                  {/* Track number */}
                                  <span className="w-6 text-right text-[10px] font-extrabold text-[#9aa292] tabular-nums shrink-0">
                                    {track.track_number}
                                  </span>

                                  {/* Artwork thumbnail */}
                                  <div className="w-7 h-7 shrink-0 rounded-md overflow-hidden bg-[#f0f3ec] border border-[#dfe4d8]">
                                    {track.track_artwork_url ? (
                                      <img src={track.track_artwork_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <i className="ri-music-line text-[10px] text-[#c5ccba]" />
                                      </div>
                                    )}
                                  </div>

                                  {/* Title + featured */}
                                  <div className="flex-1 min-w-0">
                                    <a
                                      href={`/admin/registry/tracks/${track.track_slug}`}
                                      className="text-[12px] font-extrabold text-[#171712] hover:text-[#5f8f2f] transition-colors truncate block"
                                    >
                                      {track.track_title}
                                    </a>
                                    {featured.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-x-1 mt-0.5">
                                        <span className="text-[9px] text-[#9aa292]">ft.</span>
                                        {featured.map((fa, i) => (
                                          <a
                                            key={fa.artist_id}
                                            href={`/admin/registry/artists/${fa.artist_slug}`}
                                            className="text-[10px] font-medium text-[#697062] hover:text-[#5f8f2f] transition-colors"
                                          >
                                            {fa.artist_name_text}{i < featured.length - 1 ? "," : ""}
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Duration */}
                                  <span className="text-[10px] font-semibold text-[#9aa292] tabular-nums shrink-0">
                                    {formatDurationMs(track.duration_ms)}
                                  </span>

                                  {/* Status */}
                                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                                    track.track_status === "active" ? "bg-emerald-50 text-emerald-700" :
                                    track.track_status === "draft" ? "bg-amber-50 text-amber-700" :
                                    "bg-gray-100 text-gray-500"
                                  }`}>
                                    {track.track_status}
                                  </span>
                                </div>
                              );
                            })}

                            {richData.tracks.length > 20 && (
                              <div className="px-4 py-2.5 text-center">
                                <p className="text-[10px] font-semibold text-[#9aa292]">
                                  +{richData.tracks.length - 20} more tracks ·{" "}
                                  <a
                                    href={`/admin/registry/releases/${entity.slug || entity.id}`}
                                    className="text-[#5f8f2f] hover:underline"
                                  >
                                    View full detail page
                                  </a>
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="shrink-0 border-t border-[#e8ece2] bg-[#fbfcf8] px-5 py-4 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#697062]">
              {hasChanges
                ? `${dirtyFields.length} field${dirtyFields.length > 1 ? "s" : ""} changed. Save to persist.`
                : "No changes to save."}
            </p>
            <div className="flex gap-2">
              {hasChanges && (
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="flex items-center gap-1.5 rounded-xl border border-[#dfe4d8] bg-white px-4 py-2.5 text-sm font-black text-[#171712] hover:border-[#85c441] hover:text-[#5f8f2f] transition-all whitespace-nowrap"
                >
                  <i className="ri-arrow-go-back-line" />
                  Discard
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasChanges || hasValidationErrors}
                className="flex items-center gap-1.5 rounded-xl bg-[#85c441] px-5 py-2.5 text-sm font-black text-[#102006] shadow-sm transition-all hover:bg-[#76b33a] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none whitespace-nowrap"
              >
                {saving ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" />
                    Saving…
                  </>
                ) : hasChanges ? (
                  <>
                    <i className="ri-save-line" />
                    Save {dirtyFields.length} change{dirtyFields.length > 1 ? "s" : ""}
                  </>
                ) : (
                  <>
                    <i className="ri-check-line" />
                    Saved
                  </>
                )}
              </button>
            </div>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function ProviderMetadataChips({ metadata }: { metadata: Record<string, unknown> }) {
  const chips: Array<{ icon: string; label: string; value: string }> = [];

  const source = metadata.source || metadata.provider || metadata.provider_name;
  if (source && typeof source === "string") {
    chips.push({ icon: "ri-cloud-line", label: "Source", value: source });
  }

  if (metadata.provider_url && typeof metadata.provider_url === "string") {
    chips.push({ icon: "ri-link", label: "Provider URL", value: metadata.provider_url });
  }

  const genres = metadata.genres || metadata.genre_names;
  if (Array.isArray(genres) && genres.length > 0) {
    chips.push({ icon: "ri-price-tag-3-line", label: "Genres", value: genres.join(", ") });
  } else if (genres && typeof genres === "string") {
    chips.push({ icon: "ri-price-tag-3-line", label: "Genres", value: genres });
  }

  if (metadata.upc && typeof metadata.upc === "string") {
    chips.push({ icon: "ri-barcode-line", label: "UPC", value: metadata.upc });
  }

  if (chips.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#dfe4d8] bg-[#fbfcf8] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-[#71796b] mb-2">
        Provider Metadata
      </p>
      <div className="space-y-1.5">
        {chips.map((chip) => (
          <div key={chip.label} className="flex items-start gap-2">
            <i className={`${chip.icon} text-[10px] text-[#9aa292] mt-0.5 shrink-0`} />
            <div className="min-w-0">
              <span className="text-[9px] font-bold uppercase text-[#9aa292]">{chip.label}</span>
              <p className="text-[11px] text-[#5d6557] truncate">{chip.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldCard({
  field,
  value,
  onChange,
  displayName,
  isDirty,
  error,
}: {
  field: RegistryFieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  displayName: string;
  isDirty: boolean;
  error?: string;
}) {
  const strValue = value === null || value === undefined ? "" : String(value);
  const fieldId = `field-${field.key}`;

  const renderInput = () => {
    if (field.type === "textarea") {
      return (
        <div className="relative">
          <textarea
            id={fieldId}
            value={strValue}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className={`w-full rounded-xl border bg-[#f8f9f4] px-3 py-3 text-sm outline-none transition-all resize-y min-h-[88px] focus:bg-white ${
              error
                ? "border-red-400 focus:border-red-500"
                : isDirty
                  ? "border-amber-300 focus:border-[#85c441]"
                  : "border-[#dfe4d8] focus:border-[#85c441]"
            }`}
          />
          {isDirty && !error && (
            <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            </span>
          )}
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <div className="relative">
          <select
            id={fieldId}
            value={strValue}
            onChange={(e) => onChange(e.target.value)}
            className={`h-11 w-full appearance-none rounded-xl border bg-[#f8f9f4] pl-3 pr-9 text-sm outline-none transition-all focus:bg-white ${
              error
                ? "border-red-400 focus:border-red-500"
                : isDirty
                  ? "border-amber-300 focus:border-[#85c441]"
                  : "border-[#dfe4d8] focus:border-[#85c441]"
            }`}
          >
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa292] pointer-events-none" />
        </div>
      );
    }

    if (field.type === "boolean") {
      return (
        <label
          htmlFor={fieldId}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className={`relative flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            value ? "bg-[#85c441]" : "bg-[#d9ddcf]"
          }`}>
            <div
              className={`absolute h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                value ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </div>
          <input
            id={fieldId}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only"
          />
          <span className="text-sm font-semibold text-[#2d3329] group-hover:text-[#171712]">
            {value ? "Yes" : "No"}
          </span>
        </label>
      );
    }

    if (field.type === "slug") {
      return (
        <div className="flex gap-2">
          <input
            id={fieldId}
            value={strValue}
            onChange={(e) => onChange(e.target.value)}
            className={`h-11 flex-1 rounded-xl border bg-[#f8f9f4] px-3 text-sm font-mono outline-none transition-all focus:bg-white ${
              error
                ? "border-red-400 focus:border-red-500"
                : isDirty
                  ? "border-amber-300 focus:border-[#85c441]"
                  : "border-[#dfe4d8] focus:border-[#85c441]"
            }`}
          />
          <button
            type="button"
            onClick={() => onChange(normalizeSlug(displayName))}
            className="flex items-center gap-1 rounded-xl border border-[#dfe4d8] bg-white px-3 text-xs font-black text-[#5d6557] hover:border-[#85c441] hover:text-[#5f8f2f] transition-all whitespace-nowrap"
          >
            <i className="ri-sparkling-line" />
            Generate
          </button>
        </div>
      );
    }

    return (
      <div className="relative">
        <input
          id={fieldId}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          className={`h-11 w-full rounded-xl border bg-[#f8f9f4] px-3 text-sm outline-none transition-all focus:bg-white ${
            field.type === "url" || field.type === "text"
              ? "font-mono"
              : ""
          } ${
            error
              ? "border-red-400 focus:border-red-500"
              : isDirty
                ? "border-amber-300 focus:border-[#85c441]"
                : "border-[#dfe4d8] focus:border-[#85c441]"
          }`}
        />
        {isDirty && !error && (
          <span className="absolute top-1/2 right-2.5 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          </span>
        )}
      </div>
    );
  };

  return (
    <div>
      <label htmlFor={fieldId} className="grid gap-1.5">
        <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-[#71796b]">
          {field.label}
          {field.required && (
            <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-red-100 text-[9px] font-black text-red-600">
              *
            </span>
          )}
        </span>
        {renderInput()}
      </label>
      {field.helpText && (
        <p className="mt-1.5 text-[11px] text-[#858c7e]">{field.helpText}</p>
      )}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-red-600">
          <i className="ri-error-warning-fill text-xs" />
          {error}
        </p>
      )}
    </div>
  );
}