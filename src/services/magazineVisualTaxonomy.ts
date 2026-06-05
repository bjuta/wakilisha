export const MAGAZINE_VISUAL_FAMILIES = [
  'Field Record',
  'Map / Route / Migration',
  'Evidence / Dossier',
  'Signal / Data Intelligence',
  'Archive / Memory',
  'Scene / Atmosphere',
  'Object / Artifact',
  'Portrait Without Portraiture',
  'Language / Translation',
  'Sound / Frequency',
  'Time / Timeline',
  'Network / Constellation',
  'Place / City / Room',
  'Material / Texture',
  'Quote / Manifesto',
  'Commercial / Patronage',
] as const;

export const MAGAZINE_VISUAL_TYPES = [
  'sound_migration_field_record',
  'city_to_city_route',
  'scene_map',
  'venue_floor_energy',
  'festival_weather_record',
  'nightlife_capacity_trace',
  'artist_registry_constellation',
  'label_ownership_strip',
  'chart_power_index',
  'release_object_card',
  'listening_map',
  'sample_lineage_map',
  'genre_family_tree',
  'language_translation_sheet',
  'vernacular_phrase_poster',
  'lyric_fragment_poster',
  'evidence_board',
  'policy_dossier',
  'rights_flow_diagram',
  'funding_gap_receipt',
  'platform_algorithm_blackbox',
  'archive_file',
  'library_card',
  'memory_wall',
  'oral_history_waveform',
  'field_guide_route',
  'travel_itinerary_map',
  'biennale_pavilion_map',
  'food_origin_trace',
  'ingredient_field_note',
  'fashion_material_board',
  'textile_pattern_study',
  'garment_construction_diagram',
  'film_scene_board',
  'shot_list_grid',
  'poster_wall',
  'quote_only_poster',
  'one_sentence_full_page',
  'full_bleed_atmosphere',
  'abstract_crowd_light',
  'object_still_life',
  'patronage_surface',
  'sponsor_cultural_stamp',
  'back_matter_colophon_graphic',
] as const;

export const MAGAZINE_VISUAL_TREATMENTS = [
  'full-bleed',
  'diagrammatic',
  'typographic',
  'paper-file',
  'night-map',
  'light-table',
  'stamped-document',
  'annotated-photo',
  'abstract-gradient',
  'data-strip',
  'route-line',
  'constellation',
  'grid-system',
  'cutout-collage',
  'poster',
  'field-guide',
  'index-card',
  'receipt',
  'black-box-stage',
  'map-fragment',
] as const;

export const MAGAZINE_EDITORIAL_INTENTS = [
  'explain movement',
  'prove a claim',
  'create atmosphere',
  'slow the reader down',
  'mark a section break',
  'make a single sentence unforgettable',
  'visualize power',
  'show a network',
  'show a timeline',
  'make a place feel real',
  'turn a song/release into an object',
  'create a collectible poster moment',
  'make a sponsor page desirable',
] as const;

export const MAGAZINE_VISUAL_PALETTES = {
  music: { accent: '#84C241', background: '#080908', foreground: '#F2F1E8', contrast: 'dark' },
  conflict: { accent: '#D6766A', background: '#120B0A', foreground: '#F7F1EA', contrast: 'dark' },
  place: { accent: '#4FD9C2', background: '#071111', foreground: '#F2F1E8', contrast: 'dark' },
  language: { accent: '#6BA8F5', background: '#F8FAFF', foreground: '#0C0D0A', contrast: 'light' },
  memory: { accent: '#C7A06D', background: '#FFF8E8', foreground: '#0C0D0A', contrast: 'light' },
  systems: { accent: '#9C8FF5', background: '#070814', foreground: '#F2F1E8', contrast: 'dark' },
  food: { accent: '#E8A23A', background: '#FFF7E5', foreground: '#0C0D0A', contrast: 'light' },
  art: { accent: '#D85AAB', background: '#120913', foreground: '#F2F1E8', contrast: 'dark' },
  neutral: { accent: '#84C241', background: '#F2F1E8', foreground: '#0C0D0A', contrast: 'light' },
} as const;

export type MagazineVisualFamily = typeof MAGAZINE_VISUAL_FAMILIES[number];
export type MagazineVisualType = typeof MAGAZINE_VISUAL_TYPES[number];
export type MagazineVisualTreatment = typeof MAGAZINE_VISUAL_TREATMENTS[number];
export type MagazineEditorialIntent = typeof MAGAZINE_EDITORIAL_INTENTS[number];
export type MagazineVisualPaletteKey = keyof typeof MAGAZINE_VISUAL_PALETTES;

export function paletteForSection(section?: string): MagazineVisualPaletteKey {
  const value = (section ?? '').toLowerCase();
  if (/sound|music|record|song|release|album|chart/.test(value)) return 'music';
  if (/conflict|form|film|image|visual/.test(value)) return 'conflict';
  if (/scene|place|city|room|guide|field|travel/.test(value)) return 'place';
  if (/language|translation|lyric|vernacular/.test(value)) return 'language';
  if (/book|memory|archive|oral|library/.test(value)) return 'memory';
  if (/system|future|rights|copyright|platform|policy/.test(value)) return 'systems';
  if (/food|ingredient|source/.test(value)) return 'food';
  if (/art|fashion|textile|material/.test(value)) return 'art';
  return 'neutral';
}
