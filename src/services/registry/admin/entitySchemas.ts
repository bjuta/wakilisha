import {
  type RegistryEntitySchema,
  type RegistryEntityType,
} from "./types";

const LIVING_MEMORY_EDITABLE_FIELDS: RegistryEntitySchema["editableFields"] = [
  {
    key: "living_memory_editorial_opener",
    label: "Editorial opener",
    type: "textarea",
    access: "editable",
    normalizer: "trim",
    helpText: "The WAKILISHA opening frame shown above public contributions.",
  },
  {
    key: "living_memory_public_prompt",
    label: "Public prompt",
    type: "textarea",
    access: "editable",
    normalizer: "trim",
    helpText: "The question shown to readers and used in the contribution composer.",
  },
  {
    key: "living_memory_editorial_label",
    label: "Editorial disclosure",
    type: "textarea",
    access: "editable",
    normalizer: "trim",
    helpText: "Explains what WAKILISHA wrote and what belongs to contributors.",
  },
  {
    key: "living_memory_status",
    label: "Living Memory status",
    type: "select",
    access: "editable",
    options: ["draft", "published", "archived"],
    helpText: "Only published entries appear on public pages.",
  },
];

const LIVING_MEMORY_READONLY_FIELDS: RegistryEntitySchema["readonlyFields"] = [
  {
    key: "living_memory_updated_at",
    label: "Living Memory updated",
    type: "date",
    access: "readonly",
  },
];

export const artistSchema: RegistryEntitySchema = {
  entityType: "artist",
  table: "registry_artists",
  idField: "id",
  displayNameField: "display_name",
  searchFields: ["display_name", "slug", "origin_iso2", "bio", "status", "artist_type"],
  qualityFields: ["display_name", "origin_iso2", "public_image_url", "bio", "status", "artist_type"],
  editableFields: [
    {
      key: "display_name",
      label: "Artist name",
      type: "text",
      access: "editable",
      required: true,
      normalizer: "trim",
    },
    {
      key: "slug",
      label: "Slug",
      type: "slug",
      access: "editable",
      required: true,
      normalizer: "slug",
    },
    {
      key: "sort_name",
      label: "Sort name",
      type: "text",
      access: "editable",
      normalizer: "trim",
      helpText: "Name used for alphabetical sorting.",
    },
    {
      key: "origin_iso2",
      label: "Country code",
      type: "text",
      access: "editable",
      normalizer: "uppercase",
      helpText: "Two-letter ISO code, e.g. KE.",
    },
    {
      key: "bio",
      label: "Bio",
      type: "textarea",
      access: "editable",
    },
    {
      key: "artist_type",
      label: "Artist type",
      type: "text",
      access: "editable",
      normalizer: "trim",
    },
    {
      key: "gender",
      label: "Gender",
      type: "text",
      access: "editable",
      normalizer: "trim",
    },
    {
      key: "public_image_url",
      label: "Image URL",
      type: "url",
      access: "editable",
    },
    ...LIVING_MEMORY_EDITABLE_FIELDS,
    {
      key: "status",
      label: "Status",
      type: "select",
      access: "editable",
      options: ["active", "draft", "needs_review", "archived"],
    },
  ],
  readonlyFields: [
    ...LIVING_MEMORY_READONLY_FIELDS,
    { key: "id", label: "Registry ID", type: "text", access: "readonly" },
    { key: "normalized_name", label: "Normalized name", type: "text", access: "readonly" },
    { key: "origin_confidence", label: "Origin confidence", type: "number", access: "readonly" },
    { key: "image_source_provider", label: "Image source", type: "text", access: "readonly" },
    { key: "created_at", label: "Created", type: "date", access: "readonly" },
    { key: "updated_at", label: "Updated", type: "date", access: "readonly" },
  ],
};

export const trackSchema: RegistryEntitySchema = {
  entityType: "track",
  table: "registry_tracks",
  idField: "id",
  displayNameField: "title",
  searchFields: ["title", "slug", "isrc", "status"],
  qualityFields: ["title", "isrc", "artwork_url", "duration_ms", "status"],
  editableFields: [
    {
      key: "title",
      label: "Track title",
      type: "text",
      access: "editable",
      required: true,
      normalizer: "trim",
    },
    {
      key: "slug",
      label: "Slug",
      type: "slug",
      access: "editable",
      required: true,
      normalizer: "slug",
    },
    {
      key: "isrc",
      label: "ISRC",
      type: "text",
      access: "editable",
      normalizer: "uppercase",
    },
    {
      key: "duration_ms",
      label: "Duration (ms)",
      type: "number",
      access: "editable",
    },
    {
      key: "artwork_url",
      label: "Artwork URL",
      type: "url",
      access: "editable",
    },
    {
      key: "preview_url",
      label: "Preview URL",
      type: "url",
      access: "editable",
    },
    {
      key: "explicit",
      label: "Explicit",
      type: "boolean",
      access: "editable",
    },
    {
      key: "track_number",
      label: "Track number",
      type: "number",
      access: "editable",
    },
    {
      key: "disc_number",
      label: "Disc number",
      type: "number",
      access: "editable",
    },
    ...LIVING_MEMORY_EDITABLE_FIELDS,
    {
      key: "status",
      label: "Status",
      type: "select",
      access: "editable",
      options: ["active", "draft", "needs_review", "archived"],
    },
  ],
  readonlyFields: [
    ...LIVING_MEMORY_READONLY_FIELDS,
    { key: "id", label: "Registry ID", type: "text", access: "readonly" },
    { key: "normalized_title", label: "Normalized title", type: "text", access: "readonly" },
    { key: "release_id", label: "Release ID", type: "text", access: "readonly" },
    { key: "created_at", label: "Created", type: "date", access: "readonly" },
    { key: "updated_at", label: "Updated", type: "date", access: "readonly" },
  ],
};

export const releaseSchema: RegistryEntitySchema = {
  entityType: "release",
  table: "registry_releases",
  idField: "id",
  displayNameField: "title",
  searchFields: ["title", "slug", "upc", "release_type", "status", "description"],
  qualityFields: ["title", "release_date", "release_type", "artwork_url", "upc", "status", "description"],
  editableFields: [
    {
      key: "title",
      label: "Release title",
      type: "text",
      access: "editable",
      required: true,
      normalizer: "trim",
    },
    {
      key: "slug",
      label: "Slug",
      type: "slug",
      access: "editable",
      required: true,
      normalizer: "slug",
    },
    {
      key: "release_type",
      label: "Release type",
      type: "select",
      access: "editable",
      options: ["single", "ep", "album", "mixtape", "compilation"],
    },
    {
      key: "release_date",
      label: "Release date",
      type: "date",
      access: "editable",
    },
    {
      key: "upc",
      label: "UPC",
      type: "text",
      access: "editable",
      normalizer: "trim",
    },
    {
      key: "artwork_url",
      label: "Artwork URL",
      type: "url",
      access: "editable",
    },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      access: "editable",
    },
    ...LIVING_MEMORY_EDITABLE_FIELDS,
    {
      key: "status",
      label: "Status",
      type: "select",
      access: "editable",
      options: ["active", "draft", "needs_review", "archived"],
    },
  ],
  readonlyFields: [
    ...LIVING_MEMORY_READONLY_FIELDS,
    { key: "id", label: "Registry ID", type: "text", access: "readonly" },
    { key: "normalized_title", label: "Normalized title", type: "text", access: "readonly" },
    { key: "label_id", label: "Label ID", type: "text", access: "readonly" },
    { key: "release_date_precision", label: "Date precision", type: "text", access: "readonly" },
    { key: "created_at", label: "Created", type: "date", access: "readonly" },
    { key: "updated_at", label: "Updated", type: "date", access: "readonly" },
  ],
};

export const labelSchema: RegistryEntitySchema = {
  entityType: "label",
  table: "registry_labels",
  idField: "id",
  displayNameField: "name",
  searchFields: ["name", "slug", "country_code", "description", "status"],
  qualityFields: ["name", "slug", "country_code", "description", "status"],
  editableFields: [
    {
      key: "name",
      label: "Label name",
      type: "text",
      access: "editable",
      required: true,
      normalizer: "trim",
    },
    {
      key: "slug",
      label: "Slug",
      type: "slug",
      access: "editable",
      required: true,
      normalizer: "slug",
    },
    {
      key: "country_code",
      label: "Country code",
      type: "text",
      access: "editable",
      normalizer: "uppercase",
      helpText: "Two-letter ISO code, e.g. KE.",
    },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      access: "editable",
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      access: "editable",
      options: ["active", "draft", "needs_review", "archived"],
    },
  ],
  readonlyFields: [
    { key: "id", label: "Registry ID", type: "text", access: "readonly" },
    { key: "normalized_name", label: "Normalized name", type: "text", access: "readonly" },
    { key: "created_at", label: "Created", type: "date", access: "readonly" },
    { key: "updated_at", label: "Updated", type: "date", access: "readonly" },
  ],
};

export const genreSchema: RegistryEntitySchema = {
  entityType: "genre",
  table: "registry_genres",
  idField: "id",
  displayNameField: "name",
  searchFields: ["name", "slug", "description", "status"],
  qualityFields: ["name", "slug", "description", "status"],
  editableFields: [
    {
      key: "name",
      label: "Genre name",
      type: "text",
      access: "editable",
      required: true,
      normalizer: "trim",
    },
    {
      key: "slug",
      label: "Slug",
      type: "slug",
      access: "editable",
      required: true,
      normalizer: "slug",
    },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      access: "editable",
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      access: "editable",
      options: ["active", "draft", "needs_review", "archived"],
    },
  ],
  readonlyFields: [
    { key: "id", label: "Registry ID", type: "text", access: "readonly" },
    { key: "parent_genre_id", label: "Parent genre ID", type: "text", access: "readonly" },
    { key: "created_at", label: "Created", type: "date", access: "readonly" },
    { key: "updated_at", label: "Updated", type: "date", access: "readonly" },
  ],
};

const schemasByType: Record<RegistryEntityType, RegistryEntitySchema> = {
  artist: artistSchema,
  track: trackSchema,
  release: releaseSchema,
  label: labelSchema,
  genre: genreSchema,
};

export function getEntitySchema(entityType: RegistryEntityType): RegistryEntitySchema {
  return schemasByType[entityType];
}

export function getAllFields(schema: RegistryEntitySchema): Array<{ key: string; label: string; type: string; access: string }> {
  return [
    ...schema.editableFields.map((f) => ({ key: f.key, label: f.label, type: f.type, access: f.access })),
    ...schema.readonlyFields.map((f) => ({ key: f.key, label: f.label, type: f.type, access: f.access })),
  ];
}

export function getEditableFieldKeys(schema: RegistryEntitySchema): string[] {
  return schema.editableFields.filter((f) => f.access === "editable").map((f) => f.key);
}