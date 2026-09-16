import { supabase } from "@/lib/supabase";

type MusicArchiveEntityType = "track" | "release";

async function archiveRegistryMusicEntity(
  entityType: MusicArchiveEntityType,
  entityId: string,
  expectedUpdatedAt: string,
): Promise<{
  ok: boolean;
  data: Record<string, unknown> | null;
  error: string | null;
  stale: boolean;
}> {
  const { data, error } = await supabase.rpc(
    "admin_archive_registry_music_entity_v1",
    {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_expected_updated_at: expectedUpdatedAt,
    },
  );

  if (error) {
    const stale = error.code === "40001";
    return {
      ok: false,
      data: null,
      error: stale
        ? `${entityType === "track" ? "Track" : "Release"} changed after this editor loaded it. Reload before archiving.`
        : error.message,
      stale,
    };
  }

  return {
    ok: true,
    data: data && typeof data === "object" ? data as Record<string, unknown> : null,
    error: null,
    stale: false,
  };
}

export function archiveRegistryTrack(entityId: string, expectedUpdatedAt: string) {
  return archiveRegistryMusicEntity("track", entityId, expectedUpdatedAt);
}

export function archiveRegistryRelease(entityId: string, expectedUpdatedAt: string) {
  return archiveRegistryMusicEntity("release", entityId, expectedUpdatedAt);
}
