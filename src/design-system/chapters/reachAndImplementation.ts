import type { WkDesignChapterSpec } from '../designSystemSpecTypes';

export const reachChapters: WkDesignChapterSpec[] = [
  {
    id: 'social-templates',
    number: '24',
    group: 'Reach',
    title: 'Social Templates',
    summary:
      'Future content studio/export surfaces inherit tokens, typography, logo safe zones, and image rules. No safe-zone guides burned into output. Data-driven content blocks rather than manual one-off art. The design system is the source of truth for all exports.',
    adminSections: ['Export preview panel', 'Social template gallery', 'Asset export queue'],
    implementationRules: [
      'Social templates must inherit tokens, typography, logo safe zones, and image rules.',
      'No exports should burn safe-zone guides into output.',
      'Use data-driven content blocks rather than manual one-off art.',
      'Export templates must be reskinned via token overrides, not rebuilt.',
    ],
    componentsRequired: ['WkExportPreview', 'WkSocialTemplate', 'WkAssetExport'],
    tables: [],
    parityTargets: [
      'Keep content studio and public app design tokens unified.',
      'Social templates are token-driven.',
    ],
    qaChecks: [
      { id: '24-token-inherit', label: 'Token inheritance', description: 'Social templates use the same token system.' },
      { id: '24-no-guides', label: 'No burned guides', description: 'Safe-zone guides are not visible in exports.' },
    ],
  },
  {
    id: 'commercial-surfaces',
    number: '25',
    group: 'Reach',
    title: 'Commercial Surfaces',
    summary:
      'Sponsors, partners, reports, and cultural products without making the app feel ad-stuffed. Commercial modules are clearly labeled and visually restrained. Editorial credibility is never compromised. Premium report/card surfaces are preferred over ad banners.',
    adminSections: ['Sponsor module preview', 'Partner report cards', 'Commercial placement audit'],
    implementationRules: [
      'Commercial modules must be clearly labeled and visually restrained.',
      'Do not compromise editorial credibility for sponsor chrome.',
      'Use premium report/card surfaces rather than ad banners as the default.',
      'Commercial content must be separated from editorial in data and layout.',
    ],
    componentsRequired: ['WkSponsorModule', 'WkPartnerCard', 'WkReportCard'],
    tables: [],
    parityTargets: [
      'Design sponsor/report modules that do not pollute charts or editorial.',
      'Commercial surfaces are clearly labeled and non-intrusive.',
    ],
    qaChecks: [
      { id: '25-labeled', label: 'Clearly labeled', description: 'Commercial content is clearly labeled as such.' },
      { id: '25-restrained', label: 'Visually restrained', description: 'Commercial modules do not dominate the page.' },
      { id: '25-separate', label: 'Data separation', description: 'Commercial data is separated from editorial data.' },
    ],
  },
  {
    id: 'cultural-verticals',
    number: '26',
    group: 'Reach',
    title: 'Cultural Verticals',
    summary:
      'Music, Film, Fashion, Food, Language, Dance, Places, Intelligence, and Experiences share one chassis. Each vertical gets one accent and metadata vocabulary. Music components are generalized where possible for future verticals. No app fork.',
    adminSections: ['Vertical switcher preview', 'Vertical token panel', 'Component generalization audit'],
    implementationRules: [
      'Each vertical gets one accent and metadata vocabulary.',
      'Do not fork the app per vertical.',
      'Music components must be generalized where possible for future verticals.',
      'Vertical props must be typed: vertical, accent, metadata, density.',
    ],
    componentsRequired: ['WkVerticalBadge', 'WkVerticalHero', 'WkVerticalCard'],
    tables: ['entity_slugs'],
    parityTargets: [
      'Add vertical token and surface metadata props to archetypes.',
      'All archetypes support vertical prop.',
    ],
    qaChecks: [
      { id: '26-one-accent', label: 'One accent', description: 'Each vertical has exactly one accent color.' },
      { id: '26-no-fork', label: 'No app fork', description: 'Verticals are prop-driven, not separate apps.' },
    ],
  },
  {
    id: 'internationalization',
    number: '27',
    group: 'Reach',
    title: 'Internationalization',
    summary:
      'African languages and multi-locale data presentation. Locale-aware dates, numbers, currencies, and language spans. English-only is not assumed. Diacritics and source casing are preserved. Mixed-language content supports lang attributes.',
    adminSections: ['Locale preview', 'Language span tester', 'i18n string audit'],
    implementationRules: [
      'Locale-aware dates, numbers, currencies, and language spans are required.',
      'Do not assume English-only or US formatting.',
      'Preserve diacritics and source casing.',
      'Mixed-language content must support lang attributes.',
      'Admin interface must be i18n-ready even if initially English-only.',
    ],
    componentsRequired: ['WkLocaleDate', 'WkLocaleNumber', 'WkLangSpan'],
    tables: [],
    parityTargets: [
      'Use Intl and content lang metadata in page payloads.',
      'All dates and numbers use locale-aware formatting.',
    ],
    qaChecks: [
      { id: '27-locale-dates', label: 'Locale dates', description: 'Dates use locale-aware formatting.' },
      { id: '27-diacritics', label: 'Diacritics preserved', description: 'Source casing and diacritics are preserved.' },
      { id: '27-lang-attr', label: 'Lang attributes', description: 'Mixed-language content has lang attributes.' },
    ],
  },
  {
    id: 'rights-attribution',
    number: '28',
    group: 'Reach',
    title: 'Rights & Attribution',
    summary:
      'Source, credit, and provenance are visible enough to build trust. Images, tracks, charts, editorial, and playback sources carry attribution when available. Provider/source context is not removed from playback. Corrections and methodology links have consistent placement.',
    adminSections: ['Attribution audit panel', 'Source attribution table', 'Methodology editor'],
    implementationRules: [
      'Images, tracks, charts, editorial, and playback sources must carry attribution when available.',
      'Do not remove provider/source context from playback.',
      'Corrections and methodology links must have a consistent placement.',
      'Attribution must be visible on entity, chart, article, and player surfaces.',
    ],
    componentsRequired: ['WkAttribution', 'WkSourceBadge', 'WkMethodologyLink'],
    tables: ['track_playback_sources'],
    parityTargets: [
      'Add attribution modules to entity, chart, article, and player surfaces.',
      'Attribution is visible on all content surfaces.',
    ],
    qaChecks: [
      { id: '28-attribution-visible', label: 'Attribution visible', description: 'Attribution is visible on all content surfaces.' },
      { id: '28-source-preserved', label: 'Source preserved', description: 'Playback source context is not removed.' },
      { id: '28-methodology', label: 'Methodology link', description: 'Charts and editorial have consistent methodology placement.' },
    ],
  },
];

export const implementationChapters: WkDesignChapterSpec[] = [
  {
    id: 'tokens-map',
    number: '29',
    group: 'Implementation',
    title: 'Tokens',
    summary:
      'Bridge design tokens into CSS variables, Tailwind, React components, and theme mode. --wk-* variables are source of truth. Tailwind maps to tokens, not replaces them. Hard-coded spacing/colors are design debt unless part of media overlays or documented exceptions.',
    adminSections: ['Token inspector', 'CSS variable audit', 'Tailwind config viewer', 'Theme toggle'],
    implementationRules: [
      'Use --wk-* variables as source of truth.',
      'Tailwind should map to tokens, not replace them.',
      'Hard-coded spacing/colors are design debt unless part of media overlays or documented exceptions.',
      'All token values must be inspectable in the admin token inspector.',
      'Theme mode switching must be instant and persistent via data-wk-theme.',
    ],
    componentsRequired: ['TokenInspector', 'ThemeProvider', 'WkTokenSwatch', 'WkTokenValue'],
    tables: [],
    parityTargets: [
      'Ship packages/design-system/src/wakilisha.tokens.css and import it app-wide.',
      'All CSS uses --wk-* tokens.',
    ],
    qaChecks: [
      { id: '29-token-source', label: 'Token source of truth', description: 'All colors and spacing use --wk-* tokens.' },
      { id: '29-no-hardcoded', label: 'No hard-coded', description: 'No hard-coded colors or spacing outside media overlays.' },
      { id: '29-theme-switch', label: 'Theme switching', description: 'Theme switches instantly without page reload.' },
    ],
  },
  {
    id: 'component-inventory',
    number: '30',
    group: 'Implementation',
    title: 'Component Inventory',
    summary:
      'Components that all pages must use rather than rebuilding local variants. Components expose data-driven props and states. No duplicate Card/Button/Row/Hero per page. Every component has responsive and empty-state behavior. The admin bible shows component specimens.',
    adminSections: ['Specimen wall', 'Component catalog', 'Component backlog', 'QA gate: component compliance'],
    implementationRules: [
      'Components must expose data-driven props and states.',
      'Avoid duplicate Card/Button/Row/Hero components per page.',
      'Every component needs responsive and empty-state behavior.',
      'Component inventory must be browsable in the admin design bible.',
      'New components must be added to the inventory before shipping to production.',
    ],
    componentsRequired: [
      'WkButton', 'WkTag', 'WkSurface', 'WkCard', 'WkTrackRow', 'WkChartRow',
      'WkArtistCard', 'WkReleaseCard', 'WkLabelCard', 'WkGenreCard', 'WkStoryCard',
      'WkPlayerDock', 'WkPlayerSheet', 'WkModal', 'WkSheet', 'WkAdminBar', 'WkAdminKpi', 'WkAdminTable'
    ],
    tables: [],
    parityTargets: [
      'Create component backlog from chapters 10–54.',
      'All pages use shared components, not one-off variants.',
    ],
    qaChecks: [
      { id: '30-reusable', label: 'Reusable', description: 'All components are reusable across pages.' },
      { id: '30-data-driven', label: 'Data-driven', description: 'Components accept data props, not hard-coded content.' },
      { id: '30-empty-state', label: 'Empty state', description: 'Every component has a defined empty state.' },
    ],
  },
  {
    id: 'figma-organization',
    number: '31',
    group: 'Implementation',
    title: 'Figma Organization',
    summary:
      'Design work is organized around foundations, components, archetypes, and shipped pages. Figma frames mirror component inventory and page archetypes. Specimen pages map back to token/component names. No orphaned one-off frames without implementation status.',
    adminSections: ['Figma frame mirror', 'Implementation status tracker', 'Specimen page map'],
    implementationRules: [
      'Figma frames should mirror component inventory and page archetypes.',
      'Specimen pages should map back to token/component names.',
      'No orphaned one-off design frames without implementation status.',
      'The admin design bible is the in-app counterpart to Figma.',
    ],
    componentsRequired: ['AdminDesignSystem', 'SpecimenWall', 'ParityMap', 'QAGates'],
    tables: [],
    parityTargets: [
      'Use the admin design bible as the in-app counterpart to Figma.',
      'Admin bible mirrors Figma organization.',
    ],
    qaChecks: [
      { id: '31-figma-mirror', label: 'Figma mirror', description: 'Figma frames mirror component inventory and archetypes.' },
      { id: '31-no-orphans', label: 'No orphans', description: 'No design frames without implementation status.' },
    ],
  },
  {
    id: 'qa-checklist',
    number: '32',
    group: 'Implementation',
    title: 'QA Checklist',
    summary:
      'Pass/fail system for design, accessibility, responsiveness, and data wiring. Every page must pass data, design, mobile, accessibility, copy, and performance checks. Screenshots are required before declaring parity. Mock data automatically fails production QA.',
    adminSections: ['QA gate matrix', 'Page-level QA checklist', 'Screenshot audit', 'QA history'],
    implementationRules: [
      'Every page must pass data, design, mobile, accessibility, copy, and performance checks.',
      'Screenshots are required before declaring parity.',
      'Mock data automatically fails production QA.',
      'QA gates are per-page and per-chapter.',
      'Admin must show QA status for every route and every chapter.',
    ],
    componentsRequired: ['WkQAGates', 'WkQAChecklist', 'WkQAMatrix', 'WkScreenshotAudit'],
    tables: [],
    parityTargets: [
      'Add page QA matrices to parity plan.',
      'Every page has a documented QA checklist.',
    ],
    qaChecks: [
      { id: '32-data-pass', label: 'Data pass', description: 'All data is graph-backed and real.' },
      { id: '32-design-pass', label: 'Design pass', description: 'Design matches system tokens and archetypes.' },
      { id: '32-mock-fails', label: 'Mock data fails', description: 'Mock data automatically fails production QA.' },
    ],
  },
  {
    id: 'anti-slop-rules',
    number: '33',
    group: 'Implementation',
    title: 'Anti-Slop Rules',
    summary:
      'Prevent AI-template design drift and generic React-app behavior. No fake data on public pages. No generic SaaS gradients, bouncy cards, emoji microcopy, or meaningless CTAs. No hard-coded content that should come from the repaired graph. No page ships without matching a design-system archetype.',
    adminSections: ['Anti-slop audit panel', 'Design drift detector', 'Template contamination report', 'QA gate: anti-slop'],
    implementationRules: [
      'No fake data on public pages.',
      'No generic SaaS gradients, bouncy cards, emoji microcopy, or meaningless CTAs.',
      'No hard-coded content that should come from the repaired graph.',
      'No page ships without matching a design-system archetype.',
      'Admin must flag pages that violate anti-slop rules in the review queue.',
    ],
    componentsRequired: ['WkAntiSlopAudit', 'WkTemplateContamination', 'WkDesignDriftDetector'],
    tables: [],
    parityTargets: [
      'Add an anti-slop review gate to every Readdy/dev handoff.',
      'All production pages pass anti-slop review.',
    ],
    qaChecks: [
      { id: '33-no-fake', label: 'No fake data', description: 'Public pages have no mock or placeholder data.' },
      { id: '33-no-gradients', label: 'No generic gradients', description: 'No SaaS gradient backgrounds or neon accents.' },
      { id: '33-no-emojis', label: 'No emoji copy', description: 'No emoji in UI copy or microcopy.' },
    ],
  },
  {
    id: 'roadmap',
    number: '34',
    group: 'Implementation',
    title: 'Roadmap',
    summary:
      'Sequence design-system adoption: foundation first, then admin bible, then payloads, then public archetypes. Do not redesign all pages independently. Design parity is system compliance plus product behavior parity, not visual imitation.',
    adminSections: ['Roadmap timeline', 'Phase tracker', 'Component backlog', 'Page parity progress'],
    implementationRules: [
      'Foundation first, then admin bible, then payloads, then public archetypes.',
      'Do not redesign all pages independently.',
      'Design parity is not visual imitation; it is system compliance plus product behavior parity.',
      'Admin roadmap shows current phase, completed items, and next blockers.',
    ],
    componentsRequired: ['WkRoadmap', 'WkPhaseTracker', 'WkProgressBar'],
    tables: [],
    parityTargets: [
      'Use this roadmap to gate the React rebuild.',
      'All phases are documented and tracked.',
    ],
    qaChecks: [
      { id: '34-phase-order', label: 'Phase order', description: 'Foundation → Bible → Payloads → Archetypes → Public.' },
      { id: '34-no-skips', label: 'No skips', description: 'No public page ships before its archetype is defined.' },
    ],
  },
];