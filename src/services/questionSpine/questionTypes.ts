export type QuestionSpineEntityType =
  | "artist"
  | "release"
  | "track"
  | "label"
  | "genre"
  | "guide"
  | "inquiry";

export type QuestionSpineStatus =
  | "clear"
  | "emerging"
  | "thin"
  | "needs_review";

export type QuestionSpineConfidence =
  | "high"
  | "medium"
  | "low";

export type QuestionSpineEvidenceKind =
  | "bio"
  | "catalog"
  | "track_count"
  | "release_count"
  | "chart"
  | "genre"
  | "place"
  | "collaboration"
  | "related_artist"
  | "media"
  | "article"
  | "missing_context";

export type QuestionSpineRelationshipKind =
  | "scene"
  | "place"
  | "catalog"
  | "chart"
  | "collaboration"
  | "adjacent_artist"
  | "media"
  | "memory";

export interface QuestionSpineEvidence {
  id: string;
  kind: QuestionSpineEvidenceKind;
  label: string;
  detail: string;
  value?: string | number;
  confidence: QuestionSpineConfidence;
  source: "page-data" | "registry" | "editorial" | "inference";
  weight: number;
}

export interface QuestionSpineRelationship {
  id: string;
  kind: QuestionSpineRelationshipKind;
  label: string;
  detail: string;
  entitySlug?: string;
  strength: QuestionSpineConfidence;
}

export interface QuestionSpineNextQuestion {
  id: string;
  question: string;
  reason: string;
  priority: "primary" | "secondary";
}

export interface QuestionSpineOpenQuestion {
  id: string;
  question: string;
  whyItMatters: string;
}

export interface QuestionSpine {
  entityType: QuestionSpineEntityType;
  entityId: string;
  entitySlug: string;
  entityTitle: string;
  primaryQuestion: string;
  shortAnswer: string;
  status: QuestionSpineStatus;
  confidence: QuestionSpineConfidence;
  evidence: QuestionSpineEvidence[];
  relationships: QuestionSpineRelationship[];
  nextQuestions: QuestionSpineNextQuestion[];
  openQuestions: QuestionSpineOpenQuestion[];
}
