import type { CreateIngestDryRunRequest } from "./ingestStudioTypes";

export type WpCreateIngestDryRunPayload = {
  chart_title: string;
  chart_slug: string;
  edition_date: string;
  chart_size: number;
  market: string;
  chart_kind: CreateIngestDryRunRequest["chartKind"];
  cover_style: string;
  source_urls: string[];
  save_as_recurring_series: boolean;
  existing_series_id: string | null;
  eligibility_profile_id: string | null;
  market_scope_id: string | null;
  market_scope_snapshot: CreateIngestDryRunRequest["marketScopeSnapshot"];
  enrichment_options: CreateIngestDryRunRequest["enrichmentOptions"];
};

export function normalizeDryRunRequest(request: CreateIngestDryRunRequest): CreateIngestDryRunRequest {
  return {
    ...request,
    coverStyle: request.coverStyle ?? "default",
    saveAsRecurringSeries: request.saveAsRecurringSeries ?? false,
    existingSeriesId: request.existingSeriesId ?? null,
    eligibilityProfileId: request.eligibilityProfileId ?? null,
    marketScopeId: request.marketScopeId ?? null,
    marketScopeSnapshot: request.marketScopeSnapshot ?? null,
    enrichmentOptions: request.enrichmentOptions ?? null,
  };
}

export function toWpCreateIngestDryRunPayload(request: CreateIngestDryRunRequest): WpCreateIngestDryRunPayload {
  const normalized = normalizeDryRunRequest(request);

  return {
    chart_title: normalized.chartTitle,
    chart_slug: normalized.chartSlug,
    edition_date: normalized.editionDate,
    chart_size: normalized.chartSize,
    market: normalized.market,
    chart_kind: normalized.chartKind,
    cover_style: normalized.coverStyle ?? "default",
    source_urls: normalized.sourceUrls,
    save_as_recurring_series: normalized.saveAsRecurringSeries ?? false,
    existing_series_id: normalized.existingSeriesId ?? null,
    eligibility_profile_id: normalized.eligibilityProfileId ?? null,
    market_scope_id: normalized.marketScopeId ?? null,
    market_scope_snapshot: normalized.marketScopeSnapshot ?? null,
    enrichment_options: normalized.enrichmentOptions ?? null,
  };
}
