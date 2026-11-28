import { useMemo, useState, useCallback, useEffect } from "react";
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
import { WkTextField } from "@/components/design-system/primitives/Field";
import { WkButton } from "@/components/design-system/primitives/Button";
import { RegistryChoiceField } from "./RegistryChoiceField";
import { WakilishaToggle } from "@/components/design-system/primitives/WakilishaToggle";
import { Sheet } from "@/components/design-system/primitives/Sheet";
import { WkNumberField } from "@/components/design-system/primitives/NumberField";
import { WkDatePicker } from "@/components/design-system/primitives/DateTimePicker";


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
    "country_code",
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
  "Living Memory": [
    "living_memory_editorial_opener",
    "living_memory_public_prompt",
    "living_memory_editorial_label",
    "living_memory_status",
  ],
  Publishing: ["status"],
};

const SHORT_FIELD_TYPES = new Set(["text", "select", "number", "date", "boolean"]);

const LIVING_MEMORY_ENTITY_TYPES = new Set<RegistryEntityType>([
  "artist",
  "release",
  "track",
]);

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
  const navigate = useNavigate();

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
          .eq("status", "active")
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

  const activeReleaseTracks =
    richData?.tracks.filter((track) => track.track_status === "active") ?? [];
  const primaryReleaseArtist =
    richData?.releaseArtists.find((artist) => artist.is_primary) ||
    richData?.releaseArtists[0] ||
    null;
  const singlePublicTrack =
    activeReleaseTracks.length === 1 ? activeReleaseTracks[0] : null;
  const singlePublicTrackArtist =
    singlePublicTrack
      ? richData?.trackArtists.find(
          (credit) =>
            credit.track_id === singlePublicTrack.track_id &&
            credit.is_primary,
        ) || null
      : null;
  const releasePublicUrl =
    entityType === "release" && entity.slug && richData
      ? releaseUrl({
          slug: String(entity.slug),
          artist:
            primaryReleaseArtist?.artist_name_text ||
            String(entity.display_name || entity.title || ""),
          artistSlug: primaryReleaseArtist?.artist_slug || undefined,
          releaseType: String(entity.release_type || ""),
          trackCount: activeReleaseTracks.length,
          singleTrackSlug: singlePublicTrack?.track_slug || null,
          singleTrackArtistSlug:
            singlePublicTrackArtist?.artist_slug ||
            primaryReleaseArtist?.artist_slug ||
            null,
        })
      : "";

  const dirtyFields = useMemo(() => {
    const result = buildChangesPayload(entity, draft, schema);
    return result.savedFields.map((f) => f.key);
  }, [entity, draft, schema]);

  const hasChanges = dirtyFields.length > 0;

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

          if (
            key === "living_memory_status" &&
            value !== "published"
          ) {
            delete next.living_memory_editorial_opener;
            delete next.living_memory_public_prompt;
            delete next.living_memory_editorial_label;
          }

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

    if (
      LIVING_MEMORY_ENTITY_TYPES.has(entityType) &&
      draft.living_memory_status === "published"
    ) {
      const requiredLivingMemoryFields = [
        ["living_memory_editorial_opener", "Editorial opener"],
        ["living_memory_public_prompt", "Public prompt"],
        ["living_memory_editorial_label", "Editorial disclosure"],
      ] as const;

      for (const [key, label] of requiredLivingMemoryFields) {
        if (!String(draft[key] ?? "").trim()) {
          errors[key] = `${label} is required before publishing.`;
        }
      }
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
    : "Not set";

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
        ? "border-wk-warning bg-wk-warning-soft text-wk-warning"
        : "border-wk-success bg-wk-success-soft text-wk-success";
    }
    if (saveResult.errorCode === "stale_update") {
      return "border-wk-warning bg-wk-warning-soft text-wk-warning";
    }
    if (saveResult.errorCode === "duplicate_key") {
      return "border-wk-danger bg-wk-danger-soft text-wk-danger";
    }
    return "border-wk-danger bg-wk-danger-soft text-wk-danger";
  };

  const footer = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-wk-text-muted">
        {hasChanges
          ? `${dirtyFields.length} field${dirtyFields.length > 1 ? "s" : ""} changed. Save to persist.`
          : "No changes to save."}
      </p>
      <div className="flex gap-2">
        {hasChanges ? (
          <button
            type="button"
            onClick={handleDiscard}
            className="flex items-center gap-1.5 rounded-xl border border-wk-border bg-wk-surface px-4 py-2.5 text-sm font-black text-wk-text hover:border-wk-brand hover:text-wk-brand transition-all whitespace-nowrap"
          >
            <i className="ri-arrow-go-back-line" />
            Discard
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex items-center gap-1.5 rounded-xl bg-wk-brand px-5 py-2.5 text-sm font-black text-wk-brand-on shadow-sm transition-all hover:opacity-90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none whitespace-nowrap"
        >
          {saving ? (
            <>
              <i className="ri-loader-4-line animate-spin" />
              Saving...
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
  );

  return (
    <Sheet
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      title={`Edit ${entityType}`}
      side="right"
      maxWidth="2xl"
      dismissable={!saving}
      footer={footer}
      bodyClassName="!p-0"
    >
      <div data-wk-registry-editor-header className="border-b border-wk-divider bg-wk-surface px-5 py-4 sm:px-6 sm:py-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-wk-brand bg-wk-brand-soft px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-wk-brand">
            <i className="ri-database-2-line text-xs" />
            {entityType}
          </span>
          {hasChanges ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-wk-warning bg-wk-warning-soft px-2 py-1 text-[10px] font-black uppercase tracking-wider text-wk-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-wk-warning animate-pulse" />
              Unsaved
            </span>
          ) : null}
        </div>
        <h2 className="truncate text-xl font-black tracking-tight text-wk-text sm:text-2xl">
          {displayName}
        </h2>
        <p className="mt-1 truncate font-mono text-[11px] text-wk-text-muted">
          {String(entity[schema.idField] ?? "")}
        </p>
      </div>
      <div className="px-5 py-5 sm:px-6">

            {/* Quality summary */}
            <div data-wk-registry-editor-metrics className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-6">
              <div className="rounded-2xl border border-wk-border bg-wk-surface px-4 py-3.5 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-wk-brand" />
                <div className="flex items-center gap-2 mb-1">
                  <i className="ri-pie-chart-2-fill text-wk-brand text-sm" />
                  <p className="text-[10px] font-black uppercase tracking-wide text-wk-text-muted">Complete</p>
                </div>
                <p className="text-2xl font-black text-wk-text">{quality.completeness}%</p>
              </div>
              <div className="rounded-2xl border border-wk-border bg-wk-surface px-4 py-3.5 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-wk-warning" />
                <div className="flex items-center gap-2 mb-1">
                  <i className="ri-alert-fill text-wk-warning text-sm" />
                  <p className="text-[10px] font-black uppercase tracking-wide text-wk-text-muted">Missing</p>
                </div>
                <p className="text-2xl font-black text-wk-text">{quality.missingFields.length}</p>
              </div>
              <div className="rounded-2xl border border-wk-border bg-wk-surface px-4 py-3.5 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-wk-success" />
                <div className="flex items-center gap-2 mb-1">
                  <i className="ri-flag-fill text-wk-success text-sm" />
                  <p className="text-[10px] font-black uppercase tracking-wide text-wk-text-muted">Status</p>
                </div>
                <p className="text-lg font-black text-wk-text truncate">
                  {String(draft.status ?? "active")}
                </p>
              </div>
              <div className="rounded-2xl border border-wk-border bg-wk-surface px-4 py-3.5 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-wk-border-strong" />
                <div className="flex items-center gap-2 mb-1">
                  <i className="ri-time-fill text-wk-text-muted text-sm" />
                  <p className="text-[10px] font-black uppercase tracking-wide text-wk-text-muted">Updated</p>
                </div>
                <p className="text-xs font-bold text-wk-text-muted">{updatedAt}</p>
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
                  <span className="text-xs text-wk-text-muted">
                    Missing: {quality.missingFields.join(", ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-36">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-wk-surface-strong">
                  <div
                    className="h-full rounded-full bg-wk-brand transition-all duration-500"
                    style={{ width: `${quality.completeness}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-wk-text-muted tabular-nums w-8 text-right">
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
                            className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-wk-warning bg-wk-surface px-4 py-2 text-xs font-black text-wk-warning hover:border-wk-warning transition-colors"
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
                          <div className="mt-2 rounded-xl border border-wk-danger bg-wk-surface px-3 py-2.5">
                            <p className="text-[11px] font-bold text-wk-text-muted">
                              Conflicting {entityType}
                            </p>
                            <p className="text-sm font-bold text-wk-text">
                              {String(saveResult.conflictingEntity.title ?? "Unknown")}
                            </p>
                            {saveResult.conflictingEntity.slug && (
                              <p className="text-xs font-mono text-wk-text-muted">
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
                                className="inline-flex items-center gap-1 rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-xs font-bold text-wk-text hover:border-wk-brand transition-colors"
                              >
                                <i className="ri-external-link-line" />
                                View existing
                              </button>
                              <button
                                type="button"
                                onClick={handleGenerateNewSlug}
                                className="inline-flex items-center gap-1 rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-xs font-bold text-wk-text hover:border-wk-brand transition-colors"
                              >
                                <i className="ri-sparkling-line" />
                                Generate new slug
                              </button>
                              <button
                                type="button"
                                onClick={() => setSaveResult(null)}
                                className="inline-flex items-center gap-1 rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-xs font-bold text-wk-text-muted hover:border-wk-brand transition-colors"
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
                      <span className="h-4 w-1 rounded-full bg-wk-brand" />
                      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-wk-text-muted">
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
              <div className="mt-8 border-t border-wk-divider pt-6">
                <button
                  type="button"
                  onClick={() => setShowSystemFields(!showSystemFields)}
                  className="flex w-full items-center justify-between group"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-wk-border-strong" />
                    <span className="text-[11px] font-black uppercase tracking-[0.12em] text-wk-text-muted">
                      System fields
                    </span>
                    <span className="rounded-full bg-wk-surface-strong px-1.5 py-0.5 text-[9px] font-bold text-wk-text-muted">
                      {schema.readonlyFields.length}
                    </span>
                  </span>
                  <i
                    className={`ri-arrow-down-s-line text-wk-text-muted transition-transform duration-200 ${
                      showSystemFields ? "rotate-180" : ""
                    } group-hover:text-wk-text-muted`}
                  />
                </button>

                {showSystemFields && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 animate-[slideIn_200ms_ease-out]">
                    {schema.readonlyFields.map((field) => (
                      <div key={field.key}>
                        <label className="grid gap-1">
                          <span className="text-[10px] font-black uppercase tracking-wide text-wk-text-muted">
                            {field.label}
                          </span>
                          <div className="flex h-10 items-center rounded-xl border border-wk-border bg-wk-surface-raised px-3">
                            <span className="truncate font-mono text-xs text-wk-text-muted">
                              {field.type === "date" && entity[field.key]
                                ? new Intl.DateTimeFormat("en-GB", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  }).format(new Date(String(entity[field.key])))
                                : String(entity[field.key] ?? "Not set")}
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
              <div className="mt-8 border-t border-wk-divider pt-6">
                <button
                  type="button"
                  onClick={() => setShowRichPanel(!showRichPanel)}
                  className="flex w-full items-center justify-between group"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-wk-brand" />
                    <span className="text-[11px] font-black uppercase tracking-[0.12em] text-wk-text-muted">
                      Release Content
                    </span>
                    {richData && (
                      <span className="rounded-full bg-wk-brand-soft px-1.5 py-0.5 text-[9px] font-bold text-wk-brand">
                        {richData.tracks.length} tracks
                      </span>
                    )}
                  </span>
                  <i
                    className={`ri-arrow-down-s-line text-wk-text-muted transition-transform duration-200 ${
                      showRichPanel ? "rotate-180" : ""
                    } group-hover:text-wk-text-muted`}
                  />
                </button>

                {showRichPanel && (
                  <div className="mt-4 space-y-4 animate-[slideIn_200ms_ease-out]">
                    {richDataLoading && (
                      <div className="flex items-center gap-2 text-xs text-wk-text-muted">
                        <i className="ri-loader-4-line animate-spin" />
                        Loading tracks and artists…
                      </div>
                    )}

                    {!richDataLoading && !richData && (
                      <p className="text-xs text-wk-text-muted">No track data available.</p>
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
                              className="h-16 w-16 shrink-0 rounded-xl object-cover border border-wk-border"
                            />
                          ) : (
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-wk-border bg-wk-surface-raised text-xs font-black text-wk-text-muted">
                              <i className="ri-album-line text-lg" />
                            </div>
                          )}

                          <div className="min-w-0 space-y-1">
                            {/* Release type + date */}
                            <div className="flex items-center gap-2">
                              {entity.release_type && (
                                <span className="inline-flex items-center rounded-full bg-wk-brand-soft px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-wk-brand">
                                  {String(entity.release_type)}
                                </span>
                              )}
                              {entity.release_date && (
                                <span className="text-[10px] font-semibold text-wk-text-muted">
                                  {String(entity.release_date)}
                                </span>
                              )}
                            </div>

                            {/* Label */}
                            {richData.label && (
                              <div className="flex items-center gap-1.5">
                                <i className="ri-building-2-line text-[10px] text-wk-text-muted" />
                                <a
                                  href={`/admin/registry/labels/${richData.label.slug}`}
                                  className="text-xs font-bold text-wk-text hover:text-wk-brand transition-colors truncate"
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
                                  <i className="ri-user-line text-[10px] text-wk-text-muted" />
                                  <a
                                    href={`/admin/registry/artists/${primary.artist_slug}`}
                                    className="text-xs font-bold text-wk-text hover:text-wk-brand transition-colors truncate"
                                  >
                                    {primary.artist_name_text}
                                  </a>
                                </div>
                              );
                            })()}

                            {/* Track count + total duration */}
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-wk-text-muted">
                                <i className="ri-list-check text-xs" />
                                {richData.tracks.length} track{richData.tracks.length !== 1 ? "s" : ""}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-wk-text-muted">
                                <i className="ri-timer-line text-xs" />
                                {formatDurationMs(richData.tracks.reduce((sum, t) => sum + t.duration_ms, 0))}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* View public page + detail page links */}
                        <div className="flex flex-wrap items-center gap-2">
                          {releasePublicUrl && releasePublicUrl !== "/releases" && (
                            <a
                              href={releasePublicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-wk-border bg-wk-surface px-3 py-2 text-[11px] font-bold text-wk-text hover:border-wk-brand hover:text-wk-brand transition-colors"
                            >
                              <i className="ri-external-link-line text-xs" />
                              View Public Page
                            </a>
                          )}
                          <a
                            href={`/admin/registry/releases/${entity.slug || entity.id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-wk-border bg-wk-surface px-3 py-2 text-[11px] font-bold text-wk-text hover:border-wk-brand hover:text-wk-brand transition-colors"
                          >
                            <i className="ri-file-list-3-line text-xs" />
                            Full Detail Page
                          </a>
                        </div>

                        {/* Description / NLG excerpt */}
                        {entity.description && (
                          <div className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-wide text-wk-text-muted mb-1.5">
                              Description
                            </p>
                            <p className="text-xs text-wk-text-muted leading-relaxed line-clamp-4">
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
                          <div className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-wide text-wk-text-muted mb-2">
                              Featured Artists
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {richData.releaseArtists
                                .filter((ra) => !ra.is_primary)
                                .map((ra) => (
                                  <a
                                    key={ra.artist_id}
                                    href={`/admin/registry/artists/${ra.artist_slug}`}
                                    className="inline-flex items-center gap-1 rounded-full border border-wk-border bg-wk-surface px-2.5 py-1 text-[11px] font-semibold text-wk-text-soft hover:border-wk-brand hover:text-wk-brand transition-colors"
                                  >
                                    {ra.artist_name_text}
                                    <span className="text-[9px] text-wk-text-muted">{ra.role}</span>
                                  </a>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Mini tracklist */}
                        <div className="rounded-xl border border-wk-border overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-wk-surface border-b border-wk-divider">
                            <i className="ri-list-ordered text-xs text-wk-text-muted" />
                            <span className="text-[10px] font-black uppercase tracking-wide text-wk-text-muted">
                              Tracklist
                            </span>
                          </div>
                          <div className="divide-y divide-wk-divider">
                            {richData.tracks.slice(0, 20).map((track) => {
                              const featured = getFeaturedForTrack(track.track_id, richData.trackArtists);
                              return (
                                <div
                                  key={track.track_id}
                                  className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-wk-surface transition-colors"
                                >
                                  {/* Track number */}
                                  <span className="w-6 text-right text-[10px] font-extrabold text-wk-text-muted tabular-nums shrink-0">
                                    {track.track_number}
                                  </span>

                                  {/* Artwork thumbnail */}
                                  <div className="w-7 h-7 shrink-0 rounded-md overflow-hidden bg-wk-surface-raised border border-wk-border">
                                    {track.track_artwork_url ? (
                                      <img src={track.track_artwork_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <i className="ri-music-line text-[10px] text-wk-text-faint" />
                                      </div>
                                    )}
                                  </div>

                                  {/* Title + featured */}
                                  <div className="flex-1 min-w-0">
                                    <a
                                      href={`/admin/registry/tracks/${track.track_slug}`}
                                      className="text-[12px] font-extrabold text-wk-text hover:text-wk-brand transition-colors truncate block"
                                    >
                                      {track.track_title}
                                    </a>
                                    {featured.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-x-1 mt-0.5">
                                        <span className="text-[9px] text-wk-text-muted">ft.</span>
                                        {featured.map((fa, i) => (
                                          <a
                                            key={fa.artist_id}
                                            href={`/admin/registry/artists/${fa.artist_slug}`}
                                            className="text-[10px] font-medium text-wk-text-muted hover:text-wk-brand transition-colors"
                                          >
                                            {fa.artist_name_text}{i < featured.length - 1 ? "," : ""}
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Duration */}
                                  <span className="text-[10px] font-semibold text-wk-text-muted tabular-nums shrink-0">
                                    {formatDurationMs(track.duration_ms)}
                                  </span>

                                  {/* Status */}
                                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                                    track.track_status === "active" ? "bg-wk-success-soft text-wk-success" :
                                    track.track_status === "draft" ? "bg-wk-warning-soft text-wk-warning" :
                                    "bg-wk-surface-raised text-wk-text-muted"
                                  }`}>
                                    {track.track_status}
                                  </span>
                                </div>
                              );
                            })}

                            {richData.tracks.length > 20 && (
                              <div className="px-4 py-2.5 text-center">
                                <p className="text-[10px] font-semibold text-wk-text-muted">
                                  +{richData.tracks.length - 20} more tracks ·{" "}
                                  <a
                                    href={`/admin/registry/releases/${entity.slug || entity.id}`}
                                    className="text-wk-brand hover:underline"
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
    </Sheet>
  );}

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
    <div className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-wk-text-muted mb-2">
        Provider Metadata
      </p>
      <div className="space-y-1.5">
        {chips.map((chip) => (
          <div key={chip.label} className="flex items-start gap-2">
            <i className={`${chip.icon} text-[10px] text-wk-text-muted mt-0.5 shrink-0`} />
            <div className="min-w-0">
              <span className="text-[9px] font-bold uppercase text-wk-text-muted">{chip.label}</span>
              <p className="text-[11px] text-wk-text-muted truncate">{chip.value}</p>
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
  const renderInput = () => {
    if (field.type === "select") {
      return <RegistryChoiceField field={field} value={value} onChange={onChange} />;
    }
    if (field.type === "boolean") {
      return (
        <div className="flex items-center gap-3">
          <WakilishaToggle value={Boolean(value)} onChange={onChange} size="sm"
            ariaLabel={`Toggle ${field.label}`} />
          <span className="text-sm font-semibold text-wk-text-soft">{value ? "Yes" : "No"}</span>
        </div>
      );
    }
    if (field.type === "number") {
      return <WkNumberField value={strValue} onChange={(next) => onChange(Number.isNaN(next) ? "" : String(next))}
        ariaLabel={field.label} showSteppers={false} />;
    }
    if (field.type === "date") {
      return <WkDatePicker value={strValue} onChange={onChange} label={field.label} showLabel={false} />;
    }
    const control = <WkTextField value={strValue} onChange={onChange} ariaLabel={field.label}
      required={field.required} invalid={Boolean(error)} multiline={field.type === "textarea"} />;
    return field.type === "slug" ? (
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">{control}</div>
        <WkButton variant="ghost" onClick={() => onChange(normalizeSlug(displayName))}>Generate</WkButton>
      </div>
    ) : control;
  };

  return (
    <div data-wk-registry-field={field.key} className="min-w-0">
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-wk-text-muted">
          <span>{field.label}{field.required ? " *" : ""}</span>
          {isDirty && <span className="rounded-full bg-wk-warning-soft px-2 py-0.5 text-[10px] normal-case text-wk-warning">Changed</span>}
        </div>
        {renderInput()}
      </div>
      {field.helpText && <p className="mt-1.5 text-xs text-wk-text-muted">{field.helpText}</p>}
      {error && <p role="alert" className="mt-1.5 text-xs font-semibold text-wk-danger">{error}</p>}
    </div>
  );
}
