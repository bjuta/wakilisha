/**
 * Magazine Issue Briefs
 * Each issue gets a unique art direction brief. The cycle of 10 schools means
 * no two consecutive issues look the same. Hybrids between schools are also
 * incorporated to create additional variation.
 *
 * Rule: These are creative direction documents, not templates.
 * The art director's job is to make each issue feel like a distinct publication.
 */

import type { IssueBrief, DesignSchoolName } from './types';

/** The 10 school rotation with hybrid combinations */
const SCHOOL_ROTATION: Array<{
  primary: DesignSchoolName;
  secondary?: DesignSchoolName;
  modeOverride?: 'light' | 'dark';
  direction: string;
}> = [
  {
    primary: 'editorial_magazine',
    secondary: 'swiss',
    modeOverride: 'dark',
    direction: 'Launch issue: Swiss skeleton, editorial warmth. Cinematic pacing. Authorial photography. Full-bleed cover. Drop caps in the feature. The Turley-era Businessweek energy — rigorous grids, dramatic typography.',
  },
  {
    primary: 'swiss',
    modeOverride: 'light',
    direction: 'Grid as foundation. Black ink on cream. One red accent, used sparingly. Sans-serif only. Negative space is the hero. Every element earns its position through the grid.',
  },
  {
    primary: 'luxury_fashion_editorial',
    secondary: 'editorial_magazine',
    modeOverride: 'light',
    direction: 'The image is sovereign. Didone display, airy whitespace. Authored photography. Typography placed like couture — precise and rare. Paper-white with warm blacks.',
  },
  {
    primary: 'bauhaus',
    secondary: 'swiss',
    modeOverride: 'dark',
    direction: 'Geometric primitives. Primary colour fields. Diagonal energy. Single-case sans. The grid is the teacher. Constructive photography treated as graphic material.',
  },
  {
    primary: 'memphis_postmodern',
    secondary: 'editorial_magazine',
    modeOverride: 'light',
    direction: 'Good taste is not a law. Colour clashes that are the point. Pattern as content. Stage-set composition. This issue is allowed to have fun — serious systems sabotaged by delight.',
  },
  {
    primary: 'japanese_minimal',
    secondary: 'luxury_fashion_editorial',
    modeOverride: 'light',
    direction: 'Emptiness as the primary field. Natural muted tones. Typography lightly held. Make the reader slower. Wabi-sabi restraint — imperfection humanises.',
  },
  {
    primary: 'modernist_poster',
    secondary: 'bauhaus',
    modeOverride: 'dark',
    direction: 'Each spread is a single public argument. Theatrical scale — one large decision per spread. Image and headline fuse. Works at distance. Ruthless hierarchy.',
  },
  {
    primary: 'information_design',
    secondary: 'swiss',
    modeOverride: 'light',
    direction: 'The information structure is the design. Clarity is moral. Numbers are first-class typography. Charts and data rendered as editorial art. Tufte meets Bloomberg.',
  },
  {
    primary: 'folk_vernacular',
    secondary: 'editorial_magazine',
    modeOverride: 'light',
    direction: 'Place is source. Warm earthy tones. Pattern and ornament are structural. Dense and situated. Nairobi sign-painting energy — irregular marks that signal authenticity.',
  },
  {
    primary: 'brutalist_web',
    secondary: 'memphis_postmodern',
    modeOverride: 'dark',
    direction: 'Structure is visible. Default-as-material. Friction is expressive. Crude and loud. Assembled not airbrushed. Anti-polish as a commitment, not a failure.',
  },
];

/** Visual keywords for image generation per school */
const SCHOOL_VISUAL_KEYWORDS: Record<DesignSchoolName, string[]> = {
  swiss: ['clean grid lines', 'Helvetica posters', 'black white red', 'structured whitespace', 'modernist museum aesthetic'],
  modernist_poster: ['bold silhouettes', 'theatrical scale', 'high contrast graphic', 'single-statement composition', 'mid-century poster art'],
  memphis_postmodern: ['geometric shapes', 'clashing colour fields', 'pattern surface', 'Memphis furniture aesthetic', 'playful postmodern decoration'],
  luxury_fashion_editorial: ['fashion photography full bleed', 'Didone serif lettering', 'luxury whitespace', 'couture editorial crop', 'high contrast fashion black white'],
  japanese_minimal: ['empty space meditation', 'wabi-sabi texture', 'natural muted tones', 'Japanese packaging minimal', 'ma negative space philosophy'],
  information_design: ['data visualization graphic', 'isotype chart system', 'transit map clean lines', 'civic information diagram', 'statistical graphic evidence'],
  folk_vernacular: ['hand-painted sign vernacular', 'West African kanga textile', 'market graphic local colour', 'matatu truck art Nairobi', 'folk festival poster energy'],
  editorial_magazine: ['magazine spread typography', 'editorial photography crop', 'drop cap serif display', 'full bleed fashion editorial', 'magazine layout pull quote'],
  brutalist_web: ['raw concrete structure visible', 'industrial brutalist aesthetic', 'system default exposed', 'monospace crude text', 'anti-design friction'],
  bauhaus: ['Bauhaus geometric circle triangle square', 'primary colour blocks', 'constructivist diagonal composition', 'single letterform graphic', 'workshop pedagogy object'],
};

/** Typography quirks per school */
const SCHOOL_TYPE_QUIRKS: Record<DesignSchoolName, string[]> = {
  swiss: ['flush-left, ragged right', 'hierarchy through weight only', 'no italic for emphasis', 'grid-aligned captions', 'column rules as visual anchors'],
  modernist_poster: ['headline occupies 70% of spread', 'type fuses with image', 'single word per line at display scale', 'caption as footer strip', 'number as dominant element'],
  memphis_postmodern: ['mixed families intentionally', 'weight shifts mid-sentence', 'colour on individual letterforms', 'decorative initial letters', 'type as surface pattern'],
  luxury_fashion_editorial: ['Didone italic at hero scale', 'body text at 12pt max', 'caption in small caps', 'generous leading — editorial breathing room', 'credit lines whisper-thin'],
  japanese_minimal: ['generous tracking on display', 'body text light weight', 'single Chinese character as visual anchor', 'horizontal rule as breath', 'white space is content'],
  information_design: ['axis labels as typographic content', 'numbers in tabular figures', 'utility monospace for data', 'legend as typographic composition', 'annotation system consistent'],
  folk_vernacular: ['hand-lettered energy in digital form', 'mixed language text blocks', 'declarative sentence as headline', 'community greeting as opener', 'place name in capitals'],
  editorial_magazine: ['drop cap on every feature', 'pull quote at 40pt italic', 'folio numbers as page anchors', 'byline in small caps', 'caption italic 9pt serif'],
  brutalist_web: ['all-caps brutal headlines', 'monospace body text', 'pixel-border buttons', 'visible link underlines always', 'form elements unstyled'],
  bauhaus: ['single-case where possible', 'Raleway light 300 for display', 'constructed letterform motifs', 'black/red/yellow as only accent', 'geometric sans, never humanist'],
};

export function getIssueBrief(issueNumber: number): IssueBrief {
  // Cycle through the rotation (10 schools)
  const rotationIndex = (issueNumber - 1) % SCHOOL_ROTATION.length;
  const rotation = SCHOOL_ROTATION[rotationIndex];

  const issueKey = `issue-${String(issueNumber).padStart(3, '0')}`;

  return {
    issueKey,
    issueNumber,
    primarySchool: rotation.primary,
    secondarySchool: rotation.secondary,
    modeOverride: rotation.modeOverride,
    direction: rotation.direction,
    spreadTypes: [], // Will be filled by engine
    featuredDevices: [], // Will be filled by engine
    visualKeywords: SCHOOL_VISUAL_KEYWORDS[rotation.primary],
    typeQuirks: SCHOOL_TYPE_QUIRKS[rotation.primary],
  };
}

/** Get all briefs for a given number of issues */
export function getAllIssueBriefs(count: number): IssueBrief[] {
  return Array.from({ length: count }, (_, i) => getIssueBrief(i + 1));
}

/** What school name this issue uses (for CSS class) */
export function getIssueSchoolClass(issueNumber: number): string {
  const brief = getIssueBrief(issueNumber);
  return `mag-school-${brief.primarySchool}`;
}

/** What mode this issue uses */
export function getIssueModeClass(issueNumber: number): string {
  const brief = getIssueBrief(issueNumber);
  const primarySchool = SCHOOL_ROTATION[(issueNumber - 1) % SCHOOL_ROTATION.length];
  if (primarySchool.modeOverride) return `mag-mode-${primarySchool.modeOverride}`;
  // Derive from school preference
  const modeMap: Record<DesignSchoolName, 'light' | 'dark' | 'either'> = {
    swiss: 'either',
    modernist_poster: 'either',
    memphis_postmodern: 'light',
    luxury_fashion_editorial: 'light',
    japanese_minimal: 'light',
    information_design: 'either',
    folk_vernacular: 'light',
    editorial_magazine: 'either',
    brutalist_web: 'dark',
    bauhaus: 'either',
  };
  const pref = modeMap[brief.primarySchool] ?? 'either';
  const mode = pref === 'either' ? (issueNumber % 2 === 0 ? 'light' : 'dark') : pref;
  return `mag-mode-${mode}`;
}