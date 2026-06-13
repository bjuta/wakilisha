import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

interface RegistryEntityEditorDrawerProps {
  entityType: RegistryEntityType;
  entity: Record<string, unknown>;
  schema: RegistryEntitySchema;
  onClose: () => void;
  onSaved: (updatedEntity: Record<string, unknown>) => void;
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