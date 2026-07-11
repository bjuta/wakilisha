export type InquiryScreen =
  | "home"
  | "inquiry"
  | "workbench"
  | "anchorBrief"
  | "evidence"
  | "claims"
  | "relationships"
  | "memory"
  | "corrections"
  | "review"
  | "summary"
  | "clinic"
  | "lineage"
  | "public"
  | "learned"
  | "ai";

export type InquirySection =
  | "overview"
  | "material"
  | "notes"
  | "work"
  | "history";

export type RegistryAnchorType = "artist" | "track" | "release" | "label" | "genre";
export type AnchorCategory = RegistryAnchorType | "none";

export type RegistryAnchor = {
  type: RegistryAnchorType;
  slug: string;
  label: string;
  subtitle: string;
  imageUrl: string | null;
  contextText?: string;
  href?: string;
  metadata?: Record<string, unknown>;
};

export type AnchorContextItem = {
  title: string;
  body: string;
  source?: string;
};

export type AnchorContextSnapshot = {
  id: string;
  snapshotVersion: number;
  anchorEntityType: RegistryAnchorType;
  anchorSlug: string | null;
  anchorLabel: string;
  sourceContext: Record<string, unknown>;
  knowns: AnchorContextItem[];
  unknowns: AnchorContextItem[];
  relationshipLeads: AnchorContextItem[];
  evidenceGaps: AnchorContextItem[];
  relatedEntities: AnchorContextItem[];
  thinDataNotes: AnchorContextItem[];
  sourceReferences: Array<Record<string, unknown>>;
  createdAt: string;
};

export type EvidenceKind =
  | "WAKILISHA record"
  | "Article"
  | "Link"
  | "Citation"
  | "Audio"
  | "Video"
  | "Photo"
  | "Interview"
  | "Contributor memory"
  | "Social post"
  | "Chart data"
  | "Playlist data"
  | "Archive document"
  | "Contributor memory"
  | "Social post"
  | "Playlist data"
  | "Personal note";

export type ReviewState =
  | "Draft"
  | "Needs review"
  | "Accepted for internal memory"
  | "Public-safe candidate"
  | "Needs more evidence"
  | "Kept as doubt"
  | "Rejected with reason";

export type EvidenceItem = {
  id: string;
  title: string;
  kind: EvidenceKind;
  source: string;
  sourceUrl: string;
  summary: string;
  whyItMatters: string;
  mediaMinutes: number;
  reviewState: ReviewState;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type InquirySetup = {
  inquiryType: string;
  outputs: string[];
  formats: string[];
  tools: string[];
  scopeTimeRange: string;
  scopePlaceRoute: string;
  scopeLanguageRegister: string;
  scopeExclusion: string;
  consentDefault: string;
  reviewStandard: string;
  draftTimer: string;
  previewDepth: string;
};

export type InquiryDraft = {
  id: string;
  code: string;
  rawQuestion: string;
  workingQuestion: string;
  anchor: RegistryAnchor | null;
  anchorContextSnapshot: AnchorContextSnapshot | null;
  featuredImageUrl: string;
  featuredImageAlt: string;
  featuredImageCredit: string;
  featuredImageSource: string;
  status: "Draft" | "Framing";
  createdAt: string;
  updatedAt: string;
  versionCount: number;
  setup: InquirySetup;
  evidence: EvidenceItem[];
};

export type InstituteState = {
  screen: InquiryScreen;
  section: InquirySection;
  activeId: string | null;
  questionDraft: string;
  selectedAnchor: RegistryAnchor | null;
  selectedAnchorCategory: AnchorCategory | null;
  anchorSearch: string;
};
