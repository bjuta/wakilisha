/**
 * V2 Programs — resolved from Supabase (rpc_get_chart_programs).
 * No hardcoded program data. Everything comes from the database.
 */

import { supabase } from "@/lib/supabase";
import type { V2Program } from "./commitTypes";

export type { V2Program };

let cachedPrograms: V2Program[] | null = null;

export async function loadV2Programs(): Promise<V2Program[]> {
  const { data, error } = await supabase.rpc("rpc_get_chart_programs");

  if (error || !data) {
    cachedPrograms = [];
    return [];
  }

  const rows = (data as Record<string, unknown>[]) ?? [];
  cachedPrograms = rows.map((row) => ({
    id: row.id as string,
    publicSlug: (row.public_slug as string) ?? (row.id as string),
    seriesSlug: (row.series_slug as string) ?? "",
    marketSlug: (row.market_slug as string) ?? "",
    label: (row.public_label as string) ?? (row.series_slug as string) ?? "",
    defaultMethodologyVersion:
      (row.default_methodology_version as string) ?? "weighted_streaming_v1",
    defaultEligibilityRulesVersion:
      (row.default_eligibility_rules_version as string) ?? "default_v1",
  }));

  return cachedPrograms;
}

/**
 * Resolve a V2 program from a public slug, program ID, or series slug.
 * Reads from Supabase — no hardcoded data.
 */
export async function resolveV2Program(
  publicSlugOrId: string | undefined
): Promise<V2Program | null> {
  if (!publicSlugOrId) return null;

  const programs = await loadV2Programs();

  const bySlug = programs.find((p) => p.publicSlug === publicSlugOrId);
  if (bySlug) return bySlug;

  const byId = programs.find((p) => p.id === publicSlugOrId);
  if (byId) return byId;

  const bySeries = programs.find((p) => p.seriesSlug === publicSlugOrId);
  if (bySeries) return bySeries;

  return null;
}