import type { MagazineIssueArticle } from './magazineIssues';
import {
  clampConfidence,
  makeVisualBriefId,
  validateVisualBrief,
  type MagazineVisualBrief,
  type MagazineVisualDirectorInput,
  type MagazineVisualSpreadRole,
} from './magazineVisualSchemas';
import { buildContrastSafePalette, contrastModeForPalette } from './magazineVisualContrast';
import { paletteForSection, type MagazineVisualFamily, type MagazineVisualTreatment, type MagazineVisualType } from './magazineVisualTaxonomy';

const CITY_PATTERNS = [
  'Nairobi', 'Johannesburg', 'Lagos', 'Accra', 'Dakar', 'Kampala', 'Dar es Salaam', 'Addis Ababa', 'Cape Town', 'Mombasa', 'Kigali', 'Abidjan', 'Kinshasa', 'Cairo', 'London', 'New York', 'Paris', 'Venice', 'Dubai', 'Gedi'
];

function articleText(article?: MagazineIssueArticle): string {
  if (!article) return '';
  return [article.title, article.dek, article.section, article.canonicalSection, ...(article.tags ?? []), ...(article.body ?? []).slice(0, 5)].filter(Boolean).join(' ');
}

function findCities(text: string): string[] {
  const found = CITY_PATTERNS.filter((city) => new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
  return Array.from(new Set(found));
}

function findYears(text: string): string[] {
  return Array.from(new Set(text.match(/\b(19|20)\d{2}\b/g) ?? [])).slice(0, 8);
}

function spreadRoleFor(type: string): MagazineVisualSpreadRole {
  if (type === 'cover') return 'cover_key_visual';
  if (type === 'feature') return 'feature_opener';
  if (type === 'section-opener') return 'section_opener';
  if (type === 'quote-only') return 'quote_page';
  if (type === 'signal') return 'data_spread';
  if (type === 'partner') return 'partner_surface';
  if (type === 'back-matter') return 'back_matter';
  if (type === 'color-interlude' || type === 'full-bleed-image') return 'interlude';
  return 'inline_support';
}

function classifyVisual(input: MagazineVisualDirectorInput): {
  visual_family: MagazineVisualFamily;
  visual_type: MagazineVisualType;
  treatment: MagazineVisualTreatment;
  confidence: number;
  rationale: string;
  required_data: Record<string, string | number | boolean | string[]>;
} {
  const { article, issue, spread } = input;
  const text = articleText(article);
  const cities = findCities(text);
  const years = findYears(text);
  const lower = text.toLowerCase();
  const section = article?.canonicalSection ?? spread.section ?? issue.primaryVerticals[0];

  if (issue.issueNumber === 1 && /afrohouse|johannesburg|nairobi|sound migration|second home/i.test(text)) {
    return {
      visual_family: 'Map / Route / Migration',
      visual_type: 'sound_migration_field_record',
      treatment: 'night-map',
      confidence: 0.9,
      rationale: 'Issue 001 feature context supports the original sound-migration field record treatment.',
      required_data: { origin: 'Johannesburg', destination: 'Nairobi', cities: ['Johannesburg', 'Nairobi'], years },
    };
  }

  if (cities.length >= 2) {
    return {
      visual_family: 'Map / Route / Migration',
      visual_type: /guide|field|travel|where to/.test(lower) ? 'field_guide_route' : 'city_to_city_route',
      treatment: 'route-line',
      confidence: 0.78,
      rationale: 'Article contains multiple place signals, so a route or migration visual can explain movement.',
      required_data: { origin: cities[0], destination: cities[1], cities, years },
    };
  }

  if (/copyright|bill|policy|rights|law|platform|algorithm|funding|system|future/.test(lower)) {
    return {
      visual_family: 'Evidence / Dossier',
      visual_type: /algorithm|platform/.test(lower) ? 'platform_algorithm_blackbox' : /funding/.test(lower) ? 'funding_gap_receipt' : 'policy_dossier',
      treatment: 'stamped-document',
      confidence: 0.76,
      rationale: 'Systems language suggests a dossier/evidence visual should clarify claims and structures.',
      required_data: { keywords: ['rights', 'system', 'policy'].filter((word) => lower.includes(word)), years },
    };
  }

  if (/song|album|ep|track|playlist|chart|release|artist|label|genre|music/.test(lower)) {
    return {
      visual_family: 'Signal / Data Intelligence',
      visual_type: /chart/.test(lower) ? 'chart_power_index' : /label/.test(lower) ? 'label_ownership_strip' : 'listening_map',
      treatment: 'data-strip',
      confidence: 0.7,
      rationale: 'Music/release language suggests a listening map or signal board rather than a generic image.',
      required_data: { section: section ?? 'music', years, article_title: article?.title ?? spread.title },
    };
  }

  if (/language|translation|lyric|vernacular|word|phrase/.test(lower)) {
    return {
      visual_family: 'Language / Translation',
      visual_type: /lyric/.test(lower) ? 'lyric_fragment_poster' : 'language_translation_sheet',
      treatment: 'typographic',
      confidence: 0.72,
      rationale: 'Language signals should become type-led graphics or phrase sheets.',
      required_data: { article_title: article?.title ?? spread.title, years },
    };
  }

  if (/book|archive|memory|oral|library|history|remember/.test(lower)) {
    return {
      visual_family: 'Archive / Memory',
      visual_type: /library|book/.test(lower) ? 'library_card' : 'archive_file',
      treatment: 'paper-file',
      confidence: 0.68,
      rationale: 'Memory/archive language suggests paper-file or library-card treatment.',
      required_data: { article_title: article?.title ?? spread.title, years },
    };
  }

  if (/food|ingredient|source|eat|drink|diet/.test(lower)) {
    return {
      visual_family: 'Material / Texture',
      visual_type: 'food_origin_trace',
      treatment: 'field-guide',
      confidence: 0.65,
      rationale: 'Food/source language suggests a trace or ingredient field-note visual.',
      required_data: { article_title: article?.title ?? spread.title, years },
    };
  }

  if (/fashion|textile|garment|material|fabric|design/.test(lower)) {
    return {
      visual_family: 'Material / Texture',
      visual_type: /textile|fabric/.test(lower) ? 'textile_pattern_study' : 'fashion_material_board',
      treatment: 'cutout-collage',
      confidence: 0.65,
      rationale: 'Fashion/material language suggests boards, studies, or object diagrams.',
      required_data: { article_title: article?.title ?? spread.title, years },
    };
  }

  if (spread.type === 'partner') {
    return {
      visual_family: 'Commercial / Patronage',
      visual_type: 'patronage_surface',
      treatment: 'stamped-document',
      confidence: 0.82,
      rationale: 'Partner spreads should become desirable patronage surfaces, not banner inventory.',
      required_data: { issue: issue.issueLabel },
    };
  }

  if (spread.type === 'quote-only') {
    return {
      visual_family: 'Quote / Manifesto',
      visual_type: 'one_sentence_full_page',
      treatment: 'poster',
      confidence: 0.84,
      rationale: 'Quote-only spread is intentionally a pause page.',
      required_data: { quote: spread.title },
    };
  }

  return {
    visual_family: article?.heroUrl ? 'Scene / Atmosphere' : 'Quote / Manifesto',
    visual_type: article?.heroUrl ? 'full_bleed_atmosphere' : 'quote_only_poster',
    treatment: article?.heroUrl ? 'annotated-photo' : 'poster',
    confidence: article?.heroUrl ? 0.58 : 0.48,
    rationale: 'Fallback decision: use available imagery as atmosphere or create a quote/poster visual.',
    required_data: { article_title: article?.title ?? spread.title, has_image: Boolean(article?.heroUrl) },
  };
}

export function buildMagazineVisualBrief(input: MagazineVisualDirectorInput): MagazineVisualBrief {
  const { issue, spread, article } = input;
  const classification = classifyVisual(input);
  const palette = paletteForSection(article?.canonicalSection ?? spread.section ?? issue.primaryVerticals[0]);
  const safePalette = buildContrastSafePalette(palette);
  const contrast_mode = classification.treatment === 'annotated-photo' ? 'image-overlay' : contrastModeForPalette(palette);

  return validateVisualBrief({
    id: makeVisualBriefId({ issue, spread, article }),
    issue_id: issue.id,
    spread_id: spread.id,
    article_id: article?.slug,
    visual_family: classification.visual_family,
    visual_type: classification.visual_type,
    editorial_intent: classification.visual_family === 'Map / Route / Migration'
      ? 'explain movement'
      : classification.visual_family === 'Evidence / Dossier'
        ? 'prove a claim'
        : classification.visual_family === 'Signal / Data Intelligence'
          ? 'visualize power'
          : classification.visual_family === 'Commercial / Patronage'
            ? 'make a sponsor page desirable'
            : classification.visual_family === 'Quote / Manifesto'
              ? 'make a single sentence unforgettable'
              : 'create atmosphere',
    treatment: classification.treatment,
    spread_role: spreadRoleFor(spread.type),
    palette,
    contrast_mode,
    required_data: {
      ...classification.required_data,
      safe_background: safePalette.background,
      safe_foreground: safePalette.foreground,
      safe_accent: safePalette.accent,
      contrast_ratio: safePalette.contrastRatio,
    },
    text_policy: 'render_text_in_svg_html_only',
    fallback_visual_type: article?.heroUrl ? 'full_bleed_atmosphere' : 'quote_only_poster',
    confidence: clampConfidence(classification.confidence),
    rationale: classification.rationale,
    warnings: [],
  });
}

export function buildMagazineVisualBriefsForIssue(input: Omit<MagazineVisualDirectorInput, 'spread' | 'article'>) {
  return input.issue.spreads.map((spread) => {
    const article = spread.articles?.[0];
    return buildMagazineVisualBrief({ ...input, spread, article });
  });
}
