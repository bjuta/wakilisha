/**
 * Art Director — Type definitions for the design school system.
 * Each school defines a complete visual DNA through composable atoms.
 */

export type DesignSchoolName =
  | 'swiss'
  | 'modernist_poster'
  | 'memphis_postmodern'
  | 'luxury_fashion_editorial'
  | 'japanese_minimal'
  | 'information_design'
  | 'folk_vernacular'
  | 'editorial_magazine'
  | 'brutalist_web'
  | 'bauhaus';

export type AtomPriority = 'primary' | 'common' | 'occasional' | 'rare' | 'refused';

export type CompositionBias =
  | 'modular_grid'
  | 'edge_anchored'
  | 'asymmetric'
  | 'poster_stack'
  | 'grid_broken'
  | 'centered_symmetric';

export type Density = 'balanced' | 'sparse' | 'dense' | 'maximal';

export type TypographicTemperament =
  | 'restrained_geometric'
  | 'loose_small_editorial'
  | 'tight_stacked_display'
  | 'mixed_weight_aggressive'
  | 'utility_monospace';

export type ColorStrategy =
  | 'accent_only'
  | 'monochromatic_restraint'
  | 'duotone_field'
  | 'high_contrast_blocks'
  | 'soft_tonal_layers';

export type ImageryMode =
  | 'editorial_crop'
  | 'full_bleed_background'
  | 'duotone_image'
  | 'illustration_system'
  | 'abstract_shapes'
  | 'no_imagery';

export type DeviceAtom =
  | 'editorial_hairline'
  | 'column_rule'
  | 'numeric_overlay'
  | 'oversized_punctuation'
  | 'letterform_motif'
  | 'negative_third'
  | 'text_as_pattern'
  | 'stamped_initials'
  | 'brand_vector_corner'
  | 'corner_frame';

export type MotionBehavior =
  | 'none'
  | 'subtle_fade'
  | 'stagger_in'
  | 'kinetic_type'
  | 'ambient_loop';

export interface SchoolAtoms {
  compositionBias: Record<CompositionBias, AtomPriority>;
  density: Record<Density, AtomPriority>;
  typography: Record<TypographicTemperament, AtomPriority>;
  color: Record<ColorStrategy, AtomPriority>;
  imagery: Record<ImageryMode, AtomPriority>;
  devices: Record<DeviceAtom, AtomPriority>;
  motion: Record<MotionBehavior, AtomPriority>;
}

export interface DesignSchool {
  name: DesignSchoolName;
  displayName: string;
  origin: string;
  period: string;
  firstPrinciples: string[];
  antiRules: string[];
  atoms: SchoolAtoms;
  /** Preferred for light or dark mode? */
  modePreference: 'light' | 'dark' | 'either';
  /** Signature accent color (hex) */
  signatureAccent: string;
  /** Secondary accent options */
  secondaryAccents: string[];
  /** Font family direction: serif or sans-serif as primary */
  fontDirection: 'serif' | 'sans' | 'mixed';
  /** Quirky text direction: restrained, expressive, playful, brutal, poetic */
  textDirection: 'restrained' | 'expressive' | 'playful' | 'brutal' | 'poetic';
  /** Description of visual character */
  visualCharacter: string;
  /** Schools that hybridize well with this one */
  hybridCompat: DesignSchoolName[];
}

export interface IssueBrief {
  issueKey: string;
  issueNumber: number;
  /** Primary design school driving the visual identity */
  primarySchool: DesignSchoolName;
  /** Optional secondary school for hybrid direction */
  secondarySchool?: DesignSchoolName;
  /** Override the mode preference */
  modeOverride?: 'light' | 'dark';
  /** Issue-specific accent color override */
  accentOverride?: string;
  /** Creative direction notes */
  direction: string;
  /** Spread types this issue should use */
  spreadTypes: SpreadType[];
  /** Special devices or visual elements to feature */
  featuredDevices: DeviceAtom[];
  /** Key visual words for image generation */
  visualKeywords: string[];
  /** Typography quirks for this issue */
  typeQuirks: string[];
}

export type SpreadType =
  | 'cover'
  | 'editors-note'
  | 'contents'
  | 'feature'
  | 'signal'
  | 'section-opener'
  | 'guide'
  | 'review'
  | 'partner'
  | 'back-matter'
  | 'article-list'
  | 'full-bleed-image'
  | 'quote-only'
  | 'color-interlude'
  | 'typographic-poster'
  | 'grid-manifesto'
  | 'image-collage'
  | 'device-showcase'
  | 'split-screen'
  | 'data-visualization'
  | 'pattern-field'
  | 'archive-wall'
  | 'texture-interlude'
  | 'number-monument'
  | 'type-specimen'
  | 'photo-essay';

export interface GeneratedTokens {
  /** CSS custom properties for the issue */
  cssVars: Record<string, string>;
  /** Tailwind class overrides */
  classOverrides: string[];
  /** Spread type selection for this issue */
  spreadTypes: SpreadType[];
  /** Device atoms to activate */
  activeDevices: DeviceAtom[];
  /** Typography scale tokens */
  typeScale: {
    display: string;
    body: string;
    mono: string;
    displayWeight: number;
    displayStyle: 'normal' | 'italic';
  };
  /** Color tokens */
  colors: {
    bg: string;
    surface: string;
    surfaceRaised: string;
    text: string;
    textSoft: string;
    textMuted: string;
    accent: string;
    accentHi: string;
    accentDeep: string;
    rule: string;
    ruleStrong: string;
  };
  /** Density level for this issue */
  densityLevel: Density;
  /** Motion behavior for this issue */
  motionBehavior: MotionBehavior;
  /** Whether to use the image grid system */
  usesImageGrid: boolean;
  /** Whether to use bold typographic spreads */
  usesTypePosters: boolean;
  /** Whether to use full-bleed imagery */
  usesFullBleed: boolean;
  /** Quirky text direction */
  textDirection: string;
  /** Light or dark mode */
  mode: 'light' | 'dark';
  /** The school name for CSS class targeting */
  schoolClass: string;
  /** Hybrid class if secondary school exists */
  hybridClass?: string;
}