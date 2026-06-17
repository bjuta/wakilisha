import { normalizePublicPunctuation, validatePublicTone } from "./guards";
import { normalizeCultureFacts } from "./normalize";
import { markAdminOutput } from "./recipes/admin";
import { buildArtistContext } from "./recipes/artist";
import { buildChartContext } from "./recipes/chart";
import { buildGenreContext } from "./recipes/genre";
import { buildLabelContext } from "./recipes/label";
import { buildReleaseContext } from "./recipes/release";
import { buildSearchContext } from "./recipes/search";
import { trimSeoDescription } from "./recipes/seo";
import { buildTrackContext } from "./recipes/track";
import type {
  ArtistFacts,
  ChartFacts,
  CultureContextInput,
  CultureContextOptions,
  CultureContextOutput,
  CultureFacts,
  CultureRecipeResult,
  GenreFacts,
  LabelFacts,
  ReleaseFacts,
  SearchResultFacts,
  TrackFacts,
} from "./types";

export * from "./types";
export * from "./facts";

export const CULTURE_CONTEXT_ENGINE_VERSION = "culture-context-v1";

const DEFAULT_OPTIONS: Required<CultureContextOptions> = {
  tone: "public",
  maxLength: "medium",
  includeStats: true,
};

function buildRecipeResult(input: CultureContextInput, facts: CultureFacts, options: Required<CultureContextOptions>): CultureRecipeResult {
  if (input.entityType === "track") return buildTrackContext({ facts: facts as TrackFacts, surface: input.surface, options });
  if (input.entityType === "artist") return buildArtistContext({ facts: facts as ArtistFacts, surface: input.surface, options });
  if (input.entityType === "release") return buildReleaseContext({ facts: facts as ReleaseFacts, surface: input.surface, options });
  if (input.entityType === "label") return buildLabelContext({ facts: facts as LabelFacts, surface: input.surface, options });
  if (input.entityType === "genre") return buildGenreContext({ facts: facts as GenreFacts, surface: input.surface, options });
  if (input.entityType === "chart") return buildChartContext({ facts: facts as ChartFacts, surface: input.surface, options });
  return buildSearchContext({ facts: facts as SearchResultFacts, surface: input.surface, options });
}

export function buildCultureContext(input: CultureContextInput): CultureContextOutput {
  const options: Required<CultureContextOptions> = {
    ...DEFAULT_OPTIONS,
    ...(input.options || {}),
  };

  const facts = normalizeCultureFacts(input.entityType, input.data);
  const result = buildRecipeResult(input, facts, options);
  const publicText = options.tone === "public" ? normalizePublicPunctuation(result.text) : result.text;
  const publicWarnings = options.tone === "public" ? validatePublicTone(publicText) : [];

  const output: CultureContextOutput = {
    text: publicText,
    confidence: result.confidence,
    factsUsed: result.factsUsed,
    warnings: [...(result.warnings || []), ...publicWarnings],
    recipe: result.recipe,
    version: CULTURE_CONTEXT_ENGINE_VERSION,
  };

  if (input.surface === "seoDescription") return trimSeoDescription(output);
  if (input.surface === "adminQualityNote") return markAdminOutput(output);
  return output;
}
