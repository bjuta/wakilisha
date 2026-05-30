import type { WkDesignSystemSpec } from './designSystemSpecTypes';
import { foundationsChapters } from './chapters/foundations';
import { productChapters } from './chapters/product';
import { mediaChapters } from './chapters/media';
import { reachChapters, implementationChapters } from './chapters/reachAndImplementation';
import { reactAppUIChapters } from './chapters/reactAppUI';
import { mobileExperienceChapters } from './chapters/mobileExperience';
import { canonicalChapterEnhancementByNumber, canonicalChapterEnhancements } from './canonicalChapterEnhancements';

export * from './designSystemSpecTypes';
export * from './canonicalChapterEnhancements';
export * from './wakilishaElementRegistry';

const baseChapters = [
  ...foundationsChapters,
  ...productChapters,
  ...mediaChapters,
  ...reachChapters,
  ...implementationChapters,
  ...reactAppUIChapters,
  ...mobileExperienceChapters,
];

const chapters = baseChapters.map((chapter) => ({
  ...chapter,
  canonical: canonicalChapterEnhancementByNumber[chapter.number],
}));

const canonicalTotals = canonicalChapterEnhancements.reduce(
  (acc, chapter) => {
    acc.richMediaSpecimens += chapter.canonicalMetrics.visualSpecimens;
    acc.sourceTables += chapter.canonicalMetrics.tables;
    acc.sourceCodeBlocks += chapter.canonicalMetrics.codeBlocks;
    acc.sourceCallouts += chapter.canonicalMetrics.callouts;
    acc.sourceDoDontCards += chapter.canonicalMetrics.doDontCards;
    return acc;
  },
  { richMediaSpecimens: 0, sourceTables: 0, sourceCodeBlocks: 0, sourceCallouts: 0, sourceDoDontCards: 0 }
);

export const wakilishaDesignSystemSpec: WkDesignSystemSpec = {
  meta: {
    name: 'WAKILISHA Design System',
    version: 'v5.0',
    sourceDocument: 'wakilisha-design-system-v5 (2).html',
    northStar: 'One system. Every WAKILISHA surface.',
    principles: [
      'Cinematic restraint',
      'Editorial credibility',
      'Cultural specificity',
      'Commercial credibility',
      'Long-haul scale'
    ],
    rule: 'The interface stays small until the content earns space.'
  },

  chapters,

  canonicalParity: {
    canonicalChapterCount: canonicalChapterEnhancements.length + mobileExperienceChapters.length,
    implementedChapterCount: chapters.filter((chapter) => chapter.canonical).length + mobileExperienceChapters.length,
    richMediaSpecimens: canonicalTotals.richMediaSpecimens,
    sourceTables: canonicalTotals.sourceTables,
    sourceCodeBlocks: canonicalTotals.sourceCodeBlocks,
    sourceCallouts: canonicalTotals.sourceCallouts,
    sourceDoDontCards: canonicalTotals.sourceDoDontCards,
    parityPercent: Math.round(((chapters.filter((chapter) => chapter.canonical).length + mobileExperienceChapters.length) / (canonicalChapterEnhancements.length + mobileExperienceChapters.length)) * 100),
  },

  parityPageMap: [
    { route: '/', archetype: 'Home / cultural graph overview', chapters: ['01','04','05','06','13','16','19','21','22','35','38','53','55','66'], qaChecks: ['01-earn-space','01-culture-forward','01-no-templates','04-token-only','05-fonts','06-token-spacing','13-metadata','16-dock-height','19-scrim-legible','35-scale-appropriate','38-editorial','53-intentional','55-mobile-native','66-phone-fidelity'] },
    { route: '/auth', archetype: 'Auth and onboarding', chapters: ['03','04','05','11','47','53','65'], qaChecks: ['03-svg-only','04-token-only','05-fonts','11-specific-actions','47-theme-switch','53-hit-area','65-phone-fidelity'] },
    { route: '/search', archetype: 'Search and discovery', chapters: ['17','22','53','75'], qaChecks: ['17-real-data','17-debounced','22-graph-backed','53-hit-area','75-route-backed'] },
    { route: '/charts', archetype: 'Charts index', chapters: ['21','35','39','15','16','53','67'], qaChecks: ['21-dense','21-canonical-links','21-no-fabricated','35-scale-appropriate','39-dense','39-playable','39-no-fabricated','15-density','15-playable','15-movement','16-dock-height','16-source-visible','67-phone-fidelity'] },
    { route: '/charts/:series/:edition', archetype: 'Charts edition', chapters: ['21','39','15','16','45','53','67'], qaChecks: ['21-dense','21-canonical-links','21-no-fabricated','39-dense','39-playable','39-no-fabricated','15-density','15-playable','15-movement','16-dock-height','16-source-visible','45-specific-copy','45-og-preview','45-timestamp','67-route-backed'] },
    { route: '/artists', archetype: 'Artist directory', chapters: ['17','22','35','37','53','69'], qaChecks: ['17-entity-type','17-real-data','17-debounced','22-relationships-visible','22-graph-backed','22-slug-routes','35-scale-appropriate','37-culturally-important','37-grid-list','37-relationships','53-intentional','53-player-coexist','53-hit-area','69-phone-fidelity'] },
    { route: '/artists/:slug', archetype: 'Artist entity page', chapters: ['22','35','37','40','41','45','53','70'], qaChecks: ['22-relationships-visible','22-graph-backed','22-slug-routes','35-scale-appropriate','37-culturally-important','37-relationships','40-graph-backed','40-playback-enabled','40-attribution','41-tracklist-accurate','41-modal-consistent','41-no-flatten','45-specific-copy','45-og-preview','45-timestamp','70-route-backed'] },
    { route: '/tracks/:slug', archetype: 'Single track', chapters: ['16','21','22','35','40','45','53','58','73'], qaChecks: ['16-dock-height','16-source-visible','16-no-fake','21-dense','21-canonical-links','21-no-fabricated','22-relationships-visible','22-graph-backed','22-slug-routes','35-scale-appropriate','40-graph-backed','40-playback-enabled','40-attribution','45-specific-copy','45-og-preview','45-timestamp','58-phone-fidelity','73-phone-fidelity'] },
    { route: '/releases', archetype: 'Release catalog', chapters: ['17','22','35','41','42','53'], qaChecks: ['17-entity-type','17-real-data','17-debounced','22-relationships-visible','22-graph-backed','22-slug-routes','35-scale-appropriate','41-tracklist-accurate','41-modal-consistent','41-no-flatten','42-focus-trap','42-reduced-motion','42-same-language','53-hit-area'] },
    { route: '/releases/:slug', archetype: 'Single release', chapters: ['22','35','41','42','45','53'], qaChecks: ['22-relationships-visible','22-graph-backed','22-slug-routes','35-scale-appropriate','41-tracklist-accurate','41-modal-consistent','41-no-flatten','42-focus-trap','42-reduced-motion','42-same-language','45-specific-copy','45-og-preview','45-timestamp','53-hit-area'] },
    { route: '/genres', archetype: 'Genre directory', chapters: ['17','22','35','36','53','71'], qaChecks: ['17-entity-type','17-real-data','17-debounced','22-relationships-visible','22-graph-backed','22-slug-routes','35-scale-appropriate','36-counts','36-no-stock','36-graph-backed','71-phone-fidelity'] },
    { route: '/genres/:slug', archetype: 'Genre page', chapters: ['22','35','36','37','40','53','71'], qaChecks: ['22-relationships-visible','22-graph-backed','22-slug-routes','35-scale-appropriate','36-counts','36-no-stock','36-graph-backed','37-culturally-important','37-grid-list','37-relationships','40-graph-backed','40-playback-enabled','40-attribution','71-route-backed'] },
    { route: '/labels', archetype: 'Labels directory', chapters: ['17','22','35','43','53','72'], qaChecks: ['17-entity-type','17-real-data','17-debounced','22-relationships-visible','22-graph-backed','22-slug-routes','35-scale-appropriate','43-serious-registry','43-relationships','43-repaired','72-phone-fidelity'] },
    { route: '/labels/:slug', archetype: 'Label page', chapters: ['22','35','41','43','53','72'], qaChecks: ['22-relationships-visible','22-graph-backed','22-slug-routes','35-scale-appropriate','41-tracklist-accurate','41-modal-consistent','41-no-flatten','43-serious-registry','43-relationships','43-repaired','72-route-backed'] },
    { route: '/magazine', archetype: 'Magazine index', chapters: ['20','35','38','44','53','68'], qaChecks: ['20-reading-width','20-related-routes','20-classified','35-scale-appropriate','38-editorial','38-classified','38-real-routes','44-reading-width','44-credible','44-related-graph','68-phone-fidelity'] },
    { route: '/magazine/:slug', archetype: 'Article page', chapters: ['20','35','44','45','53','68'], qaChecks: ['20-reading-width','20-related-routes','20-classified','35-scale-appropriate','44-reading-width','44-credible','44-related-graph','45-specific-copy','45-og-preview','45-timestamp','68-route-backed'] },
    { route: '/profile', archetype: 'User profile', chapters: ['22','48','53','74'], qaChecks: ['22-graph-backed','48-specific-profile','53-hit-area','74-phone-fidelity'] },
    { route: '/settings', archetype: 'Settings', chapters: ['49','53'], qaChecks: ['49-calm-settings','49-toggle-clear','53-hit-area'] },
    { route: '/admin/design-system', archetype: 'Living design bible', chapters: ['29','30','32','33','50','55','65'], qaChecks: ['29-token-source','29-no-hardcoded','29-theme-switch','30-reusable','30-data-driven','30-empty-state','32-data-pass','32-design-pass','32-mock-fails','33-no-fake','33-no-gradients','33-no-emojis','50-same-tokens','50-bible','50-not-backend','55-mobile-native','65-phone-fidelity'] },
  ],

  globalQaGates: [
    { id: 'data-backed', label: 'Data-backed', description: 'All data comes from graph or real API.' },
    { id: 'no-mock', label: 'No mock data', description: 'Production routes contain no mock/placeholder data.' },
    { id: 'token-compliance', label: 'Token compliance', description: 'All colors, spacing, and typography use design tokens.' },
    { id: 'mobile-behavior', label: 'Mobile behavior', description: 'Layout is intentional on mobile, not collapsed desktop.' },
    { id: 'touch-architecture', label: 'Touch architecture', description: 'Mobile hit areas, thumb zones and bottom actions are intentionally designed.' },
    { id: 'player-coexistence', label: 'Player coexistence', description: 'Mini-player, bottom nav, sheets and page content do not overlap.' },
    { id: 'accessibility', label: 'Accessibility', description: 'WCAG 2.2 AA compliance, semantic headings, aria labels.' },
    { id: 'voice-copy', label: 'Voice / Copy', description: 'Editorial tone, specific CTAs, no emoji or filler text.' },
    { id: 'empty-states', label: 'Empty states', description: 'Loading, empty, and error states are handled.' },
    { id: 'archetype-match', label: 'Archetype match', description: 'Page maps to a design-system archetype.' },
  ],
};

export const chapterCount = wakilishaDesignSystemSpec.chapters.length;

export const chapterById = (id: string) => wakilishaDesignSystemSpec.chapters.find(c => c.id === id);

export const chapterByNumber = (num: string) => wakilishaDesignSystemSpec.chapters.find(c => c.number === num);

export const chaptersByGroup = (group: string) => wakilishaDesignSystemSpec.chapters.filter(c => c.group === group);

export const parityPagesForChapter = (chapterNumber: string) => wakilishaDesignSystemSpec.parityPageMap.filter(p => p.chapters.includes(chapterNumber));

export const qaChecksForChapter = (chapterId: string) => {
  const ch = chapterById(chapterId);
  return ch ? ch.qaChecks : [];
};

export const allComponentNames = () => {
  const set = new Set<string>();
  for (const ch of wakilishaDesignSystemSpec.chapters) {
    for (const c of ch.componentsRequired) set.add(c);
  }
  return Array.from(set).sort();
};

export const allTableNames = () => {
  const set = new Set<string>();
  for (const ch of wakilishaDesignSystemSpec.chapters) {
    for (const t of ch.tables) set.add(t);
  }
  return Array.from(set).sort();
};
