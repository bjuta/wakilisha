export type ProviderKind =
  | "spotify"
  | "apple_music"
  | "youtube"
  | "boomplay"
  | "mdundo"
  | "chart_import"
  | "wordpress_legacy"
  | "csv_upload"
  | "manual_submission"
  | "other";

export type ProviderEntityType = "artist" | "track" | "release" | "label" | "genre" | "media";
export type ProviderRunStatus = "draft" | "running" | "completed" | "failed" | "cancelled";
export type ProviderItemStatus = "staged" | "matched" | "review" | "blocked" | "promoted";
export type ProviderMatchStatus = "candidate" | "accepted" | "rejected" | "superseded";
export type ProviderPromotionDecision = "auto_match" | "propose_new" | "review_required" | "block" | "promote";
export type RegistryEntityType = "artist" | "track" | "release" | "label" | "genre" | "media";

export interface ProviderSource {
  id: string;
  providerKind: ProviderKind;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderRun {
  id: string;
  providerSourceId: string;
  runKey: string;
  status: ProviderRunStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  sourceCursor?: string | null;
  stats: Record<string, unknown>;
  errors: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface ProviderItem {
  id: string;
  providerSourceId: string;
  providerRunId?: string | null;
  providerExternalId?: string | null;
  providerUrl?: string | null;
  entityType: ProviderEntityType;
  status: ProviderItemStatus;
  normalizedSlug?: string | null;
  normalizedTitle?: string | null;
  normalizedArtist?: string | null;
  normalizedPayload: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
  confidenceScore: number;
  sourceTimestamp?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderMatchCandidate {
  id: string;
  providerItemId: string;
  registryEntityType: RegistryEntityType;
  registryEntityId?: string | null;
  matchStatus: ProviderMatchStatus;
  matchRule: string;
  confidenceScore: number;
  evidence: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderPromotionRecord {
  id: string;
  providerItemId: string;
  matchCandidateId?: string | null;
  decision: ProviderPromotionDecision;
  decisionStatus: "draft" | "approved" | "applied" | "rejected";
  registryEntityType?: RegistryEntityType | null;
  registryEntityId?: string | null;
  notes?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
