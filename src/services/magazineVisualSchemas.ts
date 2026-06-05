import type { MagazineIssue, MagazineIssueArticle, MagazineSpread } from './magazineIssues';
import type { MagazineEditorialSystem } from './magazineNlg';
import type {
  MagazineEditorialIntent,
  MagazineVisualFamily,
  MagazineVisualPaletteKey,
  MagazineVisualTreatment,
  MagazineVisualType,
} from './magazineVisualTaxonomy';

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
  rationale: string;
  warnings: string[];
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
  return { ...brief, confidence: clampConfidence(brief.confidence), warnings };
}
