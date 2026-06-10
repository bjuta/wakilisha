/**
 * useArtDirector — React hook that wires the Art Director engine to a magazine issue.
 * Returns complete tokens + CSS variables for the issue, plus spread-level decisions.
 */

import { useMemo } from 'react';
import { generateIssueTokens } from './engine';
import { getIssueBrief } from './briefs';
import type { GeneratedTokens, IssueBrief } from './types';

export interface ArtDirectorResult {
  tokens: GeneratedTokens;
  brief: IssueBrief;
  /** CSS class string to apply to the magazine-issue wrapper */
  issueClass: string;
  /** Inline CSS variables as a React style object */
  cssVars: React.CSSProperties;
  /** Whether this issue is light mode */
  isLight: boolean;
  /** Readable school name for display */
  schoolDisplayName: string;
  /** Google Fonts URL for this issue */
  fontsUrl: string;
}

/** School display names */
const SCHOOL_DISPLAY_NAMES: Record<string, string> = {
  swiss: 'Swiss / International Typographic Style',
  modernist_poster: 'Modernist Poster',
  memphis_postmodern: 'Memphis Postmodern',
  luxury_fashion_editorial: 'Luxury Fashion Editorial',
  japanese_minimal: 'Japanese Minimal',
  information_design: 'Information Design',
  folk_vernacular: 'Folk Vernacular',
  editorial_magazine: 'Editorial Magazine',
  brutalist_web: 'Brutalist Web',
  bauhaus: 'Bauhaus',
};

/** Google Fonts URLs per school */
const SCHOOL_FONTS_URLS: Record<string, string> = {
  swiss: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  modernist_poster: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap',
  memphis_postmodern: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700;12..96,800&family=DM+Sans:opsz,wght@9..40,400;9..40,500&family=DM+Mono:wght@400;500&display=swap',
  luxury_fashion_editorial: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500;1,600&family=DM+Mono:wght@400&display=swap',
  japanese_minimal: 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap',
  information_design: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap',
  folk_vernacular: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,700;1,9..144,300;1,9..144,400;1,9..144,700&family=DM+Mono:wght@400&display=swap',
  editorial_magazine: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400&display=swap',
  brutalist_web: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;700;900&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap',
  bauhaus: 'https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,300;0,400;0,500;0,700;0,900;1,300;1,400&family=DM+Mono:wght@400&display=swap',
};

export function useArtDirector(issueNumber: number, userThemePreference?: 'light' | 'dark'): ArtDirectorResult {
  return useMemo(() => {
    const brief = getIssueBrief(issueNumber);
    const tokens = generateIssueTokens(brief, userThemePreference);

    const issueClass = [
      'magazine-issue',
      tokens.schoolClass,
      `mag-mode-${tokens.mode}`,
      tokens.hybridClass ?? '',
    ].filter(Boolean).join(' ');

    // Build inline CSS vars from the tokens
    const cssVars = Object.entries(tokens.cssVars).reduce<React.CSSProperties>((acc, [k, v]) => {
      (acc as Record<string, string>)[k] = v;
      return acc;
    }, {});

    return {
      tokens,
      brief,
      issueClass,
      cssVars,
      isLight: tokens.mode === 'light',
      schoolDisplayName: SCHOOL_DISPLAY_NAMES[brief.primarySchool] ?? brief.primarySchool,
      fontsUrl: SCHOOL_FONTS_URLS[brief.primarySchool] ?? '',
    };
  }, [issueNumber, userThemePreference]);
}