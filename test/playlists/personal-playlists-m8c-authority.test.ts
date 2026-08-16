import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260816130000_personal_playlists_m8c_authority.sql",
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-personal-playlists-m8c-authority.sql",
  "utf8",
);

const signatures = [
  "create_personal_playlist(text,text,text,text,text,uuid)",
  "update_personal_playlist(uuid,bigint,jsonb,text,uuid)",
  "add_personal_playlist_track(uuid,bigint,uuid,text,uuid)",
  "remove_personal_playlist_item(uuid,uuid,bigint,text,uuid)",
  "reorder_personal_playlist_items(uuid,bigint,uuid[],text,uuid)",
  "archive_personal_playlist(uuid,bigint,text,text,uuid)",
  "list_my_personal_playlists(boolean,integer)",
  "get_my_personal_playlist(uuid)",
  "get_my_personal_playlist_by_route(text,text)",
  "get_public_personal_playlist(text,text)",
  "list_public_personal_playlists_for_username(text,integer)",
];

describe(
  "WAKILISHA M8C-M1 Personal Playlist authority",
  () => {
    it(
      "keeps Personal Playlists inside the canonical Playlist domain",
      () => {
        expect(migration).toContain(
          "add column playlist_kind text not null default 'editorial'",
        );
        expect(migration).toContain(
          "check (playlist_kind in ('editorial', 'personal'))",
        );
        expect(migration).toContain(
          "insert into public.wk_playlists",
        );
        expect(migration).toContain(
          "insert into editorial.playlist_resources",
        );
        expect(migration).not.toContain(
          "create table public.user_playlists",
        );
        expect(migration).not.toContain(
          "create table public.personal_playlists",
        );
      },
    );

    it(
      "does not grant consumer ownership through editorial capabilities",
      () => {
        expect(migration).toContain(
          "editorial.current_user_owns_personal_playlist",
        );
        expect(migration).toContain(
          "resource.owner_id = auth.uid()",
        );
        expect(migration).not.toContain(
          "grant edit_own_playlists to authenticated",
        );
        expect(migration).not.toContain(
          "current_user_can_edit_playlist(binding.resource_id)",
        );
      },
    );

    it(
      "keeps the accepted editorial read policies and adds owner-only Personal reads",
      () => {
        expect(migration).toContain(
          "create policy wk_playlists_personal_owner_read",
        );
        expect(migration).toContain(
          "create policy wk_playlist_items_personal_owner_read",
        );
        expect(migration).not.toContain(
          "drop policy if exists wk_playlists_authenticated_read",
        );
        expect(migration).not.toContain(
          "drop policy if exists wk_playlists_public_published_read",
        );
      },
    );

    it(
      "supports create, edit, visibility, Track add/remove/reorder, archive, and owned reads",
      () => {
        for (const name of [
          "create_personal_playlist",
          "update_personal_playlist",
          "add_personal_playlist_track",
          "remove_personal_playlist_item",
          "reorder_personal_playlist_items",
          "archive_personal_playlist",
          "list_my_personal_playlists",
          "get_my_personal_playlist",
        ]) {
          expect(migration).toContain(`function public.${name}`);
        }

        expect(migration).toContain(
          "v_visibility not in ('private', 'public')",
        );
        expect(migration).toContain(
          "lifecycle_state = 'removed'",
        );
        expect(migration).toContain(
          "status = 'archived'",
        );
      },
    );

    it(
      "reuses canonical Playlist command receipts instead of inventing a parallel ledger",
      () => {
        for (const commandType of [
          "playlist.create",
          "playlist.metadata.update",
          "playlist.item.add",
          "playlist.item.remove",
          "playlist.items.reorder",
          "playlist.archive",
        ]) {
          expect(migration).toContain(`'${commandType}'`);
        }

        expect(migration).not.toContain(
          "playlist.personal.create",
        );
      },
    );

    it(
      "exposes only safe public Personal Playlist reads and profile ownership",
      () => {
        expect(migration).toContain(
          "function public.get_public_personal_playlist",
        );
        expect(migration).toContain(
          "function public.list_public_personal_playlists_for_username",
        );
        expect(migration).toContain(
          "resource.visibility = 'public'",
        );
        expect(migration).toContain(
          "profile.is_public",
        );
        expect(migration).not.toContain(
          "wk_playlists_personal_public_read",
        );
      },
    );

    it(
      "classifies every new browser-reachable RPC",
      () => {
        for (const signature of signatures) {
          expect(migration).toContain(signature);
          expect(verifier).toContain(signature);
        }
        expect(migration).toContain(
          "private.phase_0a_rpc_classification",
        );
      },
    );

    it(
      "ships a read-only verifier and no Edge Function",
      () => {
        expect(verifier).toContain(
          "wakilisha_m8c_m1_personal_playlist_verification",
        );
        expect(verifier).not.toContain("insert into");
        expect(verifier).not.toContain("update public.");
        expect(verifier).not.toContain("delete from");
        expect(migration).not.toContain("supabase/functions/");
      },
    );

    it(
      "keeps M8C runtime authority free of em and en dashes",
      () => {
        for (const source of [migration, verifier]) {
          expect(source).not.toContain("—");
          expect(source).not.toContain("–");
        }
      },
    );
  },
);
