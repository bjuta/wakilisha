/**
 * V2 Programs — resolved from Supabase (rpc_get_chart_programs).
 * No hardcoded program data. Everything comes from the database.
 *
 * NOTE: rpc_get_chart_programs returns a JSONB aggregate wrapped as:
 *   [{ rpc_get_chart_programs: [...] }]
 * We unwrap it here so resolveV2Program works correctly.
 */

import { supabase } from "@/lib/supabase";
import type { V2Program } from "./commitTypes";

export type { V2Program };

let cachedPrograms: V2Program[] | null = null;

export async function loadV2Programs(): Promise<V2Program[]> {
  if (cachedPrograms && cachedPrograms.length > 0) return cachedPrograms;

  const { data, error } = await supabase.rpc("rpc_get_chart_programs");

  if (error || !data) {
    cachedPrograms = [];
    return [];
  }

  // The RPC returns a JSONB aggregate wrapped as:
  //   [{ rpc_get_chart_programs: [{...}, {...}] }]
  // Supabase client may return this as-is because the function
  // returns `jsonb` type which the client treats as opaque JSON.
  let rows: Record<string, unknown>[] = [];

  if (Array.isArray(data)) {
    const first = data[0] as Record<string, unknown> | undefined;
    if (first && Array.isArray(first.rpc_get_chart_programs)) {
      // Nested wrapper: [{ rpc_get_chart_programs: [...] }]
      rows = first.rpc_get_chart_programs as Record<string, unknown>[];
    } else if (first && typeof first.id === "string") {
      // Flat array of program objects
      rows = data as Record<string, unknown>[];
    }
  }

  cachedPrograms = rows.map((row) => ({
    id: row.id as string,
    publicSlug: (row.public_slug as string) ?? (row.id as string),
    seriesSlug: (row.series_slug as string) ?? "",
    marketSlug: (row.market_slug as string) ?? "",
    label: (row.label as string) ?? (row.public_label as string) ?? (row.series_slug as string) ?? "",
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

  const byId = programs.find((p) => p.id === publicSlugOrId);
  if (byId) return byId;

  const bySlug = programs.find((p) => p.publicSlug === publicSlugOrId);
  if (bySlug) return bySlug;

  const bySeries = programs.find((p) => p.seriesSlug === publicSlugOrId);
  if (bySeries) return bySeries;

  return null;
}