export type EditorialDiscoveryVersionType =
  | "playlist_version"
  | "audio_publication_version"\n  | "video_publication_version";

export type EditorialTaxonomy = "category" | "post_tag";

export interface EditorialTaxonomyTerm {
  id: string;
  slug: string;
  name: string;
}

export interface EditorialDiscoverySeo {
  title: string;
  description: string;
  keywords: string[];
  focusKeyword: string;
}

export interface EditorialDiscoveryValue {
  targetVersionType: EditorialDiscoveryVersionType;
  targetVersionId: string;
  resourceId: string;
  resourceKind: string;
  metadataRevision: number;
  categories: EditorialTaxonomyTerm[];
  tags: EditorialTaxonomyTerm[];
  seo: EditorialDiscoverySeo;
}

export interface EditorialDiscoveryDraft {
  categories: EditorialTaxonomyTerm[];
  tags: EditorialTaxonomyTerm[];
  seo: EditorialDiscoverySeo;
}
