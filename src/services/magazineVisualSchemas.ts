import type { MagazineIssue, MagazineIssueArticle, MagazineSpread } from './magazineIssues';
import type { MagazineEditorialSystem } from './magazineNlg';
import type {
  MagazineEditorialIntent,
  MagazineVisualFamily,
  MagazineVisualPaletteKey,
  MagazineVisualTreatment,
  MagazineVisualType,
} from './magazineVisualTaxonomy';
import type { MagazineVisualContext } from './magazineVisualExtractors';

export type MagazineVisualContrastMode = 'dark' | 'light' | 'image-overlay';
export type MagazineVisualTextPolicy = 'render_text_in_svg_html_only' | 'no_generated_text' | 'decorative_only';
export type MagazineVisualSpreadRole =
  | 'cover_key_visual'
  | 'feature_opener'
  | 'section_opener'
  | 'interlude'
  | 'quote_page'
  | 'data_spread'
  | 'partner_surface'
  | 'back_matter'
  | 'inline_support';

export type MagazineVisualComplexity = 'simple' | 'moderate' | 'complex';
export type MagazineVisualApprovalRisk = 'low' | 'medium' | 'high';

export type MagazineVisualRendererHint = {
  renderer_family: 'RouteVisual' | 'EvidenceBoardVisual' | 'SignalVisual' | 'ArchiveVisual' | 'PosterVisual' | 'FieldGuideVisual' | 'ObjectVisual' | 'AtmosphereVisual' | 'PatronageVisual' | 'ConstellationVisual';
  preferred_aspect_ratio: '1:1' | '4:5' | '16:9' | '3:2' | 'full-spread' | 'story';
  safe_text_zones: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'left-rail' | 'right-rail'>;
  avoid: string[];
};

export type MagazineVisualBrief = {
  id: string;
  issue_id: string;
  spread_id: string;
  article_id?: string;
  visual_family: MagazineVisualFamily;
  visual_type: MagazineVisualType;
  editorial_intent: MagazineEditorialIntent;
  treatment: MagazineVisualTreatment;
  spread_role: MagazineVisualSpreadRole;
  palette: MagazineVisualPaletteKey;
  contrast_mode: MagazineVisualContrastMode;
  required_data: Record<string, string | number | boolean | string[]>;
  text_policy: MagazineVisualTextPolicy;
  fallback_visual_type: MagazineVisualType;
  confidence: number;
  complexity: MagazineVisualComplexity;
  approval_risk: MagazineVisualApprovalRisk;
  renderer_hint: MagazineVisualRendererHint;
  extracted_context?: MagazineVisualContext;
  rationale: string;
  warnings: string[];
};

export type MagazineIssueVisualBriefing = {
  issue_id: string;
  issue_slug: string;
  issue_label: string;
  issue_title: string;
  source_window_label: string;
  dominant_visual_family: MagazineVisualFamily;
  dominant_palette: MagazineVisualPaletteKey;
  briefs: MagazineVisualBrief[];
  warnings: string[];
  summary: string;
};

export type MagazineVisualDirectorInput = {
  issue: MagazineIssue;
  spread: MagazineSpread;
  article?: MagazineIssueArticle;
  editorialSystem?: MagazineEditorialSystem;
  availableImages?: string[];
  relatedArticles?: MagazineIssueArticle[];
};

export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

export function makeVisualBriefId(input: Pick<MagazineVisualDirectorInput, 'issue' | 'spread'> & { article?: MagazineIssueArticle }) {
  return [input.issue.slug, input.spread.id, input.article?.slug ?? 'no-article'].join('__');
}

function riskForBrief(brief: MagazineVisualBrief): MagazineVisualApprovalRisk {
  if (brief.contrast_mode === 'image-overlay') return 'medium';
  if (brief.confidence < 0.5) return 'medium';
  if (brief.visual_type === 'full_bleed_atmosphere') return 'medium';
  if (brief.text_policy !== 'render_text_in_svg_html_only') return 'high';
  return 'low';
}

export function validateVisualBrief(brief: MagazineVisualBrief): MagazineVisualBrief {
  const warnings = [...brief.warnings];
  if (!brief.required_data || Object.keys(brief.required_data).length === 0) {
    warnings.push('Visual brief has no required data; renderer should use fallback visual treatment.');
  }
  if (brief.contrast_mode === 'image-overlay' && brief.text_policy !== 'render_text_in_svg_html_only') {
    warnings.push('Image overlay visuals must keep real text in SVG/HTML layers.');
  }
  if (brief.confidence < 0.45) {
    warnings.push('Low confidence visual decision; admin review recommended.');
  }
  if (Number(brief.required_data.contrast_ratio ?? 0) < 4.5) {
    warnings.push('Palette contrast is below WCAG AA for normal text; renderer must apply overlay or alternate text color.');
  }
  if (brief.renderer_hint.safe_text_zones.length === 0) {
    warnings.push('No safe text zone defined; renderer should default to bottom-left overlay card.');
  }
  const confidence = clampConfidence(brief.confidence);
  return {
    ...brief,
    confidence,
    approval_risk: riskForBrief({ ...brief, confidence }),
    warnings: Array.from(new Set(warnings)),
  };
}
