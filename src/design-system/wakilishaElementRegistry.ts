export type WakilishaElementGroup =
  | 'Foundations'
  | 'Product'
  | 'Media & Editorial'
  | 'Reach'
  | 'Implementation'
  | 'React App UI'
  | 'Mobile-First Experience'
  | 'Mobile High-Fidelity Screens';

export type WakilishaElement = {
  chapter: string;
  title: string;
  group: WakilishaElementGroup;
  purpose: string;
  primaryClasses: string[];
  productRoutes?: string[];
  implementationNotes: string[];
};

export const wakilishaElementRegistry: WakilishaElement[] = [
  {
    chapter: '03',
    title: 'Logo',
    group: 'Foundations',
    purpose: 'Theme-aware wordmark, bolt mark, clear-space, sizing and placement contexts.',
    primaryClasses: ['logo-spec', 'logo-spec-inner', 'logo-spec-meta'],
    productRoutes: ['global nav', 'footer', 'auth', 'marketing', 'admin'],
    implementationNotes: [
      'Use the inline SVG wordmark or a shared Logo component; never recreate WAKILISHA in a system font except as a temporary fallback.',
      'Dark mode uses white letters plus green bolt; light mode uses black letters plus green bolt.',
      'Photography placements require a scrim behind the logo.'
    ]
  },
  {
    chapter: '04',
    title: 'Color',
    group: 'Foundations',
    purpose: 'Dark/light surface system, text hierarchy, status colors and vertical accents.',
    primaryClasses: ['swatch-row', 'swatch-block', 'swatch-token', 'swatch-hex', 'swatch-use'],
    productRoutes: ['all routes'],
    implementationNotes: [
      'Use CSS variables only; do not introduce random hex values in product components.',
      'Green is the only primary brand color; vertical accents stay secondary.'
    ]
  },
  {
    chapter: '05',
    title: 'Typography',
    group: 'Foundations',
    purpose: 'Inter display/UI, DM Sans body and DM Mono metadata/code.',
    primaryClasses: ['type-row', 'type-meta', 'type-sample', 'wk-h-hero', 'wk-h-page', 'wk-h-section', 'wk-copy'],
    productRoutes: ['all routes'],
    implementationNotes: ['Use Inter for structure and impact; use DM Sans for readable editorial body copy.']
  },
  {
    chapter: '06',
    title: 'Spacing & Layout',
    group: 'Foundations',
    purpose: '4-based spacing, radius scale and content width grammar.',
    primaryClasses: ['wk-container', 'wk-container-wide', 'wk-container-max', 'pg-layout', 'pg-block'],
    productRoutes: ['all routes'],
    implementationNotes: ['Do not invent one-off layout widths; use tokenized container widths.']
  },
  {
    chapter: '07',
    title: 'Motion',
    group: 'Foundations',
    purpose: 'Durations, easing, float, pulse, shimmer, slide-up, scale-in and equalizer motion.',
    primaryClasses: ['anim-float', 'anim-pulse-brand', 'anim-scale-in', 'anim-slide-up', 'shimmer', 'loading-skeleton', 'eq-bars', 'eq-bar'],
    productRoutes: ['all interactive routes'],
    implementationNotes: ['Animation must be purposeful and must respect reduced-motion preferences from the base token file.']
  },
  {
    chapter: '11',
    title: 'Buttons & Actions',
    group: 'Product',
    purpose: 'Primary, ghost, soft, danger and size variants for actions.',
    primaryClasses: ['btn', 'btn-sm', 'btn-md', 'btn-lg', 'btn-primary', 'btn-ghost', 'btn-soft', 'btn-danger'],
    productRoutes: ['all routes'],
    implementationNotes: ['CTA copy must be specific; no generic engagement-bait language.']
  },
  {
    chapter: '14',
    title: 'Tags & Badges',
    group: 'Product',
    purpose: 'Metadata tags, status tags and movement indicators.',
    primaryClasses: ['tag', 'tag-brand', 'tag-success', 'tag-warn', 'tag-up', 'tag-dn'],
    productRoutes: ['/charts', '/artists', '/genres', '/labels', '/magazine', '/admin'],
    implementationNotes: ['Use tags for scannable metadata, not decorative stickers.']
  },
  {
    chapter: '15',
    title: 'Track & Entity Rows',
    group: 'Product',
    purpose: 'Dense, information-rich rows for tracks, entities and ranked lists.',
    primaryClasses: ['trow', 'trow-pos', 'trow-art', 'trow-meta', 'trow-title', 'trow-artist', 'trow-delta', 'trow-meta-cell'],
    productRoutes: ['/charts', '/artists/:slug', '/tracks/:slug', '/releases/:slug'],
    implementationNotes: ['Rows should carry artwork, title, artist/entity, movement/metadata and a clear action affordance.']
  },
  {
    chapter: '16',
    title: 'Player System',
    group: 'Product',
    purpose: 'Dock player, nav capsule, expanded sheet and theater-mode player.',
    primaryClasses: ['player-stage', 'dock', 'dock-left', 'dock-art', 'dock-meta', 'dock-controls', 'dock-progress', 'nav-cap', 'sheet', 'theater'],
    productRoutes: ['global player', '/tracks/:slug', '/charts/:series/:edition', '/artists/:slug'],
    implementationNotes: [
      'Default player is compact; expanded sheet and theater are earned states.',
      'Always show provenance/source context for media where available.'
    ]
  },
  {
    chapter: '18',
    title: 'States',
    group: 'Product',
    purpose: 'Empty, loading, error and skeleton states.',
    primaryClasses: ['loading-skeleton', 'shimmer', 'wk-callout', 'cal', 'cal.warn', 'cal.bad', 'cal.info'],
    productRoutes: ['all data routes'],
    implementationNotes: ['Do not show fake data to avoid empty states; explain what is missing and what can happen next.']
  },
  {
    chapter: '20',
    title: 'Editorial Articles',
    group: 'Media & Editorial',
    purpose: 'Article hero, header, byline, pullquotes, embeds, body copy and captions.',
    primaryClasses: ['article-hero', 'article-hero-content', 'article-header', 'article-kicker', 'article-hed', 'article-dek', 'article-byline', 'article-body', 'article-p', 'article-pullquote', 'article-embed', 'article-img'],
    productRoutes: ['/magazine/:slug'],
    implementationNotes: ['Keep reading width narrow; editorial metadata must remain visible.']
  },
  {
    chapter: '21',
    title: 'Charts & Rankings',
    group: 'Media & Editorial',
    purpose: 'Edition header, chart rows, movement deltas, weeks and history visuals.',
    primaryClasses: ['chart-header', 'chart-header-body', 'chart-ed-badge', 'chart-ed-title', 'chart-ed-meta', 'chart-row', 'chart-rank', 'chart-art', 'chart-title', 'chart-artist', 'chart-delta', 'chart-btn'],
    productRoutes: ['/charts', '/charts/:series/:edition'],
    implementationNotes: ['Do not fabricate movement/history when data is unavailable.']
  },
  {
    chapter: '29',
    title: 'Tokens Map',
    group: 'Implementation',
    purpose: 'CSS variable bridge from design bible to React/Admin/Public UI.',
    primaryClasses: ['wk-panel', 'wk-button', 'wk-tag', 'wk-h-hero', 'wk-h-page', 'wk-h-section', 'wk-copy'],
    productRoutes: ['all routes'],
    implementationNotes: ['The token CSS remains the canonical bridge; element CSS sits on top of tokens.']
  },
  {
    chapter: '35',
    title: 'Hero Sections',
    group: 'React App UI',
    purpose: 'Page heroes for home, magazine, charts, artists, tracks, releases and admin.',
    primaryClasses: ['pg-hero', 'pg-hero-bg', 'pg-hero-inner', 'pg-hero-eyebrow', 'pg-hero-title', 'pg-hero-sub', 'pg-hero-actions', 'pg-hero-stat-row'],
    productRoutes: ['/', '/charts', '/artists', '/genres', '/labels', '/magazine'],
    implementationNotes: ['Hero scale must match content importance. Directory heroes are smaller than editorial moments.']
  },
  {
    chapter: '36',
    title: 'Genre Directory',
    group: 'React App UI',
    purpose: 'Genre cards and grid discovery surface.',
    primaryClasses: ['genre-grid', 'genre-card', 'genre-card-bg', 'genre-card-overlay', 'genre-card-body', 'genre-card-name', 'genre-card-count', 'genre-card-icon'],
    productRoutes: ['/genres', '/genres/:slug'],
    implementationNotes: ['Permanent genre art must come from real cultural/artwork sources, not unrelated stock imagery.']
  },
  {
    chapter: '37',
    title: 'Artist Directory',
    group: 'React App UI',
    purpose: 'Artist cards, artist list rows, verification and stats.',
    primaryClasses: ['artist-grid', 'artist-card', 'artist-card-img', 'artist-card-body', 'artist-card-name', 'artist-card-meta', 'artist-card-tags', 'artist-card-verify', 'artist-list-item', 'artist-list-ava'],
    productRoutes: ['/artists', '/artists/:slug'],
    implementationNotes: ['Artists should feel like cultural figures, not database rows.']
  },
  {
    chapter: '38',
    title: 'Magazine Page',
    group: 'React App UI',
    purpose: 'Magazine hero, story grid, featured cards, pullquotes and editorial composition.',
    primaryClasses: ['mag-hero', 'mag-hero-img', 'mag-hero-content', 'mag-hero-kicker', 'mag-hero-hed', 'mag-hero-dek', 'mag-grid', 'mag-story', 'mag-story-img', 'mag-story-body', 'mag-story-kicker', 'mag-story-hed'],
    productRoutes: ['/magazine'],
    implementationNotes: ['Magazine layouts should feel editorial, not like generic blog cards.']
  },
  {
    chapter: '39',
    title: 'Charts Edition',
    group: 'React App UI',
    purpose: 'Charts edition header and dense ranked list pattern.',
    primaryClasses: ['chart-header', 'chart-ed-badge', 'chart-ed-title', 'chart-row', 'chart-rank', 'chart-art', 'chart-delta'],
    productRoutes: ['/charts/:series/:edition'],
    implementationNotes: ['Chart rows must link to canonical track and artist pages.']
  },
  {
    chapter: '40',
    title: 'Single Track',
    group: 'React App UI',
    purpose: 'Track hero, artwork, metadata, actions and waveform.',
    primaryClasses: ['track-hero', 'track-hero-layout', 'track-hero-art', 'track-hero-eyebrow', 'track-hero-title', 'track-hero-artist', 'track-meta-grid', 'track-meta-item', 'track-waveform', 'track-waveform-bar'],
    productRoutes: ['/tracks/:slug'],
    implementationNotes: ['Single tracks should expose attribution, source, chart context and playback.']
  },
  {
    chapter: '41',
    title: 'Single Album',
    group: 'React App UI',
    purpose: 'Album hero, cover interaction and tracklist.',
    primaryClasses: ['album-hero', 'album-hero-layout', 'album-cover', 'album-cover-overlay', 'album-play-btn', 'album-type', 'album-title', 'album-artist', 'album-tracklist', 'album-trow'],
    productRoutes: ['/releases/:slug'],
    implementationNotes: ['Do not flatten an album into generic cards; tracklist is part of the release object.']
  },
  {
    chapter: '42',
    title: 'Album Modal',
    group: 'React App UI',
    purpose: 'Focused album preview overlay with metadata and tracklist.',
    primaryClasses: ['modal-backdrop', 'modal-inner', 'modal-header', 'modal-close', 'modal-album-layout', 'modal-cover', 'modal-album-title', 'modal-info-grid', 'modal-trow'],
    productRoutes: ['modal overlays', '/releases', '/artists/:slug'],
    implementationNotes: ['Trap focus and keep overlay language consistent with the page context.']
  },
  {
    chapter: '43',
    title: 'Labels Directory',
    group: 'React App UI',
    purpose: 'Label grid, label logo blocks, artist avatar stack and featured label tags.',
    primaryClasses: ['label-grid', 'label-card', 'label-logo', 'label-name', 'label-country', 'label-artists-row', 'label-ava', 'label-stat', 'label-feat-tag'],
    productRoutes: ['/labels', '/labels/:slug'],
    implementationNotes: ['Labels must expose serious registry relationships, not just a count.']
  },
  {
    chapter: '44',
    title: 'Article / Post',
    group: 'React App UI',
    purpose: 'Article page pattern for WAKILISHA magazine and guides.',
    primaryClasses: ['article-hero', 'article-header', 'article-kicker-pill', 'article-hed', 'article-dek', 'article-byline', 'article-body', 'article-p', 'article-pullquote', 'article-img'],
    productRoutes: ['/magazine/:slug'],
    implementationNotes: ['Preserve article credibility: byline, read time, related graph and source/attribution.']
  },
  {
    chapter: '45',
    title: 'Sharing System',
    group: 'React App UI',
    purpose: 'Share sheet, preview card, destinations, link row, timestamp and OG card.',
    primaryClasses: ['share-sheet', 'share-handle', 'share-title', 'share-sub', 'share-preview', 'share-destinations', 'share-dest', 'share-link-row', 'share-og-card'],
    productRoutes: ['all shareable routes'],
    implementationNotes: ['Share copy must be specific to the entity and should support timestamp when playback context exists.']
  },
  {
    chapter: '48',
    title: 'User Profile',
    group: 'React App UI',
    purpose: 'Profile cover, avatar, bio, stats and tabs.',
    primaryClasses: ['profile-hero', 'profile-cover', 'profile-ava-wrap', 'profile-ava', 'profile-name', 'profile-handle', 'profile-body', 'profile-bio', 'profile-stats', 'profile-tabs'],
    productRoutes: ['/profile', '/users/:slug'],
    implementationNotes: ['Profiles should feel editorial but still account-oriented.']
  },
  {
    chapter: '49',
    title: 'Settings Pages',
    group: 'React App UI',
    purpose: 'Settings side nav, panes, rows, toggles, selects and danger zones.',
    primaryClasses: ['settings-layout', 'settings-nav', 'settings-nav-item', 'settings-nav-icon', 'settings-pane', 'settings-row', 'settings-toggle', 'settings-select'],
    productRoutes: ['/settings'],
    implementationNotes: ['Keep settings calm and legible; no marketing chrome.']
  },
  {
    chapter: '50',
    title: 'Admin Areas',
    group: 'React App UI',
    purpose: 'Admin bar, KPI cards, admin table and status pills.',
    primaryClasses: ['admin-bar', 'admin-kpi-grid', 'admin-kpi', 'admin-kpi-val', 'admin-table', 'admin-status'],
    productRoutes: ['/admin', '/admin/design-system'],
    implementationNotes: ['Admin areas should use the same tokens as the public product, not a separate backend aesthetic.']
  },
  {
    chapter: '51',
    title: 'Notifications',
    group: 'React App UI',
    purpose: 'Notification panel, unread rail, icon, text, time and mark-all affordance.',
    primaryClasses: ['notif-panel', 'notif-panel-header', 'notif-panel-title', 'notif-mark-all', 'notif-item', 'notif-icon', 'notif-text', 'notif-time'],
    productRoutes: ['global nav', '/admin'],
    implementationNotes: ['Notifications should be content-aware, not generic app noise.']
  },
  {
    chapter: '53',
    title: 'Mobile Patterns',
    group: 'React App UI',
    purpose: 'Mobile frame, status, bottom nav, scroll rows and small cards.',
    primaryClasses: ['mobile-frame', 'mobile-status', 'mobile-bottom-nav', 'mobile-nav-item', 'mobile-content', 'mobile-scroll-row', 'mobile-card-sm'],
    productRoutes: ['all responsive routes'],
    implementationNotes: ['Mobile is not collapsed desktop; design for thumb zones and bottom actions.']
  },
  {
    chapter: '55',
    title: 'Mobile Philosophy & Manifesto',
    group: 'Mobile-First Experience',
    purpose: 'Mobile-first decision rules and device-first product expression.',
    primaryClasses: ['mob-device', 'mob-screen', 'mob-safe-bottom', 'feature-chip', 'desktop-vs-mobile'],
    productRoutes: ['all mobile routes'],
    implementationNotes: ['Mobile should create its own product moment, not simply fit desktop into a narrow viewport.']
  },
  {
    chapter: '56',
    title: 'Thumb Zone & Touch Architecture',
    group: 'Mobile-First Experience',
    purpose: 'Thumb zones, touch targets and reachability maps.',
    primaryClasses: ['thumb-canvas', 'thumb-zone', 'thumb-zone-easy', 'thumb-zone-ok', 'thumb-zone-hard', 'touch-grid', 'touch-cell'],
    productRoutes: ['mobile QA'],
    implementationNotes: ['Primary actions should live in the easy thumb zone; touch targets should clear 44px.']
  },
  {
    chapter: '57',
    title: 'Mobile Navigation Systems',
    group: 'Mobile-First Experience',
    purpose: 'Mobile nav bars, active states and bottom-tab hierarchy.',
    primaryClasses: ['mob-nav-specimen', 'mob-nav-bar', 'mob-nav-tab', 'mob-nav-pip', 'mobile-bottom-nav', 'mobile-nav-item'],
    productRoutes: ['mobile nav'],
    implementationNotes: ['Bottom nav is a primary mobile structure, not a hidden fallback.']
  },
  {
    chapter: '58',
    title: 'Mobile Player — Full Experience',
    group: 'Mobile-First Experience',
    purpose: 'Full mobile player, scrubber, controls and lyrics strip.',
    primaryClasses: ['player-full', 'player-full-art', 'player-full-body', 'player-scrubber', 'player-controls-row', 'player-play-btn', 'player-lyrics-strip', 'lyric-line'],
    productRoutes: ['mobile player', '/tracks/:slug'],
    implementationNotes: ['The full player is a premium mobile moment with lyrics and ambient context.']
  },
  {
    chapter: '65',
    title: 'Auth & Onboarding',
    group: 'Mobile High-Fidelity Screens',
    purpose: 'High-fidelity auth screen with brand zone and CTA stack.',
    primaryClasses: ['phone', 'auth-screen', 'auth-logo-zone', 'auth-tagline', 'auth-buttons', 'auth-btn', 'auth-btn-primary', 'auth-btn-secondary'],
    productRoutes: ['/auth'],
    implementationNotes: ['Use the dark cinematic auth surface; avoid generic SaaS onboarding cards.']
  },
  {
    chapter: '66',
    title: 'Home & Feed',
    group: 'Mobile High-Fidelity Screens',
    purpose: 'Mobile home greeting, editorial shelves and compact cards.',
    primaryClasses: ['home-greeting', 'home-greeting-time', 'home-greeting-msg', 'home-section', 'home-shelf', 'hcard'],
    productRoutes: ['/'],
    implementationNotes: ['Home should feel curated, not like an endless generic feed.']
  },
  {
    chapter: '67',
    title: 'Charts Page',
    group: 'Mobile High-Fidelity Screens',
    purpose: 'Mobile chart header, filters, top hero cards and compact chart rows.',
    primaryClasses: ['charts-hdr', 'charts-ed-badge', 'charts-title', 'charts-filter-row', 'charts-filter', 'chart-hero-cards', 'chart-hero-card', 'chart-row-list'],
    productRoutes: ['/charts'],
    implementationNotes: ['Mobile charts need emotional top entries and dense list scanning below.']
  },
  {
    chapter: '69',
    title: 'Artist Directory',
    group: 'Mobile High-Fidelity Screens',
    purpose: 'Two-column mobile artist cards with image-first hierarchy.',
    primaryClasses: ['artist-grid-2col', 'acard', 'acard-overlay', 'acard-name', 'acard-meta', 'acard-badge'],
    productRoutes: ['/artists'],
    implementationNotes: ['Artist images are not optional on mobile if the registry has public profile images.']
  },
  {
    chapter: '70',
    title: 'Single Artist Page',
    group: 'Mobile High-Fidelity Screens',
    purpose: 'Mobile artist hero, actions, tabs and track rows.',
    primaryClasses: ['artist-page-hero', 'artist-hero-overlay', 'artist-hero-bottom', 'artist-hero-name', 'artist-actions-row', 'artist-tab-strip', 'artist-tab', 'atrow'],
    productRoutes: ['/artists/:slug'],
    implementationNotes: ['The single artist page must expose tracks, releases and chart appearances.']
  },
  {
    chapter: '73',
    title: 'Full Player',
    group: 'Mobile High-Fidelity Screens',
    purpose: 'High-fidelity full player with ambient art, scrubber, controls and lyrics.',
    primaryClasses: ['full-player', 'fp-art-zone', 'fp-ambient', 'fp-topbar', 'fp-controls', 'fp-track-name', 'fp-track-artist', 'fp-scrub', 'fp-play-btn', 'fp-lyrics'],
    productRoutes: ['mobile player', '/tracks/:slug'],
    implementationNotes: ['Full player should feel like a flagship product surface.']
  },
  {
    chapter: '75',
    title: 'Search & Discovery',
    group: 'Mobile High-Fidelity Screens',
    purpose: 'Mobile search input, sections and hot chips.',
    primaryClasses: ['search-bar-zone', 'search-input', 'search-input-icon', 'search-input-text', 'search-sections', 'search-section-label', 'search-chip-row', 'search-chip'],
    productRoutes: ['/search'],
    implementationNotes: ['Search must distinguish typed query, hot discovery chips and registry-backed results.']
  }
];

export const wakilishaElementRegistryByChapter = Object.fromEntries(
  wakilishaElementRegistry.map((item) => [item.chapter, item])
) as Record<string, WakilishaElement>;

export const wakilishaElementRoutes = wakilishaElementRegistry.reduce<Record<string, WakilishaElement[]>>((acc, item) => {
  for (const route of item.productRoutes ?? []) {
    acc[route] = acc[route] || [];
    acc[route].push(item);
  }
  return acc;
}, {});

export const wakilishaElementGroups = wakilishaElementRegistry.reduce<Record<WakilishaElementGroup, WakilishaElement[]>>((acc, item) => {
  acc[item.group] = acc[item.group] || [];
  acc[item.group].push(item);
  return acc;
}, {} as Record<WakilishaElementGroup, WakilishaElement[]>);
