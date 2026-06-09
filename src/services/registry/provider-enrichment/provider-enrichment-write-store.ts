import type { Pool, PoolClient } from 'pg';
import type { ProviderFieldObservationInput } from './field-observation-mapper';
import type { RegistryEnrichmentSuggestionInput } from './enrichment-suggestion-builder';
import type { ProviderEntityLinkInput } from './provider-entity-linker';

export type ProviderEnrichmentWriteStore = {
  writeFieldObservations(observations: ProviderFieldObservationInput[]): Promise<number>;
  writeEnrichmentSuggestions(suggestions: RegistryEnrichmentSuggestionInput[]): Promise<number>;
  writeProviderEntityLinks(links: ProviderEntityLinkInput[]): Promise<number>;
};

export type PostgresProviderEnrichmentWriteStoreOptions = {
  pool: Pool;
};

export class PostgresProviderEnrichmentWriteStore implements ProviderEnrichmentWriteStore {
  private readonly pool: Pool;

  constructor(options: PostgresProviderEnrichmentWriteStoreOptions) {
    this.pool = options.pool;
  }

  async writeFieldObservations(observations: ProviderFieldObservationInput[]): Promise<number> {
    if (observations.length === 0) return 0;

    return this.withTransaction(async (client) => {
      let written = 0;

      for (const observation of observations) {
        await client.query(
          `
            insert into public.provider_field_observations (
              provider_item_id,
              entity_type,
              field_name,
              field_value,
              provider,
              confidence_score,
              source_path,
              raw_payload
            ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          `,
          [
            observation.providerItemId,
            observation.entityType,
            observation.fieldName,
            observation.fieldValue,
            observation.provider,
            observation.confidenceScore,
            observation.sourcePath,
            JSON.stringify(observation.rawPayload ?? {}),
          ],
        );
        written += 1;
      }

      return written;
    });
  }

  async writeEnrichmentSuggestions(suggestions: RegistryEnrichmentSuggestionInput[]): Promise<number> {
    if (suggestions.length === 0) return 0;

    return this.withTransaction(async (client) => {
      let written = 0;

      for (const suggestion of suggestions) {
        await client.query(
          `
            insert into public.registry_enrichment_suggestions (
              registry_entity_type,
              registry_entity_id,
              field_name,
              current_value,
              suggested_value,
              provider_item_id,
              confidence_score,
              decision_status
            ) values ($1, $2::uuid, $3, $4, $5, $6, $7, $8)
          `,
          [
            suggestion.registryEntityType,
            suggestion.registryEntityId,
            suggestion.fieldName,
            suggestion.currentValue,
            suggestion.suggestedValue,
            suggestion.providerItemId,
            suggestion.confidenceScore,
            suggestion.decisionStatus,
          ],
        );
        written += 1;
      }

      return written;
    });
  }

  async writeProviderEntityLinks(links: ProviderEntityLinkInput[]): Promise<number> {
    if (links.length === 0) return 0;

    return this.withTransaction(async (client) => {
      let written = 0;

      for (const link of links) {
        await client.query(
          `
            insert into public.provider_entity_links (
              registry_entity_type,
              registry_entity_id,
              provider,
              provider_entity_id,
              provider_url,
              match_status,
              confidence_score
            ) values ($1, $2::uuid, $3, $4, $5, $6, $7)
          `,
          [
            link.registryEntityType,
            link.registryEntityId,
            link.provider,
            link.providerEntityId,
            link.providerUrl,
            link.matchStatus,
            link.confidenceScore,
          ],
        );
        written += 1;
      }

      return written;
    });
  }

  private async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('begin');
      const result = await operation(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
}
