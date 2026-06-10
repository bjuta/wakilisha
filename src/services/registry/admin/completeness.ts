import { type RegistryEntitySchema, type RegistryQualitySummary, type RegistryQualityState } from "./types";

export function calculateCompleteness(entity: Record<string, unknown>, schema: RegistryEntitySchema): RegistryQualitySummary {
  const fields = schema.qualityFields.filter((key) => {
    const fieldDef = schema.editableFields.find((f) => f.key === key) || schema.readonlyFields.find((f) => f.key === key);
    return fieldDef !== undefined;
  });

  const present: string[] = [];
  const missing: string[] = [];

  for (const key of fields) {
    const fieldDef = schema.editableFields.find((f) => f.key === key) || schema.readonlyFields.find((f) => f.key === key);
    const value = entity[key];
    const label = fieldDef?.label ?? key;

    if (hasMeaningfulValue(value)) {
      present.push(label);
    } else {
      missing.push(label);
    }
  }

  const completeness = fields.length > 0 ? Math.round((present.length / fields.length) * 100) : 0;

  let state: RegistryQualityState;
  if (schema.editableFields.some((f) => f.required && !hasMeaningfulValue(entity[f.key]))) {
    state = "blocked";
  } else if (completeness >= 85) {
    state = "complete";
  } else if (completeness >= 50) {
    state = "needs_work";
  } else {
    state = "poor";
  }

  return { completeness, state, missingFields: missing, presentFields: present };
}

export function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

export function completenessTone(value: number): string {
  if (value >= 85) return "bg-emerald-100 text-emerald-700";
  if (value >= 50) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export function completenessLabel(state: RegistryQualityState): string {
  switch (state) {
    case "complete":
      return "Complete";
    case "needs_work":
      return "Needs work";
    case "poor":
      return "Poor";
    case "blocked":
      return "Blocked";
    default:
      return "Unknown";
  }
}