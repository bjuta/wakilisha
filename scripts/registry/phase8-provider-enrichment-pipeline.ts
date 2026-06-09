import { mapReleaseToFieldObservations } from '../../src/services/registry/provider-enrichment/field-observation-mapper';
import { buildEnrichmentSuggestions } from '../../src/services/registry/provider-enrichment/enrichment-suggestion-builder';
import type { NormalizedProviderRelease } from '../../src/types/registry/normalized-provider-payload';

export type Phase8ProviderEnrichmentRunInput = {
  releases: NormalizedProviderRelease[];
  dryRun?: boolean;
};

export type Phase8ProviderEnrichmentRunResult = {
  releaseCount: number;
  fieldObservationCount: number;
  enrichmentSuggestionCount: number;
};

export function runPhase8ProviderEnrichment(
  input: Phase8ProviderEnrichmentRunInput,
): Phase8ProviderEnrichmentRunResult {
  const dryRun = input.dryRun ?? true;

  let fieldObservationCount = 0;
  let enrichmentSuggestionCount = 0;

  console.log('\nWAKILISHA Phase 8 Provider Enrichment Pipeline');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}`);
  console.log(`Releases: ${input.releases.length}`);

  for (const release of input.releases) {
    console.log('\nRelease');
    console.log('-'.repeat(80));
    console.log(`Provider: ${release.provider}`);
    console.log(`Provider release ID: ${release.providerReleaseId ?? 'unknown'}`);
    console.log(`Title: ${release.release.title}`);
    console.log(`Artist: ${release.release.artistDisplayName ?? 'unknown'}`);
    console.log(`Storefront/market: ${release.release.storefrontOrMarket ?? 'unknown'}`);

    const observations = mapReleaseToFieldObservations(
      release,
      release.providerReleaseId,
    );

    fieldObservationCount += observations.length;

    const registrySnapshot = {
      registryEntityType: 'release' as const,
      registryEntityId: release.providerReleaseId ?? 'dry-run-release',
      fields: {
        title: null,
        artist_display_name: null,
        release_date: null,
        release_type: null,
        track_count: null,
        upc: null,
        ean: null,
        label_name: null,
        copyright_text: null,
        genres: null,
        storefront_or_market: null,
        artwork_url: null,
        provider_url: null,
      },
    };

    const suggestions = buildEnrichmentSuggestions(
      registrySnapshot,
      observations,
      {
        minConfidenceScore: 0.75,
        allowOverwrite: false,
      },
    );

    enrichmentSuggestionCount += suggestions.length;

    console.log(`Field observations: ${observations.length}`);
    console.log(`Release suggestions: ${suggestions.length}`);

    console.log('\nTop release suggestions');
    console.table(
      suggestions.slice(0, 12).map((suggestion) => ({
        field: suggestion.fieldName,
        suggested: suggestion.suggestedValue,
        confidence: suggestion.confidenceScore,
      })),
    );
  }

  const result = {
    releaseCount: input.releases.length,
    fieldObservationCount,
    enrichmentSuggestionCount,
  };

  console.log('\nPhase 8 summary');
  console.log('-'.repeat(80));
  console.table([result]);

  if (dryRun) {
    console.log('\nDry run complete. No canonical writes performed.');
  }

  return result;
}
