import { useMemo, useState, useCallback } from "react";
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

  const displayName = String(entity[schema.displayNameField] ?? "Untitled");
  const quality = useMemo(() => calculateCompleteness(entity, schema), [entity, schema]);

  const dirtyFields = useMemo(() => {
    const result = buildChangesPayload(entity, draft, schema);
    return result.savedFields.map((f) => f.key);
  }, [entity, draft, schema]);

  const hasChanges = dirtyFields.length > 0;
  const hasValidationErrors = Object.keys(validationErrors).length > 0;

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

    // Final validation
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <button type="button" aria-label="Close editor" onClick={onClose} className="absolute inset-0 cursor-default" />

      <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        <header className="border-b border-[#e8ece2] bg-[#fbfcf8] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">
                Backend {entityType} profile
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">{displayName}</h2>
              <p className="mt-1 font-mono text-xs text-[#858c7e]">{String(entity[schema.idField] ?? "")}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 text-xs font-black text-[#171712] hover:border-[#85c441]"
            >
              Close
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Quality summary */}
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#dfe4d8] bg-[#fbfcf8] p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Completeness</p>
              <p className="mt-1 text-2xl font-black">{quality.completeness}%</p>
            </div>
            <div className="rounded-2xl border border-[#dfe4d8] bg-[#fbfcf8] p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Missing</p>
              <p className="mt-1 text-2xl font-black">{quality.missingFields.length}</p>
            </div>
            <div className="rounded-2xl border border-[#dfe4d8] bg-[#fbfcf8] p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Status</p>
              <p className="mt-1 text-lg font-black">{String(draft.status ?? "active")}</p>
            </div>
          </div>

          {/* Quality state */}
          <div className="mb-5 flex items-center gap-3">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${completenessTone(quality.completeness)}`}>
              {completenessLabel(quality.state)}
            </span>
            {quality.missingFields.length > 0 && (
              <span className="text-xs text-[#8a9283]">
                Missing: {quality.missingFields.join(", ")}
              </span>
            )}
          </div>

          {/* Unsaved changes */}
          {hasChanges && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-800">
                {dirtyFields.length} unsaved change{dirtyFields.length > 1 ? "s" : ""}
              </p>
              <p className="mt-1 text-xs text-amber-700">
                {dirtyFields.map((key) => {
                  const field = schema.editableFields.find((f) => f.key === key);
                  return field?.label ?? key;
                }).join(", ")}
              </p>
            </div>
          )}

          {/* Save result */}
          {saveResult && (
            <div
              className={`mb-5 rounded-xl border p-4 ${
                saveResult.ok
                  ? saveResult.warnings.length > 0
                    ? "border-amber-200 bg-amber-50"
                    : "border-emerald-200 bg-emerald-50"
                  : saveResult.errorCode === "stale_update"
                    ? "border-orange-300 bg-orange-50"
                    : "border-red-200 bg-red-50"
              }`}
            >
              <p className={`text-sm font-bold ${saveResult.ok ? "text-emerald-800" : saveResult.errorCode === "stale_update" ? "text-orange-800" : "text-red-800"}`}>
                {saveResult.ok
                  ? saveResult.savedFields.length > 0
                    ? `Saved ${displayName}`
                    : "No changes to save"
                  : saveResult.errorCode === "stale_update"
                    ? "Someone else edited this record"
                    : saveResult.errorCode === "not_authenticated"
                      ? "Session expired"
                      : saveResult.errorCode === "permission_denied"
                        ? "Permission denied"
                        : "Save failed"}
              </p>
              {saveResult.savedFields.length > 0 && (
                <p className="mt-1 text-xs text-emerald-700">
                  Updated: {saveResult.savedFields.map((f) => f.label).join(", ")}
                </p>
              )}
              {saveResult.warnings.length > 0 && (
                <p className="mt-1 text-xs text-amber-700">{saveResult.warnings.join(" ")}</p>
              )}
              {saveResult.errorCode === "stale_update" && (
                <div className="mt-2">
                  <p className="text-xs text-orange-700">
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
                      className="mt-2 inline-block rounded-xl border border-orange-300 bg-white px-4 py-2 text-xs font-black text-orange-800 hover:border-orange-400"
                    >
                      Load latest version
                    </button>
                  )}
                </div>
              )}
              {saveResult.message && !saveResult.ok && saveResult.errorCode !== "stale_update" && (
                <p className="mt-1 text-xs text-red-700">{saveResult.message}</p>
              )}
              {saveResult.errorCode === "duplicate_key" && (
                <p className="mt-1 text-xs text-red-700">
                  A record with this unique value already exists (e.g. duplicate slug or ISRC).
                </p>
              )}
            </div>
          )}

          {/* Editable fields */}
          <div className="grid gap-4">
            {schema.editableFields.map((field) => (
              <div key={field.key}>
                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase tracking-wide text-[#71796b]">
                    {field.label}
                    {field.required && <span className="ml-1 text-red-500">*</span>}
                  </span>
                  <FieldInput
                    field={field}
                    value={draft[field.key]}
                    onChange={(value) => updateField(field.key, value)}
                    displayName={displayName}
                  />
                </label>
                {field.helpText && (
                  <p className="mt-1 text-xs text-[#858c7e]">{field.helpText}</p>
                )}
                {validationErrors[field.key] && (
                  <p className="mt-1 text-xs font-semibold text-red-600">{validationErrors[field.key]}</p>
                )}
                {dirtyFields.includes(field.key) && (
                  <p className="mt-1 text-xs font-semibold text-amber-600">Unsaved</p>
                )}
              </div>
            ))}
          </div>

          {/* Readonly fields */}
          {schema.readonlyFields.length > 0 && (
            <div className="mt-8 border-t border-[#e8ece2] pt-6">
              <p className="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-[#71796b]">
                System fields
              </p>
              <div className="grid gap-4">
                {schema.readonlyFields.map((field) => (
                  <div key={field.key}>
                    <label className="grid gap-1">
                      <span className="text-xs font-black uppercase tracking-wide text-[#71796b]">
                        {field.label}
                      </span>
                      <input
                        value={String(entity[field.key] ?? "")}
                        readOnly
                        className="h-11 cursor-not-allowed rounded-xl border border-[#dfe4d8] bg-[#f0f3ec] px-3 text-sm text-[#858c7e] outline-none"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-[#e8ece2] bg-[#fbfcf8] px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#697062]">
              {hasChanges
                ? `${dirtyFields.length} field(s) changed. Save to persist.`
                : "No changes to save."}
            </p>
            <div className="flex gap-2">
              {hasChanges && (
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="rounded-xl border border-[#dfe4d8] bg-white px-4 py-2 text-sm font-black text-[#171712] hover:border-[#85c441]"
                >
                  Discard
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasChanges || hasValidationErrors}
                className="rounded-xl bg-[#85c441] px-4 py-2 text-sm font-black text-[#102006] shadow-sm transition hover:bg-[#76b33a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : hasChanges ? `Save ${dirtyFields.length} change${dirtyFields.length > 1 ? "s" : ""}` : "Save"}
              </button>
            </div>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  displayName,
}: {
  field: RegistryFieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  displayName: string;
}) {
  const strValue = value === null || value === undefined ? "" : String(value);

  if (field.type === "textarea") {
    return (
      <textarea
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 py-3 text-sm outline-none focus:border-[#85c441] focus:bg-white"
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none focus:border-[#85c441] focus:bg-white"
      >
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5 rounded border-[#dfe4d8] accent-[#85c441]"
        />
        <span className="text-sm text-[#2d3329]">{value ? "Yes" : "No"}</span>
      </label>
    );
  }

  if (field.type === "slug") {
    return (
      <div className="flex gap-2">
        <input
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 flex-1 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none focus:border-[#85c441] focus:bg-white"
        />
        <button
          type="button"
          onClick={() => onChange(normalizeSlug(displayName))}
          className="rounded-xl border border-[#dfe4d8] bg-white px-3 text-xs font-black hover:border-[#85c441]"
        >
          Generate
        </button>
      </div>
    );
  }

  return (
    <input
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      value={strValue}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none focus:border-[#85c441] focus:bg-white"
    />
  );
}