export type RegistryEntityType = "artist" | "track" | "release" | "label" | "genre";

export type RegistryFieldType =
  | "text"
  | "textarea"
  | "url"
  | "date"
  | "number"
  | "select"
  | "tags"
  | "slug"
  | "boolean";

export type RegistryFieldAccess = "editable" | "readonly" | "hidden";

export interface RegistryFieldSchema {
  key: string;
  label: string;
  type: RegistryFieldType;
  access: RegistryFieldAccess;
  required?: boolean;
  options?: string[];
  helpText?: string;
  aliases?: string[];
  normalizer?: "trim" | "uppercase" | "slug" | "tags";
  qualityWeight?: number;
}

export interface RegistryEntitySchema {
  entityType: RegistryEntityType;
  table: string;
  idField: string;
  displayNameField: string;
  searchFields: string[];
  editableFields: RegistryFieldSchema[];
  readonlyFields: RegistryFieldSchema[];
  qualityFields: string[];
}

export interface RegistryFieldChange {
  key: string;
  label: string;
  previousValue: unknown;
  nextValue: unknown;
}

export interface RegistrySaveResult {
  ok: boolean;
  entityType: RegistryEntityType;
  entityId: string;
  savedFields: RegistryFieldChange[];
  skippedFields: Array<{ key: string; label: string; reason: string }>;
  rejectedFields: Array<{ key: string; label: string; reason: string }>;
  warnings: string[];
  updatedEntity?: Record<string, unknown>;
  errorCode?: string;
  message?: string;
  /** Set when stale_update: the current server-side entity state */
  currentEntity?: Record<string, unknown>;
}

export interface RegistryEntityProfile {
  id: string;
  [key: string]: unknown;
}

export type RegistrySortMode = "recent" | "name" | "completeness_low" | "completeness_high";

export type RegistryQualityState = "complete" | "needs_work" | "poor" | "blocked";

export interface RegistryQualitySummary {
  completeness: number;
  state: RegistryQualityState;
  missingFields: string[];
  presentFields: string[];
}