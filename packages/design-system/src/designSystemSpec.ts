export type WkSpecItem = {
  label: string;
  body: string;
};

export type WkSpecTable = {
  title: string;
  columns: string[];
  rows: string[][];
};

export type WkSpecimen = {
  name: string;
  kind: 'token' | 'component' | 'page' | 'state' | 'pattern' | 'motion' | 'copy' | 'qa';
  description: string;
  requiredProps?: string[];
  states?: string[];
  dataSources?: string[];
};

export type WkDesignChapterSpec = {
  id: string;
  number: string;
  group: string;
  title: string;
  summary: string;
  adminSections: WkSpecItem[];
  implementationRules: string[];
  specimens: WkSpecimen[];
  tables: WkSpecTable[];
  pageParity?: string[];
  qaChecks: string[];
};

export const wkDesignSystemGroups = [
  'Foundations',
  'Product',
  'Media & Editorial',
  'Reach',
  'Implementation',
  'React App UI'
] as const;

export const wkDesignSystemSpec: WkDesignChapterSpec[] = [
  {
    id: 'north-star',
    number: '01',
    group: 'Foundations',
    title: 'North Star',
    summary: 'WAKILISHA is cultural infrastructure: a living archive, discovery engine, editorial platform, and commercial ecosystem for African culture beginning with music.',
    adminSections: [
      { label: 'Decision filter', body: 'Every decision must pass three questions: does it earn the space, does it carry the work, and does it belong here? The interface stays small until the content earns space.' },
      { label: 'Cinematic restraint', body: 'Most surfaces are quiet. Players are small. Cards are honest. Editorial chrome whispers. Big moments are earned through restraint elsewhere.' },
      { label: 'Editorial credibility', body: 'Pages read like a publication, not a feed. Bylines, methodology, corrections, dates, and tabular numbers are part of the product grammar.' },
      { label: 'Cultural specificity', body: 'Scenes, countries, languages, eras, peer relationships, and place are first-class metadata. The product must answer where culture comes from, not just what it is.' },
      { label: 'Commercial credibility', body: 'The visual system must be serious enough for funders, cultural institutions, artist managers, partners, and advertisers without becoming corporate blandware.' },
      { label: 'Long-haul scale', body: 'Music is the first vertical, not the ceiling. Components and tokens must scale to film, fashion, food, language, dance, places, intelligence, and experiences.' }
    ],
    implementationRules: [
      'No page ships unless it can explain how it serves restraint, editorial credibility, cultural specificity, commercial credibility, and long-haul scale.',
      'Default to compact surfaces; expand only for hero moments, feature stories, theater/player modes, and culturally significant entities.',
      'Avoid both pan-African visual clichés and Western SaaS templates with African content pasted in.'
    ],
    specimens: [
      { name: 'North-star checklist', kind: 'qa', description: 'Admin checklist shown on every page parity record.', states: ['pass', 'fail', 'needs review'] },
      { name: 'Cultural infrastructure positioning card', kind: 'copy', description: 'Reusable product positioning block for homepage/admin/about surfaces.' }
    ],
    tables: [
      { title: 'Five creative principles', columns: ['Principle', 'Meaning'], rows: [
        ['Cinematic restraint', 'Quiet by default; large only when earned.'],
        ['Editorial credibility', 'Publication-grade structure, source transparency, methodology, and correction affordances.'],
        ['Cultural specificity', 'Metadata and layout must surface scenes, languages, places, and relationships.'],
        ['Commercial credibility', 'Premium enough for serious partners without losing cultural edge.'],
        ['Long-haul scale', 'Designed to support all future cultural verticals.']
      ]}
    ],
    qaChecks: ['Does the surface earn the space?', 'Does it carry the cultural work?', 'Does it feel like WAKILISHA rather than a generic app?']
  },
  {
    id: 'brand-architecture',
    number: '02',
    group: 'Foundations',
    title: 'Brand Architecture',
    summary: 'WAKILISHA is the mother brand. Verticals ride the same system and flex only through light accenting, metadata vocabulary, image treatment, and content-specific components.',
    adminSections: [
      { label: 'Mother brand', body: 'WAKILISHA uses the wordmark + bolt alone. The tone is cultural, intelligent, premium, and editorial.' },
      { label: 'Product verticals', body: 'Music, Film, Fashion, Food, Language, Dance, Places, Intelligence, and Experiences inherit the mother system and add only the temperament of the subject.' },
      { label: 'Surface labels', body: 'Charts, Magazine, Registry, Reports, Field guides, Discover, and Profile describe the work and should not compete with the mother brand.' },
      { label: 'Editorial titles', body: 'Story titles and cultural projects use editorial type, not branded chrome. The brand gets out of the writer’s way.' }
    ],
    implementationRules: [
      'Universal: wordmark, bolt, typography, spacing, radius, motion, navigation, editorial conventions.',
      'Flexible: one vertical accent, hero image treatment, metadata vocabulary, player/card adapter, and microcopy extension.',
      'A user should always know both that they are in WAKILISHA and which vertical/surface they are using.'
    ],
    specimens: [
      { name: 'Vertical identity tile', kind: 'component', description: 'Shows vertical accent, route, metadata vocabulary, and whether vertical is enabled.' },
      { name: 'Surface label chip', kind: 'component', description: 'Small functional label for Charts, Magazine, Registry, Reports, and Discover.' }
    ],
    tables: [
      { title: 'Brand hierarchy', columns: ['Level', 'Identity', 'Lockup', 'Tone'], rows: [
        ['Mother brand', 'WAKILISHA', 'Wordmark + bolt', 'Cultural, intelligent, premium, editorial.'],
        ['Product vertical', 'WAKILISHA Music / Film / Fashion / Food / Language / Dance / Places / Intelligence / Experiences', 'Wordmark + vertical label', 'Mother tone plus subject temperament.'],
        ['Surface label', 'Charts / Magazine / Registry / Reports / Field guides', 'Small surface kicker', 'Functional and factual.'],
        ['Editorial title', 'Story/project title', 'Editorial type only', 'Voice of the writer.']
      ]}
    ],
    qaChecks: ['Is the mother brand still recognizable?', 'Is the vertical only lightly accented?', 'Did we avoid forking the system?']
  },
  {
    id: 'logo', number: '03', group: 'Foundations', title: 'Logo',
    summary: 'The WAKILISHA wordmark is a custom SVG masthead with a lightning bolt in the S-position. It has themed variants and strict safe-zone rules.',
    adminSections: [
      { label: 'Primary lockups', body: 'Dark mode: white letters + #84C241 bolt. Light mode: black letters + green bolt. On photography: use a scrim underneath.' },
      { label: 'Size scale', body: 'XL 48px for hero headers, LG 32px for marketing, MD 22px for standard nav, SM 14px for compact nav/footer, below 10px use bolt-only.' },
      { label: 'Safe zone', body: 'Clear space around the wordmark equals the height of the bolt glyph. Use 1.5x for print and event posters.' },
      { label: 'Motion', body: 'Wordmark may animate on first page render or brand moments only: mask-wipe left-to-right over 420ms, bolt lands last with a 60ms snap. Never loop.' }
    ],
    implementationRules: ['Never recreate the wordmark in a font.', 'Never stretch, skew, outline, or recolor the bolt outside brand green.', 'Use theme-aware Logo and BoltMark components.', 'Fallback text is Inter 900 only while filing a bug.'],
    specimens: [
      { name: 'Logo', kind: 'component', description: 'Theme-aware full wordmark.', requiredProps: ['variant', 'size', 'label'] },
      { name: 'BoltMark', kind: 'component', description: 'Bolt-only mark for tiny spaces and app icons.' },
      { name: 'Logo safe-zone specimen', kind: 'pattern', description: 'Visual safe-zone demonstration in admin.' }
    ],
    tables: [{ title: 'Logo sizes', columns: ['Token', 'Height', 'Use'], rows: [['xl','48px','Hero headers'],['lg','32px','Marketing surfaces'],['md','22px','Standard nav'],['sm','14px','Compact nav/footer'],['xs','10px or less','Switch to bolt-only']]}],
    qaChecks: ['Is the SVG used?', 'Is the correct theme variant used?', 'Is safe-zone preserved?', 'Is photo placement protected by a scrim?']
  },
  {
    id: 'color', number: '04', group: 'Foundations', title: 'Color',
    summary: 'A restrained warm-neutral spine with one brand color, semantic status colors, and light vertical accents. Dark mode is primary.',
    adminSections: [
      { label: 'Dark surfaces', body: 'Use #080908 bg, #0E100D subtle bg, #141712 surface, #1C2018 raised, #23271E strong. Text is warm off-white #F0EFE8 with soft/muted/faint tiers.' },
      { label: 'Light surfaces', body: 'Use #F7F8F3 bg, #EEF1E8 subtle, #FFFFFF surface, #F1F4EA raised, #E7ECD9 strong. Brand text shifts to #5C8E25 for AA contrast.' },
      { label: 'Brand and status', body: 'Brand green is #84C241 in dark mode. Status colors: success, warning, danger, info. Status must communicate meaning, not decoration.' },
      { label: 'Vertical accents', body: 'Music green, Film clay, Fashion ochre, Food saffron, Language blue, Dance magenta, Places teal, Intelligence violet. Accents never replace primary CTA.' }
    ],
    implementationRules: ['Use --wk-* tokens only.', 'Use brand green for one meaningful moment per surface.', 'No generic SaaS blue as primary.', 'No neon gradients or random purple.', 'Red only for destructive/error/chart-down states.'],
    specimens: [
      { name: 'Color token grid', kind: 'token', description: 'Dark/light surfaces, text, brand, status, and vertical swatches.' },
      { name: 'Contrast checker', kind: 'qa', description: 'Displays AA/AAA pairings for selected token combinations.' }
    ],
    tables: [{ title: 'Core color tokens', columns: ['Token', 'Dark', 'Light', 'Use'], rows: [['--wk-bg','#080908','#F7F8F3','Page background'],['--wk-surface','#141712','#FFFFFF','Cards/panels'],['--wk-brand','#84C241','#5C8E25','Brand accents/primary CTA'],['--wk-text','#F0EFE8','#0C0D0A','Primary text'],['--wk-text-muted','#7E7C74','#6B6E62','Metadata']]}],
    qaChecks: ['No hard-coded hex outside token files.', 'Brand green is not overused.', 'Light mode is legible.', 'Status colors mean something.']
  },
  {
    id: 'typography', number: '05', group: 'Foundations', title: 'Typography',
    summary: 'Inter handles display/UI/metadata/numbers. DM Sans handles body/editorial warmth. DM Mono handles tokens/code. Nothing else ships.',
    adminSections: [
      { label: 'Type stack', body: 'Display and UI: Inter. Body: DM Sans with Inter fallback. Mono: DM Mono. Load only defined weights.' },
      { label: 'Editorial scale', body: 'Hero display uses Inter 900 clamp(48px, 7vw, 96px)/.92 with -0.055em tracking. Page, section, article, body, caption, metadata, and mono scales are fixed.' },
      { label: 'Casing', body: 'Headlines, buttons, navigation, and tags use sentence case. Eyebrows/status use uppercase. Preserve artist/title source casing.' },
      { label: 'Fallback', body: 'If fonts fail, use system-ui stack. Never let a serif fallback appear.' }
    ],
    implementationRules: ['No new fonts.', 'No all-caps headlines.', 'Body copy should not be 14px for editorial reading.', 'Numbers use tabular numerals.', 'Display tracking must stay tight.'],
    specimens: [
      { name: 'Type scale specimen', kind: 'token', description: 'Hero, page, section, article, lead, body, caption, metadata, mono.' },
      { name: 'Casing inspector', kind: 'qa', description: 'Flags generic/titlecase/all-caps misuse.' }
    ],
    tables: [{ title: 'Type roles', columns: ['Role','Font','Size','Weight','Tracking'], rows: [['Hero','Inter','clamp(48px,7vw,96px)','900','-0.055em'],['Page title','Inter','clamp(34px,4.5vw,52px)','900','-0.045em'],['Body','DM Sans','15px','400','0'],['Metadata','Inter','10–11px','700–800','0.18em'],['Mono','DM Mono','12px','500','0']]}],
    qaChecks: ['Correct font used by role.', 'Sentence case respected.', 'Source casing preserved.', 'Fallback chain is sans-serif.']
  },
  {
    id: 'spacing-layout', number: '06', group: 'Foundations', title: 'Spacing & Layout',
    summary: 'A 4-based spacing scale, a defined radius scale, and tuned widths for text, content, wide, and max layouts.',
    adminSections: [
      { label: 'Spacing scale', body: 'Use --wk-s-1 through --wk-s-32. Major rhythm must be --wk-s-10, --wk-s-12, or --wk-s-16.' },
      { label: 'Radius scale', body: 'Use --wk-r-1 through --wk-r-7 plus pill. Tags 4px, cards 8–10px, hero/media 14px, modal/sheet 20px.' },
      { label: 'Container widths', body: 'Narrow 680px, text 760px, content 1080px, wide 1280px, max 1440px.' },
      { label: 'Breakpoints', body: 'Mobile default, sm 640, md 768, lg 1024, xl 1280, 2xl 1440.' }
    ],
    implementationRules: ['Do not invent spacing values.', 'Use content width by surface type.', 'Mobile is intentional, not collapsed desktop.', 'Hero padding varies by archetype.'],
    specimens: [{ name: 'Spacing ruler', kind: 'token', description: 'Visualizes spacing/radius/container scales.' }],
    tables: [{ title: 'Widths', columns: ['Token','Px','Use'], rows: [['--wk-w-narrow','680','Auth/focus forms'],['--wk-w-text','760','Article body'],['--wk-w-content','1080','Standard pages'],['--wk-w-wide','1280','Dense data/admin'],['--wk-w-max','1440','Magazine/full hero']]}],
    qaChecks: ['Section rhythm uses approved tokens.', 'Article body uses text width.', 'Dense pages use wide width.', 'Radius matches component role.']
  },
  {
    id: 'motion', number: '07', group: 'Foundations', title: 'Motion',
    summary: 'Motion is utility, not decoration. It orients the eye, respects reduced motion, and never loops without purpose.',
    adminSections: [
      { label: 'Duration scale', body: 'Instant 60ms, fast 120ms, standard 220ms, slow 420ms, deliberate 640ms.' },
      { label: 'Easing', body: 'Standard cubic-bezier(.2,.8,.2,1), snap cubic-bezier(.16,1,.3,1), ease-in, ease-out.' },
      { label: 'Principles', body: 'Origin and destination must be clear. One axis at a time. No idle motion. Always respect prefers-reduced-motion.' },
      { label: 'Player motion', body: 'Dock slides up on first play, sheet expands from dock, theater opens via deliberate fade/scale, nav capsule width animates from zero.' }
    ],
    implementationRules: ['No bouncy hover, parallax, card tilt, animated counters, or decorative carousels.', 'Only live dots, overflow marquees, and active audio waveforms may loop.', 'Reduced motion must drop durations to near-instant.'],
    specimens: [{ name: 'Motion samples', kind: 'motion', description: 'Dock, sheet, modal, route transition, shimmer, active waveform.' }],
    tables: [{ title: 'Motion tokens', columns: ['Token','Duration','Use'], rows: [['--wk-d-instant','60ms','Immediate state feedback'],['--wk-d-fast','120ms','Hover/focus'],['--wk-d-standard','220ms','Drawer/modal'],['--wk-d-slow','420ms','Page/theater open'],['--wk-d-deliberate','640ms','Brand reveal']]}],
    qaChecks: ['Motion has purpose.', 'No idle loops.', 'Reduced motion works.', 'Element moves from logical origin.']
  },
  {
    id: 'voice', number: '08', group: 'Foundations', title: 'Voice',
    summary: 'WAKILISHA writes like a thoughtful editor with context: specific, factual, restrained, occasionally dry, never sycophantic.',
    adminSections: [
      { label: 'Tone', body: 'Editorial, considered, specific, confident, honest about scope and comfortable with silence.' },
      { label: 'Microcopy', body: 'Loading is compact. Empty is one short sentence. Errors are one short sentence plus a verb. Confirmation is quiet.' },
      { label: 'CTA grammar', body: 'Use verb + noun: Open profile, Follow artist, Read the story, Save to collection. Avoid Learn more, Click here, See all where specificity exists.' },
      { label: 'Anti-sycophancy', body: 'No Awesome!, Oops!, emojis, confetti, or fake warmth for normal interface states.' }
    ],
    implementationRules: ['Use one clear sentence for state copy.', 'Use concrete dates/counts.', 'Never call things amazing unless editorially justified.', 'No “your” CTAs in WAKILISHA language guide contexts.'],
    specimens: [{ name: 'Copy compare', kind: 'copy', description: 'Do/don’t microcopy pairs and CTA examples.' }],
    tables: [{ title: 'Microcopy patterns', columns: ['Surface','Rule'], rows: [['Loading','Small label or shimmer; no chatter'],['Empty','One true sentence'],['Error','One sentence + action'],['Success','Quiet acknowledgement'],['CTA','Verb + noun'],['Counts','Numerals with units']]}],
    qaChecks: ['No emoji/sycophancy.', 'CTA is specific.', 'State copy is factual.', 'No generic “Learn more” where better exists.']
  },
  {
    id: 'accessibility', number: '09', group: 'Foundations', title: 'Accessibility',
    summary: 'WCAG 2.2 AA is the floor. The system supports contrast, keyboard, focus, screen readers, language, forms, touch, motion, and low bandwidth.',
    adminSections: [
      { label: 'Contrast', body: '4.5:1 for body, 3:1 for large/bold. Status colors must work on default surfaces.' },
      { label: 'Keyboard and focus', body: 'All interactive elements reachable by Tab. Focus order matches visual order. Focus is visible with brand outline.' },
      { label: 'Screen readers', body: 'Icons need aria-labels unless decorative. Status changes use aria-live. Images get meaningful alt or empty decorative alt.' },
      { label: 'Language', body: 'Each page sets lang. Mixed-language content wraps spans with language codes.' },
      { label: 'Performance', body: 'Mobile-first and bandwidth-aware. Directory pages under 400kb transfer target; editorial dominated by optimized hero media.' }
    ],
    implementationRules: ['44x44px touch target minimum.', 'No color-only errors.', 'Sequential headings.', 'Respect reduced motion.', 'Placeholder is never label.'],
    specimens: [{ name: 'Accessibility audit panel', kind: 'qa', description: 'Checklist for contrast, keyboard, screen reader, language, motion, and touch targets.' }],
    tables: [{ title: 'A11y floor', columns: ['Area','Rule'], rows: [['Contrast','WCAG 2.2 AA minimum'],['Keyboard','All controls tabbable'],['Focus','Visible focus outline'],['Touch','44x44 target'],['Forms','Visible labels and described errors'],['Language','lang attributes for mixed language']]}],
    qaChecks: ['Keyboard usable.', 'Focus visible.', 'Images have alt.', 'Controls labeled.', 'Motion reduced.', 'Touch target sufficient.']
  },
  {
    id: 'navigation', number: '10', group: 'Product', title: 'Navigation',
    summary: 'Navigation is small, stable, theme-aware, and player/search compatible. It frames product surfaces without becoming the product.',
    adminSections: [
      { label: 'Public nav', body: 'Masthead, surface links, search, theme, data/admin access where authorized, player capsule when active.' },
      { label: 'Admin nav', body: 'Breadcrumb bar, current section, review/status affordances, and design-system access.' },
      { label: 'Mobile nav', body: 'Bottom nav can exist, but must coexist with the player dock and avoid trapping core actions.' }
    ],
    implementationRules: ['Nav labels are sentence case.', 'Do not crowd masthead with decorative items.', 'Player state must be reflected without hijacking navigation.'],
    specimens: [{ name: 'PublicNav', kind: 'component', description: 'Theme-aware masthead and route nav.' }, { name: 'PlayerNavCapsule', kind: 'component', description: 'Compact now-playing state in nav.' }],
    tables: [], qaChecks: ['Nav works with player.', 'Mobile nav clear.', 'Theme logo correct.', 'Active route visible.']
  },
  {
    id: 'buttons-actions', number: '11', group: 'Product', title: 'Buttons & Actions',
    summary: 'Buttons are specific, accessible, restrained, and use one primary action per decision area.',
    adminSections: [
      { label: 'Variants', body: 'Primary brand, ghost, soft, danger, icon-only, and text-link actions.' },
      { label: 'Labels', body: 'Sentence case. Verb + noun. Avoid vague utility language.' },
      { label: 'Hierarchy', body: 'Primary actions are brand green. Secondary actions are ghost/soft. Destructive actions are danger and require confirmation if irreversible.' }
    ],
    implementationRules: ['Only one primary action per decision cluster.', 'Icon-only controls need aria-label.', '44px touch target even when visually compact.', 'Never use brand green for every button.'],
    specimens: [{ name: 'Button', kind: 'component', description: 'Primary, ghost, soft, danger; sm/md/lg; disabled/loading states.' }, { name: 'ActionBar', kind: 'component', description: 'Grouped page/entity actions.' }],
    tables: [], qaChecks: ['Action label specific.', 'Primary singular.', 'Disabled/loading states exist.', 'Icon controls labeled.']
  },
  {
    id: 'forms', number: '12', group: 'Product', title: 'Forms',
    summary: 'Forms are visible-label, validation-aware, admin-grade, and never rely on placeholder-only labels.',
    adminSections: [
      { label: 'Inputs', body: 'Visible label, helper text, error message, and described-by wiring.' },
      { label: 'Search', body: 'Search must show scope and result counts when possible.' },
      { label: 'Filters', body: 'Filters are composable and preserve URL state for directories/charts.' }
    ],
    implementationRules: ['Placeholder is never a label.', 'Errors use icon/text/color.', 'Filters should not erase context.', 'Long admin forms should group sections clearly.'],
    specimens: [{ name: 'SearchInput', kind: 'component', description: 'Scoped search with result count.' }, { name: 'FilterBar', kind: 'component', description: 'Directory/chart filter controls.' }],
    tables: [], qaChecks: ['Labels visible.', 'Errors accessible.', 'Filter state retained.', 'Search scope clear.']
  },
  {
    id: 'cards-surfaces', number: '13', group: 'Product', title: 'Cards & Surfaces',
    summary: 'Cards and panels clarify hierarchy. They must carry useful metadata, not just image + title.',
    adminSections: [
      { label: 'Surface levels', body: 'Background, subtle, surface, raised, strong. Use hierarchy sparingly.' },
      { label: 'Card content', body: 'Cards need entity type, title/name, key metadata, relationship counts, route/action, and image/fallback where relevant.' },
      { label: 'Hover', body: 'Hover may raise or reveal action, but should not introduce noisy animation.' }
    ],
    implementationRules: ['Do not box every section.', 'Prefer rows for dense data, cards for discovery/editorial.', 'Fallback media must be deterministic.'],
    specimens: [{ name: 'Surface', kind: 'component', description: 'Base panel/card container.' }, { name: 'EntityCard', kind: 'component', description: 'Generic data-backed entity card.' }],
    tables: [], qaChecks: ['Card has useful metadata.', 'Surface hierarchy clear.', 'No decorative boxing.']
  },
  {
    id: 'tags-badges', number: '14', group: 'Product', title: 'Tags & Badges', summary: 'Tags and badges communicate status, category, movement, and metadata without visual clutter.',
    adminSections: [{ label: 'Tag grammar', body: 'Tags use sentence case. Status badges may use uppercase with tracking.' }, { label: 'Status meaning', body: 'Brand, success, warning, danger, and info variants must map to real semantic state.' }],
    implementationRules: ['Do not over-tag cards.', 'Use status variants only for status.', 'Movement badges must match chart data.'],
    specimens: [{ name: 'Tag', kind: 'component', description: 'Default, brand, success, warning, danger, info.' }, { name: 'ChartMovementBadge', kind: 'component', description: 'Up/down/same/new/re-entry.' }],
    tables: [], qaChecks: ['Tag casing correct.', 'Status semantic.', 'No tag clutter.']
  },
  {
    id: 'track-entity-rows', number: '15', group: 'Product', title: 'Track & Entity Rows', summary: 'Dense row systems for charts, albums, queues, search, and related entities.',
    adminSections: [{ label: 'Track rows', body: 'Position/rank, artwork, title, artist, movement/status, secondary metadata, and player action.' }, { label: 'Entity rows', body: 'Avatar/artwork, name, entity type, relationship count, route/action.' }, { label: 'Expanded rows', body: 'Reveal chart history, credits, release, playback, and related links without navigating away.' }],
    implementationRules: ['Use row patterns for dense data.', 'Playable state depends on playback source.', 'Rank and numeric columns use tabular numerals.', 'Rows support compact and expanded modes.'],
    specimens: [{ name: 'TrackRow', kind: 'component', description: 'Compact/playable track row.' }, { name: 'ChartRow', kind: 'component', description: 'Ranked chart row with movement/history.' }, { name: 'EntityRow', kind: 'component', description: 'Registry/search result row.' }],
    tables: [], qaChecks: ['Rows link to canonical entities.', 'Playable state accurate.', 'Expanded content graph-backed.']
  },
  {
    id: 'player-system', number: '16', group: 'Product', title: 'Player System', summary: 'Playback is a system: dock, nav capsule, sheet, theater, queue, provider attribution, and availability states.',
    adminSections: [{ label: 'Dock', body: '64px desktop, 56px mobile. Shows artwork, title, artist/context, controls, progress, secondary actions.' }, { label: 'Nav capsule', body: 'Small now-playing capsule in navigation when active.' }, { label: 'Sheet', body: 'Expanded player with large art, source/provider, progress, controls, queue/lyrics/context tabs.' }, { label: 'Theater', body: 'Immersive visual mode reserved for content that earns it.' }, { label: 'Attribution', body: 'Provider/source must be visible; playback comes from track_playback_sources.' }],
    implementationRules: ['No fake play buttons.', 'If no playback source exists, show unavailable state.', 'Player motion originates from dock.', 'Queue state persists across pages.'],
    specimens: [{ name: 'PlayerDock', kind: 'component', description: 'Persistent bottom dock.', dataSources: ['track_playback_sources'] }, { name: 'PlayerSheet', kind: 'component', description: 'Expanded mobile/desktop sheet.' }, { name: 'PlayerTheater', kind: 'component', description: 'Immersive mode.' }],
    tables: [{ title: 'Player surfaces', columns: ['Surface','Purpose'], rows: [['Dock','Persistent compact playback'],['Nav capsule','Now-playing in nav'],['Sheet','Expanded controls/context'],['Theater','Immersive visual listening']]}],
    qaChecks: ['Playback source real.', 'Provider shown.', 'Keyboard controls work.', 'No audio state lies.']
  },
  {
    id: 'search-discovery', number: '17', group: 'Product', title: 'Search & Discovery', summary: 'Discovery is graph-aware across artists, tracks, releases, labels, genres, charts, and editorial.',
    adminSections: [{ label: 'Global search', body: 'Results identify entity type, route, image, and relationship context.' }, { label: 'Directories', body: 'Support search, filters, sort, layout mode, and count summaries.' }, { label: 'Recommendations', body: 'Related content should come from graph relationships, not random matching.' }],
    implementationRules: ['No mock search results.', 'URL state for filters.', 'Show scope and counts.', 'Graph relationships are the ranking/context source.'],
    specimens: [{ name: 'GlobalSearch', kind: 'component', description: 'Multi-entity search.' }, { name: 'DiscoveryRail', kind: 'component', description: 'Graph-backed related content rail.' }], tables: [], qaChecks: ['Results are graph-backed.', 'Filters persist.', 'Empty state factual.']
  },
  {
    id: 'states', number: '18', group: 'Product', title: 'States', summary: 'Loading, empty, error, partial data, review, and no-playback states are part of the design system.',
    adminSections: [{ label: 'Loading', body: 'Use skeletons/shimmer and compact factual labels.' }, { label: 'Empty', body: 'One short sentence about what is true now.' }, { label: 'Error', body: 'One short sentence plus action. No Oops.' }, { label: 'Partial graph', body: 'When repaired data is incomplete, show context internally and avoid guessing publicly.' }],
    implementationRules: ['Every payload state must be represented.', 'No cheerful filler.', 'Review reasons are admin-visible.', 'Public uncertainty is handled gracefully.'],
    specimens: [{ name: 'StateBlock', kind: 'state', description: 'Empty/error/partial/loading states.' }, { name: 'Skeleton', kind: 'state', description: 'Tokenized loading skeletons.' }], tables: [], qaChecks: ['Loading/empty/error exist.', 'No fake data fallback.', 'Review state visible internally.']
  },
  {
    id: 'image-system', number: '19', group: 'Media & Editorial', title: 'Image System', summary: 'Photography carries warmth. UI stays restrained. Media resolution, scrims, fallbacks, and attribution are systemized.',
    adminSections: [{ label: 'Image roles', body: 'Artist portrait, release artwork, editorial photo, hero background, card thumbnail, provider artwork.' }, { label: 'Scrims', body: 'Hero photography must use scrims to protect contrast and logo safe zones.' }, { label: 'Fallbacks', body: 'Fallbacks are deterministic and entity-aware, not random stock images.' }, { label: 'Attribution', body: 'Media source/credit must be available where data exists.' }],
    implementationRules: ['No unrelated permanent stock images.', 'Object-fit rules per role.', 'Lazy-load below fold.', 'Use media assets before fallback.' ],
    specimens: [{ name: 'EntityArtwork', kind: 'component', description: 'Artwork/portrait resolver with fallback.' }, { name: 'HeroScrim', kind: 'pattern', description: 'Contrast-safe overlay.' }], tables: [], qaChecks: ['Media source checked.', 'Fallback deterministic.', 'Alt text set.', 'Contrast protected.']
  },
  {
    id: 'editorial-articles', number: '20', group: 'Media & Editorial', title: 'Editorial Articles', summary: 'Articles must feel authored, credible, culturally specific, and readable.',
    adminSections: [{ label: 'Article anatomy', body: 'Hero, kicker, headline, dek, byline, date, reading time, body, pullquotes, embeds, related entities, attribution.' }, { label: 'Reading width', body: 'Article body uses --wk-w-text and DM Sans reading scale.' }, { label: 'Content classification', body: 'Magazine only surfaces real editorial; app shells and utility pages are excluded.' }],
    implementationRules: ['Use editorial metadata.', 'Do not treat posts as generic cards.', 'Related graph embeds should be data-backed.', 'Do not overdecorate article body.'],
    specimens: [{ name: 'ArticlePage', kind: 'page', description: 'Full editorial article archetype.' }, { name: 'StoryCard', kind: 'component', description: 'Magazine index card.' }], tables: [], qaChecks: ['True editorial only.', 'Byline/date present when available.', 'Body width correct.', 'Related embeds graph-backed.']
  },
  {
    id: 'charts-rankings', number: '21', group: 'Media & Editorial', title: 'Charts & Rankings', summary: 'Charts are the signature product surface: ranked, dense, playable, linked, and credible.',
    adminSections: [{ label: 'Chart header', body: 'Series, edition, period/date, methodology/status, stats, filters.' }, { label: 'Rows', body: 'Rank, movement, artwork, track, artist, date, weeks, peak, label, play/expand.' }, { label: 'History', body: 'Show only when data exists. Never fabricate movement or peak data.' }, { label: 'Methodology', body: 'Charts need source/methodology and update cadence visible somewhere consistent.' }],
    implementationRules: ['Chart entries link to canonical tracks/artists.', 'Top positions may be visually stronger.', 'Rows must remain scannable.', 'No fake movement/history.'],
    specimens: [{ name: 'ChartHeader', kind: 'component', description: 'Edition metadata and controls.' }, { name: 'ChartRow', kind: 'component', description: 'Ranked expandable row.' }, { name: 'ChartHistoryMini', kind: 'component', description: 'Tiny history visual when data exists.' }],
    tables: [], qaChecks: ['Canonical links work.', 'Movement data real.', 'Playback availability accurate.', 'Methodology surfaced.']
  },
  {
    id: 'registry', number: '22', group: 'Media & Editorial', title: 'Registry', summary: 'Registry pages make the cultural graph visible: artists, tracks, releases, labels, genres, media, and relationships.',
    adminSections: [{ label: 'Entity graph', body: 'Artist→tracks/releases/genres/charts. Track→artists/release/charts/playback. Release→tracklist/label/artists. Genre→artists/tracks. Label→releases/artists.' }, { label: 'Review handling', body: 'Uncertain/combined/duplicate relationships are flagged internally; public pages do not silently guess.' }, { label: 'Relationship modules', body: 'Each entity page should show meaningful relationship modules rather than isolated metadata.' }],
    implementationRules: ['Use repaired graph tables as source of truth.', 'Show relationship counts.', 'Make connections visible and pleasurable.', 'Do not flatten uncertain states.'],
    specimens: [{ name: 'RelationshipRail', kind: 'component', description: 'Graph-backed entity connections.' }, { name: 'EntityHeader', kind: 'component', description: 'Canonical entity identity.' }], tables: [], qaChecks: ['Relationships graph-backed.', 'Counts accurate.', 'Uncertainty handled.', 'No flat CSV pages.']
  },
  {
    id: 'page-archetypes', number: '23', group: 'Media & Editorial', title: 'Page Archetypes', summary: 'Repeatable public page structures replace disjointed WordPress templates.',
    adminSections: [{ label: 'Archetype pattern', body: 'Data contract → page shell → hero → primary modules → relationship modules → related content → attribution/footer.' }, { label: 'Seven core archetypes', body: 'Home/discovery, directory, entity detail, chart edition, magazine index, article, admin/workbench.' }, { label: 'One-off rule', body: 'One-off pages are allowed only after proving no archetype fits.' }],
    implementationRules: ['Every route maps to an archetype.', 'Archetypes define components and payloads.', 'No local page design drift.'],
    specimens: [{ name: 'PageArchetypeMap', kind: 'pattern', description: 'Admin route-to-chapter parity map.' }], tables: [], qaChecks: ['Route mapped to archetype.', 'Payload defined.', 'Components reused.', 'No orphan design.']
  },
  {
    id: 'social-templates', number: '24', group: 'Reach', title: 'Social Templates', summary: 'Social and content-studio exports inherit the same tokens, logo safe zones, typography, and image rules.',
    adminSections: [{ label: 'Template inheritance', body: 'Templates are not separate brand worlds. They use the same foundations and component grammar.' }, { label: 'Export safety', body: 'Safe-zone guides must never export. Output must match canvas preview.' }, { label: 'Data-driven content', body: 'Templates consume tracks, artists, charts, releases, stories, and events from structured sources.' }],
    implementationRules: ['No raw social art drift.', 'Editable text/image layers.', 'Logo placement obeys safe zones.', 'No SVG output if unsupported by target workflow.'],
    specimens: [{ name: 'SocialTemplateCard', kind: 'component', description: 'Template preview for content studio/admin.' }], tables: [], qaChecks: ['Token inherited.', 'Logo safe.', 'Export clean.', 'Data source real.']
  },
  {
    id: 'commercial-surfaces', number: '25', group: 'Reach', title: 'Commercial Surfaces', summary: 'Sponsors, partners, reports, rate cards, and media kits must feel premium without compromising editorial credibility.',
    adminSections: [{ label: 'Commercial restraint', body: 'Prefer report cards, partner modules, and clearly labeled sponsored editorial over banner-like ad clutter.' }, { label: 'Credibility', body: 'Commercial surfaces must not visually overpower editorial or registry content.' }, { label: 'Products', body: 'Deck covers, slides, pitch docs, media kit, rate card, insight reports, partner modules.' }],
    implementationRules: ['Label commercial content clearly.', 'Keep sponsor chrome restrained.', 'Do not use generic ad placements as default.', 'Protect editorial hierarchy.'],
    specimens: [{ name: 'PartnerModule', kind: 'component', description: 'Commercial module with restraint.' }, { name: 'ReportCard', kind: 'component', description: 'Cultural intelligence/report preview.' }], tables: [], qaChecks: ['Clearly labeled.', 'Does not pollute editorial.', 'Premium not banner-like.']
  },
  {
    id: 'cultural-verticals', number: '26', group: 'Reach', title: 'Cultural Verticals', summary: 'Music is first proof. The system must also support Film, Fashion, Food, Language, Dance, Places, Intelligence, and Experiences.',
    adminSections: [{ label: 'Vertical strategy', body: 'Do not launch all verticals at once. Music proves the operating model, then adjacency expands organically.' }, { label: 'Vertical adapters', body: 'Each vertical config defines accent color, metadata vocabulary, hero treatment, card density, player/media adapter, and voice extension.' }, { label: 'Mission frame', body: 'WAKILISHA is cultural infrastructure for African creative life, beginning with music.' }],
    implementationRules: ['Do not hard-code music assumptions into universal components.', 'Each vertical gets one accent only.', 'Universal system remains unchanged as verticals expand.'],
    specimens: [{ name: 'VerticalConfigCard', kind: 'component', description: 'Admin configuration preview for vertical readiness.' }],
    tables: [{ title: 'Verticals', columns: ['Vertical','Scope'], rows: [['Music','Charts, artists, releases, labels, genres, editorial'],['Film','Cinema, documentaries, music videos, screen culture'],['Fashion','Textiles, designers, style, objects, visual identity'],['Food','Food culture, chefs, recipes, markets, memory'],['Language','Languages, lyrics, oral histories, preservation'],['Dance','Movement, crews, choreography, performance'],['Places','Cities, venues, neighborhoods, festivals'],['Intelligence','Reports, data, trends, research'],['Experiences','Events, pop-ups, exhibitions, travel']]}],
    qaChecks: ['Component not music-only unless named.', 'Accent used lightly.', 'Vertical metadata configurable.']
  },
  {
    id: 'internationalization', number: '27', group: 'Reach', title: 'Internationalization', summary: 'Support African languages, mixed-language editorial, and locale-aware formatting.',
    adminSections: [{ label: 'Language support', body: 'Pages set lang. Mixed language spans use language codes. Typography must preserve diacritics.' }, { label: 'Formatting', body: 'Dates, numbers, currencies, and units use Intl and page/user locale.' }, { label: 'Transcripts', body: 'Oral histories, interviews, and language content should support transcripts and source audio.' }],
    implementationRules: ['Do not assume English-only.', 'Do not hardcode US date/number formats.', 'Preserve source casing and diacritics.', 'Use content language metadata where available.'],
    specimens: [{ name: 'LocaleFormatPreview', kind: 'component', description: 'Admin preview for dates/numbers/lang spans.' }], tables: [], qaChecks: ['lang set.', 'Intl used.', 'Diacritics preserved.', 'Mixed language marked.']
  },
  {
    id: 'rights-attribution', number: '28', group: 'Reach', title: 'Rights & Attribution', summary: 'Source, credit, rights, methodology, and provenance must be visible enough to build trust.',
    adminSections: [{ label: 'Media credit', body: 'Images, videos, and artworks use attribution when available.' }, { label: 'Playback source', body: 'Provider/source context must remain visible.' }, { label: 'Charts methodology', body: 'Ranking surfaces need methodology/source/update context.' }, { label: 'Corrections', body: 'Editorial corrections should have consistent placement and history.' }],
    implementationRules: ['Never strip provider/source from playback.', 'Attribution is a module, not an afterthought.', 'No uncredited editorial media if credit exists.'],
    specimens: [{ name: 'AttributionBlock', kind: 'component', description: 'Source/credit/provenance module.' }], tables: [], qaChecks: ['Credit shown when available.', 'Provider shown.', 'Methodology linked.', 'Corrections supported.']
  },
  {
    id: 'tokens-map', number: '29', group: 'Implementation', title: 'Tokens · CSS variable + Tailwind map', summary: 'The complete token surface mirrors CSS variables into Tailwind and component code. Token names are canonical.',
    adminSections: [{ label: 'CSS variables', body: 'All tokens use --wk-* namespace and live in the global stylesheet. Dark/light modes are driven by data-wk-theme.' }, { label: 'Tailwind sketch', body: 'Tailwind should reference var(--wk-*) for colors, fonts, radius, spacing, shadows, transitions, and z-index.' }, { label: 'Contract', body: 'Hard-coded values are visual debt unless explicitly documented as media overlay exceptions.' }],
    implementationRules: ['Import wakilisha.tokens.css app-wide.', 'Map tokens into Tailwind if Tailwind is used.', 'Use data-wk-theme for theme switching.', 'Never duplicate token values locally.'],
    specimens: [{ name: 'TokenInspector', kind: 'token', description: 'Admin token browser for colors, type, spacing, radius, motion, widths.' }],
    tables: [{ title: 'Token groups', columns: ['Group','Examples'], rows: [['Surfaces','--wk-bg, --wk-surface, --wk-surface-raised'],['Text','--wk-text, --wk-text-soft, --wk-text-muted'],['Brand','--wk-brand, --wk-brand-soft, --wk-brand-on'],['Spacing','--wk-s-1 … --wk-s-32'],['Motion','--wk-d-fast, --wk-ease-standard'],['Player','--wk-player-dock-h, --wk-player-z-dock']]}],
    qaChecks: ['Tokens imported.', 'No hard-coded hex.', 'Theme switch via data attribute.', 'Tailwind maps to tokens.']
  },
  {
    id: 'component-inventory', number: '30', group: 'Implementation', title: 'Component Inventory', summary: 'All pages should use shared Wk components instead of local variants.',
    adminSections: [{ label: 'Primitive components', body: 'Button, IconButton, Tag, Surface, PageShell, PageHero, StateBlock, Modal, Sheet.' }, { label: 'Music components', body: 'TrackRow, ChartRow, ReleaseTrackRow, PlayerDock, PlayerSheet, PlayerTheater.' }, { label: 'Registry components', body: 'ArtistCard, ReleaseCard, LabelCard, GenreCard, RelationshipRail, EntityHeader.' }, { label: 'Editorial components', body: 'StoryCard, MagazineHero, ArticleBody, Pullquote, AttributionBlock.' }, { label: 'Admin components', body: 'AdminBar, AdminKpi, AdminTable, DesignChapterCard, TokenInspector, QA checklist.' }],
    implementationRules: ['Do not create duplicate local cards/rows/heroes.', 'Components must expose data-driven props and states.', 'Every component needs responsive and empty-state behavior.'],
    specimens: [{ name: 'ComponentWall', kind: 'component', description: 'Admin wall showing all component families and variants.' }],
    tables: [{ title: 'Component families', columns: ['Family','Components'], rows: [['Primitives','Button, IconButton, Tag, Surface, PageShell, Hero, StateBlock'],['Music','TrackRow, ChartRow, PlayerDock, PlayerSheet, ReleaseTrackRow'],['Registry','ArtistCard, ReleaseCard, LabelCard, GenreCard'],['Editorial','StoryCard, ArticleBody, MagazineHero'],['Admin','AdminBar, KPI, Table, DesignSystemBrowser']]}],
    qaChecks: ['Shared component used.', 'Variants documented.', 'Responsive state present.', 'No local duplicate.']
  },
  {
    id: 'figma-organization', number: '31', group: 'Implementation', title: 'Figma Organization', summary: 'Figma files mirror foundations, components, page archetypes, social templates, commercial surfaces, vertical files, and sandbox.',
    adminSections: [{ label: 'File structure', body: 'Foundations, Components, Page archetypes, Social templates, Commercial, Vertical/[name], Sandbox.' }, { label: 'Naming', body: 'Components use Wk/Card/Artist. Frames use archetype-resolution. Layers are semantic, not visual. Variants are lowercase hyphenated.' }, { label: 'Promotion', body: 'Sandbox experiments are non-canonical until promoted into a real file/component.' }],
    implementationRules: ['Figma and code names should align.', 'No orphan design frames.', 'Specimens map to component names.'],
    specimens: [{ name: 'FigmaLibraryMap', kind: 'pattern', description: 'Admin documentation of design-file organization.' }], tables: [], qaChecks: ['Naming aligned.', 'No orphan frames.', 'Sandbox not treated as canonical.']
  },
  {
    id: 'qa-checklist', number: '32', group: 'Implementation', title: 'QA Checklist', summary: 'Every page/component/vertical clears token, data, accessibility, responsiveness, copy, performance, and anti-slop checks before merge.',
    adminSections: [{ label: 'Token QA', body: 'No hardcoded hex, inline font-family, local radius/spacing values, or out-of-system shadows.' }, { label: 'Data QA', body: 'No mock data in production route. Payload uses repaired graph. Empty/partial states exist.' }, { label: 'Responsive QA', body: 'Mobile is intentionally designed; bottom nav/player coexist; horizontal scroll is used sparingly.' }, { label: 'Accessibility QA', body: 'Keyboard, focus, aria labels, touch targets, reduced motion, alt text, and heading order.' }, { label: 'Voice QA', body: 'No emoji, Oops, Awesome, vague CTAs, or sycophancy.' }],
    implementationRules: ['PRs must address every checklist category.', 'Failures need explicit rationale.', 'Screenshots required before declaring parity.'],
    specimens: [{ name: 'PageQAChecklist', kind: 'qa', description: 'Pass/fail checklist per route and component.' }],
    tables: [{ title: 'QA categories', columns: ['Category','Check'], rows: [['Tokens','No hardcoded styles'],['Data','Graph-backed, no mock production data'],['Responsive','Mobile designed intentionally'],['Accessibility','WCAG 2.2 AA floor'],['Voice','Specific and restrained'],['Performance','Budget respected'],['Anti-slop','No generic template behavior']]}],
    qaChecks: ['QA panel exists.', 'Route has screenshots.', 'Failures documented.', 'No mock data.']
  },
  {
    id: 'anti-slop-rules', number: '33', group: 'Implementation', title: 'Anti-Slop Rules', summary: 'Rules that prevent AI-template drift and generic React-app behavior.',
    adminSections: [{ label: 'Hard failures', body: 'Mock data, hard-coded content, non-token colors, fake movement/history, fake play buttons, generic CTAs, desktop-only layout, and pages without archetype mapping.' }, { label: 'Visual debt', body: 'SaaS gradients, bouncy hovers, card tilt, random purple, emoji copy, noisy animations, over-tagged cards.' }, { label: 'Data discipline', body: 'No public route may use fake entities or flat CSV thinking when repaired graph data exists.' }],
    implementationRules: ['Mock data automatically fails production QA.', 'Every public entity comes from repaired graph.', 'Page design must map to chapter/archetype.', 'No Readdy leftovers if they violate tokens.'],
    specimens: [{ name: 'AntiSlopGate', kind: 'qa', description: 'Automated/manual checklist for route readiness.' }], tables: [], qaChecks: ['No mock data.', 'No non-token styling.', 'No fake chart/player states.', 'Archetype mapped.']
  },
  {
    id: 'roadmap', number: '34', group: 'Implementation', title: 'Roadmap', summary: 'System adoption proceeds from tokens to admin bible to component foundation to graph payloads to page parity.',
    adminSections: [{ label: 'Phase 1', body: 'Tokens imported, admin design-system browser exists, theme toggle works.' }, { label: 'Phase 2', body: 'Shared components replace local page markup. Player ships all core surfaces.' }, { label: 'Phase 3', body: 'Vertical readiness proven by configuring a second vertical without rebuilding the system.' }],
    implementationRules: ['Do not redesign every page independently.', 'Design parity is system compliance plus product behavior parity.', 'When document and product disagree, revise openly.'],
    specimens: [{ name: 'RoadmapTimeline', kind: 'pattern', description: 'Admin progress tracker for migration/design-system adoption.' }], tables: [], qaChecks: ['Current phase visible.', 'Blockers documented.', 'System adoption measurable.']
  },
  {
    id: 'hero-sections', number: '35', group: 'React App UI', title: 'Hero Sections', summary: 'Hero sections are archetype-specific. A magazine hero, chart hero, entity hero, and directory hero do not share the same scale.',
    adminSections: [{ label: 'Hero anatomy', body: 'Eyebrow, title, subtitle/dek, actions, stats/metadata, background image/gradient/scrim.' }, { label: 'Scale by page', body: 'Magazine heroes breathe; directories are tighter; track/release heroes are content-first; admin heroes are compact.' }, { label: 'Legibility', body: 'Photography needs scrim; text contrast is non-negotiable.' }],
    implementationRules: ['Hero actions are graph-backed.', 'No fake hero stats.', 'Use PageHero variants, not bespoke markup.'],
    specimens: [{ name: 'PageHero', kind: 'component', description: 'Base hero.' }, { name: 'MagazineHero', kind: 'component', description: 'Editorial feature hero.' }, { name: 'ChartHero', kind: 'component', description: 'Charts edition/index hero.' }, { name: 'EntityHero', kind: 'component', description: 'Artist/track/release/label/genre hero.' }],
    tables: [], pageParity: ['/', '/charts', '/artists', '/tracks/:slug', '/releases/:slug', '/genres', '/labels', '/magazine'], qaChecks: ['Hero variant matches archetype.', 'Contrast passes.', 'Stats real.', 'Actions specific.']
  },
  {
    id: 'genre-directory', number: '36', group: 'React App UI', title: 'Genre Directory', summary: 'Genres are a discovery surface with counts, representative artists/tracks, and visual cards.',
    adminSections: [{ label: 'Directory', body: 'Genre cards show name, artist count, representative artists/tracks, and route.' }, { label: 'Genre page', body: 'Shows related artists, tracks, chart entries, editorial, and scene context when available.' }, { label: 'Imagery', body: 'Use deterministic/curated genre imagery; avoid unrelated permanent stock.' }],
    implementationRules: ['Data from artist_genres/entity relationships.', 'Counts must be real.', 'Genre detail uses graph-backed modules.'],
    specimens: [{ name: 'GenreCard', kind: 'component', description: 'Visual discovery card.' }, { name: 'GenreHeader', kind: 'component', description: 'Genre detail hero.' }], tables: [], pageParity: ['/genres','/genres/:slug'], qaChecks: ['Counts accurate.', 'Representative artists real.', 'Route valid.']
  },
  {
    id: 'artist-directory', number: '37', group: 'React App UI', title: 'Artist Directory', summary: 'Artists should feel culturally important, not like database rows.',
    adminSections: [{ label: 'Directory', body: 'Grid/list toggle, search, filters, alphabetic index, counts, genre tags, track/release/chart metadata.' }, { label: 'Artist cards', body: 'Image, name, genres, track count, release count, chart appearances, route.' }, { label: 'Artist page', body: 'Identity, media, genres, tracks, releases, chart appearances, related artists, editorial where available.' }],
    implementationRules: ['No mock artists.', 'Use entity_slugs + track_artists + artist_genres + relationships.', 'Full text index is secondary, not the emotional lead.'],
    specimens: [{ name: 'ArtistCard', kind: 'component', description: 'Image-led artist card.' }, { name: 'ArtistListItem', kind: 'component', description: 'Dense directory row.' }], tables: [], pageParity: ['/artists','/artists/:slug'], qaChecks: ['Artist data real.', 'Counts graph-backed.', 'Filters work.', 'Mobile intentional.']
  },
  {
    id: 'magazine-page', number: '38', group: 'React App UI', title: 'Magazine Page', summary: 'Magazine is an authored editorial surface, not a generic blog grid.',
    adminSections: [{ label: 'Index', body: 'Feature story, sections, asymmetric story grids, story cards, editorial metadata, related graph embeds.' }, { label: 'Classification', body: 'Only real editorial appears. App shells, utility pages, and route scaffolds are excluded.' }, { label: 'Voice', body: 'Story cards should carry WAKILISHA’s editorial voice and context.' }],
    implementationRules: ['Use content_route_classification.', 'Exclude non-editorial shells.', 'Feature story must be real.', 'Do not use stock editorial filler.'],
    specimens: [{ name: 'MagazineHero', kind: 'component', description: 'Feature story hero.' }, { name: 'StoryCard', kind: 'component', description: 'Profile/guide/feature card.' }], tables: [], pageParity: ['/magazine','/magazine/:slug'], qaChecks: ['Content classified.', 'Article routes real.', 'Byline/date handled.', 'No fake stories.']
  },
  {
    id: 'charts-edition', number: '39', group: 'React App UI', title: 'Charts Edition', summary: 'Chart editions are page-by-page signature screens with dense ranked rows and playable graph links.',
    adminSections: [{ label: 'Header', body: 'Series, edition, date/period, genre filter, stats, methodology.' }, { label: 'Rows', body: 'Rank, movement, artwork, title, artist, date, weeks, peak, label, play/expand.' }, { label: 'Footer', body: 'Relationship counts, methodology, previous/next chart, related charts.' }],
    implementationRules: ['Use chart-entry-track links.', 'Movement only if data exists.', 'Rows expandable.', 'Playback only when source exists.'],
    specimens: [{ name: 'ChartEditionPage', kind: 'page', description: 'Full chart edition archetype.' }, { name: 'ChartRowExpanded', kind: 'component', description: 'Expanded chart row.' }], tables: [], pageParity: ['/charts','/charts/:series','/charts/:series/:edition'], qaChecks: ['Ranks accurate.', 'Canonical links work.', 'No fake movement.', 'Play availability correct.']
  },
  {
    id: 'single-track', number: '40', group: 'React App UI', title: 'Single Track', summary: 'Single track pages show playback, artists, source, ISRC/provider, release relationships, chart appearances, and related content.',
    adminSections: [{ label: 'Hero', body: 'Artwork, chart status, title, artist, source/provider, ISRC, release date, label, peak/weeks when available.' }, { label: 'Playback', body: 'Preview/play action enabled only when track_playback_sources provides playable source.' }, { label: 'Graph modules', body: 'Featured artists, release links, chart history, related tracks, media/attribution.' }],
    implementationRules: ['No play button without playback.', 'ISRC/provider visible when available.', 'Artists link to canonical routes.', 'Chart/release relationships real.'],
    specimens: [{ name: 'TrackHero', kind: 'component', description: 'Single track hero.' }, { name: 'TrackWaveform', kind: 'component', description: 'Preview/player visual when active.' }], tables: [], pageParity: ['/tracks/:slug'], qaChecks: ['Playback source real.', 'Artists linked.', 'Release/chart relationships present or empty state.']
  },
  {
    id: 'single-album', number: '41', group: 'React App UI', title: 'Single Album', summary: 'Release pages show cover, type, artists, label, metadata, actions, and tracklist from release_tracks.',
    adminSections: [{ label: 'Album hero', body: 'Cover, type, title, artist, label, release year/date, track count, actions.' }, { label: 'Tracklist', body: 'Track numbers, title, featured artists, duration/play state when available.' }, { label: 'Related graph', body: 'Label, artists, related releases, charted tracks, source attribution.' }],
    implementationRules: ['Tracklist from release_tracks.', 'Duplicate/review states not flattened.', 'Modal/page patterns consistent.'],
    specimens: [{ name: 'ReleaseHero', kind: 'component', description: 'Single release header.' }, { name: 'AlbumTrackRow', kind: 'component', description: 'Tracklist row.' }], tables: [], pageParity: ['/releases','/releases/:slug'], qaChecks: ['Tracklist graph-backed.', 'Label linked.', 'Release state handled.', 'Cover/fallback correct.']
  },
  {
    id: 'album-modal', number: '42', group: 'React App UI', title: 'Album Modal', summary: 'Quick release preview without leaving context.',
    adminSections: [{ label: 'Modal anatomy', body: 'Cover, title, artist, tags, info grid, actions, tracklist preview, share/source.' }, { label: 'Focus', body: 'Trap focus, Escape close, restore focus. Sheet-like behavior on mobile.' }, { label: 'Consistency', body: 'Same release data and component language as full release page.' }],
    implementationRules: ['Modal is not a separate design language.', 'Focus management required.', 'Mobile uses sheet if appropriate.'],
    specimens: [{ name: 'ReleaseQuickView', kind: 'component', description: 'Album/release modal.' }], tables: [], qaChecks: ['Focus trapped.', 'Data same as release page.', 'Mobile sheet works.']
  },
  {
    id: 'labels-directory', number: '43', group: 'React App UI', title: 'Labels Directory', summary: 'Labels are an industry registry: releases, artists, chart activity, and metadata.',
    adminSections: [{ label: 'Directory', body: 'Label cards with logo/fallback, name, country/meta, artist/release counts, featured flag.' }, { label: 'Label page', body: 'Releases, artists, tracks, chart activity, related entities, attribution.' }],
    implementationRules: ['Use release_label and release relationships.', 'Label cards need more than name.', 'No plain list as final design.'],
    specimens: [{ name: 'LabelCard', kind: 'component', description: 'Industry registry card.' }, { name: 'LabelPage', kind: 'page', description: 'Label detail archetype.' }], tables: [], pageParity: ['/labels','/labels/:slug'], qaChecks: ['Counts real.', 'Releases linked.', 'Metadata/fallback handled.']
  },
  {
    id: 'article-post', number: '44', group: 'React App UI', title: 'Article / Post', summary: 'Article pages prioritize reading rhythm, credibility, related graph embeds, and attribution.',
    adminSections: [{ label: 'Header', body: 'Kicker, headline, dek, byline, date, hero, share/save actions.' }, { label: 'Body', body: 'Text width, paragraphs, pullquotes, images/captions, embeds, headings.' }, { label: 'Related graph', body: 'Embedded tracks, artists, releases, articles, or charts when relevant.' }],
    implementationRules: ['Use --wk-w-text for body.', 'Article body not overdecorated.', 'Byline/date/section visible where available.', 'Related embeds graph-backed.'],
    specimens: [{ name: 'ArticleBody', kind: 'component', description: 'Reading body.' }, { name: 'ArticleEmbed', kind: 'component', description: 'Track/artist/story embed inside editorial.' }], tables: [], pageParity: ['/magazine/:slug'], qaChecks: ['Reading width correct.', 'Hero/metadata present.', 'Related embeds real.']
  },
  {
    id: 'sharing-system', number: '45', group: 'React App UI', title: 'Sharing System', summary: 'Share sheets, timestamp sharing, OG previews, and platform destinations use consistent WAKILISHA grammar.',
    adminSections: [{ label: 'Share sheet', body: 'Preview, destination grid, copy link, timestamp toggle for playable media, and close behavior.' }, { label: 'OG card', body: 'Image, title, description, URL, entity type, and attribution/source where needed.' }, { label: 'Copy', body: 'Specific labels: Share track, Copy article link, Share from 01:24.' }],
    implementationRules: ['Share preview reflects actual entity.', 'Timestamp share only for playable media.', 'No generic link labels.'],
    specimens: [{ name: 'ShareSheet', kind: 'component', description: 'Universal share UI.' }, { name: 'OGCardPreview', kind: 'component', description: 'Open graph preview card.' }], tables: [], qaChecks: ['Preview real.', 'Destinations accessible.', 'Copy specific.', 'Timestamp valid.']
  },
  {
    id: 'iconography', number: '46', group: 'React App UI', title: 'Iconography', summary: 'Icons support meaning, never decorative clutter. Sizing, labels, and hit areas are standardized.',
    adminSections: [{ label: 'Sizes', body: '16px small UI, 20px default, 24px emphasis. Touch targets still 44px when interactive.' }, { label: 'Labels', body: 'Icon-only controls require aria-label. Decorative icons are aria-hidden.' }, { label: 'Use', body: 'Icons are semantic hints. Avoid filling cards with icons just to look designed.' }],
    implementationRules: ['Icon-only buttons labeled.', 'Consistent size system.', 'No decorative clutter.'],
    specimens: [{ name: 'IconCell', kind: 'component', description: 'Admin icon catalog cell.' }, { name: 'IconButton', kind: 'component', description: 'Accessible icon-only button.' }], tables: [], qaChecks: ['aria-label present.', 'Hit target ok.', 'Icon meaning clear.']
  },
  {
    id: 'dark-light-mode', number: '47', group: 'React App UI', title: 'Dark / Light Mode', summary: 'Both themes are first-class and driven by tokens, including logo variants and media overlays.',
    adminSections: [{ label: 'Theme switching', body: 'Use data-wk-theme. Tokens drive colors. No class piles or hard-coded dark surfaces.' }, { label: 'Logo', body: 'Logo variant changes with theme.' }, { label: 'Media overlays', body: 'Scrims must preserve readability in both modes.' }],
    implementationRules: ['No dark-only hardcoded text/backgrounds.', 'Theme provider required.', 'Test every page in both themes.'],
    specimens: [{ name: 'ThemeCompare', kind: 'component', description: 'Dark/light side-by-side specimen.' }, { name: 'ThemeToggle', kind: 'component', description: 'Accessible theme switch.' }], tables: [], qaChecks: ['Both themes pass contrast.', 'Logo correct.', 'No hard-coded dark classes.']
  },
  {
    id: 'user-profile', number: '48', group: 'React App UI', title: 'User Profile', summary: 'Profile surfaces support identity, follows, saves, collections, listening/editorial activity, and privacy states.',
    adminSections: [{ label: 'Profile anatomy', body: 'Cover, avatar, name/handle, bio, stats, actions, tabs.' }, { label: 'Scope', body: 'Do not overbuild a social network until product requires it.' }, { label: 'Privacy', body: 'Public/private states must be explicit.' }],
    implementationRules: ['Build after registry/chart/magazine parity unless auth requires earlier.', 'Respect privacy states.', 'Use same tokens as public pages.'],
    specimens: [{ name: 'ProfileHero', kind: 'component', description: 'User profile header.' }, { name: 'ProfileTabs', kind: 'component', description: 'Saves/follows/activity tabs.' }], tables: [], qaChecks: ['Privacy clear.', 'Stats real.', 'Responsive tabs.']
  },
  {
    id: 'settings-pages', number: '49', group: 'React App UI', title: 'Settings Pages', summary: 'Settings surfaces cover account, notifications, theme, privacy, and playback preferences with clear labels and descriptions.',
    adminSections: [{ label: 'Layout', body: 'Desktop sidebar/pane; mobile stacked nav.' }, { label: 'Rows', body: 'Each setting has label, description, control, and state.' }, { label: 'Danger zone', body: 'Visually distinct but restrained.' }],
    implementationRules: ['Every toggle has label and description.', 'Danger actions require confirmation.', 'No unlabeled controls.'],
    specimens: [{ name: 'SettingsLayout', kind: 'page', description: 'Settings sidebar/pane archetype.' }, { name: 'SettingsToggle', kind: 'component', description: 'Accessible toggle row.' }], tables: [], qaChecks: ['Labels/descriptions present.', 'Danger zone safe.', 'Mobile nav works.']
  },
  {
    id: 'admin-areas', number: '50', group: 'React App UI', title: 'Admin Areas', summary: 'Admin is an editorial/cultural operating system, including the living design bible.',
    adminSections: [{ label: 'Admin chrome', body: 'Admin bar, breadcrumb, current section, review/status indicators.' }, { label: 'KPI cards', body: 'Compact stats with labels, deltas, and state.' }, { label: 'Tables', body: 'Dense, accessible, sortable review/registry tables.' }, { label: 'Design system browser', body: 'Browse 54 chapters, search, filter, inspect tokens, preview specimens, see route parity and QA gates.' }],
    implementationRules: ['Admin uses same tokens as public UI.', 'Admin must not look like a detached CMS template.', 'Design system content must be structured data, not raw HTML iframe.'],
    specimens: [{ name: 'AdminBar', kind: 'component', description: 'Admin breadcrumb/status bar.' }, { name: 'DesignSystemBrowser', kind: 'page', description: 'Living design bible admin page.' }], tables: [], pageParity: ['/admin/design-system'], qaChecks: ['Chapter browser complete.', 'Search/filter works.', 'Token inspector works.', 'Theme toggle works.']
  },
  {
    id: 'notifications', number: '51', group: 'React App UI', title: 'Notifications', summary: 'Notifications are factual, restrained, and linked to exact entities/review items.',
    adminSections: [{ label: 'Panel', body: 'Header, mark all, item list, unread indicator, icon, text, time.' }, { label: 'Copy', body: 'Specific factual notices. No excitement copy.' }, { label: 'Review alerts', body: 'Admin alerts link to exact review item/entity.' }],
    implementationRules: ['Unread indicator subtle.', 'Notification copy specific.', 'No noisy banners by default.'],
    specimens: [{ name: 'NotificationPanel', kind: 'component', description: 'Notification dropdown/panel.' }], tables: [], qaChecks: ['Unread visible.', 'Links exact.', 'Copy restrained.']
  },
  {
    id: 'modals-overlays', number: '52', group: 'React App UI', title: 'Modals & Overlays', summary: 'Modals, sheets, drawers, and overlays have consistent motion, focus, and responsive behavior.',
    adminSections: [{ label: 'Modal', body: 'Desktop focus task with backdrop, focus trap, Escape, restore focus.' }, { label: 'Sheet', body: 'Mobile/contextual action from bottom, handle, safe scrolling.' }, { label: 'Drawer', body: 'Secondary navigation or filters when page context must remain visible.' }],
    implementationRules: ['Focus trap required.', 'Escape close unless destructive confirmation requires explicit choice.', 'Motion originates from trigger or dock.', 'Reduced motion supported.'],
    specimens: [{ name: 'Modal', kind: 'component', description: 'Accessible modal primitive.' }, { name: 'Sheet', kind: 'component', description: 'Bottom sheet primitive.' }, { name: 'Drawer', kind: 'component', description: 'Side drawer primitive.' }], tables: [], qaChecks: ['Focus trapped/restored.', 'Escape works.', 'Mobile safe.', 'Reduced motion works.']
  },
  {
    id: 'mobile-patterns', number: '53', group: 'React App UI', title: 'Mobile Patterns', summary: 'Mobile is intentionally designed, not collapsed desktop.',
    adminSections: [{ label: 'Mobile frame', body: 'Content needs its own hierarchy, not miniature desktop cards.' }, { label: 'Bottom nav', body: 'Coexists with player dock. Does not hide dismiss controls.' }, { label: 'Horizontal rows', body: 'Use sparingly for discovery, never as primary navigation crutch.' }, { label: 'Touch', body: '44px touch targets and sensible thumb zones.' }],
    implementationRules: ['Every page has mobile layout review.', 'Player + nav collision tested.', 'Filters/sheets designed for mobile.'],
    specimens: [{ name: 'MobileFrame', kind: 'pattern', description: 'Admin preview frame for mobile specimens.' }, { name: 'MobileBottomNav', kind: 'component', description: 'Player-aware mobile nav.' }], tables: [], qaChecks: ['Mobile not afterthought.', 'Player/nav no overlap.', 'Touch targets ok.', 'Horizontal scroll justified.']
  },
  {
    id: 'delight-animation', number: '54', group: 'React App UI', title: 'Delight & Animation', summary: 'Delight comes from meaningful playback waveforms, tactile transitions, reveal moments, and good state choreography—not noise.',
    adminSections: [{ label: 'Permitted delight', body: 'Active equalizer bars, shimmer skeletons, slide-up/scale-in overlays, one-time brand reveal, player transitions.' }, { label: 'Forbidden delight', body: 'Infinite decorative pulses, background gradient drift, card tilt, bounce hovers, fake animated counters.' }, { label: 'Reduced motion', body: 'All delight respects reduced-motion preferences.' }],
    implementationRules: ['Delight never blocks comprehension.', 'Audio animation only when active.', 'Loading animation communicates state.', 'No idle noise.'],
    specimens: [{ name: 'EqualizerBars', kind: 'motion', description: 'Active audio indicator.' }, { name: 'ShimmerSkeleton', kind: 'state', description: 'Loading skeleton.' }, { name: 'SlideUpReveal', kind: 'motion', description: 'Overlay entry.' }], tables: [], qaChecks: ['Delight purposeful.', 'Reduced motion works.', 'No idle decorative loops.']
  }
];

export const wkDesignSystemSpecById = Object.fromEntries(
  wkDesignSystemSpec.map((chapter) => [chapter.id, chapter])
) as Record<string, WkDesignChapterSpec>;

export const wkDesignSystemSpecByNumber = Object.fromEntries(
  wkDesignSystemSpec.map((chapter) => [chapter.number, chapter])
) as Record<string, WkDesignChapterSpec>;
