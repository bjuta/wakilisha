import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const baselinePath =
  "supabase/migrations/20260814202000_wakilisha_production_baseline.sql";

const baseline = readFileSync(
  baselinePath,
  "utf8",
);

const defaultPrivilegeMarker =
  "-- WAKILISHA REPLAY DEFAULT-PRIVILEGE NORMALIZATION --";

const serviceRoleMarker =
  "-- WAKILISHA REPLAY SERVICE_ROLE EXECUTE NORMALIZATION --";

const exactServiceRoleRevokes = [
  "REVOKE EXECUTE ON FUNCTION public.add_playlist_registry_track_with_intake_slots(uuid,bigint,uuid,text,uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.add_playlist_validated_provider_track(uuid,bigint,uuid,uuid,text,uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.add_playlist_validated_provider_track_with_intake_slots(uuid,bigint,uuid,uuid,text,uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.admin_get_registry_track_intake_enrichment(uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.admin_get_registry_track_intake_queue(text,integer,integer,uuid,uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.admin_record_registry_track_intake_provider_evidence(uuid,text,text,text,jsonb,jsonb,numeric) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.admin_reject_registry_track_intake(uuid,text) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.admin_resolve_registry_track_intake(uuid,uuid,text) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.admin_save_registry_track_intake_enrichment(uuid,jsonb,text) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.admin_select_registry_track_intake_provider_evidence(uuid,text,text,text) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.admin_update_registry_track_intake_artist_credit(uuid,integer,text,text,uuid,text) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.adopt_verified_media_upload_session_v1(uuid,text,text,uuid,uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.cancel_media_upload_session_v1(uuid,text) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.create_institute_playlist_draft(uuid,text,text,text,jsonb) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.create_media_upload_session_v1(text,text,text,bigint,text,integer,uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.create_media_upload_session_v2(text,text,text,bigint,text,integer,uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.create_registry_track_intake_suggestion(uuid,uuid,text,uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.current_user_can_edit_playlist_id(uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.get_media_private_delivery_target_v1(uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.get_media_upload_session_v1(uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.get_playlist_cover_source(uuid,uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.get_playlist_pending_registry_intake(uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.get_playlist_pending_registry_intake_editorial(uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.guard_registry_track_intake_provider_selection() FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.move_playlist_pending_registry_intake(uuid,uuid,bigint,text,text,uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.read_media_assets_admin_v2(jsonb) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.remove_playlist_item_with_intake_slots(uuid,uuid,bigint,text,uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.reorder_playlist_items_with_intake_slots(uuid,bigint,uuid[],text,uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.save_playlist_pending_registry_note(uuid,uuid,bigint,text,text,uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.set_playlist_cover(uuid,bigint,uuid,text,jsonb,text,text,text,uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.submit_media_processing_command_v1(uuid,uuid,text,text,uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.submit_playlist_registry_intake(uuid,bigint,uuid,jsonb,text,uuid) FROM service_role;",
  "REVOKE EXECUTE ON FUNCTION public.sync_registry_track_intake_artist_credits(uuid,uuid) FROM service_role;",
] as const;

describe(
  "replay baseline default privilege parity",
  () => {
    it(
      "normalizes fresh-project defaults before application routines are created",
      () => {
        const markerIndex =
          baseline.indexOf(defaultPrivilegeMarker);

        const firstApplicationFunctionIndex =
          baseline.indexOf(
            'CREATE OR REPLACE FUNCTION "editorial".',
          );

        expect(markerIndex)
          .toBeGreaterThan(-1);
        expect(firstApplicationFunctionIndex)
          .toBeGreaterThan(markerIndex);

        expect(baseline)
          .toContain(
            'REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, "anon", "authenticated";',
          );
        expect(baseline)
          .toContain(
            'REVOKE ALL ON SEQUENCES FROM "anon", "authenticated";',
          );
        expect(baseline)
          .toContain(
            'REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM "anon", "authenticated";',
          );
      },
    );

    it(
      "locks the exact production service_role execution perimeter",
      () => {
        const markerIndex =
          baseline.indexOf(serviceRoleMarker);

        expect(markerIndex)
          .toBeGreaterThan(-1);

        const tail =
          baseline.slice(markerIndex);

        const actualRevokes =
          tail
            .split("\n")
            .map((line) => line.trim())
            .filter((line) =>
              line.startsWith(
                "REVOKE EXECUTE ON FUNCTION public.",
              )
              && line.endsWith(
                " FROM service_role;",
              ),
            );

        expect(actualRevokes)
          .toHaveLength(34);

        expect(
          [...actualRevokes].sort(),
        ).toEqual(
          [...exactServiceRoleRevokes].sort(),
        );
      },
    );

    it(
      "keeps the sensitive Article acceptance RPC out of fresh-project anonymous defaults",
      () => {
        expect(baseline)
          .toContain(
            'REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, "anon", "authenticated";',
          );

        expect(baseline)
          .toContain(
            'REVOKE ALL ON FUNCTION "public"."accept_article_suggestion"',
          );
      },
    );
  },
);
