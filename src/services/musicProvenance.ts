import { supabase } from "@/lib/supabase";

export type MusicCreditSubjectKind = "track" | "work";

export interface MusicCreditSubject {
  kind: MusicCreditSubjectKind;
  id: string;
  title: string;
  path: string | null;
  artworkUrl?: string;
}

export interface MusicCreditPersonCandidate {
  personId: string;
  name: string;
  path: string;
}

export interface MusicCreditWorkspaceItem {
  kind: string;
  attestationId?: string;
  canonicalContributionId?: string;
  invitationId?: string;
  state: string;
  roleKey?: string;
  roleLabel: string;
  instrument?: string | null;
  detail?: string | null;
  creditedAs?: string | null;
  subject: MusicCreditSubject | null;
  inviter?: { name?: string };
  canonicalPath?: string;
  at?: string;
}

export interface MusicCreditPermission {
  permissionId?: string;
  changeKind: string;
  publicDisplay: boolean;
  cmoRightsContexts: string[];
  approvedPartnerKeys: string[];
  thirdPartyCommercialReuse: boolean;
  updatedAt?: string;
}

export interface MusicCreditPermissionItem {
  attestationId: string;
  roleLabel: string;
  subject: MusicCreditSubject | null;
  permission: MusicCreditPermission;
}

export interface MusicCreditsWorkspace {
  personId: string;
  needsYou: MusicCreditWorkspaceItem[];
  yourWork: MusicCreditWorkspaceItem[];
  activity: MusicCreditWorkspaceItem[];
  sharingPermissions: MusicCreditPermissionItem[];
}

export interface MusicCreditInviteContext {
  invitationId: string;
  state: string;
  expiresAt: string;
  subject: MusicCreditSubject | null;
  roleKey: string;
  roleLabel: string;
  instrument: string | null;
  detail: string | null;
  inviteeName: string | null;
  inviter: { name: string };
  canRespond: boolean;
  requiresAuthentication: boolean;
  responseMode: "counterparty_confirmation";
}

export interface PublicPersonMusicCredit {
  id: string;
  roleKey: string;
  roleLabel: string;
  instrument?: string | null;
  detail?: string | null;
  creditedAs?: string | null;
  subject: MusicCreditSubject | null;
}

export interface PublicPersonMusicCredits {
  personId: string;
  recordingCredits: PublicPersonMusicCredit[];
  workCredits: PublicPersonMusicCredit[];
}

export interface PublicArtistMusicProvenance {
  artistId: string;
  recordingCredits: PublicPersonMusicCredit[];
  workCredits: PublicPersonMusicCredit[];
  groupMembers: Array<{
    membershipId: string;
    roleKey: string;
    roleLabel: string;
    roleDetail: string | null;
    validFrom: string | null;
    validTo: string | null;
    person: {
      kind: "person";
      id: string;
      name: string;
      path: string | null;
    };
  }>;
}

type RpcResult<T> = {
  data: T | null;
  error: { message?: string } | null;
};

// New Slice 2 RPC names are intentionally kept behind one temporary typed
// boundary until Preview regenerates the canonical Supabase type snapshot.
async function provenanceRpc<T>(
  functionName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const call = supabase.rpc as unknown as (
    name: string,
    parameters?: Record<string, unknown>,
  ) => Promise<RpcResult<T>>;

  const { data, error } = await call(functionName, args);

  if (error) {
    throw new Error(
      error.message || "Music provenance request failed.",
    );
  }

  return data as T;
}

export function getMyMusicCredits(): Promise<MusicCreditsWorkspace> {
  return provenanceRpc<MusicCreditsWorkspace>(
    "get_my_music_credits_v1",
  );
}

export function searchMusicCreditPeople(
  query: string,
): Promise<MusicCreditPersonCandidate[]> {
  const needle = query.trim();
  if (needle.length < 2) return Promise.resolve([]);

  return provenanceRpc<MusicCreditPersonCandidate[]>(
    "search_music_credit_people_v1",
    {
      p_query: needle,
      p_limit: 8,
    },
  );
}

export async function createMyMusicCreditAttestation(input: {
  subjectKind: MusicCreditSubjectKind;
  subjectId: string;
  roleKey: string;
  instrumentKey?: string | null;
  detailText?: string | null;
  creditedAs?: string | null;
  proposedPersonResourceId?: string | null;
  proposedArtistId?: string | null;
  elicitationMethod?: "open_response" | "self_claim" | "suggested_confirmation";
  candidateShownPayload?: Record<string, unknown> | null;
  idempotencyKey: string;
}): Promise<{
  attestationId: string;
  state: string;
  idempotentReplay: boolean;
}> {
  return provenanceRpc(
    "create_my_music_credit_attestation_v1",
    {
      p_subject_kind: input.subjectKind,
      p_subject_id: input.subjectId,
      p_role_key: input.roleKey,
      p_instrument_key: input.instrumentKey ?? null,
      p_detail_text: input.detailText ?? null,
      p_credited_as: input.creditedAs ?? null,
      p_proposed_person_resource_id:
        input.proposedPersonResourceId ?? null,
      p_proposed_artist_id: input.proposedArtistId ?? null,
      p_elicitation_method:
        input.elicitationMethod ?? "open_response",
      p_candidate_shown_payload:
        input.candidateShownPayload ?? null,
      p_idempotency_key: input.idempotencyKey,
    },
  );
}

export function createMusicCreditInvitation(input: {
  parentAttestationId: string;
  inviteePersonResourceId?: string | null;
  inviteeCreditedAs?: string | null;
  expiresInDays?: number;
}): Promise<{
  invitationId: string;
  sharePath: string;
  expiresAt: string;
  notificationDelivered: boolean;
  deliveryMode: "existing_user_notification" | "inviter_share_only";
}> {
  return provenanceRpc(
    "create_music_credit_invitation_v1",
    {
      p_parent_attestation_id:
        input.parentAttestationId,
      p_invitee_person_resource_id:
        input.inviteePersonResourceId ?? null,
      p_invitee_credited_as:
        input.inviteeCreditedAs ?? null,
      p_expires_in_days:
        input.expiresInDays ?? 14,
    },
  );
}

export function getMusicCreditInvite(
  inviteRef: string,
): Promise<MusicCreditInviteContext | null> {
  return provenanceRpc<MusicCreditInviteContext | null>(
    "get_music_credit_invite_v1",
    { p_invite_ref: inviteRef },
  );
}

export function respondMusicCreditInvitation(
  inviteRef: string,
  responseMode: "accepted" | "disputed" | "declined",
  reason?: string | null,
): Promise<{
  invitationId: string;
  state: string;
  responseAttestationId: string | null;
}> {
  return provenanceRpc(
    "respond_music_credit_invitation_v1",
    {
      p_invite_ref: inviteRef,
      p_response_mode: responseMode,
      p_reason: reason ?? null,
    },
  );
}

export function transitionMyMusicCreditAttestation(
  attestationId: string,
  action: "withdrawn" | "disputed",
  reason?: string | null,
): Promise<{
  attestationId: string;
  state: string;
  idempotentReplay: boolean;
}> {
  return provenanceRpc(
    "transition_my_music_credit_attestation_v1",
    {
      p_attestation_id: attestationId,
      p_action: action,
      p_reason: reason ?? null,
    },
  );
}

export function setMyMusicCreditPermission(
  item: MusicCreditPermissionItem,
  next: Partial<
    Pick<
      MusicCreditPermission,
      | "publicDisplay"
      | "cmoRightsContexts"
      | "approvedPartnerKeys"
      | "thirdPartyCommercialReuse"
    >
  >,
): Promise<{
  permissionId: string;
  attestationId: string;
  changeKind: string;
  publicDisplay: boolean;
  cmoRightsContexts: string[];
  approvedPartnerKeys: string[];
  thirdPartyCommercialReuse: boolean;
}> {
  const current = item.permission;

  return provenanceRpc(
    "set_my_music_credit_permission_v1",
    {
      p_attestation_id: item.attestationId,
      p_public_display:
        next.publicDisplay ?? current.publicDisplay,
      p_cmo_rights_contexts:
        next.cmoRightsContexts ?? current.cmoRightsContexts,
      p_approved_partner_keys:
        next.approvedPartnerKeys ?? current.approvedPartnerKeys,
      p_third_party_commercial_reuse:
        next.thirdPartyCommercialReuse
        ?? current.thirdPartyCommercialReuse,
      p_reason: "Creator updated sharing permissions.",
    },
  );
}

export function getPublicPersonMusicCredits(
  personId: string,
): Promise<PublicPersonMusicCredits | null> {
  return provenanceRpc<PublicPersonMusicCredits | null>(
    "get_public_person_music_credits_v1",
    { p_person_resource_id: personId },
  );
}

export function getPublicArtistMusicProvenance(
  artistId: string,
): Promise<PublicArtistMusicProvenance | null> {
  return provenanceRpc<PublicArtistMusicProvenance | null>(
    "get_public_artist_music_provenance_v1",
    { p_artist_id: artistId },
  );
}

export function getPublicTrackProvenanceById(
  trackId: string,
): Promise<{
  recordingContributions: unknown[];
  works: Array<{
    id: string;
    title: string;
    relationshipKind: string;
    contributions: unknown[];
  }>;
  provenanceReceipt: {
    summary: string;
    lastCheckedAt: string | null;
  } | null;
} | null> {
  return provenanceRpc(
    "get_public_track_provenance_v1",
    { p_track_id: trackId },
  );
}
