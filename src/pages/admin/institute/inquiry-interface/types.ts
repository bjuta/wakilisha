export type InquiryScreen =
  | "home"
  | "workbench"
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

export type EvidenceKind =
  | "WAKILISHA record"
  | "Article"
  | "Link"
  | "Citation"
  | "Audio"
  | "Video"
  | "Photo"
  | "Interview"
  | "Chart data"
  | "Archive document"
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
  activeId: string | null;
  questionDraft: string;
  selectedAnchor: RegistryAnchor | null;
  selectedAnchorCategory: AnchorCategory | null;
  anchorSearch: string;
};
