import { mapReleaseToFieldObservations } from '../../src/services/registry/provider-enrichment/field-observation-mapper';
import { buildEnrichmentSuggestions } from '../../src/services/registry/provider-enrichment/enrichment-suggestion-builder';
import { buildProviderEntityLinks } from '../../src/services/registry/provider-enrichment/provider-entity-linker';
import type { ProviderEnrichmentWriteStore } from '../../src/services/registry/provider-enrichment/provider-enrichment-write-store';
import type { NormalizedProviderRelease } from '../../src/types/registry/normalized-provider-payload';

export type Phase8ProviderEnrichmentRunInput = {
  releases: NormalizedProviderRelease[];
  dryRun?: boolean;
  writeStore?: ProviderEnrichmentWriteStore;
  includeTrackLinks?: boolean;
  includeArtistLinks?: boolean;
};

export type Phase8ProviderEnrichmentRunResult = {
  releaseCount: number;
  fieldObservationCount: number;
  enrichmentSuggestionCount: number;
  providerEntityLinkCount: number;
  writtenFieldObservationCount: number;
  writtenEnrichmentSuggestionCount: number;
  writtenProviderEntityLinkCount: number;
};

export async function runPhase8ProviderEnrichment(
  input: Phase8ProviderEnrichmentRunInput,
): Promise<Phase8ProviderEnrichmentRunResult> {
  const dryRun = input.dryRun ?? true;

  if (!dryRun && !input.writeStore) {
    throw new Error('Phase 8B write mode requires a writeStore.');
  }

  let fieldObservationCount = 0;
  let enrichmentSuggestionCount = 0;
  let providerEntityLinkCount = 0;
  let writtenFieldObservationCount = 0;
  let writtenEnrichmentSuggestionCount = 0;
  let writtenProviderEntityLinkCount = 0;

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

    const registryReleaseId = release.providerReleaseId ?? 'dry-run-release';

    const observations = mapReleaseToFieldObservations(
      release,
      release.providerReleaseId,
    );

    fieldObservationCount += observations.length;

    const registrySnapshot = {
      registryEntityType: 'release' as const,
      registryEntityId: registryReleaseId,
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

    const providerEntityLinks = buildProviderEntityLinks(release, {
      registryReleaseId,
      includeTrackLinks: input.includeTrackLinks ?? false,
      includeArtistLinks: input.includeArtistLinks ?? false,
    });

    providerEntityLinkCount += providerEntityLinks.length;

    console.log(`Field observations: ${observations.length}`);
    console.log(`Release suggestions: ${suggestions.length}`);
    console.log(`Provider entity links: ${providerEntityLinks.length}`);

    console.log('\nTop release suggestions');
    console.table(
      suggestions.slice(0, 12).map((suggestion) => ({
        field: suggestion.fieldName,
        suggested: suggestion.suggestedValue,
        confidence: suggestion.confidenceScore,
      })),
    );

    if (!dryRun && input.writeStore) {
      const writtenObservations = await input.writeStore.writeFieldObservations(observations);
      const writtenSuggestions = await input.writeStore.writeEnrichmentSuggestions(suggestions);
      const writtenLinks = await input.writeStore.writeProviderEntityLinks(providerEntityLinks);

      writtenFieldObservationCount += writtenObservations;
      writtenEnrichmentSuggestionCount += writtenSuggestions;
      writtenProviderEntityLinkCount += writtenLinks;

      console.log('\nWrite results');
      console.table([
        {
          fieldObservations: writtenObservations,
          enrichmentSuggestions: writtenSuggestions,
          providerEntityLinks: writtenLinks,
        },
      ]);
    }
  }

  const result = {
    releaseCount: input.releases.length,
    fieldObservationCount,
    enrichmentSuggestionCount,
    providerEntityLinkCount,
    writtenFieldObservationCount,
    writtenEnrichmentSuggestionCount,
    writtenProviderEntityLinkCount,
  };

  console.log('\nPhase 8 summary');
  console.log('-'.repeat(80));
  console.table([result]);

  if (dryRun) {
    console.log('\nDry run complete. No canonical writes performed.');
  } else {
    console.log('\nWrite mode complete. Staging writes only. No canonical writes performed.');
  }

  return result;
}
