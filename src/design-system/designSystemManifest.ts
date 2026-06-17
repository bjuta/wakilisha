export type WkDesignChapter = {
  id: string;
  number: string;
  group: 'Foundations' | 'Product' | 'Media & Editorial' | 'Reach' | 'Implementation' | 'React App UI';
  title: string;
  purpose: string;
  implementationRules: string[];
  parityTargets: string[];
};

export const wakilishaDesignSystemMeta = {
  name: 'WAKILISHA Design System',
  version: 'v5.0',
  sourceDocument: 'wakilisha-design-system-v5.html',
  northStar: 'One system. Every WAKILISHA surface.',
  principles: [
    'Cinematic restraint',
    'Editorial credibility',
    'Cultural specificity',
    'Commercial credibility',
    'Long-haul scale'
  ],
  rule: 'The interface stays small until the content earns space.'
};

export const wakilishaDesignChapters: WkDesignChapter[] = [
  {
    id: 'north-star',
    number: '01',
    group: 'Foundations',
    title: 'North Star',
    purpose: 'Set the decision filter for every surface: restraint, editorial credibility, cultural specificity, commercial credibility, and long-haul scale.',
    implementationRules: [
      'Every UI decision must answer whether it earns the space, carries the work, and belongs to WAKILISHA.',
      'Interfaces stay compact by default and expand only when content earns it.',
      'Do not build Western SaaS templates with African content pasted in.'
    ],
    parityTargets: ['All page reviews must include a north-star compliance check.']
  },
  {
    id: 'brand-architecture',
    number: '02',
    group: 'Foundations',
    title: 'Brand Architecture',
    purpose: 'Preserve WAKILISHA as the mother brand while letting verticals flex through light accent systems.',
    implementationRules: [
      'Universal: wordmark, bolt, typography, spacing, radius, motion, navigation grammar, and editorial conventions.',
      'Flexible: one vertical accent, image treatment, metadata vocabulary, card density, and player chrome.',
      'Music keeps brand green as the founding vertical.'
    ],
    parityTargets: ['Create vertical-aware components without forking the design system.']
  },
  {
    id: 'logo',
    number: '03',
    group: 'Foundations',
    title: 'Logo',
    purpose: 'Use the custom WAKILISHA SVG masthead correctly across dark, light, photo, and brand surfaces.',
    implementationRules: [
      'Never recreate WAKILISHA in a system font except as a temporary bug fallback.',
      'Dark mode uses white letters and green bolt. Light mode uses black letters and green bolt.',
      'Clear space equals the height of the bolt glyph; 1.5x for print and event posters.',
      'Below 10px logo height, switch to bolt-only mark.'
    ],
    parityTargets: ['Ship theme-aware Logo and BoltMark React components.']
  },
  {
    id: 'color',
    number: '04',
    group: 'Foundations',
    title: 'Color',
    purpose: 'Create the restrained warm-neutral spine, one brand green, semantic status colors, and light vertical accents.',
    implementationRules: [
      'Primary green is #84C241 in dark mode. Light mode brand text shifts to #5C8E25 for contrast.',
      'Use green for one meaningful moment per surface, not as decoration everywhere.',
      'No generic SaaS blue as primary, no neon gradients, no random purple as brand color.',
      'Use vertical accents lightly and never as primary CTAs.'
    ],
    parityTargets: ['All CSS must consume --wk-* tokens, not hard-coded Readdy classes.']
  },
  {
    id: 'typography',
    number: '05',
    group: 'Foundations',
    title: 'Typography',
    purpose: 'Use Inter for display/UI, DM Sans for body/editorial warmth, and DM Mono for tokens/code.',
    implementationRules: [
      'Nothing else ships beyond Inter, DM Sans, and DM Mono.',
      'Headlines and buttons use sentence case. Eyebrows/status can use uppercase with tracking.',
      'Artist, track, place, and title casing must preserve source casing.',
      'Use clamp display scale for heroes, page titles, section titles, and article heads.'
    ],
    parityTargets: ['Create type utility classes and replace generic heading styles.']
  },
  {
    id: 'spacing-layout',
    number: '06',
    group: 'Foundations',
    title: 'Spacing & Layout',
    purpose: 'Use the 4-based spacing scale, radius scale, responsive breakpoints, and tuned content widths.',
    implementationRules: [
      'Major section rhythm must use --wk-s-10, --wk-s-12, or --wk-s-16.',
      'Use --wk-w-text for article bodies, --wk-w-content for standard pages, --wk-w-wide for dense data, and --wk-w-max for magazine surfaces.',
      'Do not invent in-between spacing values without adding a system token.'
    ],
    parityTargets: ['Build page shells around container tokens before adding page content.']
  },
  {
    id: 'motion',
    number: '07',
    group: 'Foundations',
    title: 'Motion',
    purpose: 'Use motion as orientation, not decoration.',
    implementationRules: [
      'No idle looping motion except live status dots, overflow marquees, and audio waveforms during playback.',
      'Things appear from where they came and leave toward where they went.',
      'Respect prefers-reduced-motion globally.',
      'Avoid bouncy hover, parallax, card tilt, animated counters, and AI-template carousel motion.'
    ],
    parityTargets: ['Create motion primitives for sheets, modals, player, route transitions, and reduced-motion.']
  },
  {
    id: 'voice',
    number: '08',
    group: 'Foundations',
    title: 'Voice',
    purpose: 'Keep UI copy editorial, factual, specific, restrained, and non-sycophantic.',
    implementationRules: [
      'No emojis, no Awesome!, no Oops!, no celebration copy for ordinary states.',
      'Use one short sentence for empty/error states.',
      'Use verb + noun CTAs: Open profile, Read the story, Save to collection.',
      'Avoid Learn more, Click here, See all where a specific action exists.'
    ],
    parityTargets: ['Add copy lint rules to review page strings and CTAs.']
  },
  {
    id: 'accessibility',
    number: '09',
    group: 'Foundations',
    title: 'Accessibility',
    purpose: 'Make WAKILISHA reachable across devices, bandwidth levels, languages, keyboard, and screen readers.',
    implementationRules: [
      'WCAG 2.2 AA is the floor; AAA where feasible.',
      '44x44px touch targets for player and mobile controls.',
      'All icon-only controls require aria-labels. All page headings must be semantic.',
      'Mixed-language content must support lang attributes.'
    ],
    parityTargets: ['Add page-level accessibility review before shipping any public route.']
  },
  {
    id: 'navigation',
    number: '10',
    group: 'Product',
    title: 'Navigation',
    purpose: 'Create a consistent product navigation grammar across public, admin, search, player, and profile surfaces.',
    implementationRules: [
      'Navigation must be small, stable, and theme-aware.',
      'Player and search must coexist without crowding the masthead.',
      'Use page-specific surface labels rather than oversized nav decoration.'
    ],
    parityTargets: ['Implement public nav, admin nav, mobile nav, and player-aware nav capsule.']
  },
  {
    id: 'buttons-actions',
    number: '11',
    group: 'Product',
    title: 'Buttons & Actions',
    purpose: 'Make actions specific, accessible, and visually restrained.',
    implementationRules: [
      'Primary button is brand green; do not use multiple primary CTAs in one decision area.',
      'Ghost and soft buttons carry secondary actions.',
      'Button labels are sentence case and specific to the action.'
    ],
    parityTargets: ['Centralize Button, IconButton, ActionBar, and CTA patterns.']
  },
  {
    id: 'forms',
    number: '12',
    group: 'Product',
    title: 'Forms',
    purpose: 'Create readable admin and public forms with visible labels, validation, and accessible errors.',
    implementationRules: [
      'Placeholder is never the label.',
      'Errors use color, text, and icons; never color-only.',
      'Search inputs must show data scope and result count where possible.'
    ],
    parityTargets: ['Build search, filters, admin edit forms, review queue forms.']
  },
  {
    id: 'cards-surfaces',
    number: '13',
    group: 'Product',
    title: 'Cards & Surfaces',
    purpose: 'Define restrained cards, raised panels, hover states, and media surfaces.',
    implementationRules: [
      'Cards must carry useful metadata, not just image + title.',
      'Use surfaces to clarify content hierarchy, not as heavy boxes around everything.',
      'Prefer image-led cards for editorial/music discovery and row patterns for dense charts.'
    ],
    parityTargets: ['Build entity cards, story cards, release cards, label cards, genre cards, and admin cards.']
  },
  {
    id: 'tags-badges',
    number: '14',
    group: 'Product',
    title: 'Tags & Badges',
    purpose: 'Use tags and badges to communicate status, metadata, and editorial categories.',
    implementationRules: [
      'Tags use sentence case. Status badges may use uppercase.',
      'Brand-soft backgrounds communicate active/featured states.',
      'Do not over-tag cards until they become noisy.'
    ],
    parityTargets: ['Centralize genre tags, status tags, chart movement tags, editorial categories.']
  },
  {
    id: 'track-entity-rows',
    number: '15',
    group: 'Product',
    title: 'Track & Entity Rows',
    purpose: 'Standardize dense music rows across charts, albums, search, queues, and related lists.',
    implementationRules: [
      'Rows should expose rank/position, artwork, title, artist, movement, and metadata where context requires.',
      'Rows must support compact and expanded modes.',
      'Playable rows must reveal player affordances without breaking density.'
    ],
    parityTargets: ['Build TrackRow, ChartRow, AlbumTrackRow, EntityRow.']
  },
  {
    id: 'player-system',
    number: '16',
    group: 'Product',
    title: 'Player System',
    purpose: 'Make playback a system: dock, nav capsule, sheet, theater, queue, and source attribution.',
    implementationRules: [
      'Player dock height is 64px desktop and 56px mobile.',
      'Sheet expands from dock cover; theater is reserved for immersive mode.',
      'Source/provider attribution must be visible; playback metadata must come from track_playback_sources.',
      'No fake player controls detached from real playback availability.'
    ],
    parityTargets: ['Build persistent player store, dock UI, expanded sheet, preview availability states.']
  },
  {
    id: 'search-discovery',
    number: '17',
    group: 'Product',
    title: 'Search & Discovery',
    purpose: 'Make discovery graph-aware: search across artists, tracks, releases, labels, genres, charts, and editorial.',
    implementationRules: [
      'Search results must identify entity type, relationship context, and route.',
      'Discovery pages should use filters and editorial grouping, not generic grids only.',
      'No mock data in search results.'
    ],
    parityTargets: ['Build global search payload and directory filters.']
  },
  {
    id: 'states',
    number: '18',
    group: 'Product',
    title: 'States',
    purpose: 'Define loading, empty, error, review, partial-data, and no-playback states.',
    implementationRules: [
      'Empty states state what is true now, not cheerful filler.',
      'Partial graph states must expose review reasons when useful.',
      'Use skeletons and factual labels, not spinner-heavy pages.'
    ],
    parityTargets: ['Create StateBlock, Skeleton, ErrorBlock, PartialDataNotice.']
  },
  {
    id: 'image-system',
    number: '19',
    group: 'Media & Editorial',
    title: 'Image System',
    purpose: 'Standardize artist portraits, album art, editorial photos, hero scrims, and fallback artwork.',
    implementationRules: [
      'Photography carries warmth; UI stays restrained.',
      'Hero photography needs legible scrims and safe logo placement.',
      'Fallback media must be deterministic and entity-aware, not random unrelated images.'
    ],
    parityTargets: ['Build media resolver from wk_media_assets and fallback art system.']
  },
  {
    id: 'editorial-articles',
    number: '20',
    group: 'Media & Editorial',
    title: 'Editorial Articles',
    purpose: 'Make magazine surfaces feel authored, credible, and culturally specific.',
    implementationRules: [
      'Articles need headline, dek, byline, section, date, hero, body, related entities, and attribution.',
      'Use --wk-w-text for reading body.',
      'Separate true editorial from WordPress shells using content classification.'
    ],
    parityTargets: ['Build MagazineIndex, ArticlePage, story cards, related graph embeds.']
  },
  {
    id: 'charts-rankings',
    number: '21',
    group: 'Media & Editorial',
    title: 'Charts & Rankings',
    purpose: 'Make WAKILISHA charts distinctive, dense, playable, and graph-aware.',
    implementationRules: [
      'Chart rows show rank, artwork, track, artist, movement, weeks, peak, and label/metadata when available.',
      'Top positions deserve stronger visual treatment without destroying list density.',
      'Charts must link to canonical tracks and artists.'
    ],
    parityTargets: ['Build chart series, edition, row, movement, and history components.']
  },
  {
    id: 'registry',
    number: '22',
    group: 'Media & Editorial',
    title: 'Registry',
    purpose: 'Make tracks, artists, releases, labels, and genres feel like a cultural graph, not flat tables.',
    implementationRules: [
      'Entity pages must expose relationships: artist→tracks, track→release/chart/playback, release→tracklist/label, genre→artists/tracks.',
      'Do not hide relationship counts; make the graph visible and pleasurable.',
      'Review/uncertain data must be flagged internally, not guessed publicly.'
    ],
    parityTargets: ['Build registry payloads and graph relationship modules for every entity page.']
  },
  {
    id: 'page-archetypes',
    number: '23',
    group: 'Media & Editorial',
    title: 'Page Archetypes',
    purpose: 'Define the repeatable public page structures that replace disjointed WordPress templates.',
    implementationRules: [
      'Every archetype starts with data contract, then layout, then components.',
      'Use page shell + hero + relationship modules + related content pattern.',
      'Do not build one-off pages where a reusable archetype exists.'
    ],
    parityTargets: ['Map every route to a system archetype before UI implementation.']
  },
  {
    id: 'social-templates',
    number: '24',
    group: 'Reach',
    title: 'Social Templates',
    purpose: 'Prepare future content studio/export surfaces from the same design system language.',
    implementationRules: [
      'Social templates must inherit tokens, typography, logo safe zones, and image rules.',
      'No exports should burn safe-zone guides into output.',
      'Use data-driven content blocks rather than manual one-off art.'
    ],
    parityTargets: ['Keep content studio and public app design tokens unified.']
  },
  {
    id: 'commercial-surfaces',
    number: '25',
    group: 'Reach',
    title: 'Commercial Surfaces',
    purpose: 'Support sponsors, partners, reports, and cultural products without making the app feel ad-stuffed.',
    implementationRules: [
      'Commercial modules must be clearly labeled and visually restrained.',
      'Do not compromise editorial credibility for sponsor chrome.',
      'Use premium report/card surfaces rather than ad banners as the default.'
    ],
    parityTargets: ['Design sponsor/report modules that do not pollute charts or editorial.']
  },
  {
    id: 'cultural-verticals',
    number: '26',
    group: 'Reach',
    title: 'Cultural Verticals',
    purpose: 'Prepare Music, Film, Fashion, Food, Language, Dance, Places, Intelligence, and Experiences to share one chassis.',
    implementationRules: [
      'Each vertical gets one accent and metadata vocabulary.',
      'Do not fork the app per vertical.',
      'Music components must be generalized where possible for future verticals.'
    ],
    parityTargets: ['Add vertical token and surface metadata props to archetypes.']
  },
  {
    id: 'internationalization',
    number: '27',
    group: 'Reach',
    title: 'Internationalization',
    purpose: 'Support African languages and multi-locale data presentation.',
    implementationRules: [
      'Locale-aware dates, numbers, currencies, and language spans are required.',
      'Do not assume English-only or US formatting.',
      'Preserve diacritics and source casing.'
    ],
    parityTargets: ['Use Intl and content lang metadata in page payloads.']
  },
  {
    id: 'rights-attribution',
    number: '28',
    group: 'Reach',
    title: 'Rights & Attribution',
    purpose: 'Keep source, credit, and provenance visible enough to build trust.',
    implementationRules: [
      'Images, tracks, charts, editorial, and playback sources must carry attribution when available.',
      'Do not remove provider/source context from playback.',
      'Corrections and methodology links must have a consistent placement.'
    ],
    parityTargets: ['Add attribution modules to entity, chart, article, and player surfaces.']
  },
  {
    id: 'tokens-map',
    number: '29',
    group: 'Implementation',
    title: 'Tokens',
    purpose: 'Bridge design tokens into CSS variables, Tailwind, React components, and theme mode.',
    implementationRules: [
      'Use --wk-* variables as source of truth.',
      'Tailwind should map to tokens, not replace them.',
      'Hard-coded spacing/colors are design debt unless part of media overlays or documented exceptions.'
    ],
    parityTargets: ['Ship packages/design-system/src/wakilisha.tokens.css and import it app-wide.']
  },
  {
    id: 'component-inventory',
    number: '30',
    group: 'Implementation',
    title: 'Component Inventory',
    purpose: 'Define the components that all pages must use rather than rebuilding local variants.',
    implementationRules: [
      'Components must expose data-driven props and states.',
      'Avoid duplicate Card/Button/Row/Hero components per page.',
      'Every component needs responsive and empty-state behavior.'
    ],
    parityTargets: ['Create component backlog from chapters 10–54.']
  },
  {
    id: 'figma-organization',
    number: '31',
    group: 'Implementation',
    title: 'Figma Organization',
    purpose: 'Keep design work organized around foundations, components, archetypes, and shipped pages.',
    implementationRules: [
      'Figma frames should mirror component inventory and page archetypes.',
      'Specimen pages should map back to token/component names.',
      'No orphaned one-off design frames without implementation status.'
    ],
    parityTargets: ['Use the admin design bible as the in-app counterpart to Figma.']
  },
  {
    id: 'qa-checklist',
    number: '32',
    group: 'Implementation',
    title: 'QA Checklist',
    purpose: 'Create the pass/fail system for design, accessibility, responsiveness, and data wiring.',
    implementationRules: [
      'Every page must pass data, design, mobile, accessibility, copy, and performance checks.',
      'Screenshots are required before declaring parity.',
      'Mock data automatically fails production QA.'
    ],
    parityTargets: ['Add page QA matrices to parity plan.']
  },
  {
    id: 'anti-slop-rules',
    number: '33',
    group: 'Implementation',
    title: 'Anti-Slop Rules',
    purpose: 'Prevent AI-template design drift and generic React-app behavior.',
    implementationRules: [
      'No fake data on public pages.',
      'No generic SaaS gradients, bouncy cards, emoji microcopy, or meaningless CTAs.',
      'No hard-coded content that should come from the repaired graph.',
      'No page ships without matching a design-system archetype.'
    ],
    parityTargets: ['Add an anti-slop review gate to every Readdy/dev handoff.']
  },
  {
    id: 'roadmap',
    number: '34',
    group: 'Implementation',
    title: 'Roadmap',
    purpose: 'Sequence design-system adoption from tokens to components to page parity.',
    implementationRules: [
      'Foundation first, then admin bible, then payloads, then public archetypes.',
      'Do not redesign all pages independently.',
      'Design parity is not visual imitation; it is system compliance plus product behavior parity.'
    ],
    parityTargets: ['Use this roadmap to gate the React rebuild.']
  },
  {
    id: 'hero-sections',
    number: '35',
    group: 'React App UI',
    title: 'Hero Sections',
    purpose: 'Define page heroes for magazine, charts, directories, artists, tracks, releases, and admin pages.',
    implementationRules: [
      'Hero scale must match content importance; directory heroes are not as large as editorial heroes.',
      'Use scrims for photography and preserve text contrast.',
      'Hero actions must be specific and graph-backed.'
    ],
    parityTargets: ['Build PageHero, MagazineHero, ChartHero, EntityHero, AdminHero.']
  },
  {
    id: 'genre-directory',
    number: '36',
    group: 'React App UI',
    title: 'Genre Directory',
    purpose: 'Make genres a discovery surface with artist/track counts and visual cards.',
    implementationRules: [
      'Genre cards must show name, counts, representative artists/tracks where available.',
      'Do not use unrelated stock images as permanent genre art.',
      'Genre pages should route into graph-backed artist/track lists.'
    ],
    parityTargets: ['Build /genres and /genres/:slug from artist_genres and entity relationships.']
  },
  {
    id: 'artist-directory',
    number: '37',
    group: 'React App UI',
    title: 'Artist Directory',
    purpose: 'Make artists feel culturally important, not like database rows.',
    implementationRules: [
      'Artist cards need image, name, genres, track/release counts, and chart context where available.',
      'Directory supports grid/list, search, filters, and alphabetic index.',
      'Full artist index can exist, but not as the main emotional experience.'
    ],
    parityTargets: ['Build /artists and /artists/:slug from entity_slugs + track_artists.']
  },
  {
    id: 'magazine-page',
    number: '38',
    group: 'React App UI',
    title: 'Magazine Page',
    purpose: 'Create an authored editorial surface, not a generic blog grid.',
    implementationRules: [
      'Magazine needs feature story, sections, story cards, editorial metadata, and related graph embeds.',
      'Use content classification to exclude app shells and utility pages.',
      'Article cards need section/category, date, reading time when available, and real routes.'
    ],
    parityTargets: ['Build /magazine and /magazine/:slug from content classification.']
  },
  {
    id: 'charts-edition',
    number: '39',
    group: 'React App UI',
    title: 'Charts Edition',
    purpose: 'Make chart editions the signature product surface.',
    implementationRules: [
      'Chart rows must be dense, ranked, expandable, playable when possible, and linked to canonical entities.',
      'Chart headers show edition metadata, methodology/status, and stats.',
      'Movement/history UI must not be fabricated if data is unavailable.'
    ],
    parityTargets: ['Build /charts, /charts/:series, /charts/:series/:edition.']
  },
  {
    id: 'single-track',
    number: '40',
    group: 'React App UI',
    title: 'Single Track',
    purpose: 'Create graph-powered track detail pages with playback, chart history, release links, and credits.',
    implementationRules: [
      'Track page pulls artists, playback sources, release relationships, media, chart appearances, and route metadata.',
      'Play button only appears enabled when preview/playback is available.',
      'ISRC/source/provider attribution must be visible when available.'
    ],
    parityTargets: ['Build /tracks/:slug payload and page.']
  },
  {
    id: 'single-album',
    number: '41',
    group: 'React App UI',
    title: 'Single Album',
    purpose: 'Create release pages with cover, metadata, tracklist, label, artists, and related graph modules.',
    implementationRules: [
      'Release tracklist must come from release_tracks.',
      'Use modal and page patterns consistently for album detail.',
      'Do not flatten duplicate/review release states into public certainty.'
    ],
    parityTargets: ['Build /releases/:slug payload and page.']
  },
  {
    id: 'album-modal',
    number: '42',
    group: 'React App UI',
    title: 'Album Modal',
    purpose: 'Support quick release preview without leaving context.',
    implementationRules: [
      'Modal must trap focus and respect reduced motion.',
      'Shows cover, metadata, tracklist preview, actions, share, and source attribution.',
      'Never duplicate a separate design language from the release page.'
    ],
    parityTargets: ['Build ReleaseQuickView modal.']
  },
  {
    id: 'labels-directory',
    number: '43',
    group: 'React App UI',
    title: 'Labels Directory',
    purpose: 'Make labels a serious industry registry, not a plain list.',
    implementationRules: [
      'Label cards show releases, artists, country/metadata, and featured status if available.',
      'Label pages expose releases, artists, and chart activity.',
      'Use repaired label/release relationships.'
    ],
    parityTargets: ['Build /labels and /labels/:slug.']
  },
  {
    id: 'article-post',
    number: '44',
    group: 'React App UI',
    title: 'Article / Post',
    purpose: 'Create article pages with reading rhythm, related entities, and credibility markers.',
    implementationRules: [
      'Article body width must use --wk-w-text.',
      'Hero and byline placement must support editorial credibility.',
      'Related tracks/artists/articles should come from graph/content metadata when available.'
    ],
    parityTargets: ['Build article page archetype and embedded entity cards.']
  },
  {
    id: 'sharing-system',
    number: '45',
    group: 'React App UI',
    title: 'Sharing System',
    purpose: 'Create consistent share sheets, timestamp sharing, OG previews, and platform actions.',
    implementationRules: [
      'Share previews must reflect the actual entity/article being shared.',
      'Use specific share copy, not generic link labels.',
      'Timestamp sharing is available for playable media.'
    ],
    parityTargets: ['Build ShareSheet, CopyLink, OGCardPreview.']
  },
  {
    id: 'iconography',
    number: '46',
    group: 'React App UI',
    title: 'Iconography',
    purpose: 'Standardize icon size, weight, labels, and semantic use.',
    implementationRules: [
      'Icons are supportive, not decorative clutter.',
      'Icon-only buttons need labels and 44px hit areas where touchable.',
      'Use consistent 16/20/24px icon sizing.'
    ],
    parityTargets: ['Create icon wrapper and accessibility defaults.']
  },
  {
    id: 'dark-light-mode',
    number: '47',
    group: 'React App UI',
    title: 'Dark / Light Mode',
    purpose: 'Keep both themes first-class using tokens.',
    implementationRules: [
      'No dark-only hardcoded text or backgrounds.',
      'Logo variant, surface colors, brand color, and status colors must switch via tokens.',
      'Images need overlays that preserve readability in both themes.'
    ],
    parityTargets: ['Theme provider with data-wk-theme and mode toggle.']
  },
  {
    id: 'user-profile',
    number: '48',
    group: 'React App UI',
    title: 'User Profile',
    purpose: 'Prepare user identity, follows, saves, collections, and listening/editorial activity.',
    implementationRules: [
      'Profile surfaces use cover, avatar, stats, tabs, and activity modules.',
      'Do not overbuild social network behavior until product requires it.',
      'Privacy and public/private states must be explicit.'
    ],
    parityTargets: ['Build profile shell after public entity parity.']
  },
  {
    id: 'settings-pages',
    number: '49',
    group: 'React App UI',
    title: 'Settings Pages',
    purpose: 'Create clean settings surfaces for account, notifications, theme, privacy, and playback preferences.',
    implementationRules: [
      'Settings use sidebar/pane structure on desktop and stacked nav on mobile.',
      'Danger zones are visually distinct but restrained.',
      'Every toggle has label and description.'
    ],
    parityTargets: ['Build settings archetype after auth/user scope is defined.']
  },
  {
    id: 'admin-areas',
    number: '50',
    group: 'React App UI',
    title: 'Admin Areas',
    purpose: 'Make admin feel like an editorial/cultural operating system, not a backend afterthought.',
    implementationRules: [
      'Admin has its own breadcrumb bar, KPI cards, review tables, and design-system browser.',
      'Design System Bible must be browsable, searchable, theme-toggleable, and component-previewable inside admin.',
      'Admin pages use the same tokens as public pages.'
    ],
    parityTargets: ['Build /admin/design-system as first admin feature.']
  },
  {
    id: 'notifications',
    number: '51',
    group: 'React App UI',
    title: 'Notifications',
    purpose: 'Standardize notification panels and review/update alerts.',
    implementationRules: [
      'Unread indicators use brand edge bar or dot, not loud banners.',
      'Notification copy is factual and specific.',
      'Admin review alerts should link to exact review items.'
    ],
    parityTargets: ['Build NotificationPanel and AdminReviewNotifications.']
  },
  {
    id: 'modals-overlays',
    number: '52',
    group: 'React App UI',
    title: 'Modals & Overlays',
    purpose: 'Define sheets, modals, drawers, backdrops, and focus behavior.',
    implementationRules: [
      'Modals trap focus, restore focus, and support Escape close.',
      'Use sheets for mobile contextual actions and modals for desktop focus tasks.',
      'Overlay motion must originate from trigger or dock.'
    ],
    parityTargets: ['Build Modal, Sheet, Drawer, Overlay primitives.']
  },
  {
    id: 'mobile-patterns',
    number: '53',
    group: 'React App UI',
    title: 'Mobile Patterns',
    purpose: 'Design mobile intentionally, not as collapsed desktop.',
    implementationRules: [
      'Use horizontal scroll rows sparingly for discovery, not primary navigation.',
      'Mobile bottom nav must coexist with player dock.',
      'Cards and rows need mobile-specific hierarchy, not just smaller desktop.'
    ],
    parityTargets: ['Build mobile page variants for charts, directories, player, and magazine.']
  },
  {
    id: 'delight-animation',
    number: '54',
    group: 'React App UI',
    title: 'Delight & Animation',
    purpose: 'Add restrained delight through playback waveforms, tactile transitions, and meaningful reveal moments.',
    implementationRules: [
      'Delight never blocks comprehension or adds idle noise.',
      'Use equalizer bars only when audio is active.',
      'Use shimmer skeletons and slide-up/scale-in sparingly for loading and overlay entry.'
    ],
    parityTargets: ['Build animation utilities with reduced-motion support.']
  }
];

export const wakilishaParityPageMap = [
  { route: '/', archetype: 'Home / cultural graph overview', chapters: ['01','04','05','06','13','16','19','21','22','35','38'] },
  { route: '/charts', archetype: 'Charts index', chapters: ['21','35','39','15','16'] },
  { route: '/charts/:series/:edition', archetype: 'Charts edition', chapters: ['21','39','15','16','45'] },
  { route: '/artists', archetype: 'Artist directory', chapters: ['17','22','35','37','53'] },
  { route: '/artists/:slug', archetype: 'Artist entity page', chapters: ['22','35','37','40','41','45'] },
  { route: '/tracks/:artistSlug/:trackSlug', archetype: 'Single track', chapters: ['16','21','22','35','40','45'] },
  { route: '/releases', archetype: 'Release catalog', chapters: ['17','22','35','41','42'] },
  { route: '/releases/:artistSlug/:releaseSlug', archetype: 'Single release', chapters: ['22','35','41','42','45'] },
  { route: '/genres', archetype: 'Genre directory', chapters: ['17','22','35','36'] },
  { route: '/genres/:slug', archetype: 'Genre page', chapters: ['22','35','36','37','40'] },
  { route: '/labels', archetype: 'Labels directory', chapters: ['17','22','35','43'] },
  { route: '/labels/:slug', archetype: 'Label page', chapters: ['22','35','41','43'] },
  { route: '/magazine', archetype: 'Magazine index', chapters: ['20','35','38','44'] },
  { route: '/magazine/:slug', archetype: 'Article page', chapters: ['20','35','44','45'] },
  { route: '/admin/design-system', archetype: 'Living design bible', chapters: ['29','30','32','33','50'] }
];