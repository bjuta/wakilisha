import type { MagazineIssueArticle } from './magazineIssues';
import { extractMagazineVisualContext, type MagazineVisualContext } from './magazineVisualExtractors';
import {
  clampConfidence,
  makeVisualBriefId,
  validateVisualBrief,
  type MagazineIssueVisualBriefing,
  type MagazineVisualBrief,
  type MagazineVisualDirectorInput,
  type MagazineVisualRendererHint,
  type MagazineVisualSpreadRole,
} from './magazineVisualSchemas';
import { buildContrastSafePalette, contrastModeForPalette } from './magazineVisualContrast';
import { paletteForSection, type MagazineEditorialIntent, type MagazineVisualFamily, type MagazineVisualPaletteKey, type MagazineVisualTreatment, type MagazineVisualType } from './magazineVisualTaxonomy';

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

type Classification = {
  visual_family: MagazineVisualFamily;
  visual_type: MagazineVisualType;
  treatment: MagazineVisualTreatment;
  editorial_intent: MagazineEditorialIntent;
  confidence: number;
  complexity: 'simple' | 'moderate' | 'complex';
  rationale: string;
  required_data: Record<string, string | number | boolean | string[]>;
};

function entityLabels(context: MagazineVisualContext, kind?: MagazineVisualContext['entities'][number]['kind']) {
  return context.entities
    .filter((entity) => !kind || entity.kind === kind)
    .map((entity) => entity.label)
    .slice(0, 12);
}

function classifyVisual(input: MagazineVisualDirectorInput, context: MagazineVisualContext): Classification {
  const { article, issue, spread } = input;
  const section = article?.canonicalSection ?? spread.section ?? issue.primaryVerticals[0] ?? 'Field Notes';
  const places = context.places.map((place) => place.label);
  const years = context.dates.map((date) => date.label);
  const title = article?.title ?? spread.title;

  if (issue.issueNumber === 1 && /afrohouse|johannesburg|nairobi|sound migration|second home/i.test(context.text)) {
    return {
      visual_family: 'Map / Route / Migration',
      visual_type: 'sound_migration_field_record',
      treatment: 'night-map',
      editorial_intent: 'explain movement',
      confidence: 0.93,
      complexity: 'complex',
      rationale: 'Issue 001 feature context supports the original sound-migration field record: route, cities, sound history and archival labels.',
      required_data: { origin: 'Johannesburg', destination: 'Nairobi', cities: ['Johannesburg', 'Nairobi'], years, keywords: context.keywords.slice(0, 8) },
    };
  }

  if (context.signals.hasMultiplePlaces) {
    const isGuide = context.signals.hasGuide;
    const visual_type: MagazineVisualType = isGuide ? 'field_guide_route' : context.signals.hasFood ? 'food_origin_trace' : 'city_to_city_route';
    return {
      visual_family: 'Map / Route / Migration',
      visual_type,
      treatment: isGuide ? 'field-guide' : 'route-line',
      editorial_intent: isGuide ? 'make a place feel real' : 'explain movement',
      confidence: 0.82,
      complexity: places.length > 3 ? 'complex' : 'moderate',
      rationale: 'The article contains multiple place signals, so the visual should explain movement, geography or cultural transfer rather than decorate the page.',
      required_data: { origin: places[0], destination: places[1], cities: places, years, keywords: context.keywords.slice(0, 8) },
    };
  }

  if (context.signals.hasPolicy) {
    const visual_type: MagazineVisualType = /algorithm|platform/i.test(context.text)
      ? 'platform_algorithm_blackbox'
      : /funding/i.test(context.text)
        ? 'funding_gap_receipt'
        : /rights|copyright|law|bill|policy/i.test(context.text)
          ? 'policy_dossier'
          : 'evidence_board';
    return {
      visual_family: 'Evidence / Dossier',
      visual_type,
      treatment: 'stamped-document',
      editorial_intent: 'prove a claim',
      confidence: 0.8,
      complexity: years.length > 2 ? 'complex' : 'moderate',
      rationale: 'Policy, rights or systems language needs a dossier-style visual that can carry claims, receipts and hierarchy clearly.',
      required_data: { keywords: context.keywords.slice(0, 10), years, entities: entityLabels(context).slice(0, 8), article_title: title },
    };
  }

  if (context.signals.hasMusic) {
    const visual_type: MagazineVisualType = /chart/i.test(context.text)
      ? 'chart_power_index'
      : /label/i.test(context.text)
        ? 'label_ownership_strip'
        : /genre/i.test(context.text)
          ? 'genre_family_tree'
          : /release|album|ep|song|track/i.test(context.text)
            ? 'release_object_card'
            : 'listening_map';
    return {
      visual_family: 'Signal / Data Intelligence',
      visual_type,
      treatment: /release|album|ep/i.test(context.text) ? 'index-card' : 'data-strip',
      editorial_intent: visual_type === 'release_object_card' ? 'turn a song/release into an object' : 'visualize power',
      confidence: 0.76,
      complexity: 'moderate',
      rationale: 'Music/release/chart language should become a signal object, listening map or data strip instead of a generic image.',
      required_data: { section, years, keywords: context.keywords.slice(0, 10), article_title: title, entities: entityLabels(context).slice(0, 10) },
    };
  }

  if (context.signals.hasLanguage) {
    return {
      visual_family: 'Language / Translation',
      visual_type: /lyric/i.test(context.text) ? 'lyric_fragment_poster' : /vernacular|phrase|translation/i.test(context.text) ? 'vernacular_phrase_poster' : 'language_translation_sheet',
      treatment: 'typographic',
      editorial_intent: 'make a single sentence unforgettable',
      confidence: 0.76,
      complexity: 'moderate',
      rationale: 'Language signals should be handled through type, translation, fragments and controlled text rather than raster image text.',
      required_data: { article_title: title, keywords: context.keywords.slice(0, 10), pull_quotes: context.pullQuotes.slice(0, 3), years },
    };
  }

  if (context.signals.hasMemory) {
    return {
      visual_family: 'Archive / Memory',
      visual_type: /library|book/i.test(context.text) ? 'library_card' : /oral/i.test(context.text) ? 'oral_history_waveform' : 'archive_file',
      treatment: 'paper-file',
      editorial_intent: context.signals.hasTimeline ? 'show a timeline' : 'slow the reader down',
      confidence: 0.72,
      complexity: context.signals.hasTimeline ? 'complex' : 'moderate',
      rationale: 'Archive, memory and book signals should feel like a recoverable file, library card, marginalia sheet or memory object.',
      required_data: { article_title: title, years, entities: entityLabels(context).slice(0, 10), pull_quotes: context.pullQuotes.slice(0, 2) },
    };
  }

  if (context.signals.hasFashion) {
    return {
      visual_family: 'Material / Texture',
      visual_type: /textile|fabric/i.test(context.text) ? 'textile_pattern_study' : /garment/i.test(context.text) ? 'garment_construction_diagram' : 'fashion_material_board',
      treatment: 'cutout-collage',
      editorial_intent: 'turn a song/release into an object',
      confidence: 0.7,
      complexity: 'moderate',
      rationale: 'Fashion and material language should become boards, studies or construction diagrams with controlled labels.',
      required_data: { article_title: title, keywords: context.keywords.slice(0, 10), entities: entityLabels(context).slice(0, 8) },
    };
  }

  if (context.signals.hasFood) {
    return {
      visual_family: 'Material / Texture',
      visual_type: 'ingredient_field_note',
      treatment: 'field-guide',
      editorial_intent: 'make a place feel real',
      confidence: 0.68,
      complexity: 'moderate',
      rationale: 'Food and source language should become a trace, field note or ingredient map.',
      required_data: { article_title: title, places, keywords: context.keywords.slice(0, 10) },
    };
  }

  if (context.signals.hasFilm) {
    return {
      visual_family: 'Scene / Atmosphere',
      visual_type: 'film_scene_board',
      treatment: 'grid-system',
      editorial_intent: 'create atmosphere',
      confidence: 0.68,
      complexity: 'moderate',
      rationale: 'Film language suggests sequence, scene boards, shot grids and atmosphere.',
      required_data: { article_title: title, keywords: context.keywords.slice(0, 10), entities: entityLabels(context).slice(0, 8) },
    };
  }

  if (spread.type === 'partner') {
    return {
      visual_family: 'Commercial / Patronage',
      visual_type: 'patronage_surface',
      treatment: 'stamped-document',
      editorial_intent: 'make a sponsor page desirable',
      confidence: 0.86,
      complexity: 'simple',
      rationale: 'Partner spreads should become desirable patronage surfaces, not banner inventory.',
      required_data: { issue: issue.issueLabel, issue_title: issue.title },
    };
  }

  if (spread.type === 'quote-only' || context.signals.hasQuoteCandidate) {
    return {
      visual_family: 'Quote / Manifesto',
      visual_type: spread.type === 'quote-only' ? 'one_sentence_full_page' : 'quote_only_poster',
      treatment: 'poster',
      editorial_intent: 'make a single sentence unforgettable',
      confidence: spread.type === 'quote-only' ? 0.88 : 0.62,
      complexity: 'simple',
      rationale: spread.type === 'quote-only' ? 'Quote-only spread is intentionally a pause page.' : 'A strong pull quote can carry a poster moment when structured data is thin.',
      required_data: { quote: spread.type === 'quote-only' ? spread.title : context.pullQuotes[0], article_title: title },
    };
  }

  return {
    visual_family: context.signals.hasImage ? 'Scene / Atmosphere' : 'Quote / Manifesto',
    visual_type: context.signals.hasImage ? 'full_bleed_atmosphere' : 'quote_only_poster',
    treatment: context.signals.hasImage ? 'annotated-photo' : 'poster',
    editorial_intent: context.signals.hasImage ? 'create atmosphere' : 'slow the reader down',
    confidence: context.signals.hasImage ? 0.58 : 0.48,
    complexity: 'simple',
    rationale: 'Fallback decision: use available imagery as atmosphere or create a quote/poster visual.',
    required_data: { article_title: title, has_image: context.signals.hasImage, keywords: context.keywords.slice(0, 8) },
  };
}

function rendererHintFor(classification: Classification): MagazineVisualRendererHint {
  const baseAvoid = ['do not bake readable text into raster images', 'do not redraw the WAKILISHA logo', 'do not place text directly on busy imagery without an overlay'];
  if (classification.visual_family === 'Map / Route / Migration') {
    return { renderer_family: 'RouteVisual', preferred_aspect_ratio: 'full-spread', safe_text_zones: ['top-left', 'bottom-left', 'right-rail'], avoid: [...baseAvoid, 'do not use real map tiles without attribution'] };
  }
  if (classification.visual_family === 'Evidence / Dossier') {
    return { renderer_family: 'EvidenceBoardVisual', preferred_aspect_ratio: 'full-spread', safe_text_zones: ['left-rail', 'bottom-right'], avoid: [...baseAvoid, 'do not imply legal conclusions beyond the article'] };
  }
  if (classification.visual_family === 'Signal / Data Intelligence') {
    return { renderer_family: 'SignalVisual', preferred_aspect_ratio: '16:9', safe_text_zones: ['top-left', 'bottom-left'], avoid: [...baseAvoid, 'do not invent chart numbers or rankings'] };
  }
  if (classification.visual_family === 'Archive / Memory') {
    return { renderer_family: 'ArchiveVisual', preferred_aspect_ratio: '4:5', safe_text_zones: ['center', 'bottom-left'], avoid: baseAvoid };
  }
  if (classification.visual_family === 'Language / Translation') {
    return { renderer_family: 'PosterVisual', preferred_aspect_ratio: '4:5', safe_text_zones: ['center'], avoid: [...baseAvoid, 'do not use AI-generated text glyphs for real words'] };
  }
  if (classification.visual_family === 'Material / Texture' || classification.visual_family === 'Object / Artifact') {
    return { renderer_family: 'ObjectVisual', preferred_aspect_ratio: '3:2', safe_text_zones: ['right-rail', 'bottom-left'], avoid: baseAvoid };
  }
  if (classification.visual_family === 'Commercial / Patronage') {
    return { renderer_family: 'PatronageVisual', preferred_aspect_ratio: 'full-spread', safe_text_zones: ['center', 'bottom-left'], avoid: [...baseAvoid, 'do not make partner surfaces look like banner ads'] };
  }
  if (classification.visual_family === 'Network / Constellation') {
    return { renderer_family: 'ConstellationVisual', preferred_aspect_ratio: 'full-spread', safe_text_zones: ['top-left', 'right-rail'], avoid: baseAvoid };
  }
  if (classification.visual_family === 'Quote / Manifesto') {
    return { renderer_family: 'PosterVisual', preferred_aspect_ratio: '4:5', safe_text_zones: ['center'], avoid: baseAvoid };
  }
  return { renderer_family: 'AtmosphereVisual', preferred_aspect_ratio: 'full-spread', safe_text_zones: ['bottom-left', 'top-left'], avoid: baseAvoid };
}

function paletteForClassification(input: MagazineVisualDirectorInput, classification: Classification): MagazineVisualPaletteKey {
  if (classification.visual_family === 'Evidence / Dossier') return 'systems';
  if (classification.visual_family === 'Language / Translation') return 'language';
  if (classification.visual_family === 'Archive / Memory') return 'memory';
  if (classification.visual_type === 'food_origin_trace' || classification.visual_type === 'ingredient_field_note') return 'food';
  if (classification.visual_type === 'fashion_material_board' || classification.visual_type === 'textile_pattern_study' || classification.visual_type === 'garment_construction_diagram') return 'art';
  return paletteForSection(input.article?.canonicalSection ?? input.spread.section ?? input.issue.primaryVerticals[0]);
}

export function buildMagazineVisualBrief(input: MagazineVisualDirectorInput): MagazineVisualBrief {
  const { issue, spread, article } = input;
  const context = extractMagazineVisualContext(article);
  const classification = classifyVisual(input, context);
  const palette = paletteForClassification(input, classification);
  const safePalette = buildContrastSafePalette(palette);
  const contrast_mode = classification.treatment === 'annotated-photo' ? 'image-overlay' : contrastModeForPalette(palette);

  return validateVisualBrief({
    id: makeVisualBriefId({ issue, spread, article }),
    issue_id: issue.id,
    spread_id: spread.id,
    article_id: article?.slug,
    visual_family: classification.visual_family,
    visual_type: classification.visual_type,
    editorial_intent: classification.editorial_intent,
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
    fallback_visual_type: context.signals.hasImage ? 'full_bleed_atmosphere' : 'quote_only_poster',
    confidence: clampConfidence(classification.confidence),
    complexity: classification.complexity,
    approval_risk: 'low',
    renderer_hint: rendererHintFor(classification),
    extracted_context: context,
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

export function buildMagazineIssueVisualBriefing(input: Omit<MagazineVisualDirectorInput, 'spread' | 'article'>): MagazineIssueVisualBriefing {
  const briefs = buildMagazineVisualBriefsForIssue(input);
  const familyCounts = new Map<MagazineVisualFamily, number>();
  const paletteCounts = new Map<MagazineVisualPaletteKey, number>();
  const warnings = new Set<string>();

  for (const brief of briefs) {
    familyCounts.set(brief.visual_family, (familyCounts.get(brief.visual_family) ?? 0) + 1);
    paletteCounts.set(brief.palette, (paletteCounts.get(brief.palette) ?? 0) + 1);
    brief.warnings.forEach((warning) => warnings.add(`${brief.spread_role}: ${warning}`));
  }

  const dominant_visual_family = Array.from(familyCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Scene / Atmosphere';
  const dominant_palette = Array.from(paletteCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral';
  const highRisk = briefs.filter((brief) => brief.approval_risk !== 'low').length;

  return {
    issue_id: input.issue.id,
    issue_slug: input.issue.slug,
    issue_label: input.issue.issueLabel,
    issue_title: input.issue.title,
    source_window_label: input.issue.sourceWindowLabel,
    dominant_visual_family,
    dominant_palette,
    briefs,
    warnings: Array.from(warnings),
    summary: `${input.issue.issueLabel} resolves toward ${dominant_visual_family} with a ${dominant_palette} palette. ${highRisk} visual brief${highRisk === 1 ? '' : 's'} require stronger admin review before rendering.`,
  };
}
