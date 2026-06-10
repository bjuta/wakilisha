/**
 * Art Director Engine
 * Given a school name + optional hybrid, generates complete visual tokens for an issue.
 * This is the living art director — call generateIssueTokens(brief) and get a fully
 * art-directed issue with unique colour, typography, device, and spread decisions.
 */

import { DESIGN_SCHOOLS, getPrimaryAtoms, getDefiningAtom } from './schools';
import type {
  DesignSchoolName,
  DesignSchool,
  GeneratedTokens,
  IssueBrief,
  Density,
  MotionBehavior,
  DeviceAtom,
  SpreadType,
} from './types';

/** Colour palettes keyed by school + mode */
type ColorPalette = GeneratedTokens['colors'];

const SCHOOL_PALETTES: Record<string, { light: ColorPalette; dark: ColorPalette }> = {
  swiss: {
    light: {
      bg: '#F5F3EE', surface: '#EDEBE4', surfaceRaised: '#E4E2D8',
      text: '#0C0C0A', textSoft: '#3A3A34', textMuted: '#6E6D64',
      accent: '#D41C14', accentHi: '#F02A20', accentDeep: '#8C100C',
      rule: 'rgba(12,12,10,.08)', ruleStrong: 'rgba(12,12,10,.18)',
    },
    dark: {
      bg: '#0A0A08', surface: '#141410', surfaceRaised: '#1E1E18',
      text: '#F0EEE8', textSoft: '#C8C6BC', textMuted: '#7A7870',
      accent: '#E83028', accentHi: '#FF3C34', accentDeep: '#A81810',
      rule: 'rgba(240,238,232,.08)', ruleStrong: 'rgba(240,238,232,.20)',
    },
  },
  modernist_poster: {
    light: {
      bg: '#F8F4EE', surface: '#EEE8DC', surfaceRaised: '#E4DCCC',
      text: '#0E0A04', textSoft: '#38300A', textMuted: '#6A5E3C',
      accent: '#E8302A', accentHi: '#FF3C34', accentDeep: '#9C1C14',
      rule: 'rgba(14,10,4,.08)', ruleStrong: 'rgba(14,10,4,.22)',
    },
    dark: {
      bg: '#08060C', surface: '#120E1A', surfaceRaised: '#1C1826',
      text: '#F4F0F8', textSoft: '#C4C0CC', textMuted: '#7C7888',
      accent: '#FF3C34', accentHi: '#FF5E58', accentDeep: '#C41C14',
      rule: 'rgba(244,240,248,.07)', ruleStrong: 'rgba(244,240,248,.18)',
    },
  },
  memphis_postmodern: {
    light: {
      bg: '#FAFAF0', surface: '#F4F0E0', surfaceRaised: '#EAE4CC',
      text: '#1A0A18', textSoft: '#4A2040', textMuted: '#7A5070',
      accent: '#FF6B35', accentHi: '#FF8C5A', accentDeep: '#CC3800',
      rule: 'rgba(26,10,24,.07)', ruleStrong: 'rgba(26,10,24,.18)',
    },
    dark: {
      bg: '#0C0814', surface: '#181020', surfaceRaised: '#24182E',
      text: '#FAF0FC', textSoft: '#D0C0DC', textMuted: '#907898',
      accent: '#FF6B35', accentHi: '#FF9060', accentDeep: '#CC3800',
      rule: 'rgba(250,240,252,.07)', ruleStrong: 'rgba(250,240,252,.20)',
    },
  },
  luxury_fashion_editorial: {
    light: {
      bg: '#FAF7F2', surface: '#F2EDE4', surfaceRaised: '#E8DED0',
      text: '#180C04', textSoft: '#4A3428', textMuted: '#907060',
      accent: '#C8A96E', accentHi: '#DEC090', accentDeep: '#8A6A30',
      rule: 'rgba(24,12,4,.06)', ruleStrong: 'rgba(24,12,4,.14)',
    },
    dark: {
      bg: '#0C0804', surface: '#180E08', surfaceRaised: '#221610',
      text: '#FAF0E8', textSoft: '#D0BCA8', textMuted: '#907870',
      accent: '#C8A96E', accentHi: '#DEC090', accentDeep: '#8A6A30',
      rule: 'rgba(250,240,232,.06)', ruleStrong: 'rgba(250,240,232,.16)',
    },
  },
  japanese_minimal: {
    light: {
      bg: '#F8F6F2', surface: '#F0EDE6', surfaceRaised: '#E6E0D6',
      text: '#1A1814', textSoft: '#4A4640', textMuted: '#888480',
      accent: '#5C7A5C', accentHi: '#7A9A7A', accentDeep: '#3A5A3A',
      rule: 'rgba(26,24,20,.06)', ruleStrong: 'rgba(26,24,20,.14)',
    },
    dark: {
      bg: '#0C0E0A', surface: '#141610', surfaceRaised: '#1C2018',
      text: '#F0EEE8', textSoft: '#C4C0B4', textMuted: '#7A7870',
      accent: '#7A9A7A', accentHi: '#98B898', accentDeep: '#4A6A4A',
      rule: 'rgba(240,238,232,.06)', ruleStrong: 'rgba(240,238,232,.14)',
    },
  },
  information_design: {
    light: {
      bg: '#F4F6FA', surface: '#EBF0F8', surfaceRaised: '#DCE8F4',
      text: '#04100E', textSoft: '#1A3040', textMuted: '#507090',
      accent: '#1E7BC4', accentHi: '#3294DC', accentDeep: '#0C4C88',
      rule: 'rgba(4,16,14,.08)', ruleStrong: 'rgba(4,16,14,.20)',
    },
    dark: {
      bg: '#020E18', surface: '#081622', surfaceRaised: '#102030',
      text: '#EEF4FA', textSoft: '#C0D0DC', textMuted: '#7090A8',
      accent: '#3294DC', accentHi: '#50AAEE', accentDeep: '#1A60A8',
      rule: 'rgba(238,244,250,.07)', ruleStrong: 'rgba(238,244,250,.18)',
    },
  },
  folk_vernacular: {
    light: {
      bg: '#FBF4E8', surface: '#F2E8D0', surfaceRaised: '#E8D8B4',
      text: '#1C0C04', textSoft: '#4A2808', textMuted: '#885C3A',
      accent: '#D4832A', accentHi: '#ECA040', accentDeep: '#8A4C08',
      rule: 'rgba(28,12,4,.07)', ruleStrong: 'rgba(28,12,4,.20)',
    },
    dark: {
      bg: '#0E0804', surface: '#1A1008', surfaceRaised: '#281A0E',
      text: '#FAF0DC', textSoft: '#D4BCA0', textMuted: '#907060',
      accent: '#ECA040', accentHi: '#FFBA60', accentDeep: '#A86010',
      rule: 'rgba(250,240,220,.07)', ruleStrong: 'rgba(250,240,220,.18)',
    },
  },
  editorial_magazine: {
    light: {
      bg: '#FAF7F0', surface: '#F2EDE0', surfaceRaised: '#E8E0CC',
      text: '#140C04', textSoft: '#443A28', textMuted: '#807060',
      accent: '#C4883A', accentHi: '#DCA04E', accentDeep: '#8A5A14',
      rule: 'rgba(20,12,4,.07)', ruleStrong: 'rgba(20,12,4,.18)',
    },
    dark: {
      bg: '#0A0804', surface: '#160E08', surfaceRaised: '#20180C',
      text: '#FAF0E4', textSoft: '#D0BCA4', textMuted: '#907868',
      accent: '#DCA04E', accentHi: '#F0B870', accentDeep: '#9A6820',
      rule: 'rgba(250,240,228,.07)', ruleStrong: 'rgba(250,240,228,.18)',
    },
  },
  brutalist_web: {
    light: {
      bg: '#F4F4F0', surface: '#E8E8E0', surfaceRaised: '#D8D8CC',
      text: '#060606', textSoft: '#282820', textMuted: '#5A5A50',
      accent: '#F5E642', accentHi: '#FFEE66', accentDeep: '#C4B818',
      rule: 'rgba(6,6,6,.10)', ruleStrong: 'rgba(6,6,6,.28)',
    },
    dark: {
      bg: '#060606', surface: '#0E0E0A', surfaceRaised: '#181810',
      text: '#F4F4F0', textSoft: '#C8C8C0', textMuted: '#7C7C70',
      accent: '#F5E642', accentHi: '#FFEE66', accentDeep: '#C4B818',
      rule: 'rgba(244,244,240,.09)', ruleStrong: 'rgba(244,244,240,.25)',
    },
  },
  bauhaus: {
    light: {
      bg: '#F5F4EE', surface: '#ECEAE0', surfaceRaised: '#E0DED0',
      text: '#0A0806', textSoft: '#38300A', textMuted: '#6A6040',
      accent: '#E83030', accentHi: '#FF4040', accentDeep: '#A81818',
      rule: 'rgba(10,8,6,.08)', ruleStrong: 'rgba(10,8,6,.22)',
    },
    dark: {
      bg: '#060408', surface: '#100C14', surfaceRaised: '#1C1820',
      text: '#F4F2EC', textSoft: '#C8C4BC', textMuted: '#7A7870',
      accent: '#FF4040', accentHi: '#FF6060', accentDeep: '#C81818',
      rule: 'rgba(244,242,236,.08)', ruleStrong: 'rgba(244,242,236,.22)',
    },
  },
};

/** Font stacks per school */
const SCHOOL_FONTS: Record<string, GeneratedTokens['typeScale']> = {
  swiss: {
    display: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    body: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    mono: "'DM Mono', 'Courier New', monospace",
    displayWeight: 300,
    displayStyle: 'normal',
  },
  modernist_poster: {
    display: "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
    body: "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
    mono: "'Space Mono', 'Courier New', monospace",
    displayWeight: 700,
    displayStyle: 'normal',
  },
  memphis_postmodern: {
    display: "'Bricolage Grotesque', 'Arial Black', sans-serif",
    body: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    mono: "'DM Mono', 'Courier New', monospace",
    displayWeight: 800,
    displayStyle: 'normal',
  },
  luxury_fashion_editorial: {
    display: "'Cormorant Garamond', 'Didot', 'Bodoni MT', Georgia, serif",
    body: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    mono: "'DM Mono', 'Courier New', monospace",
    displayWeight: 300,
    displayStyle: 'italic',
  },
  japanese_minimal: {
    display: "'Zen Kaku Gothic New', 'Noto Sans JP', 'Helvetica Neue', Arial, sans-serif",
    body: "'Noto Sans', 'Helvetica Neue', Arial, sans-serif",
    mono: "'DM Mono', 'Courier New', monospace",
    displayWeight: 300,
    displayStyle: 'normal',
  },
  information_design: {
    display: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
    body: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
    mono: "'IBM Plex Mono', 'Courier New', monospace",
    displayWeight: 600,
    displayStyle: 'normal',
  },
  folk_vernacular: {
    display: "'Fraunces', Georgia, 'Times New Roman', serif",
    body: "'Libre Baskerville', Georgia, 'Times New Roman', serif",
    mono: "'DM Mono', 'Courier New', monospace",
    displayWeight: 700,
    displayStyle: 'italic',
  },
  editorial_magazine: {
    display: "'Playfair Display', 'Bodoni MT', Georgia, serif",
    body: "'DM Serif Display', Georgia, 'Times New Roman', serif",
    mono: "'DM Mono', 'Courier New', monospace",
    displayWeight: 400,
    displayStyle: 'italic',
  },
  brutalist_web: {
    display: "'Space Grotesk', 'Arial Black', Arial, sans-serif",
    body: "'Space Grotesk', Arial, sans-serif",
    mono: "'Space Mono', 'Courier New', monospace",
    displayWeight: 900,
    displayStyle: 'normal',
  },
  bauhaus: {
    display: "'Raleway', 'Futura', 'Century Gothic', Arial, sans-serif",
    body: "'Raleway', 'Futura', 'Century Gothic', Arial, sans-serif",
    mono: "'DM Mono', 'Courier New', monospace",
    displayWeight: 300,
    displayStyle: 'normal',
  },
};

/** Google Fonts import string for each school */
export const SCHOOL_GOOGLE_FONTS: Record<string, string> = {
  swiss: 'Inter:wght@300;400;500;700;800',
  modernist_poster: 'Space+Grotesk:wght@300;400;500;700&family=Space+Mono:ital,wght@0,400;0,700;1,400',
  memphis_postmodern: 'Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700;12..96,800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=DM+Mono:wght@400;500',
  luxury_fashion_editorial: 'Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500;1,600&family=DM+Mono:wght@400',
  japanese_minimal: 'Noto+Sans:wght@300;400;500&family=DM+Mono:wght@400',
  information_design: 'IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500',
  folk_vernacular: 'Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,700;1,9..144,300;1,9..144,400;1,9..144,700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@400',
  editorial_magazine: 'Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400',
  brutalist_web: 'Space+Grotesk:wght@300;400;500;700;900&family=Space+Mono:ital,wght@0,400;0,700;1,400',
  bauhaus: 'Raleway:ital,wght@0,300;0,400;0,500;0,700;0,900;1,300;1,400&family=DM+Mono:wght@400',
};

/** Spread types typical of each school */
const SCHOOL_SPREADS: Record<string, SpreadType[]> = {
  swiss: ['cover', 'editors-note', 'contents', 'feature', 'section-opener', 'article-list', 'back-matter', 'grid-manifesto'],
  modernist_poster: ['cover', 'editors-note', 'feature', 'full-bleed-image', 'typographic-poster', 'article-list', 'back-matter'],
  memphis_postmodern: ['cover', 'editors-note', 'contents', 'feature', 'color-interlude', 'pattern-field', 'section-opener', 'article-list', 'back-matter', 'texture-interlude'],
  luxury_fashion_editorial: ['cover', 'editors-note', 'contents', 'feature', 'full-bleed-image', 'photo-essay', 'article-list', 'back-matter'],
  japanese_minimal: ['cover', 'editors-note', 'contents', 'feature', 'full-bleed-image', 'article-list', 'back-matter'],
  information_design: ['cover', 'editors-note', 'contents', 'feature', 'signal', 'data-visualization', 'section-opener', 'article-list', 'back-matter', 'number-monument'],
  folk_vernacular: ['cover', 'editors-note', 'contents', 'feature', 'full-bleed-image', 'archive-wall', 'section-opener', 'article-list', 'back-matter', 'texture-interlude'],
  editorial_magazine: ['cover', 'editors-note', 'contents', 'feature', 'full-bleed-image', 'quote-only', 'section-opener', 'guide', 'review', 'article-list', 'signal', 'back-matter', 'photo-essay', 'split-screen'],
  brutalist_web: ['cover', 'editors-note', 'feature', 'full-bleed-image', 'type-specimen', 'section-opener', 'article-list', 'back-matter', 'grid-manifesto'],
  bauhaus: ['cover', 'editors-note', 'contents', 'feature', 'color-interlude', 'section-opener', 'article-list', 'back-matter', 'typographic-poster', 'number-monument'],
};

function resolveMode(school: DesignSchool, brief: IssueBrief, userThemePreference?: 'light' | 'dark'): 'light' | 'dark' {
  // User's explicit theme toggle always wins
  if (userThemePreference) return userThemePreference;
  if (brief.modeOverride) return brief.modeOverride;
  if (school.modePreference === 'light') return 'light';
  if (school.modePreference === 'dark') return 'dark';
  // 'either' — derive from issue number for variance
  return brief.issueNumber % 2 === 0 ? 'light' : 'dark';
}

function resolveColors(schoolName: string, mode: 'light' | 'dark', accentOverride?: string): ColorPalette {
  const palette = SCHOOL_PALETTES[schoolName] ?? SCHOOL_PALETTES.editorial_magazine;
  const base = { ...palette[mode] };
  if (accentOverride) {
    base.accent = accentOverride;
  }
  return base;
}

function resolveDevices(school: DesignSchool, secondary?: DesignSchool): DeviceAtom[] {
  const primary = getPrimaryAtoms(school.atoms.devices);
  if (!secondary) return primary as DeviceAtom[];
  const secondaryDevices = getPrimaryAtoms(secondary.atoms.devices);
  // Merge without duplicates, primary school leads
  const merged = [...primary, ...secondaryDevices.filter((d) => !primary.includes(d))];
  return merged.slice(0, 6) as DeviceAtom[];
}

function resolveSpreadTypes(schoolName: string, secondaryName?: string): SpreadType[] {
  const primary = SCHOOL_SPREADS[schoolName] ?? SCHOOL_SPREADS.editorial_magazine;
  if (!secondaryName) return primary;
  const secondary = SCHOOL_SPREADS[secondaryName] ?? [];
  // Inject up to 2 unique spread types from the secondary school
  const uniqueFromSecondary = secondary.filter((s) => !primary.includes(s)).slice(0, 2);
  return [...primary, ...uniqueFromSecondary];
}

function resolveDensity(school: DesignSchool): Density {
  return getDefiningAtom(school.atoms.density) as Density;
}

function resolveMotion(school: DesignSchool, secondary?: DesignSchool): MotionBehavior {
  const primaryMotion = getDefiningAtom(school.atoms.motion) as MotionBehavior;
  if (!secondary) return primaryMotion;
  // If secondary school has kinetic_type as primary, allow it (e.g. memphis hybrid)
  const secondaryMotion = getDefiningAtom(secondary.atoms.motion) as MotionBehavior;
  if (secondaryMotion === 'kinetic_type' && primaryMotion === 'none') return 'stagger_in';
  return primaryMotion;
}

function buildCssVars(colors: ColorPalette, typeScale: GeneratedTokens['typeScale']): Record<string, string> {
  return {
    '--mag-bg': colors.bg,
    '--mag-surface': colors.surface,
    '--mag-surface-raised': colors.surfaceRaised,
    '--mag-text': colors.text,
    '--mag-text-soft': colors.textSoft,
    '--mag-text-muted': colors.textMuted,
    '--mag-accent': colors.accent,
    '--mag-accent-hi': colors.accentHi,
    '--mag-accent-deep': colors.accentDeep,
    '--mag-rule': colors.rule,
    '--mag-rule-strong': colors.ruleStrong,
    '--mag-rule-ink': `rgba(0,0,0,.06)`,
    '--mag-overlay': `linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.5))`,
    '--mag-card-bg': colors.surface,
    '--mag-card-border': colors.rule,
    '--mag-display': typeScale.display,
    '--mag-body': typeScale.body,
    '--mag-mono': typeScale.mono,
  };
}

/** Main engine function: takes a brief and returns complete visual tokens */
export function generateIssueTokens(brief: IssueBrief, userThemePreference?: 'light' | 'dark'): GeneratedTokens {
  const primarySchool = DESIGN_SCHOOLS[brief.primarySchool];
  const secondarySchool = brief.secondarySchool ? DESIGN_SCHOOLS[brief.secondarySchool] : undefined;

  if (!primarySchool) {
    throw new Error(`Unknown design school: ${brief.primarySchool}`);
  }

  const mode = resolveMode(primarySchool, brief, userThemePreference);
  const colors = resolveColors(brief.primarySchool, mode, brief.accentOverride);
  const typeScale = SCHOOL_FONTS[brief.primarySchool] ?? SCHOOL_FONTS.editorial_magazine;
  const cssVars = buildCssVars(colors, typeScale);
  const activeDevices = resolveDevices(primarySchool, secondarySchool);
  const spreadTypes = resolveSpreadTypes(brief.primarySchool, brief.secondarySchool);
  const densityLevel = resolveDensity(primarySchool);
  const motionBehavior = resolveMotion(primarySchool, secondarySchool);

  const primaryComposition = getDefiningAtom(primarySchool.atoms.compositionBias);
  const primaryImagery = getDefiningAtom(primarySchool.atoms.imagery);

  return {
    cssVars,
    classOverrides: [],
    spreadTypes,
    activeDevices,
    typeScale,
    colors,
    densityLevel,
    motionBehavior,
    usesImageGrid: primaryImagery === 'editorial_crop' || primaryImagery === 'full_bleed_background',
    usesTypePosters: primaryComposition === 'poster_stack' || primaryComposition === 'asymmetric',
    usesFullBleed: primarySchool.atoms.imagery.full_bleed_background === 'primary' || primarySchool.atoms.imagery.full_bleed_background === 'common',
    textDirection: primarySchool.textDirection,
    mode,
    schoolClass: `mag-school-${brief.primarySchool}`,
    hybridClass: brief.secondarySchool ? `mag-hybrid-${brief.secondarySchool}` : undefined,
  };
}

/** Generate CSS string from tokens to inject into <style> or a class attribute */
export function tokensToCSS(tokens: GeneratedTokens): string {
  const vars = Object.entries(tokens.cssVars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `:root, .magazine-issue {\n${vars}\n}`;
}

/** Get the Google Fonts URL for a school */
export function getSchoolFontUrl(schoolName: DesignSchoolName): string {
  const fonts = SCHOOL_GOOGLE_FONTS[schoolName];
  if (!fonts) return '';
  return `https://fonts.googleapis.com/css2?family=${fonts}&display=swap`;
}