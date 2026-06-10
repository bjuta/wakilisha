import { type RegistryFieldSchema } from "./types";

export function normalizeForSave(value: unknown, field: RegistryFieldSchema): unknown {
  if (value === null || value === undefined) return null;

  const str = String(value);

  switch (field.normalizer) {
    case "trim":
      return str.trim() || null;
    case "uppercase":
      return str.trim().toUpperCase() || null;
    case "slug":
      return normalizeSlug(str) || null;
    case "tags": {
      const tags = str
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      return tags.length > 0 ? tags : null;
    }
    default: {
      if (field.type === "number") {
        const num = Number(str);
        return Number.isNaN(num) ? null : num;
      }
      if (field.type === "boolean") {
        return Boolean(value);
      }
      if (field.type === "date") {
        const date = new Date(str);
        return Number.isNaN(date.getTime()) ? null : str.trim();
      }
      return str.trim() || null;
    }
  }
}

export function normalizeForCompare(value: unknown, field: RegistryFieldSchema): unknown {
  const normalized = normalizeForSave(value, field);
  if (normalized === null) return null;

  if (field.type === "number") return normalized;
  if (field.type === "boolean") return normalized;

  return String(normalized);
}

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function deepEqual(a: unknown, b: unknown): boolean {
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

export function validateField(value: unknown, field: RegistryFieldSchema): string | null {
  const normalized = normalizeForSave(value, field);

  if (field.required && (normalized === null || normalized === "" || (Array.isArray(normalized) && normalized.length === 0))) {
    return `${field.label} is required.`;
  }

  if (normalized === null) return null;

  if (field.type === "url") {
    const str = String(normalized);
    if (!str.startsWith("https://")) {
      return `${field.label} must start with https://`;
    }
  }

  if (field.type === "slug") {
    const str = String(normalized);
    if (/[^a-z0-9-]/.test(str)) {
      return `${field.label} may only contain lowercase letters, numbers, and hyphens.`;
    }
  }

  if (field.key === "origin_iso2" || field.key === "iso2") {
    const str = String(normalized);
    if (str.length !== 2) {
      return `${field.label} must be exactly two letters.`;
    }
  }

  if (field.type === "number") {
    const num = Number(normalized);
    if (Number.isNaN(num)) {
      return `${field.label} must be a valid number.`;
    }
  }

  if (field.type === "select" && field.options && !field.options.includes(String(normalized))) {
    return `${field.label} must be one of: ${field.options.join(", ")}`;
  }

  return null;
}