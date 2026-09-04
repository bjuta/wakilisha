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

export type ArtistManagementIdentity = {
  id: string;
  slug: string;
  name: string;
  status:
    | "active"
    | "draft"
    | "needs_review";
  imageUrl: string | null;
};

export type ArtistManagementWorkspace = {
  artist: ArtistManagementIdentity;
  presentation: ArtistPresentation | null;
  representation: ArtistRepresentation;
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

export type ArtistClaimResolutionCandidate = {
  id: string;
  slug: string;
  displayName: string;
  status: string;
  originIso2: string | null;
};

export type ArtistClaimProposedIdentity = {
  displayName: string;
  artistType: string | null;
  originIso2: string | null;
  alternateNames: string[];
  miziziFingerprint: string;
  miziziAssessment: Record<string, unknown>;
  acceptedArtistId: string | null;
};

export type ArtistClaimQueueItem = {
  id: string;
  claimKind:
    | "existing_artist"
    | "proposed_artist";
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
  } | null;
  proposedIdentity:
    ArtistClaimProposedIdentity | null;
  claimant: {
    userId: string | null;
    username: string | null;
    displayName: string | null;
    phoneCountryIso2: string | null;
    phoneCallingCode: string | null;
    phoneNationalNumber: string | null;
    phoneE164: string | null;
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

export async function getArtistManagementWorkspace(
  artistSlug: string,
): Promise<ArtistManagementWorkspace> {
  const data = await rpc<unknown>(
    "community_get_artist_management_workspace",
    {
      p_artist_slug:
        artistSlug,
    },
  );

  const record =
    asRecord(data);
  const artist =
    asRecord(
      record?.artist,
    );
  const representation =
    asRecord(
      record?.representation,
    );

  const artistId =
    readString(
      artist,
      "id",
    );
  const slug =
    readString(
      artist,
      "slug",
    );
  const name =
    readString(
      artist,
      "display_name",
    );
  const status =
    readString(
      artist,
      "status",
    );
  const representationId =
    readString(
      representation,
      "id",
    );

  if (
    !artistId ||
    !slug ||
    !name ||
    (
      status !== "active" &&
      status !== "draft" &&
      status !== "needs_review"
    ) ||
    !representationId
  ) {
    throw new Error(
      "Artist Studio access could not be loaded.",
    );
  }

  return {
    artist: {
      id:
        artistId,
      slug,
      name,
      status,
      imageUrl:
        readString(
          artist,
          "image_url",
        ),
    },
    presentation:
      mapPresentation(
        record?.presentation,
      ),
    representation: {
      id:
        representationId,
      role:
        readString(
          representation,
          "role",
        ) ?? "other",
      status:
        readString(
          representation,
          "status",
        ) ?? "active",
      permissions:
        mapPermissions(
          representation
            ?.permissions,
        ),
      invitedAt:
        readString(
          representation,
          "invited_at",
        ),
      acceptedAt:
        readString(
          representation,
          "accepted_at",
        ),
      verifiedAt:
        readString(
          representation,
          "verified_at",
        ),
    },
  };
}

export async function submitArtistClaim(input: {
  artistId: string;
  claimantRole: string;
  statement: string;
  phone: {
    countryIso2: string;
    callingCode: string;
    nationalNumber: string;
    e164: string;
  };
  evidence: Array<{ type: string; reference?: string | null; note?: string | null }>;
}): Promise<void> {
  await rpc("community_submit_artist_claim_v2", {
    p_artist_id: input.artistId,
    p_claimant_role: input.claimantRole,
    p_statement: input.statement,
    p_phone_country_iso2: input.phone.countryIso2,
    p_phone_calling_code: input.phone.callingCode,
    p_phone_national_number: input.phone.nationalNumber,
    p_phone_e164: input.phone.e164,
    p_evidence: input.evidence,
  });
}

export async function submitNewArtistClaim(input: {
  displayName: string;
  artistType: string;
  originIso2: string;
  alternateNames: string[];
  claimantRole: string;
  statement: string;
  phone: {
    countryIso2: string;
    callingCode: string;
    nationalNumber: string;
    e164: string;
  };
  evidence: Array<{
    type: string;
    reference?: string | null;
    note?: string | null;
  }>;
}): Promise<{ claimId: string }> {
  const data = await rpc<unknown>(
    "community_submit_new_artist_claim_v2",
    {
      p_display_name:
        input.displayName,
      p_artist_type:
        input.artistType ||
        null,
      p_origin_iso2:
        input.originIso2 ||
        null,
      p_alternate_names:
        input.alternateNames,
      p_claimant_role:
        input.claimantRole,
      p_statement:
        input.statement,
      p_phone_country_iso2:
        input.phone.countryIso2,
      p_phone_calling_code:
        input.phone.callingCode,
      p_phone_national_number:
        input.phone.nationalNumber,
      p_phone_e164:
        input.phone.e164,
      p_evidence:
        input.evidence,
    },
  );

  const record =
    asRecord(data);
  const claimId =
    readString(
      record,
      "claim_id",
    );

  if (!claimId) {
    throw new Error(
      "WAKILISHA could not confirm the Artist claim.",
    );
  }

  return {
    claimId,
  };
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

export async function listArtistClaims(
  status = "pending",
  limit = 100,
): Promise<ArtistClaimQueueItem[]> {
  const data = await rpc<unknown>(
    "community_admin_get_artist_claims_v2",
    {
      p_status: status,
      p_limit: limit,
    },
  );

  if (!Array.isArray(data)) {
    return [];
  }

  return data.flatMap(
    (item) => {
      const record =
        asRecord(item);
      const artist =
        asRecord(
          record?.artist,
        );
      const claimant =
        asRecord(
          record?.claimant,
        );
      const proposed =
        asRecord(
          record?.proposed_identity,
        );
      const id =
        readString(
          record,
          "id",
        );
      const claimKind =
        readString(
          record,
          "claim_kind",
        );

      if (
        !record ||
        !id ||
        (
          claimKind !==
            "existing_artist" &&
          claimKind !==
            "proposed_artist"
        )
      ) {
        return [];
      }

      const artistId =
        readString(
          artist,
          "id",
        );
      const artistSlug =
        readString(
          artist,
          "slug",
        );
      const artistName =
        readString(
          artist,
          "display_name",
        );

      const proposedName =
        readString(
          proposed,
          "display_name",
        );
      const fingerprint =
        readString(
          proposed,
          "mizizi_fingerprint",
        );

      if (
        claimKind ===
          "existing_artist" &&
        (
          !artistId ||
          !artistSlug ||
          !artistName
        )
      ) {
        return [];
      }

      if (
        claimKind ===
          "proposed_artist" &&
        (
          !proposedName ||
          !fingerprint
        )
      ) {
        return [];
      }

      const alternateNamesRaw =
        proposed?.alternate_names;

      return [{
        id,
        claimKind,
        status:
          readString(
            record,
            "status",
          ) ?? "pending",
        claimantRole:
          readString(
            record,
            "claimant_role",
          ) ?? "other",
        statement:
          readString(
            record,
            "statement",
          ) ?? "",
        submittedAt:
          readString(
            record,
            "submitted_at",
          ),
        decidedAt:
          readString(
            record,
            "decided_at",
          ),
        decisionReason:
          readString(
            record,
            "decision_reason",
          ),
        artist:
          artistId &&
          artistSlug &&
          artistName
            ? {
                id:
                  artistId,
                slug:
                  artistSlug,
                displayName:
                  artistName,
              }
            : null,
        proposedIdentity:
          proposedName &&
          fingerprint
            ? {
                displayName:
                  proposedName,
                artistType:
                  readString(
                    proposed,
                    "artist_type",
                  ),
                originIso2:
                  readString(
                    proposed,
                    "origin_iso2",
                  ),
                alternateNames:
                  Array.isArray(
                    alternateNamesRaw,
                  )
                    ? alternateNamesRaw
                        .filter(
                          (
                            value,
                          ): value is string =>
                            typeof value ===
                            "string" &&
                            value.trim()
                              .length >
                              0,
                        )
                        .map(
                          (value) =>
                            value.trim(),
                        )
                    : [],
                miziziFingerprint:
                  fingerprint,
                miziziAssessment:
                  asRecord(
                    proposed
                      ?.mizizi_assessment,
                  ) ?? {},
                acceptedArtistId:
                  readString(
                    proposed,
                    "accepted_artist_id",
                  ),
              }
            : null,
        claimant: {
          userId:
            readString(
              claimant,
              "user_id",
            ),
          username:
            readString(
              claimant,
              "username",
            ),
          displayName:
            readString(
              claimant,
              "display_name",
            ),
          phoneCountryIso2:
            readString(
              record,
              "claimant_phone_country_iso2",
            ),
          phoneCallingCode:
            readString(
              record,
              "claimant_phone_calling_code",
            ),
          phoneNationalNumber:
            readString(
              record,
              "claimant_phone_national_number",
            ),
          phoneE164:
            readString(
              record,
              "claimant_phone_e164",
            ),
        },
        evidence:
          mapEvidence(
            record.evidence,
          ),
      }];
    },
  );
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

export async function searchRegistryArtistsForClaimResolution(
  query: string,
  limit = 8,
): Promise<ArtistClaimResolutionCandidate[]> {
  const data = await rpc<unknown>(
    "admin_search_registry_artists",
    {
      p_query:
        query.trim(),
      p_limit:
        Math.max(
          1,
          Math.min(
            limit,
            20,
          ),
        ),
    },
  );

  if (!Array.isArray(data)) {
    return [];
  }

  return data.flatMap(
    (item) => {
      const record =
        asRecord(item);
      const id =
        readString(
          record,
          "artist_id",
        );
      const slug =
        readString(
          record,
          "artist_slug",
        );
      const displayName =
        readString(
          record,
          "display_name",
        );

      if (
        !id ||
        !slug ||
        !displayName
      ) {
        return [];
      }

      return [{
        id,
        slug,
        displayName,
        status:
          readString(
            record,
            "status",
          ) ?? "draft",
        originIso2:
          readString(
            record,
            "origin_iso2",
          ),
      }];
    },
  );
}

export async function resolveArtistClaimToExisting(input: {
  claimId: string;
  artistId: string;
  reason: string;
}): Promise<void> {
  await rpc(
    "community_admin_resolve_artist_claim_existing",
    {
      p_claim_id:
        input.claimId,
      p_artist_id:
        input.artistId,
      p_reason:
        input.reason,
      p_can_manage_profile:
        null,
      p_can_submit_releases:
        null,
      p_can_post_updates:
        null,
      p_can_manage_team:
        null,
    },
  );
}
