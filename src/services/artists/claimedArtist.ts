import { supabase } from "@/lib/supabase";

export type ArtistPermissionSet = {
  profile: boolean;
  releases: boolean;
  updates: boolean;
  team: boolean;
};

export type ArtistPresentation = {
  bio: string | null;
  profileImageUrl: string | null;
  heroImageUrl: string | null;
  websiteUrl: string | null;
  publicEmail: string | null;
  socialLinks: Record<string, string>;
  updatedAt: string | null;
};

export type ArtistPublicAuthority = {
  artistId: string;
  official: boolean;
  presentation: ArtistPresentation | null;
};

export type ArtistClaimEvidence = {
  id?: string;
  type: string;
  reference: string | null;
  note: string | null;
};

export type ArtistClaimState = {
  id: string;
  claimantRole: string;
  status: string;
  statement: string;
  submittedAt: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  evidence: ArtistClaimEvidence[];
};

export type ArtistRepresentation = {
  id: string;
  role: string;
  status: string;
  permissions: ArtistPermissionSet;
  invitedAt: string | null;
  acceptedAt: string | null;
  verifiedAt: string | null;
};

export type ArtistRepresentationState = {
  canClaim: boolean;
  latestClaim: ArtistClaimState | null;
  representation: ArtistRepresentation | null;
};

export type ArtistTeamMember = {
  representationId: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  role: string;
  status: string;
  permissions: ArtistPermissionSet;
  invitedAt: string | null;
  acceptedAt: string | null;
  verifiedAt: string | null;
};

export type ArtistClaimQueueItem = {
  id: string;
  status: string;
  claimantRole: string;
  statement: string;
  submittedAt: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  artist: {
    id: string;
    slug: string;
    displayName: string;
  };
  claimant: {
    userId: string | null;
    username: string | null;
    displayName: string | null;
  };
  evidence: ArtistClaimEvidence[];
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function readString(record: JsonRecord | null, key: string): string | null {
  if (!record) return null;
  const value = record[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readBoolean(record: JsonRecord | null, key: string): boolean {
  return record?.[key] === true;
}

function mapPermissions(value: unknown): ArtistPermissionSet {
  const record = asRecord(value);
  return {
    profile: readBoolean(record, "profile"),
    releases: readBoolean(record, "releases"),
    updates: readBoolean(record, "updates"),
    team: readBoolean(record, "team"),
  };
}

function mapEvidence(value: unknown): ArtistClaimEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const type = readString(record, "type");
    if (!type) return [];
    return [{
      id: readString(record, "id") ?? undefined,
      type,
      reference: readString(record, "reference"),
      note: readString(record, "note"),
    }];
  });
}

function mapPresentation(value: unknown): ArtistPresentation | null {
  const record = asRecord(value);
  if (!record) return null;
  const social = asRecord(record.social_links) ?? {};
  const socialLinks: Record<string, string> = {};
  for (const [key, raw] of Object.entries(social)) {
    if (typeof raw === "string" && raw.trim()) socialLinks[key] = raw.trim();
  }
  return {
    bio: readString(record, "bio"),
    profileImageUrl: readString(record, "profile_image_url"),
    heroImageUrl: readString(record, "hero_image_url"),
    websiteUrl: readString(record, "website_url"),
    publicEmail: readString(record, "public_email"),
    socialLinks,
    updatedAt: readString(record, "updated_at"),
  };
}

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const invoke = supabase.rpc.bind(supabase) as unknown as (
    functionName: string,
    parameters?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  const { data, error } = await invoke(name, args);
  if (error) throw new Error(error.message || `${name} failed`);
  return data as T;
}

export async function getArtistPublicPresentation(artistId: string): Promise<ArtistPublicAuthority> {
  const data = await rpc<unknown>("community_get_artist_public_presentation", {
    p_artist_id: artistId,
  });
  const record = asRecord(data);
  if (!record) throw new Error("Could not load Artist presentation.");
  return {
    artistId: readString(record, "artist_id") ?? artistId,
    official: readBoolean(record, "official"),
    presentation: mapPresentation(record.presentation),
  };
}

export async function getArtistRepresentationState(artistId: string): Promise<ArtistRepresentationState> {
  const data = await rpc<unknown>("community_get_artist_representation_state", {
    p_artist_id: artistId,
  });
  const record = asRecord(data);
  const claimRecord = asRecord(record?.latest_claim);
  const representationRecord = asRecord(record?.representation);

  return {
    canClaim: readBoolean(record, "can_claim"),
    latestClaim: claimRecord && readString(claimRecord, "id") ? {
      id: readString(claimRecord, "id")!,
      claimantRole: readString(claimRecord, "claimant_role") ?? "other",
      status: readString(claimRecord, "status") ?? "pending",
      statement: readString(claimRecord, "statement") ?? "",
      submittedAt: readString(claimRecord, "submitted_at"),
      decidedAt: readString(claimRecord, "decided_at"),
      decisionReason: readString(claimRecord, "decision_reason"),
      evidence: mapEvidence(claimRecord.evidence),
    } : null,
    representation: representationRecord && readString(representationRecord, "id") ? {
      id: readString(representationRecord, "id")!,
      role: readString(representationRecord, "role") ?? "other",
      status: readString(representationRecord, "status") ?? "pending",
      permissions: mapPermissions(representationRecord.permissions),
      invitedAt: readString(representationRecord, "invited_at"),
      acceptedAt: readString(representationRecord, "accepted_at"),
      verifiedAt: readString(representationRecord, "verified_at"),
    } : null,
  };
}

export async function submitArtistClaim(input: {
  artistId: string;
  claimantRole: string;
  statement: string;
  evidence: Array<{ type: string; reference?: string | null; note?: string | null }>;
}): Promise<void> {
  await rpc("community_submit_artist_claim", {
    p_artist_id: input.artistId,
    p_claimant_role: input.claimantRole,
    p_statement: input.statement,
    p_evidence: input.evidence,
  });
}

export async function acceptArtistRepresentation(representationId: string): Promise<void> {
  await rpc("community_artist_accept_representation", {
    p_representation_id: representationId,
  });
}

export async function saveArtistPresentation(input: {
  artistId: string;
  bio: string;
  profileImageUrl: string;
  heroImageUrl: string;
  websiteUrl: string;
  publicEmail: string;
  socialLinks: Record<string, string>;
}): Promise<ArtistPresentation> {
  const data = await rpc<unknown>("community_save_artist_profile_presentation", {
    p_artist_id: input.artistId,
    p_bio: input.bio || null,
    p_profile_image_url: input.profileImageUrl || null,
    p_hero_image_url: input.heroImageUrl || null,
    p_website_url: input.websiteUrl || null,
    p_public_email: input.publicEmail || null,
    p_social_links: input.socialLinks,
  });
  return mapPresentation(data) ?? {
    bio: null,
    profileImageUrl: null,
    heroImageUrl: null,
    websiteUrl: null,
    publicEmail: null,
    socialLinks: {},
    updatedAt: null,
  };
}

export async function submitArtistRegistryCorrection(input: {
  artistId: string;
  fieldKey: string;
  proposedValue: string;
  reason: string;
}): Promise<void> {
  await rpc("community_submit_artist_registry_correction", {
    p_artist_id: input.artistId,
    p_field_key: input.fieldKey,
    p_proposed_value: input.proposedValue,
    p_reason: input.reason,
  });
}

export async function getArtistTeam(artistId: string): Promise<ArtistTeamMember[]> {
  const data = await rpc<unknown>("community_get_artist_team", {
    p_artist_id: artistId,
  });
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const record = asRecord(item);
    const representationId = readString(record, "representation_id");
    const userId = readString(record, "user_id");
    if (!record || !representationId || !userId) return [];
    return [{
      representationId,
      userId,
      username: readString(record, "username"),
      displayName: readString(record, "display_name"),
      role: readString(record, "role") ?? "other",
      status: readString(record, "status") ?? "pending",
      permissions: mapPermissions(record.permissions),
      invitedAt: readString(record, "invited_at"),
      acceptedAt: readString(record, "accepted_at"),
      verifiedAt: readString(record, "verified_at"),
    }];
  });
}

export async function inviteArtistRepresentative(input: {
  artistId: string;
  username: string;
  role: string;
  permissions: ArtistPermissionSet;
}): Promise<void> {
  await rpc("community_artist_invite_representative", {
    p_artist_id: input.artistId,
    p_username: input.username,
    p_representation_role: input.role,
    p_can_manage_profile: input.permissions.profile,
    p_can_submit_releases: input.permissions.releases,
    p_can_post_updates: input.permissions.updates,
    p_can_manage_team: input.permissions.team,
  });
}

export async function updateArtistRepresentative(input: {
  representationId: string;
  role: string;
  permissions: ArtistPermissionSet;
}): Promise<void> {
  await rpc("community_artist_update_representative", {
    p_representation_id: input.representationId,
    p_representation_role: input.role,
    p_can_manage_profile: input.permissions.profile,
    p_can_submit_releases: input.permissions.releases,
    p_can_post_updates: input.permissions.updates,
    p_can_manage_team: input.permissions.team,
  });
}

export async function revokeArtistRepresentative(representationId: string, reason: string): Promise<void> {
  await rpc("community_artist_revoke_representation", {
    p_representation_id: representationId,
    p_reason: reason,
  });
}

export async function listArtistClaims(status = "pending", limit = 100): Promise<ArtistClaimQueueItem[]> {
  const data = await rpc<unknown>("community_admin_get_artist_claims", {
    p_status: status,
    p_limit: limit,
  });
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const record = asRecord(item);
    const artist = asRecord(record?.artist);
    const claimant = asRecord(record?.claimant);
    const id = readString(record, "id");
    const artistId = readString(artist, "id");
    const artistSlug = readString(artist, "slug");
    const artistName = readString(artist, "display_name");
    if (!record || !id || !artistId || !artistSlug || !artistName) return [];
    return [{
      id,
      status: readString(record, "status") ?? "pending",
      claimantRole: readString(record, "claimant_role") ?? "other",
      statement: readString(record, "statement") ?? "",
      submittedAt: readString(record, "submitted_at"),
      decidedAt: readString(record, "decided_at"),
      decisionReason: readString(record, "decision_reason"),
      artist: {
        id: artistId,
        slug: artistSlug,
        displayName: artistName,
      },
      claimant: {
        userId: readString(claimant, "user_id"),
        username: readString(claimant, "username"),
        displayName: readString(claimant, "display_name"),
      },
      evidence: mapEvidence(record.evidence),
    }];
  });
}

export async function decideArtistClaim(input: {
  claimId: string;
  decision: "verified" | "rejected";
  reason: string;
}): Promise<void> {
  await rpc("community_admin_decide_artist_claim", {
    p_claim_id: input.claimId,
    p_decision: input.decision,
    p_reason: input.reason,
    p_can_manage_profile: null,
    p_can_submit_releases: null,
    p_can_post_updates: null,
    p_can_manage_team: null,
  });
}
