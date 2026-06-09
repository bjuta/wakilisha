import type { ProviderFieldObservationInput } from './field-observation-mapper';

export type RegistryEntitySnapshot = {
  registryEntityType: 'release' | 'track' | 'artist';
  registryEntityId: string;
  fields: Record<string, string | null | undefined>;
};

export type RegistryEnrichmentSuggestionInput = {
  registryEntityType: RegistryEntitySnapshot['registryEntityType'];
  registryEntityId: string;
  fieldName: string;
  currentValue: string | null;
  suggestedValue: string;
  providerItemId: string | null;
  confidenceScore: number;
  decisionStatus: 'draft';
};

export type SuggestionBuildOptions = {
  minConfidenceScore?: number;
  allowOverwrite?: boolean;
};

export function buildEnrichmentSuggestions(
  registryEntity: RegistryEntitySnapshot,
  observations: ProviderFieldObservationInput[],
  options: SuggestionBuildOptions = {},
): RegistryEnrichmentSuggestionInput[] {
  const minConfidenceScore = options.minConfidenceScore ?? 0.75;
  const allowOverwrite = options.allowOverwrite ?? false;

  const suggestions: RegistryEnrichmentSuggestionInput[] = [];

  for (const observation of observations) {
    if (observation.entityType !== registryEntity.registryEntityType) continue;
    if (!observation.fieldValue) continue;
    if (observation.confidenceScore < minConfidenceScore) continue;

    const currentValue = normalizeNullableValue(registryEntity.fields[observation.fieldName]);
    const suggestedValue = observation.fieldValue.trim();

    if (!suggestedValue) continue;
    if (valuesMatch(currentValue, suggestedValue)) continue;
    if (currentValue && !allowOverwrite) continue;

    suggestions.push({
      registryEntityType: registryEntity.registryEntityType,
      registryEntityId: registryEntity.registryEntityId,
      fieldName: observation.fieldName,
      currentValue,
      suggestedValue,
      providerItemId: observation.providerItemId,
      confidenceScore: observation.confidenceScore,
      decisionStatus: 'draft',
    });
  }

  return dedupeSuggestions(suggestions);
}

function normalizeNullableValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function valuesMatch(currentValue: string | null, suggestedValue: string): boolean {
  if (!currentValue) return false;
  return normalizeComparable(currentValue) === normalizeComparable(suggestedValue);
}

function normalizeComparable(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function dedupeSuggestions(
  suggestions: RegistryEnrichmentSuggestionInput[],
): RegistryEnrichmentSuggestionInput[] {
  const seen = new Set<string>();

  return suggestions.filter((suggestion) => {
    const key = [
      suggestion.registryEntityType,
      suggestion.registryEntityId,
      suggestion.fieldName,
      suggestion.suggestedValue,
    ].join('::');

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
