import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const identityMigration = read(
  "supabase/migrations/20260929160420_music_provenance_slice1_attestation_identity_authority_v1.sql",
);
const admissionMigration = read(
  "supabase/migrations/20260929160423_music_provenance_slice1_work_contribution_admission_v1.sql",
);
const reviewBindingIntegrityMigration = read(
  "supabase/migrations/20260929185454_music_provenance_slice1_review_binding_integrity_v1.sql",
);
const verifier = read(
  "scripts/control-plane/verify-music-provenance-slice1-authority.sql",
);
const behaviorVerifier = read(
  "scripts/control-plane/verify-music-provenance-slice1-behavior.sql",
);
const slice2Verifier = read(
  "scripts/control-plane/verify-music-identity-rights-slice2-authority.sql",
);

const slice2ParticipationMigration = read(
  "supabase/migrations/20260929194020_music_provenance_slice2_creator_public_authority_v1.sql",
);
const creditsPage = read(
  "src/pages/credits/page.tsx",
);
const creditInvitePage = read(
  "src/pages/credits/invite/page.tsx",
);
const claimComposer = read(
  "src/components/music/ClaimComposer.tsx",
);
const musicProvenanceService = read(
  "src/services/musicProvenance.ts",
);
const notificationsPage = read(
  "src/pages/notifications/page.tsx",
);
const publicContentRead = read(
  "supabase/functions/public-content-read/index.ts",
);
const seoSitemapAdmin = read(
  "supabase/functions/seo-sitemap-admin/index.ts",
);
const artistPage = read(
  "src/pages/artists/detail/page.tsx",
);
const personPage = read(
  "src/pages/people/detail/page.tsx",
);
const artistTopSongs = read(
  "src/pages/artists/detail/components/ArtistTopSongs.tsx",
);
const artistMusicProvenance = read(
  "src/pages/artists/detail/components/ArtistMusicProvenance.tsx",
);
const slice2ParticipationVerifier = read(
  "scripts/control-plane/verify-music-provenance-slice2-participation.sql",
);
const publicContentSpec = read(
  "src/data/api-specs/public-content-read.ts",
);
const publicContentOpenApi = read(
  "docs/openapi/public-content-read.yaml",
);

const releasePage = read(
  "src/pages/releases/detail/page.tsx",
);
const mobileReleasePage = read(
  "src/pages/mobile/releases/detail/page.tsx",
);
const releaseMusicProvenance = read(
  "src/pages/releases/detail/components/ReleaseMusicProvenance.tsx",
);
const releaseStructuredData = read(
  "src/services/publicContent/releaseStructuredData.ts",
);
const artistDisplay = read(
  "src/utils/musicArtistDisplay.ts",
);

function between(
  source: string,
  startMarker: string,
  endMarker: string,
): string {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`Missing end marker: ${endMarker}`);
  return source.slice(start, end + endMarker.length);
}

const executor = between(
  admissionMigration,
  "create function platform_private.execute_registry_provenance_admin_v1(",
  "end\n$$;",
);

const groupMembershipRpc = between(
  identityMigration,
  "create function public.admin_admit_registry_artist_person_membership_v1(",
  "end\n$$;",
);

describe("Music provenance Slice 1 authority", () => {
  it("preserves typed attestation semantics instead of overloading Artist claim evidence", () => {
    expect(identityMigration).toContain(
      "platform_private.registry_contribution_attestations",
    );
    expect(identityMigration).toContain(
      "platform_private.registry_contribution_attestation_state_events",
    );
    expect(identityMigration).toContain(
      "platform_private.registry_contribution_attestation_permission_versions",
    );

    for (const mode of [
      "open_response",
      "self_claim",
      "suggested_confirmation",
      "counterparty_confirmation",
      "imported_source",
    ]) {
      expect(identityMigration).toContain(mode);
    }

    for (const state of [
      "asserted",
      "corroborated",
      "confirmed",
      "disputed",
      "withdrawn",
      "superseded",
    ]) {
      expect(identityMigration).toContain(state);
    }

    expect(identityMigration).toContain("candidate_shown");
    expect(identityMigration).toContain("prompt_version");
    expect(identityMigration).toContain("parent_attestation_id");
    expect(identityMigration).toContain("source_use_basis");
    expect(identityMigration).toContain("independence_group_hint");
  });

  it("keeps attestation and sharing history append-only and creator-scoped", () => {
    expect(identityMigration).toContain(
      "reject_registry_provenance_history_mutation_v1",
    );
    expect(identityMigration).toContain(
      "registry_contribution_attestations_append_only",
    );
    expect(identityMigration).toContain(
      "registry_contribution_attestation_state_events_append_only",
    );
    expect(identityMigration).toContain(
      "registry_contribution_attestation_permissions_append_only",
    );
    expect(identityMigration).toContain(
      "registry_contribution_attestation_permissions_one_root",
    );
    expect(identityMigration).toContain(
      "registry_contribution_attestation_permissions_one_successor",
    );
    expect(identityMigration).toContain(
      "event_sequence bigint generated always as identity unique",
    );
    expect(identityMigration).toContain(
      "order by event.event_sequence desc",
    );
    expect(identityMigration).toContain("public_display");
    expect(identityMigration).toContain("cmo_rights_contexts");
    expect(identityMigration).toContain("approved_partner_keys");
    expect(identityMigration).toContain(
      "third_party_commercial_reuse",
    );
    expect(identityMigration).toContain("change_kind in ('grant','replace','withdraw')");
  });

  it("adds a narrow governed Person-to-Registry-Artist bridge without destabilizing Person source identity", () => {
    expect(identityMigration).toContain(
      "create table editorial.person_registry_artist_links",
    );
    expect(identityMigration).toContain(
      "person_registry_artist_links_current_artist_unique",
    );
    expect(identityMigration).toContain(
      "admin_link_person_registry_artist_v1",
    );
    expect(identityMigration).toContain(
      "transfer_person_registry_artist_links_on_merge_v1",
    );
    expect(identityMigration).not.toContain(
      "alter table editorial.person_identity_links\n  add column registry_artist_id",
    );
    expect(identityMigration).toContain(
      "Registry Artist bridge was incorrectly turned into automatic Person presentation authority.",
    );
  });

  it("binds reviewed Person/Artist and Group-membership evidence to the exact candidate", () => {
    expect(identityMigration).toContain(
      "'person_resource_id',p_person_resource_id::text",
    );
    expect(identityMigration).toContain(
      "'registry_artist_id',p_registry_artist_id::text",
    );
    expect(identityMigration).toContain(
      "'group_artist_id',p_group_artist_id::text",
    );
    expect(identityMigration).toContain(
      "'role_key',p_role_key",
    );
    expect(identityMigration).toContain(
      "v_evidence.claim_payload<>",
    );
  });

  it("keeps Group membership typed and separate from Recording participation", () => {
    expect(identityMigration).toContain(
      "public.registry_artist_person_memberships",
    );
    expect(identityMigration).toContain(
      "Typed Group Artist to Person membership authority",
    );
    expect(groupMembershipRpc).toContain(
      "artist_type not in ('band','group','collective','duo')",
    );
    expect(groupMembershipRpc).not.toContain(
      "registry_track_contributions",
    );
    expect(groupMembershipRpc).not.toContain(
      "registry_work_contributions",
    );
  });

  it("enables exactly the four already-declared v1 Work/Contribution operation families", () => {
    for (const operation of [
      "registry.work.create",
      "registry.track_work_link.admit",
      "registry.track_contribution.admit",
      "registry.work_contribution.admit",
    ]) {
      expect(admissionMigration).toContain(operation);
    }

    expect(admissionMigration).toContain("operation_version',1");
    expect(admissionMigration).toContain("max_rows_ceiling=1");
    expect(admissionMigration).toContain("max_grant_ttl_seconds=300");
    expect(admissionMigration).toContain("requires_human_approval");
    expect(admissionMigration).toContain("requires_verifier");
    expect(admissionMigration).not.toContain(
      "registry.track_contribution.admit.v2",
    );
    expect(admissionMigration).not.toContain(
      "registry.work_contribution.admit.v2",
    );

    expect(slice2Verifier).toContain(
      "registry.track_contribution.admit",
    );
    expect(slice2Verifier).toContain(
      "registry.work_contribution.admit",
    );
  });

  it("keeps grant subject typing PL/pgSQL-safe", () => {
    expect(admissionMigration).toContain(
      "v_expected_subject_type:=case p_operation_key",
    );
    expect(admissionMigration).toContain(
      "p_subject_type is distinct from v_expected_subject_type",
    );
    expect(admissionMigration).not.toContain(
      "p_subject_type is distinct from case p_operation_key",
    );
  });

  it("binds every reviewed provenance grant to immutable evidence trust class", () => {
    expect(reviewBindingIntegrityMigration).toContain(
      "'trust_class',v_evidence.trust_class",
    );
    expect(reviewBindingIntegrityMigration).toContain(
      "v_evidence.trust_class is distinct from",
    );
    expect(reviewBindingIntegrityMigration).toContain(
      "v_plan->>'trust_class'",
    );
    expect(verifier).toContain(
      "Provenance executor is not sealed to immutable evidence trust class",
    );
    expect(verifier).toContain(
      "Reviewed provenance plan lacks trust-class binding",
    );
  });

  it("keeps canonical writes behind human exact grants with zero standing authority", () => {
    expect(admissionMigration).toContain(
      "authority_mode','human_exact_grant'",
    );
    expect(admissionMigration).toContain(
      "required_user_capability_key",
    );
    expect(admissionMigration).toContain("'manage_registry'");
    expect(admissionMigration).toContain(
      "system_actor_capability_grant_id",
    );
    expect(admissionMigration).toContain(
      "registry_execution_target_set_fingerprint",
    );
    expect(admissionMigration).toContain(
      "begin_registry_mutation_operation",
    );
    expect(admissionMigration).toContain(
      "registry_operation_write_events",
    );
    expect(admissionMigration).toContain(
      "public.registry_canonical_write_events",
    );
    expect(admissionMigration).toContain(
      "Registry provenance admin gained standing autonomous authority.",
    );
  });

  it("allows unresolved credited_as without manufacturing a Person", () => {
    expect(identityMigration).toContain(
      "registry_contribution_attestations_contributor_presence_check",
    );
    expect(identityMigration).toContain("credited_as is not null");
    expect(admissionMigration).toContain(
      "v_attestation.credited_as",
    );
    expect(executor).not.toContain("insert into editorial.people");
    expect(executor).not.toContain("create_person_for_identity");
  });

  it("re-locks contributor identities before canonical contribution writes", () => {
    expect(executor).toContain("from editorial.people person");
    expect(executor).toContain("person.person_state='active'");
    expect(executor).toContain("from editorial.organizations organization");
    expect(executor).toContain("organization.organization_state='active'");
    expect(executor).toContain("from public.registry_artists artist");
    expect(executor).toContain("artist.status<>'archived'");
    expect(executor).toContain("for update");
  });

  it("does not infer rights or Recording participation from contribution or membership", () => {
    expect(executor).not.toContain(
      "insert into public.registry_rights_claims",
    );
    expect(executor).not.toContain(
      "update public.registry_rights_claims",
    );
    expect(groupMembershipRpc).not.toContain(
      "registry_track_contributions",
    );
    expect(groupMembershipRpc).not.toContain(
      "registry_work_contributions",
    );
  });

  it("does not silently promote a self-claim", () => {
    expect(admissionMigration).toContain(
      "WK_PROVENANCE_ATTESTATION_REVIEW_REQUIRED",
    );
    expect(admissionMigration).toContain(
      "v_attestation.elicitation_method='self_claim'",
    );
    expect(admissionMigration).toContain(
      "v_state<>'confirmed'",
    );
  });

  it("keeps Preview behavioral acceptance rollback-only and covers the frozen exit chain", () => {
    expect(behaviorVerifier.trimStart()).toMatch(/^-- Rollback-only/);
    expect(behaviorVerifier).toContain("begin;");
    expect(behaviorVerifier.trimEnd()).toMatch(/rollback;$/);
    expect(behaviorVerifier).toContain(
      "MUSIC_PROVENANCE_SLICE1_BEHAVIOR_V1_PASS",
    );
    expect(behaviorVerifier).toContain(
      "WK_PROVENANCE_ATTESTATION_REVIEW_REQUIRED",
    );
    expect(behaviorVerifier).toContain(
      "Unresolved Fixture Producer",
    );
    expect(behaviorVerifier).toContain(
      "public.registry_rights_claims",
    );
    expect(behaviorVerifier).toContain(
      "v_track_contributions_after_membership",
    );
    expect(behaviorVerifier).toContain(
      "v_active_grants<>0",
    );
    expect(behaviorVerifier).toContain(
      "v_passed_operations<>4",
    );
  });

  it("retains RLS/ACL fail-closed and independent verification", () => {
    expect(identityMigration).toContain(
      "alter table public.registry_artist_person_memberships\n  enable row level security",
    );
    expect(identityMigration).toContain(
      "from public,anon,authenticated,service_role",
    );
    expect(admissionMigration).toContain(
      "verify_registry_provenance_admin_v1",
    );
    expect(admissionMigration).toContain(
      "from public,anon,authenticated,service_role",
    );
    expect(admissionMigration).toContain(
      "Provenance canonical tables leaked direct insert authority.",
    );
    expect(verifier).toContain(
      "MUSIC_PROVENANCE_SLICE1_AUTHORITY_V1_PASS",
    );
  });

});


describe("Music provenance Slice 2 participation and public product", () => {
  it("converges Person and Artist public product on verified canonical provenance only", () => {
    expect(personPage).toContain(
      "getPublicPersonMusicCredits",
    );
    expect(personPage).toContain(
      'id: "music"',
    );
    expect(personPage).toContain(
      "PersonMusicCredits",
    );
    expect(artistPage).toContain(
      "ArtistMusicProvenance",
    );
    expect(artistMusicProvenance).toContain(
      "Recording roles",
    );
    expect(artistMusicProvenance).toContain(
      "Songwriting & Work roles",
    );
    expect(artistMusicProvenance).toContain(
      "Membership is a relationship to this Artist identity",
    );
    expect(publicContentRead).toContain(
      "get_public_artist_music_provenance_v1",
    );
    expect(publicContentRead).not.toContain(
      "public Artist music provenance pending attestation",
    );
  });

  it("keeps multi-MainArtist public routes on active structured Track Artist authority", () => {
    const artistFallback = between(
      publicContentRead,
      "async function getArtistPublicTracksFromCredits(",
      "function buildProgramSummary",
    );
    const chartResolver = between(
      publicContentRead,
      "async function resolvePublicChartEntryArtists(",
      "function extractLabelAndGenres",
    );

    expect(artistFallback).toContain(
      '.eq("status", "active")',
    );
    expect(artistFallback).toContain(
      "const mainArtists = credits.filter",
    );
    expect(artistFallback).toContain(
      "const pageMainArtist = mainArtists.find",
    );
    expect(artistFallback).not.toContain(
      "PUBLIC_MUSIC_RELATIONSHIP_STATUSES",
    );

    expect(chartResolver).toContain(
      "canonical_track_id",
    );
    expect(chartResolver).toContain(
      '.eq("status", "active")',
    );
    expect(chartResolver).not.toContain(
      "trackSlugsNeedingLookup",
    );

    expect(artistTopSongs).toContain(
      "artistSlug: song.artistSlug || artistSlug",
    );
    expect(artistTopSongs).toContain(
      "trackSlug: song.slug",
    );

    expect(seoSitemapAdmin).toContain(
      "preferredOrderedArtist",
    );
    expect(seoSitemapAdmin).toContain(
      "normalizedCreditOrder",
    );
    expect(seoSitemapAdmin).toContain(
      "!Boolean(row.is_primary)",
    );
    expect(seoSitemapAdmin).not.toContain(
      "row.credit_order || 999",
    );
    const sitemapTrackLoop = between(
      seoSitemapAdmin,
      "for (const row of tracks.data ?? [])",
      "for (const row of genres.data ?? [])",
    );
    expect(sitemapTrackLoop).not.toContain(
      "primary_artist_slug",
    );
    expect(sitemapTrackLoop).not.toContain(
      "meta.artist_slug",
    );
  });
  it("keeps invitation context private, append-only, token-hashed, and inviter-mediated", () => {
    expect(slice2ParticipationMigration).toContain(
      "create table platform_private.registry_contribution_invitations",
    );
    expect(slice2ParticipationMigration).toContain(
      "create table platform_private.registry_contribution_invitation_events",
    );
    expect(slice2ParticipationMigration).toContain(
      "registry_contribution_invitations_append_only",
    );
    expect(slice2ParticipationMigration).toContain(
      "registry_contribution_invitation_events_append_only",
    );
    expect(slice2ParticipationMigration).toContain(
      "token_hash text not null unique",
    );
    expect(slice2ParticipationMigration).toContain(
      "extensions.gen_random_bytes(32)",
    );
    const invitationTable = between(
      slice2ParticipationMigration,
      "create table platform_private.registry_contribution_invitations (",
      ");",
    );
    expect(invitationTable).not.toContain(
      "raw_token",
    );
    expect(slice2ParticipationMigration).toContain(
      "inviter_share_only",
    );
  });

  it("uses Notifications for an existing WAKILISHA invitee and never adds a cold outreach sender", () => {
    expect(slice2ParticipationMigration).toContain(
      "'credit_confirmation_request'",
    );
    expect(slice2ParticipationMigration).toContain(
      "'credit_confirmation_response'",
    );
    expect(slice2ParticipationMigration).toContain(
      "messaging.active_user_for_person",
    );
    expect(slice2ParticipationMigration).toContain(
      "insert into public.community_notifications",
    );
    for (const coldRoad of [
      "send_email",
      "send_sms",
      "resend",
      "twilio",
      "net.http_post",
      "http_post(",
    ]) {
      expect(slice2ParticipationMigration.toLowerCase()).not.toContain(
        coldRoad,
      );
    }
    expect(notificationsPage).toContain(
      "credit_confirmation_request",
    );
    expect(notificationsPage).toContain(
      "credit_confirmation_response",
    );
    expect(notificationsPage).toContain(
      'notification.entityType === "music_credit_invite"',
    );
  });

  it("makes creator attestation open-response-first and keeps canonical contribution admission separate", () => {
    const creatorCommand = between(
      slice2ParticipationMigration,
      "create function public.create_my_music_credit_attestation_v1(",
      "end\n$$;",
    );

    expect(creatorCommand).toContain(
      "'open_response','self_claim','suggested_confirmation'",
    );
    expect(creatorCommand).toContain(
      "p_candidate_shown_payload is null",
    );
    expect(creatorCommand).toContain(
      "v_person_id:=v_actor.person_resource_id",
    );
    expect(creatorCommand).toContain(
      "v_credited_as",
    );
    expect(creatorCommand).toContain(
      "pg_catalog.pg_advisory_xact_lock",
    );
    expect(creatorCommand).not.toContain(
      "insert into public.registry_track_contributions",
    );
    expect(creatorCommand).not.toContain(
      "insert into public.registry_work_contributions",
    );
    expect(claimComposer).toContain(
      'contributorMode === "self"',
    );
    expect(claimComposer).toContain(
      '? "self_claim"',
    );
    expect(claimComposer).toContain(
      ': "open_response"',
    );
    expect(claimComposer).not.toContain(
      "Open response first",
    );
    expect(claimComposer).toContain(
      "Not on WAKILISHA yet",
    );
    expect(claimComposer).toContain(
      "People on WAKILISHA get a notification. Otherwise, we’ll give you a private link to share.",
    );
  });

  it("binds counterparty confirmation to the exact parent candidate and preserves disputes", () => {
    const responseCommand = between(
      slice2ParticipationMigration,
      "create function public.respond_music_credit_invitation_v1(",
      "end\n$$;",
    );

    expect(responseCommand).toContain(
      "'counterparty_confirmation'",
    );
    expect(responseCommand).toContain(
      "'parent_attestation_id',v_parent.id",
    );
    expect(responseCommand).toContain(
      "'credited_as',v_parent.credited_as",
    );
    expect(responseCommand).toContain(
      "'role_key',v_parent.role_key",
    );
    expect(responseCommand).toContain(
      "candidate_shown_payload",
    );
    expect(responseCommand).toContain(
      "then 'confirmed'",
    );
    expect(responseCommand).toContain(
      "else 'disputed'",
    );
  });

  it("keeps sharing permission versioned and independent from historical fact", () => {
    const permissionCommand = between(
      slice2ParticipationMigration,
      "create function public.set_my_music_credit_permission_v1(",
      "end\n$$;",
    );
    const transitionCommand = between(
      slice2ParticipationMigration,
      "create function public.transition_my_music_credit_attestation_v1(",
      "end\n$$;",
    );

    expect(permissionCommand).toContain(
      "registry_contribution_attestation_permission_versions",
    );
    expect(permissionCommand).toContain(
      "supersedes_permission_id",
    );
    expect(permissionCommand).toContain(
      "music_provenance_creator_sharing",
    );
    expect(transitionCommand).toContain(
      "'withdraw'",
    );
    expect(transitionCommand).not.toContain(
      "delete from platform_private.registry_contribution_attestations",
    );
  });

  it("publishes only verified canonical contribution authority, never pending attestations", () => {
    const trackPublic = between(
      slice2ParticipationMigration,
      "create function public.get_public_track_provenance_v1(",
      "end\n$$;",
    );
    const personPublic = between(
      slice2ParticipationMigration,
      "create function public.get_public_person_music_credits_v1(",
      "end\n$$;",
    );
    const artistPublic = between(
      slice2ParticipationMigration,
      "create function public.get_public_artist_music_provenance_v1(",
      "end\n$$;",
    );

    for (const publicRead of [trackPublic, personPublic, artistPublic]) {
      expect(publicRead).toContain("'verified'");
      expect(publicRead).not.toContain(
        "platform_private.registry_contribution_attestations",
      );
    }

    expect(trackPublic).toContain(
      "public.registry_track_contributions",
    );
    expect(trackPublic).toContain(
      "public.registry_work_contributions",
    );
    expect(trackPublic).toContain(
      "public.registry_track_work_links",
    );
    expect(personPublic).toContain(
      "resource.visibility='public'",
    );
    expect(artistPublic).toContain(
      "public.registry_artist_person_memberships",
    );
  });

  it("records canonical admission in creator Activity when reviewed contribution authority completes", () => {
    const workspaceRead = between(
      slice2ParticipationMigration,
      "create function public.get_my_music_credits_v1()",
      "end\n$$;",
    );

    expect(workspaceRead).toContain(
      "'kind','canonical_admission'",
    );
    expect(workspaceRead).toContain(
      "public.registry_track_contributions",
    );
    expect(workspaceRead).toContain(
      "public.registry_work_contributions",
    );
    expect(workspaceRead).toContain(
      "contribution.status='verified'",
    );
  });

  it("seals Slice 2 database invariants in a permanent SQL verifier", () => {
    expect(slice2ParticipationVerifier).toContain(
      "MUSIC_PROVENANCE_SLICE2_PARTICIPATION_V1_PASS",
    );
    expect(slice2ParticipationVerifier).toContain(
      "registry_contribution_invitations_append_only",
    );
    expect(slice2ParticipationVerifier).toContain(
      "Creator attestation gained canonical Contribution or Rights mutation authority",
    );
    expect(slice2ParticipationVerifier).toContain(
      "Public provenance read is not sealed to verified canonical authority",
    );
  });

  it("keeps public-content-read OpenAPI aligned with structured contribution and route authority", () => {
    for (const contract of [publicContentSpec, publicContentOpenApi]) {
      expect(contract).toContain("TrackDetailPayload");
      expect(contract).toContain("MusicContribution");
      expect(contract).toContain("WorkProvenance");
      expect(contract).toContain("ProvenanceReceipt");
      expect(contract).toContain("TrackRouteBinding");
      expect(contract).toContain("ArtistMusicProvenance");
    }

    expect(publicContentSpec).toContain(
      "FeaturedArtist does not gain route ownership",
    );
    expect(publicContentOpenApi).toContain(
      "FeaturedArtist does not gain route ownership",
    );
  });

  it("provides the complete creator workspace and invite landing without exposing generated schema debt", () => {
    expect(slice2ParticipationMigration).toContain(
      "create function public.get_my_music_credits_v1()",
    );
    for (const section of [
      "needsYou",
      "yourWork",
      "activity",
      "sharingPermissions",
    ]) {
      expect(slice2ParticipationMigration).toContain(section);
      expect(creditsPage).toContain(section);
    }
    expect(creditInvitePage).toContain("Credit confirmation");
    expect(creditInvitePage).toContain("Confirm");
    expect(creditInvitePage).toContain("Dispute");
    expect(creditInvitePage).toContain("Decline");
    expect(musicProvenanceService).toContain(
      "temporary typed",
    );
    expect(musicProvenanceService).toContain(
      "canonical Supabase type snapshot",
    );
  });
});

describe("Music provenance Slice 3 public surface convergence", () => {
  it("keeps Release contribution presentation derived from Track and Work authority", () => {
    expect(releaseMusicProvenance).toContain(
      "Who worked on this release",
    );
    expect(releaseMusicProvenance).toContain(
      "Release Artist billing is separate from contribution roles.",
    );
    expect(releaseMusicProvenance).toContain(
      "WAKILISHA does not infer contribution from Release Artist billing.",
    );
    expect(publicContentRead).toContain(
      "loadPublicTrackProvenance",
    );
    expect(publicContentRead).toContain(
      "releaseMusicProvenance",
    );
    expect(publicContentRead).toContain(
      "publicReleaseArtists",
    );
    expect(publicContentRead).not.toContain(
      "registry_release_contributions",
    );
    expect(releaseMusicProvenance).not.toContain(
      "release_contributions",
    );
  });

  it("uses one Release provenance surface on desktop and mobile", () => {
    expect(releasePage).toContain(
      "ReleaseMusicProvenance",
    );
    expect(mobileReleasePage).toContain(
      "ReleaseMusicProvenance",
    );
    expect(releasePage).toContain(
      "buildReleaseSchemaArtists",
    );
    expect(mobileReleasePage).toContain(
      "buildReleaseSchemaArtists",
    );
  });

  it("preserves ordered Person vs MusicGroup Release Artist ontology", () => {
    expect(releaseStructuredData).toContain(
      "a.creditOrder",
    );
    expect(releaseStructuredData).toContain(
      "b.creditOrder",
    );
    expect(releaseStructuredData).toContain(
      'artistType === "solo"',
    );
    expect(releaseStructuredData).toContain(
      "if (!artistType) return [];",
    );
    expect(releaseStructuredData).toContain(
      '"Person"',
    );
    expect(releaseStructuredData).toContain(
      '"MusicGroup"',
    );
    expect(publicContentRead).toContain(
      "creditOrder: Number.isFinite(Number(row.credit_order))",
    );
    expect(publicContentRead).toContain(
      "artistType:",
    );
  });

  it("keeps Release provenance documented in both public API contracts", () => {
    for (const contract of [
      publicContentSpec,
      publicContentOpenApi,
    ]) {
      expect(contract).toContain(
        "ReleaseArtist",
      );
      expect(contract).toContain(
        "ReleaseTrackProvenance",
      );
      expect(contract).toContain(
        "ReleaseMusicProvenance",
      );
    }
  });

  it("removes grouping punctuation from Artist display tokens", () => {
    expect(artistTopSongs).toContain(
      "splitMusicArtistDisplayNames",
    );
    expect(artistDisplay).toContain(
      "bracketedFeature",
    );
    expect(artistDisplay).toContain(
      "feat",
    );
    expect(artistDisplay).toContain(
      ".replace(/^[([{]+",
    );
    expect(artistDisplay).toContain(
      ".replace(/\\s*[)\\]}]+$/",
    );
  });
});

describe("Creator credits cohort blocker repair", () => {
  it("keeps Supabase RPC calls bound to the client instance", () => {
    expect(musicProvenanceService).toContain(
      "await client.rpc(functionName, args)",
    );
    expect(musicProvenanceService).not.toContain(
      "await call(functionName, args)",
    );
  });

  it("hydrates a deep-linked Track directly and searches the full Registry server-side", () => {
    expect(musicProvenanceService).toContain(
      "export async function getMusicCreditTrackById",
    );
    expect(musicProvenanceService).toContain(
      '"search_public_registry_v1"',
    );
    expect(musicProvenanceService).toContain(
      'p_types: ["track"]',
    );
    expect(claimComposer).toContain(
      "getMusicCreditTrackById",
    );
    expect(claimComposer).toContain(
      "setSelectedTrack(track)",
    );
    expect(claimComposer).not.toContain(
      "useTrackSearchData",
    );
  });

  it("keeps internal provenance doctrine out of creator-facing copy", () => {
    for (const internalCopy of [
      "Open response first",
      "hidden metadata guess",
      "fake Person",
      "canonical Registry",
      "No active Registry recording",
      "Loading verified Works",
      "canonical credits and assertions",
      "Append-only history",
      "submit an attestation",
      "Music provenance",
    ]) {
      expect(claimComposer).not.toContain(
        internalCopy,
      );
      expect(creditsPage).not.toContain(
        internalCopy,
      );
    }

    expect(claimComposer).toContain(
      "Choose the recording, add the role, and tell us who the credit belongs to.",
    );
    expect(claimComposer).toContain(
      "People on WAKILISHA get a notification. Otherwise, we’ll give you a private link to share.",
    );
    expect(creditsPage).toContain(
      "Review your credits, confirmation requests, disputes, and sharing choices.",
    );
  });

  it("does not expose raw workspace exceptions to the creator", () => {
    expect(creditsPage).toContain(
      "We couldn’t load your credits. Try again.",
    );
    expect(creditsPage).toContain(
      "Could not load credits workspace:",
    );
    expect(creditsPage).not.toContain(
      "error.message\n          : \"Could not load your credits.\"",
    );
  });
});

