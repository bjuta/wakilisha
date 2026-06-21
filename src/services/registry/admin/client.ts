import { supabase } from "@/lib/supabase";
import {
  type RegistryEntityType,
  type RegistrySaveResult,
  type RegistryEntityProfile,
  type RegistryEntitySchema,
} from "./types";
import { getEntitySchema } from "./entitySchemas";
import { normalizeForSave, normalizeForCompare, validateField } from "./fieldNormalization";

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const API_BASE = `${supabaseUrl}/functions/v1/admin-router/registry`;

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function getRegistryEntityList(
  entityType: RegistryEntityType,
  options?: {
    limit?: number;
    orderBy?: string;
    ascending?: boolean;
  },
): Promise<{ data: RegistryEntityProfile[]; error: string | null }> {
  const headers = await getAuthHeaders();
  if (!headers) return { data: [], error: "Not authenticated" };

  const limit = options?.limit ?? 250;
  const orderBy = options?.orderBy ?? "updated_at";
  const ascending = options?.ascending ?? false;

  const params = new URLSearchParams({
    entityType,
    limit: String(limit),
    orderBy,
    ascending: String(ascending),
  });

  try {
    const res = await fetch(`${API_BASE}/entities?${params}`, { headers });
    const json = await res.json();

    if (!json.ok) return { data: [], error: json.error ?? "Request failed" };
    return { data: (json.data ?? []) as RegistryEntityProfile[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function getRegistryEntityProfile(
  entityType: RegistryEntityType,
  entityId: string,
): Promise<{ data: RegistryEntityProfile | null; error: string | null }> {
  const headers = await getAuthHeaders();
  if (!headers) return { data: null, error: "Not authenticated" };

  try {
    const res = await fetch(`${API_BASE}/entities/${entityType}/${entityId}`, { headers });
    const json = await res.json();

    if (!json.ok) return { data: null, error: json.error ?? "Request failed" };
    return { data: json.data as RegistryEntityProfile | null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Network error" };
  }
}

export function buildChangesPayload(
  original: Record<string, unknown>,
  draft: Record<string, unknown>,
  schema: RegistryEntitySchema,
): {
  changes: Record<string, unknown>;
  savedFields: Array<{ key: string; label: string; previousValue: unknown; nextValue: unknown }>;
  skippedFields: Array<{ key: string; label: string; reason: string }>;
  validationErrors: Array<{ key: string; label: string; message: string }>;
} {
  const changes: Record<string, unknown> = {};
  const savedFields: Array<{ key: string; label: string; previousValue: unknown; nextValue: unknown }> = [];
  const skippedFields: Array<{ key: string; label: string; reason: string }> = [];
  const validationErrors: Array<{ key: string; label: string; message: string }> = [];

  const writableFields = schema.editableFields.filter((f) => f.access === "editable");

  for (const field of writableFields) {
    const originalValue = normalizeForCompare(original[field.key], field);
    const draftValue = normalizeForCompare(draft[field.key], field);

    const validationError = validateField(draft[field.key], field);
    if (validationError) {
      validationErrors.push({ key: field.key, label: field.label, message: validationError });
      continue;
    }

    if (!deepEqual(originalValue, draftValue)) {
      const nextValue = normalizeForSave(draft[field.key], field);
      changes[field.key] = nextValue;
      savedFields.push({
        key: field.key,
        label: field.label,
        previousValue: original[field.key],
        nextValue,
      });
    }
  }

  // Detect unsupported fields in draft that aren't in schema
  const schemaKeys = new Set([...schema.editableFields.map((f) => f.key), ...schema.readonlyFields.map((f) => f.key)]);
  for (const key of Object.keys(draft)) {
    if (!schemaKeys.has(key)) {
      skippedFields.push({ key, label: key, reason: "Field is not supported by this entity schema" });
    }
  }

  return { changes, savedFields, skippedFields, validationErrors };
}

export async function saveRegistryEntityPatch(
  entityType: RegistryEntityType,
  entityId: string,
  patch: Record<string, unknown>,
  expectedUpdatedAt?: string,
  schemaOverride?: RegistryEntitySchema,
): Promise<RegistrySaveResult> {
  const headers = await getAuthHeaders();
  if (!headers) {
    return {
      ok: false,
      entityType,
      entityId,
      savedFields: [],
      skippedFields: [],
      rejectedFields: [],
      warnings: [],
      errorCode: "not_authenticated",
      message: "Not authenticated",
    };
  }

  const schema = schemaOverride ?? getEntitySchema(entityType);

  // Validate patch keys against schema
  const validKeys = schema.editableFields.filter((f) => f.access === "editable").map((f) => f.key);
  const safePatch: Record<string, unknown> = {};
  const skippedFields: Array<{ key: string; label: string; reason: string }> = [];
  const rejectedFields: Array<{ key: string; label: string; reason: string }> = [];

  for (const [key, value] of Object.entries(patch)) {
    if (!validKeys.includes(key)) {
      const fieldDef = schema.readonlyFields.find((f) => f.key === key);
      skippedFields.push({
        key,
        label: fieldDef?.label ?? key,
        reason: "Field is not editable or does not exist in schema",
      });
      continue;
    }

    const fieldDef = schema.editableFields.find((f) => f.key === key);
    if (fieldDef) {
      const validationError = validateField(value, fieldDef);
      if (validationError) {
        rejectedFields.push({ key, label: fieldDef.label, reason: validationError });
        continue;
      }
      safePatch[key] = normalizeForSave(value, fieldDef);
    }
  }

  if (Object.keys(safePatch).length === 0) {
    return {
      ok: true,
      entityType,
      entityId,
      savedFields: [],
      skippedFields,
      rejectedFields,
      warnings: skippedFields.length > 0 ? [`${skippedFields.length} unsupported field(s) were not saved`] : [],
    };
  }

  try {
    const payload: Record<string, unknown> = { ...safePatch };
    if (expectedUpdatedAt) {
      payload._expected_updated_at = expectedUpdatedAt;
    }

    const res = await fetch(`${API_BASE}/entities/${entityType}/${entityId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });

    const result: RegistrySaveResult & { error?: string; errorCode?: string; message?: string; duplicateField?: string | null; duplicateValue?: string | null; conflictingEntity?: Record<string, unknown> | null; currentEntity?: Record<string, unknown> } = await res.json();

    if (!result.ok) {
      return {
        ok: false,
        entityType,
        entityId,
        savedFields: [],
        skippedFields,
        rejectedFields,
        warnings: [],
        errorCode: result.errorCode ?? "save_failed",
        message: result.message ?? result.error ?? "Save failed",
        duplicateField: result.duplicateField ?? null,
        duplicateValue: result.duplicateValue ?? null,
        conflictingEntity: result.conflictingEntity ?? null,
        currentEntity: result.currentEntity,
      };
    }

    return {
      ...result,
      skippedFields: [...skippedFields, ...(result.skippedFields ?? [])],
      rejectedFields,
    };
  } catch (err) {
    return {
      ok: false,
      entityType,
      entityId,
      savedFields: [],
      skippedFields,
      rejectedFields,
      warnings: [],
      errorCode: "network_error",
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function deleteRegistryEntity(
  entityType: RegistryEntityType,
  entityId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const headers = await getAuthHeaders();
  if (!headers) return { ok: false, error: "Not authenticated" };

  try {
    const res = await fetch(`${API_BASE}/entities/${entityType}/${entityId}`, {
      method: "DELETE",
      headers,
    });
    const json = await res.json();

    if (!json.ok) {
      const errMsg = json.error?.message ?? json.error ?? "Delete failed";
      return { ok: false, error: errMsg };
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
  }

  return false;
}