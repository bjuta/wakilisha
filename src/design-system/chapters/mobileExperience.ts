import type { WkDesignChapterSpec } from '../designSystemSpecTypes';

const mobileFirst: WkDesignChapterSpec[] = [
  ['55','mobile-philosophy','Mobile Philosophy & Manifesto','Mobile is a first-class product expression for WAKILISHA, not a collapsed desktop viewport. The interface should feel touch-native, cinematic, music-aware and editorially serious.','mob-device, mob-screen, feature-chip, desktop-vs-mobile'],
  ['56','thumb-zone-touch-architecture','Thumb Zone & Touch Architecture','Mobile layouts must respect reachability, touch size and thumb-zone priority. Primary actions live low, secondary context lives high.','thumb-canvas, thumb-zone, touch-grid, touch-cell'],
  ['57','mobile-navigation-systems','Mobile Navigation Systems','Bottom navigation, tab states, mini-player coexistence and active states define the mobile shell.','mob-nav-specimen, mob-nav-bar, mob-nav-tab, mobile-bottom-nav, mobile-nav-item'],
  ['58','mobile-player-full-experience','Mobile Player — Full Experience','The full mobile player is a flagship listening surface with artwork, ambient color, scrubber, controls and lyrics.','player-full, player-full-art, player-scrubber, player-controls-row, player-play-btn, player-lyrics-strip'],
  ['59','mobile-typography-reading','Mobile Typography & Reading','Mobile typography must keep editorial reading comfortable while preserving WAKILISHA display impact.','mob-type-specimen, mob-type-row, mob-type-meta'],
  ['60','mobile-cards-surfaces','Mobile Cards & Surfaces','Mobile cards use strong imagery, short metadata and horizontally scrollable shelves where useful.','mob-card-vert, mob-card-horiz, mobile-card-sm'],
  ['61','gestures-haptics','Gestures & Haptics','Gestures should map to obvious media behavior and use light haptic language only for meaningful state changes.','gesture-grid, gesture-card, haptic-row, haptic-dot'],
  ['62','mobile-exclusive-features','Mobile-Exclusive Features','Mobile can have features that desktop does not need: ambient color, swipe trails, tactile lyrics and thumb-first actions.','feature-chip-grid, feature-chip, mob-ambient, swipe-trail'],
  ['63','mobile-page-transforms','Mobile Page Transforms','Desktop pages transform intentionally on mobile instead of collapsing mechanically.','desktop-vs-mobile, dvm-col, dvm-item'],
  ['64','desktop-transition-wtf-moment','Desktop Transition & The WTF Moment','The best mobile screens should make desktop feel less immediate, while desktop retains depth and density.','wtf-grid, wtf-panel, wtf-panel-body'],
].map(([number,id,title,summary,classes]) => ({
  id,
  number,
  group: 'Mobile-First Experience' as const,
  title,
  summary,
  adminSections: ['Mobile specimen preview', 'Touch QA', 'Responsive transform audit'],
  implementationRules: [
    'Mobile is not a collapsed desktop screen.',
    'Primary actions must be reachable and touch-safe.',
    'Use the ported class system from wakilisha.elements.mobile.css and wakilisha.elements.motion.css.',
    'Use real artwork/entity imagery where available instead of placeholder shapes.',
  ],
  componentsRequired: classes.split(', ').map((c) => `.${c}`),
  tables: [],
  parityTargets: [`Render a live specimen using ${classes}.`, 'Map the specimen to at least one product route or mobile QA route.'],
  qaChecks: [
    { id: `${number}-mobile-native`, label: 'Mobile-native', description: 'The pattern feels designed for touch, not collapsed from desktop.' },
    { id: `${number}-touch-safe`, label: 'Touch safe', description: 'Primary controls are reachable and clear touch target sizing.' },
    { id: `${number}-real-content`, label: 'Real content', description: 'The specimen uses real entity/media imagery where the product has it.' },
  ],
}));

const mobileScreens: WkDesignChapterSpec[] = [
  ['65','auth-onboarding','Auth & Onboarding','High-fidelity auth and onboarding screens with a cinematic brand zone and focused CTA stack.','phone, auth-screen, auth-logo-zone, auth-tagline, auth-buttons, auth-btn'],
  ['66','home-feed','Home & Feed','Mobile home/feed patterns built around greeting, curation shelves, compact cards and mini-player coexistence.','home-greeting, home-section, home-shelf, hcard, phn-miniplayer'],
  ['67','mobile-charts-page','Charts Page','Mobile chart view with edition header, filter chips, emotional top-entry cards and compact ranked rows.','charts-hdr, charts-ed-badge, charts-filter-row, chart-hero-card, chart-row-list'],
  ['68','mobile-magazine-page','Magazine Page','Mobile magazine page with full-image editorial hero and stacked story cards.','mag-hero-full, mag-hero-overlay, mag-card, mag-card-art, mag-card-title'],
  ['69','mobile-artist-directory','Artist Directory','Two-column mobile artist discovery with image-first cards and cultural figure hierarchy.','artist-grid-2col, acard, acard-overlay, acard-name, acard-meta'],
  ['70','mobile-single-artist-page','Single Artist Page','Mobile artist profile with hero image, actions, tabs and track rows.','artist-page-hero, artist-hero-overlay, artist-actions-row, artist-tab-strip, atrow'],
  ['71','mobile-genres-directory','Genres Directory','Mobile genre discovery with two-column immersive genre cards.','genre-grid-mobile, gcard-mob, gcard-mob-overlay, gcard-mob-name, gcard-mob-count'],
  ['72','mobile-labels-directory','Labels Directory','Mobile label list with avatar/logo blocks and concise relationship metadata.','labels-list, lbl-row, lbl-avatar, lbl-name, lbl-meta'],
  ['73','mobile-full-player','Full Player','High-fidelity full-screen player with ambient art, controls, scrubber and lyrics.','full-player, fp-art-zone, fp-topbar, fp-controls, fp-track-name, fp-scrub, fp-play-btn, fp-lyrics'],
  ['74','mobile-user-profile','User Profile','Mobile profile page with cover, avatar, stats, tabs and saved-content grid.','profile-cover, profile-ava, profile-info, profile-stats-row, profile-tabs'],
  ['75','mobile-search-discovery','Search & Discovery','Mobile search with input, hot chips, discovery sections and registry-backed results.','search-bar-zone, search-input, search-sections, search-section-label, search-chip-row, search-chip'],
].map(([number,id,title,summary,classes]) => ({
  id,
  number,
  group: 'Mobile High-Fidelity Screens' as const,
  title,
  summary,
  adminSections: ['Phone specimen preview', 'Route implementation audit', 'Responsive QA'],
  implementationRules: [
    'Use the phone/high-fidelity screen classes from wakilisha.elements.mobile.css.',
    'Keep the phone UI image-forward and content-specific.',
    'Mini-player, bottom nav and safe-area spacing must coexist cleanly.',
    'Route implementations must use registry-backed content, not mock buckets.',
  ],
  componentsRequired: classes.split(', ').map((c) => `.${c}`),
  tables: [],
  parityTargets: [`Render a phone specimen using ${classes}.`, 'Map each screen to its real React route.'],
  qaChecks: [
    { id: `${number}-phone-fidelity`, label: 'Phone fidelity', description: 'The screen looks like the high-fidelity mobile specimen, not a desktop card squeezed down.' },
    { id: `${number}-nav-player-coexist`, label: 'Nav/player coexist', description: 'Bottom nav, mini-player and safe areas do not overlap.' },
    { id: `${number}-route-backed`, label: 'Route backed', description: 'The implemented route uses real registry/API content.' },
  ],
}));

export const mobileExperienceChapters: WkDesignChapterSpec[] = [...mobileFirst, ...mobileScreens];
