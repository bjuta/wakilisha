export type WakilishaCptMapEntry = {
  post_type: string;
  target_entity: string;
  canonical_kind: string;
  ready_policy: "published_only" | "needs_review";
};

export const WAKILISHA_CPT_MAP: Record<string, WakilishaCptMapEntry> = {
  post: { post_type: "post", target_entity: "articles", canonical_kind: "article", ready_policy: "published_only" },
  page: { post_type: "page", target_entity: "pages", canonical_kind: "page", ready_policy: "published_only" },
  wakilisha_artist: { post_type: "wakilisha_artist", target_entity: "artists", canonical_kind: "artist", ready_policy: "published_only" },
  wk_registry_track: { post_type: "wk_registry_track", target_entity: "tracks", canonical_kind: "track", ready_policy: "published_only" },
  wk_registry_release: { post_type: "wk_registry_release", target_entity: "releases", canonical_kind: "release", ready_policy: "published_only" },
  wk_registry_label: { post_type: "wk_registry_label", target_entity: "labels", canonical_kind: "label", ready_policy: "published_only" },
  wk_genre_page: { post_type: "wk_genre_page", target_entity: "genres", canonical_kind: "genre", ready_policy: "published_only" },
  wk_field_guide: { post_type: "wk_field_guide", target_entity: "guides", canonical_kind: "guide", ready_policy: "published_only" },
  wk_chart_series: { post_type: "wk_chart_series", target_entity: "chart_series", canonical_kind: "chart_series", ready_policy: "published_only" },
  wk_chart_edition: { post_type: "wk_chart_edition", target_entity: "chart_editions", canonical_kind: "chart_edition", ready_policy: "published_only" },
  wk_top10_surface: { post_type: "wk_top10_surface", target_entity: "chart_surfaces", canonical_kind: "chart_surface", ready_policy: "needs_review" },
  wk_magazine_surface: { post_type: "wk_magazine_surface", target_entity: "magazine_surfaces", canonical_kind: "magazine_surface", ready_policy: "needs_review" },
  wk_methodology: { post_type: "wk_methodology", target_entity: "methodologies", canonical_kind: "methodology", ready_policy: "published_only" },
  wk_correction_page: { post_type: "wk_correction_page", target_entity: "corrections", canonical_kind: "correction", ready_policy: "needs_review" },
  wk_play_surface: { post_type: "wk_play_surface", target_entity: "play_surfaces", canonical_kind: "play_surface", ready_policy: "needs_review" },
  wk_labels_surface: { post_type: "wk_labels_surface", target_entity: "label_surfaces", canonical_kind: "label_surface", ready_policy: "needs_review" },
  wk_settings_surface: { post_type: "wk_settings_surface", target_entity: "settings_surfaces", canonical_kind: "settings_surface", ready_policy: "needs_review" },
  wk_profile_surface: { post_type: "wk_profile_surface", target_entity: "profile_surfaces", canonical_kind: "profile_surface", ready_policy: "needs_review" }
};

export const WAKILISHA_PLUGIN_TAXONOMIES = ["wk_artist_genre", "wk_artist_origin"];

export function wakilishaCptEntry(postType: string): WakilishaCptMapEntry | null {
  return WAKILISHA_CPT_MAP[postType] ?? null;
}

export function targetEntityForWordPressPostType(postType: string): string {
  return wakilishaCptEntry(postType)?.target_entity ?? (postType === "post" ? "articles" : postType === "page" ? "pages" : postType === "attachment" ? "media_assets" : "content_entities");
}

export function canonicalKindForWordPressPostType(postType: string): string {
  return wakilishaCptEntry(postType)?.canonical_kind ?? postType;
}

export function shouldReadyPostType(postType: string, status: string, title: string): boolean {
  const entry = wakilishaCptEntry(postType);
  if (!title || !["publish", "published"].includes(status.toLowerCase())) return false;
  if (!entry) return postType === "post" || postType === "page";
  return entry.ready_policy === "published_only";
}
