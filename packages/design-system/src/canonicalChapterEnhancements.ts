import type { WkCanonicalChapterEnhancement } from './designSystemSpecTypes';

const chapterGroups: Record<string, WkCanonicalChapterEnhancement['group']> = {
  '01':'Foundations','02':'Foundations','03':'Foundations','04':'Foundations','05':'Foundations','06':'Foundations','07':'Foundations','08':'Foundations','09':'Foundations',
  '10':'Product','11':'Product','12':'Product','13':'Product','14':'Product','15':'Product','16':'Product','17':'Product','18':'Product',
  '19':'Media & Editorial','20':'Media & Editorial','21':'Media & Editorial','22':'Media & Editorial','23':'Media & Editorial',
  '24':'Reach','25':'Reach','26':'Reach','27':'Reach','28':'Reach',
  '29':'Implementation','30':'Implementation','31':'Implementation','32':'Implementation','33':'Implementation','34':'Implementation',
  '35':'React App UI','36':'React App UI','37':'React App UI','38':'React App UI','39':'React App UI','40':'React App UI','41':'React App UI','42':'React App UI','43':'React App UI','44':'React App UI','45':'React App UI','46':'React App UI','47':'React App UI','48':'React App UI','49':'React App UI','50':'React App UI','51':'React App UI','52':'React App UI','53':'React App UI','54':'React App UI'
};

const chapterTitles: Record<string, string> = {
  '01':'North Star','02':'Brand architecture','03':'Logo','04':'Color','05':'Typography','06':'Spacing & layout','07':'Motion','08':'Voice','09':'Accessibility','10':'Navigation','11':'Buttons & actions','12':'Forms','13':'Cards & surfaces','14':'Tags & badges','15':'Track & entity rows','16':'Player system','17':'Search & discovery','18':'States','19':'Image system','20':'Editorial articles','21':'Charts & rankings','22':'Registry','23':'Page archetypes','24':'Social templates','25':'Commercial surfaces','26':'Cultural verticals','27':'Internationalization','28':'Rights & attribution','29':'Tokens','30':'Component inventory','31':'Figma organization','32':'QA checklist','33':'Anti-slop rules','34':'Roadmap','35':'Hero sections','36':'Genre directory','37':'Artist directory','38':'Magazine page','39':'Charts edition','40':'Single track','41':'Single album','42':'Album modal','43':'Labels directory','44':'Article / post','45':'Sharing system','46':'Iconography','47':'Dark / light mode','48':'User profile','49':'Settings pages','50':'Admin areas','51':'Notifications','52':'Modals & overlays','53':'Mobile patterns','54':'Delight & animation'
};

const canonicalSubsections: Record<string, string[]> = {
  '01':['Five creative principles'],
  '02':['The hierarchy','What stays universal, what flexes per vertical'],
  '03':['Primary lockups','Size scale','Safe zone','Placement context','Incorrect usage','Animated & morphing use'],
  '04':['Surfaces · dark mode','Brand & status','Vertical accents','Contrast & accessibility','Color use rules'],
  '05':['Type stack','Editorial scale','UI scale','Responsive scale','Casing rules','Fallback chain'],
  '06':['Spacing scale','Radius scale','Container max-widths','Breakpoints','Hero padding rules'],
  '07':['Duration scale','Easing curves','Motion principles','Player motion preview'],
  '08':['Tone','Do / don’t pairs','Microcopy patterns'],
  '09':['Floor requirements','Language & oral history provisions','Bandwidth & performance'],
  '10':['Specification','Brand region','Links region','Tools region','Mobile behavior'],
  '11':['Button taxonomy','Primary / ghost / soft / danger','Icon buttons','Action hierarchy','Hover and disabled states'],
  '12':['Input anatomy','Search behavior','Filter builder','Validation states','Admin relationship forms'],
  '13':['Surface levels','Card anatomy','Hover / lift behavior','Media cards','Dense data surfaces'],
  '14':['Tag taxonomy','Status badges','Chart movement badges','Metadata pills'],
  '15':['Track row anatomy','Entity row anatomy','Expandable row behavior','Dense mobile rows'],
  '16':['Dock player','Nav capsule','Expanded sheet','Theater mode','Queue and source attribution'],
  '17':['Global search','Directory discovery','Result grouping','Graph-aware recommendations'],
  '18':['Loading states','Empty states','Error states','Partial graph states','No-playback states'],
  '19':['Image roles','Scrims','Fallbacks','Attribution','Performance rules'],
  '20':['Article anatomy','Reading width','Pullquotes and embeds','Related graph modules'],
  '21':['Chart header','Ranked rows','Movement and history','Methodology','Chart visuals'],
  '22':['Entity graph','Relationship modules','Review handling','Canonical routes'],
  '23':['Archetype pattern','Core archetypes','One-off page rule','Route mapping'],
  '24':['Template inheritance','Safe zones','Export behavior','Data-driven template blocks'],
  '25':['Commercial restraint','Sponsor modules','Reports and media kits','Editorial credibility'],
  '26':['Vertical strategy','Vertical adapters','Mission frame','Accent governance'],
  '27':['Language support','Locale formatting','Transcripts','Mixed-language content'],
  '28':['Media credit','Playback source','Charts methodology','Corrections'],
  '29':['CSS variables','Tailwind map','Theme contract','Token enforcement'],
  '30':['Primitive components','Music components','Registry components','Editorial components','Admin components'],
  '31':['File structure','Naming','Promotion rules','Implementation status'],
  '32':['Token QA','Data QA','Responsive QA','Accessibility QA','Voice QA'],
  '33':['Hard failures','Visual debt','Data discipline','Anti-template checks'],
  '34':['Phase 1','Phase 2','Phase 3','Adoption gates'],
  '35':['Hero anatomy','Scale by page','Legibility','Hero variants'],
  '36':['Directory','Genre page','Imagery','Counts'],
  '37':['Directory','Artist cards','Artist page','Index modes'],
  '38':['Index','Classification','Voice','Editorial grids'],
  '39':['Header','Rows','Footer','Edition behavior'],
  '40':['Hero','Playback','Graph modules','Attribution'],
  '41':['Album hero','Tracklist','Related graph','Release states'],
  '42':['Modal anatomy','Focus','Consistency','Mobile sheet behavior'],
  '43':['Directory','Label page','Industry registry metadata'],
  '44':['Header','Body','Related graph','Credibility markers'],
  '45':['Share sheet','OG card','Copy','Timestamp sharing'],
  '46':['Sizes','Labels','Use','Icon catalog'],
  '47':['Theme switching','Logo','Media overlays','Theme comparison'],
  '48':['Profile anatomy','Scope','Privacy','Activity tabs'],
  '49':['Layout','Rows','Danger zone','Preference controls'],
  '50':['Admin bar','Dashboard KPIs','Content table','Admin sections','Design system browser'],
  '51':['Notification types','Panel behavior','Unread indicators','Review alerts'],
  '52':['Overlay taxonomy','Modal surface rules','Confirmation dialog','Sheet/drawer behavior'],
  '53':['Bottom navigation','Mobile-specific rules','Player coexistence','Thumb zones'],
  '54':['Equalizer bars','Loading skeletons','Interaction microanimations','Brand green pulse','Delight principles']
};

type RichSeed = { id: string; label: string; count?: number };
const richMediaByChapter: Record<string, RichSeed[]> = {
  '01':[{id:'north-star-checklist',label:'North-star rule card / checklist'}],
  '02':[{id:'brand-hierarchy-table',label:'Brand architecture hierarchy table'},{id:'vertical-flex-map',label:'Universal vs vertical-flex visual map'}],
  '03':[{id:'logo-spec',label:'Logo variant, size, placement and safe-zone specimen',count:9},{id:'logo-safe-zone',label:'Hatched safe-zone depiction'},{id:'logo-reveal-motion',label:'Mask-wipe + bolt snap animation'}],
  '04':[{id:'swatch-row',label:'Dark/light color token swatch grid',count:16},{id:'v-tile',label:'Vertical accent tiles',count:8},{id:'contrast-table',label:'Contrast and accessibility matrix'}],
  '05':[{id:'type-row',label:'Typography scale specimen',count:9},{id:'responsive-type-clamp',label:'Clamp scale code specimen'}],
  '06':[{id:'spacing-ruler',label:'4-based spacing ruler'},{id:'radius-strip',label:'Radius scale shape strip'},{id:'container-width-map',label:'Container width diagram'}],
  '07':[{id:'duration-timeline',label:'Motion duration timeline'},{id:'easing-curve-board',label:'Easing curve board'},{id:'sheet-slide-wireframe',label:'Sheet slide wireframe animation'},{id:'reduced-motion-toggle',label:'Reduced motion comparison'}],
  '08':[{id:'do-dont-copy-cards',label:'Do/don’t microcopy cards',count:6},{id:'microcopy-pattern-table',label:'Microcopy pattern table'}],
  '09':[{id:'a11y-floor-table',label:'Accessibility floor matrix'},{id:'language-audio-provision',label:'Language/oral-history provision card'},{id:'performance-budget-table',label:'Bandwidth and performance table'}],
  '10':[{id:'nav-layout-wireframe',label:'Public/admin/mobile navigation wireframe'},{id:'player-nav-capsule',label:'Player-aware nav capsule'}],
  '11':[{id:'button-state-board',label:'Button hover/lift state board'},{id:'action-hierarchy-map',label:'Primary/secondary/destructive action map'}],
  '12':[{id:'form-field-anatomy',label:'Visible-label form field anatomy'},{id:'filter-builder',label:'Filter builder specimen'}],
  '13':[{id:'surface-elevation-board',label:'Surface elevation comparison'},{id:'card-hover-lift',label:'Hover lift visual depiction'},{id:'entity-card-specimen',label:'Data-rich entity card'}],
  '14':[{id:'tag-badge-board',label:'Tag/status/movement badge board'}],
  '15':[{id:'track-row-specimen',label:'Dense track row specimen'},{id:'expanded-row-wireframe',label:'Expandable row behavior depiction'}],
  '16':[{id:'player-dock-specimen',label:'Persistent player dock'},{id:'player-sheet-specimen',label:'Expanded player sheet'},{id:'player-theater-specimen',label:'Theater mode'},{id:'dock-to-sheet-morph',label:'Dock-to-sheet morph animation'}],
  '17':[{id:'search-result-stack',label:'Graph-aware search results'},{id:'discovery-rail',label:'Related discovery rail'}],
  '18':[{id:'state-block-board',label:'Loading/empty/error/partial/no-playback states'},{id:'skeleton-animation-board',label:'Skeleton shimmer'}],
  '19':[{id:'image-role-board',label:'Image role board'},{id:'hero-scrim-specimen',label:'Legibility scrim depiction'},{id:'fallback-art-system',label:'Entity-aware fallback art'}],
  '20':[{id:'article-anatomy',label:'Article anatomy diagram'},{id:'article-body-board',label:'Reading body specimen'},{id:'related-graph-embed',label:'Related entity embed'}],
  '21':[{id:'chart-row-specimen',label:'Ranked chart row'},{id:'chart-history-visual',label:'Chart movement/history visual'},{id:'methodology-card',label:'Methodology card'}],
  '22':[{id:'registry-graph-map',label:'Artist→track→release→label→genre graph map'},{id:'relationship-rail',label:'Relationship module specimen'}],
  '23':[{id:'page-archetype-map',label:'Route-to-archetype map'},{id:'page-anatomy-wireframe',label:'Data contract → hero → modules wireframe'}],
  '24':[{id:'social-template-safe-zone',label:'Social template safe-zone depiction'},{id:'export-preview-parity',label:'Export preview parity check'}],
  '25':[{id:'partner-module',label:'Sponsor/partner module specimen'},{id:'report-card',label:'Commercial report card'}],
  '26':[{id:'vertical-config-card',label:'Vertical configuration card'},{id:'accent-governance-grid',label:'Accent governance grid'}],
  '27':[{id:'locale-preview',label:'Locale/date/number formatting preview'},{id:'mixed-language-specimen',label:'Mixed-language text specimen'}],
  '28':[{id:'attribution-block',label:'Rights/provenance attribution block'},{id:'methodology-link-card',label:'Methodology/correction placement'}],
  '29':[{id:'token-inspector',label:'Token inspector'},{id:'tailwind-token-map',label:'Tailwind/CSS variable map'}],
  '30':[{id:'component-wall',label:'Full component inventory wall'}],
  '31':[{id:'figma-library-map',label:'Figma file/library organization map'}],
  '32':[{id:'page-qa-checklist',label:'Page QA checklist matrix'}],
  '33':[{id:'anti-slop-gate',label:'Anti-slop hard-fail checklist'}],
  '34':[{id:'roadmap-timeline',label:'Design-system adoption roadmap'}],
  '35':[{id:'page-hero-board',label:'Hero variants board'}],
  '36':[{id:'genre-card-board',label:'Genre card media grid'}],
  '37':[{id:'artist-card-board',label:'Artist card/list/index specimens'}],
  '38':[{id:'magazine-hero-board',label:'Magazine feature hero'},{id:'story-card-board',label:'Asymmetric story grid'}],
  '39':[{id:'chart-edition-page',label:'Chart edition page specimen'},{id:'chart-row-expanded',label:'Expanded chart row'}],
  '40':[{id:'track-hero-board',label:'Single track hero'},{id:'waveform-board',label:'Waveform/playback visual'}],
  '41':[{id:'release-hero-board',label:'Release hero'},{id:'release-tracklist-board',label:'Release tracklist'}],
  '42':[{id:'modal-overlay-board',label:'Album modal overlay'}],
  '43':[{id:'label-card-board',label:'Label card grid'}],
  '44':[{id:'article-hero-board',label:'Article hero'},{id:'article-body-board',label:'Article body'}],
  '45':[{id:'share-sheet-board',label:'Share sheet'},{id:'og-preview-board',label:'Open graph preview'}],
  '46':[{id:'icon-catalog-board',label:'Icon catalog and size board'}],
  '47':[{id:'theme-compare-board',label:'Dark/light comparison board'}],
  '48':[{id:'profile-hero-board',label:'User profile hero'}],
  '49':[{id:'settings-layout-board',label:'Settings layout'}],
  '50':[{id:'admin-bar-board',label:'Admin bar'},{id:'admin-kpi-board',label:'Admin KPI grid'},{id:'admin-table-board',label:'Admin table'},{id:'design-system-browser',label:'Living design bible browser'}],
  '51':[{id:'notification-panel-board',label:'Notification panel'}],
  '52':[{id:'overlay-taxonomy-board',label:'Modal/sheet/drawer taxonomy'}],
  '53':[{id:'mobile-frame-board',label:'Mobile frame and bottom nav'}],
  '54':[{id:'equalizer-animation-board',label:'Active equalizer animation'},{id:'skeleton-animation-board',label:'Loading skeleton shimmer'},{id:'brand-pulse-once',label:'One-shot brand pulse'},{id:'slide-up-reveal',label:'Slide-up reveal animation'}]
};

const canonicalMetrics: Record<string, Omit<WkCanonicalChapterEnhancement['canonicalMetrics'], 'visualSpecimens'>> = {
  '01':{subsections:1,tables:0,codeBlocks:0,callouts:1,doDontCards:0},'02':{subsections:2,tables:1,codeBlocks:0,callouts:1,doDontCards:0},'03':{subsections:6,tables:0,codeBlocks:0,callouts:1,doDontCards:2},'04':{subsections:5,tables:1,codeBlocks:0,callouts:1,doDontCards:2},'05':{subsections:6,tables:2,codeBlocks:3,callouts:1,doDontCards:0},'06':{subsections:5,tables:5,codeBlocks:0,callouts:1,doDontCards:0},'07':{subsections:4,tables:2,codeBlocks:0,callouts:1,doDontCards:0},'08':{subsections:3,tables:2,codeBlocks:0,callouts:1,doDontCards:6},'09':{subsections:3,tables:2,codeBlocks:0,callouts:0,doDontCards:0}
};

const makeRich = (seed: RichSeed[]) => seed.map((item) => ({
  id: item.id,
  label: item.label,
  kind: item.id.includes('animation') || item.id.includes('motion') || item.id.includes('morph') || item.id.includes('pulse') || item.id.includes('shimmer') || item.id.includes('slide') ? 'animation' as const : item.id.includes('token') || item.id.includes('swatch') || item.id.includes('theme') || item.id.includes('spacing') || item.id.includes('color') ? 'token' as const : item.id.includes('page') || item.id.includes('hero') || item.id.includes('layout') ? 'page' as const : 'component' as const,
  canonicalClass: item.id,
  count: item.count ?? 1,
  implementation: 'Render as a live React specimen in /admin/design-system, with visual depiction and interactive state where applicable.'
}));

export const canonicalChapterEnhancements: WkCanonicalChapterEnhancement[] = Object.keys(chapterTitles).map((number) => {
  const richMedia = makeRich(richMediaByChapter[number] ?? [{ id: 'rule-card', label: 'Structured rule/checklist board' }]);
  const base = canonicalMetrics[number] ?? {
    subsections: canonicalSubsections[number]?.length ?? 0,
    tables: 1,
    codeBlocks: 0,
    callouts: number === '54' ? 1 : 0,
    doDontCards: ['52','54'].includes(number) ? 2 : 0,
  };
  return {
    number,
    canonicalAnchor: `ch-${number}`,
    group: chapterGroups[number],
    title: chapterTitles[number],
    canonicalDescription: `Canonical chapter ${number} from wakilisha-design-system-v5.html. Render its complete specification, visual specimens, data tables, and QA checks inside the admin design-system browser.`,
    canonicalSubsections: canonicalSubsections[number] ?? [],
    richMedia,
    canonicalMetrics: { ...base, visualSpecimens: richMedia.length },
    parityInstruction: `Chapter ${number} must render canonical sections, rich media/specimens, tables or callouts where present, and page/component QA checks. Do not reduce it to a short summary.`
  };
});

export const canonicalChapterEnhancementByNumber = Object.fromEntries(canonicalChapterEnhancements.map((chapter) => [chapter.number, chapter])) as Record<string, WkCanonicalChapterEnhancement>;

export const canonicalChapterEnhancementByAnchor = Object.fromEntries(canonicalChapterEnhancements.map((chapter) => [chapter.canonicalAnchor, chapter])) as Record<string, WkCanonicalChapterEnhancement>;
