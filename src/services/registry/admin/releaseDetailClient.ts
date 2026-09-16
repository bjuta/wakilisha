import { supabase } from "@/lib/supabase";

export interface RegistryReleaseDetailPatch {
  title: string;
  release_type: string | null;
  upc: string | null;
  release_date: string | null;
  release_date_precision: string | null;
  label_id: string | null;
  description: string | null;
  artwork_url: string | null;
  status: string;
}

export async function saveRegistryReleaseDetail(
  releaseId: string,
  patch: RegistryReleaseDetailPatch,
  expectedUpdatedAt: string,
): Promise<{
  ok: boolean;
  data: Record<string, unknown> | null;
  error: string | null;
  stale: boolean;
}> {
  const { data, error } = await supabase.rpc(
    "admin_patch_registry_release_detail_v1",
    {
      p_release_id: releaseId,
      p_title: patch.title,
      p_release_type: patch.release_type,
      p_upc: patch.upc,
      p_release_date: patch.release_date,
      p_release_date_precision: patch.release_date_precision,
      p_label_id: patch.label_id,
      p_description: patch.description,
      p_artwork_url: patch.artwork_url,
      p_status: patch.status,
      p_expected_updated_at: expectedUpdatedAt,
    },
  );

  if (error) {
    const stale = error.code === "40001";
    return {
      ok: false,
      data: null,
      error: stale
        ? "Release changed after this editor loaded it. Reload before saving again."
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
