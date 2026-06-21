// WAKILISHA briefing template profiles
// Source-of-truth registry for the 13 branded email briefing catalogs.

export type BriefingTemplateSlug =
  | "culture_dispatch"
  | "charts_digest"
  | "weekly_editorial"
  | "field_guides"
  | "artist_signals"
  | "release_radar"
  | "new_voices"
  | "registry_notes"
  | "label_industry_notes"
  | "language_memory"
  | "east_africa_weekly"
  | "weekend_agenda"
  | "diaspora_signals";

export interface BriefingTemplateProfile {
  slug: BriefingTemplateSlug;
  title: string;
  accentColor: string;
  family: string;
  editorialIntent: string;
  headlinePattern: string;
  deckPattern: string;
  primaryModules: string[];
  imageRule: string;
  archiveRule: string;
}

const IMAGE_RULE = "Use real artwork, artist portraits, story hero images, or typographic fallback cards. Never render naked text rows.";
const ARCHIVE_RULE = "Archive modules must explain why the old item matters now, not simply list old links.";

export const EMAIL_BRIEFING_TEMPLATE_PROFILES: Record<BriefingTemplateSlug, BriefingTemplateProfile> = {
  culture_dispatch: {
    slug: "culture_dispatch",
    title: "Culture Dispatch",
    accentColor: "#5C8E25",
    family: "culture",
    editorialIntent: "card-led magazine routes, chart pulse, artist motion, archive doors",
    headlinePattern: "A route through what culture left behind this week.",
    deckPattern: "Stories, charts, artists, archive routes and the wider creative record.",
    primaryModules: ["featured_routes", "chart_pulse", "artist_motion", "archive_routes", "keep_going"],
    imageRule: IMAGE_RULE,
    archiveRule: ARCHIVE_RULE,
  },
  charts_digest: {
    slug: "charts_digest",
    title: "Charts Digest",
    accentColor: "#5C8E25",
    family: "charts",
    editorialIntent: "album-art chart leader, compact ranked artwork tiles, movement board",
    headlinePattern: "The chart is telling on itself.",
    deckPattern: "A ranked read on songs moving, holding, re-entering and gathering attention.",
    primaryModules: ["chart_lead", "ranked_artwork_tiles", "movement_board", "archive_chart_route"],
    imageRule: IMAGE_RULE,
    archiveRule: ARCHIVE_RULE,
  },
  weekly_editorial: {
    slug: "weekly_editorial",
    title: "Weekly Editorial",
    accentColor: "#946B33",
    family: "editorial",
    editorialIntent: "lead essay card, story grid, pull-thread module",
    headlinePattern: "The week’s sharpest reads, held together.",
    deckPattern: "Essays, criticism and story routes with enough context to keep going.",
    primaryModules: ["lead_editorial", "story_grid", "quote_thread", "archive_reads"],
    imageRule: IMAGE_RULE,
    archiveRule: ARCHIVE_RULE,
  },
  field_guides: {
    slug: "field_guides",
    title: "Field Guides",
    accentColor: "#6452C7",
    family: "guides",
    editorialIntent: "field-guide hero, numbered steps, route cards",
    headlinePattern: "A practical route through the culture.",
    deckPattern: "A guide-led briefing for scenes, methods, places, questions and repeatable context.",
    primaryModules: ["guide_hero", "numbered_methods", "field_notes", "route_cards"],
    imageRule: IMAGE_RULE,
    archiveRule: ARCHIVE_RULE,
  },
  artist_signals: {
    slug: "artist_signals",
    title: "Artist Signals",
    accentColor: "#5C8E25",
    family: "artists",
    editorialIntent: "image-first artist wall, signal labels, minimal metadata",
    headlinePattern: "The artists are the signal.",
    deckPattern: "Image-first artist movement, new attention, heat, geography and the next profile route.",
    primaryModules: ["artist_wall", "featured_artist", "signal_tiles", "related_routes"],
    imageRule: IMAGE_RULE,
    archiveRule: ARCHIVE_RULE,
  },
  release_radar: {
    slug: "release_radar",
    title: "Release Radar",
    accentColor: "#A06800",
    family: "releases",
    editorialIntent: "cover-led release cards, new project grid, listen routes",
    headlinePattern: "New projects worth opening properly.",
    deckPattern: "Covers, release context, artist links and the records creating new listening paths.",
    primaryModules: ["release_lead", "cover_grid", "chart_context", "artist_routes"],
    imageRule: IMAGE_RULE,
    archiveRule: ARCHIVE_RULE,
  },
  new_voices: {
    slug: "new_voices",
    title: "New Voices",
    accentColor: "#9E3879",
    family: "artists",
    editorialIntent: "emerging artist wall, discovery framing, first signals",
    headlinePattern: "New names, early signals, real reasons to care.",
    deckPattern: "Emerging artists framed with image, geography, first routes and next-listen context.",
    primaryModules: ["new_voice_wall", "spotlight_card", "first_signal_tiles", "discovery_routes"],
    imageRule: IMAGE_RULE,
    archiveRule: ARCHIVE_RULE,
  },
  registry_notes: {
    slug: "registry_notes",
    title: "Registry Notes",
    accentColor: "#6452C7",
    family: "registry",
    editorialIntent: "entity-change cards, stats, audit routes",
    headlinePattern: "The archive changed. Here is what moved.",
    deckPattern: "New records, repaired entities, release shells, label links and context notes from the database.",
    primaryModules: ["registry_stats", "entity_change_cards", "repair_notes", "admin_routes"],
    imageRule: IMAGE_RULE,
    archiveRule: ARCHIVE_RULE,
  },
  label_industry_notes: {
    slug: "label_industry_notes",
    title: "Label & Industry Notes",
    accentColor: "#946B33",
    family: "industry",
    editorialIntent: "label cards, roster cues, release activity",
    headlinePattern: "Behind the songs, systems are moving.",
    deckPattern: "Labels, rosters, releases, industry notes and the infrastructure around creative work.",
    primaryModules: ["label_cards", "roster_motion", "release_activity", "industry_routes"],
    imageRule: IMAGE_RULE,
    archiveRule: ARCHIVE_RULE,
  },
  language_memory: {
    slug: "language_memory",
    title: "Language & Memory",
    accentColor: "#2D6BB5",
    family: "language",
    editorialIntent: "memory cards, language threads, archive pull routes",
    headlinePattern: "Language carries what the timeline forgets.",
    deckPattern: "Memory routes through lyrics, idioms, vernacular pop, archive writing and oral culture.",
    primaryModules: ["memory_lead", "language_cards", "archive_threads", "listen_read_routes"],
    imageRule: IMAGE_RULE,
    archiveRule: ARCHIVE_RULE,
  },
  east_africa_weekly: {
    slug: "east_africa_weekly",
    title: "East Africa Weekly",
    accentColor: "#1C8A75",
    family: "regional",
    editorialIntent: "city board, regional story cards, cross-border artist context",
    headlinePattern: "The region is not one scene. It is a set of crossings.",
    deckPattern: "Kenya, Uganda, Tanzania, Rwanda and the routes that connect cities, sounds and stories.",
    primaryModules: ["regional_lead", "city_board", "cross_border_artists", "regional_archive"],
    imageRule: IMAGE_RULE,
    archiveRule: ARCHIVE_RULE,
  },
  weekend_agenda: {
    slug: "weekend_agenda",
    title: "Weekend Agenda",
    accentColor: "#A06800",
    family: "agenda",
    editorialIntent: "Friday/Saturday/Sunday planner cards, live-culture routes",
    headlinePattern: "A cultural plan for the next few days.",
    deckPattern: "Events, listening, reading, places and low-friction routes for the weekend.",
    primaryModules: ["agenda_hero", "day_cards", "listen_read_go", "save_routes"],
    imageRule: IMAGE_RULE,
    archiveRule: ARCHIVE_RULE,
  },
  diaspora_signals: {
    slug: "diaspora_signals",
    title: "Diaspora Signals",
    accentColor: "#6452C7",
    family: "diaspora",
    editorialIntent: "home-distance-memory cards, diaspora artist routes",
    headlinePattern: "Distance is part of the record.",
    deckPattern: "Diaspora artists, home memory, language, remittance of taste and cross-border attention.",
    primaryModules: ["diaspora_lead", "distance_cards", "artist_routes", "memory_archive"],
    imageRule: IMAGE_RULE,
    archiveRule: ARCHIVE_RULE,
  },
};

export const EMAIL_BRIEFING_TEMPLATE_SLUGS = Object.keys(EMAIL_BRIEFING_TEMPLATE_PROFILES) as BriefingTemplateSlug[];

export function getEmailBriefingTemplateProfile(slug: string): BriefingTemplateProfile {
  return EMAIL_BRIEFING_TEMPLATE_PROFILES[(slug as BriefingTemplateSlug)] ?? EMAIL_BRIEFING_TEMPLATE_PROFILES.culture_dispatch;
}
