export type MigrationWizardStepId = 'welcome' | 'source' | 'scan' | 'map' | 'media' | 'review' | 'run' | 'verify';
export type MigrationSourceMode = 'zip_upload' | 'wordpress_connection' | 'database_connection' | 'rest_api' | 'wp_cli_export';
export type MigrationAuthState = 'not_started' | 'needs_auth' | 'approved' | 'failed';
export type MigrationMappingStatus = 'auto_matched' | 'needs_review' | 'ignored';

export type MigrationWizardFieldMap = { id: string; sourceEntity: string; sourceField: string; targetEntity: string; targetField: string; status: MigrationMappingStatus; confidence: number; example?: string; help: string; };
export type MigrationWizardChecklistItem = { id: string; label: string; description: string; status: 'pending' | 'done' | 'warning' | 'blocked'; };
export type MigrationWizardStep = { id: MigrationWizardStepId; label: string; childLabel: string; title: string; description: string; actionLabel: string; };
export type MigrationSourceFile = { name: string; size: number; type: string; lastModified: number; addedAt: string; };
export type MigrationScanResult = { status: 'not_started' | 'ready' | 'scanning' | 'complete' | 'warning'; summary: string; counts: Record<string, number>; warnings: string[]; detected: string[]; generatedAt?: string; };
export type MigrationRunEvent = { id: string; label: string; description: string; status: 'pending' | 'running' | 'done' | 'warning' | 'failed'; timestamp?: string; };
export type MigrationWizardSession = { id: string; name: string; createdAt: string; updatedAt: string; activeStep: MigrationWizardStepId; state: MigrationWizardState; };

export type MigrationWizardState = {
  sourceMode: MigrationSourceMode;
  authState: MigrationAuthState;
  approvedSteps: MigrationWizardStepId[];
  mappings: MigrationWizardFieldMap[];
  checklist: MigrationWizardChecklistItem[];
  sourceFile?: MigrationSourceFile;
  scanResult: MigrationScanResult;
  runEvents: MigrationRunEvent[];
};

export const MIGRATION_WIZARD_STEPS: MigrationWizardStep[] = [
  { id: 'welcome', label: 'Start', childLabel: 'Say hello', title: 'We will move your WordPress site into React safely.', description: 'The wizard asks one simple question at a time. Nothing touches the live site until you approve the final run.', actionLabel: 'Start migration' },
  { id: 'source', label: 'Connect', childLabel: 'Where is WordPress?', title: 'Choose how we should read the old WordPress site.', description: 'Upload the existing ZIP today. Later, this same wizard will support direct WordPress login, REST API, database and WP-CLI exports.', actionLabel: 'Use this source' },
  { id: 'scan', label: 'Look', childLabel: 'What did we find?', title: 'We scan the source and explain what is inside.', description: 'The system groups posts, pages, media, authors, categories, tags, custom post types, ACF fields and relationships before asking you to map anything.', actionLabel: 'Approve scan' },
  { id: 'map', label: 'Match', childLabel: 'This goes there', title: 'Match WordPress data to the React data model.', description: 'Most fields are auto-matched. Anything uncertain is shown in plain language with examples so a non-technical user can approve or change it.', actionLabel: 'Approve mapping' },
  { id: 'media', label: 'Pictures', childLabel: 'Bring images over', title: 'Check images, files and missing media.', description: 'The wizard checks featured images, inline images, audio, embeds, artist photos and fallback images before migration.', actionLabel: 'Approve media plan' },
  { id: 'review', label: 'Review', childLabel: 'Check before moving', title: 'Review the safe migration plan.', description: 'You see what will be created, skipped, merged, redirected and held for review. Production is still untouched.', actionLabel: 'Approve plan' },
  { id: 'run', label: 'Move', childLabel: 'Press the big button', title: 'Run the migration in stages.', description: 'The wizard stages data first, validates counts, then promotes only after approval. Failed records stay in a review queue.', actionLabel: 'Run staged migration' },
  { id: 'verify', label: 'Check', childLabel: 'Did it work?', title: 'Verify the React site after migration.', description: 'The wizard checks counts, sample pages, images, redirects, search, slugs and relationships so you can trust the move.', actionLabel: 'Finish' },
];

export const MIGRATION_SOURCE_OPTIONS: Array<{ id: MigrationSourceMode; title: string; description: string; available: boolean; badge: string }> = [
  { id: 'zip_upload', title: 'Upload WordPress export ZIP', description: 'Use the current ZIP import flow. Best for immediate migrations.', available: true, badge: 'Ready now' },
  { id: 'wordpress_connection', title: 'Log in to WordPress', description: 'Authenticate to a WordPress admin and let the wizard read content through approved access.', available: false, badge: 'Next' },
  { id: 'rest_api', title: 'Use WordPress REST API', description: 'Connect to a public or authenticated WordPress REST API source.', available: false, badge: 'Planned' },
  { id: 'database_connection', title: 'Connect database', description: 'Use database credentials for large professional migrations.', available: false, badge: 'Planned' },
  { id: 'wp_cli_export', title: 'Use WP-CLI export', description: 'Generate a clean export from a server terminal when admin upload is too slow.', available: false, badge: 'Planned' },
];

export const DEFAULT_FIELD_MAPPINGS: MigrationWizardFieldMap[] = [
  { id: 'post-title', sourceEntity: 'wp_posts', sourceField: 'post_title', targetEntity: 'articles', targetField: 'title', status: 'auto_matched', confidence: 0.99, example: 'Why Nairobi nightlife matters', help: 'The WordPress title becomes the React article title.' },
  { id: 'post-content', sourceEntity: 'wp_posts', sourceField: 'post_content', targetEntity: 'articles', targetField: 'body', status: 'auto_matched', confidence: 0.96, example: '<p>Story body...</p>', help: 'The main WordPress body becomes cleaned article body content.' },
  { id: 'post-excerpt', sourceEntity: 'wp_posts', sourceField: 'post_excerpt', targetEntity: 'articles', targetField: 'dek', status: 'auto_matched', confidence: 0.9, example: 'A short intro line', help: 'The excerpt becomes the editorial dek/subtitle.' },
  { id: 'featured-image', sourceEntity: 'wp_postmeta', sourceField: '_thumbnail_id', targetEntity: 'media_assets', targetField: 'hero_url', status: 'auto_matched', confidence: 0.87, example: 'attachment: 1234', help: 'Featured images become hero images and are also stored as media assets.' },
  { id: 'author', sourceEntity: 'wp_users', sourceField: 'display_name', targetEntity: 'authors', targetField: 'name', status: 'auto_matched', confidence: 0.86, example: 'Muiruri Beautah', help: 'WordPress authors become React author profiles.' },
  { id: 'categories', sourceEntity: 'wp_terms', sourceField: 'category', targetEntity: 'taxonomy', targetField: 'categories', status: 'auto_matched', confidence: 0.84, example: 'Music, Guides', help: 'Categories become high-level editorial taxonomy.' },
  { id: 'tags', sourceEntity: 'wp_terms', sourceField: 'post_tag', targetEntity: 'taxonomy', targetField: 'tags', status: 'auto_matched', confidence: 0.82, example: 'Nairobi, Afrohouse', help: 'Tags remain flexible metadata and discovery signals.' },
  { id: 'acf-fields', sourceEntity: 'wp_postmeta', sourceField: 'acf_*', targetEntity: 'custom_fields', targetField: 'structured_metadata', status: 'needs_review', confidence: 0.62, example: 'artist_name, release_date', help: 'ACF fields need review because every WordPress site names them differently.' },
  { id: 'custom-post-types', sourceEntity: 'wp_posts', sourceField: 'post_type', targetEntity: 'registry_entities', targetField: 'entity_type', status: 'needs_review', confidence: 0.58, example: 'wk_track, wk_artist', help: 'Custom post types should map to the right React registry entities.' },
];

export const DEFAULT_MIGRATION_CHECKLIST: MigrationWizardChecklistItem[] = [
  { id: 'source', label: 'Source selected', description: 'A WordPress ZIP or connection method has been chosen.', status: 'pending' },
  { id: 'auth', label: 'Access approved', description: 'User has approved access to the WordPress source.', status: 'pending' },
  { id: 'scan', label: 'Content scanned', description: 'Posts, pages, media and custom data are counted.', status: 'pending' },
  { id: 'mapping', label: 'Fields mapped', description: 'Every important WordPress field has a React destination.', status: 'warning' },
  { id: 'media', label: 'Media checked', description: 'Images and files have a migration/fallback plan.', status: 'pending' },
  { id: 'redirects', label: 'Redirects planned', description: 'Old WordPress URLs have React destinations or 301 rules.', status: 'pending' },
  { id: 'promotion', label: 'Safe promotion', description: 'Migration will stage before promoting to production.', status: 'pending' },
];

const DEFAULT_SCAN: MigrationScanResult = { status: 'not_started', summary: 'No WordPress source has been scanned yet.', counts: {}, warnings: [], detected: [] };
const DEFAULT_RUN_EVENTS: MigrationRunEvent[] = [
  { id: 'stage', label: 'Create staging run', description: 'Prepare a safe staging area for migrated records.', status: 'pending' },
  { id: 'import', label: 'Import batches', description: 'Move content in batches with failure isolation.', status: 'pending' },
  { id: 'validate', label: 'Validate counts', description: 'Compare imported counts with the source scan.', status: 'pending' },
  { id: 'promote', label: 'Promote approved records', description: 'Publish only records that passed validation.', status: 'pending' },
  { id: 'redirects', label: 'Generate redirects', description: 'Create old-to-new URL rules.', status: 'pending' },
];

export function defaultMigrationWizardState(): MigrationWizardState {
  return { sourceMode: 'zip_upload', authState: 'not_started', approvedSteps: ['welcome'], mappings: DEFAULT_FIELD_MAPPINGS, checklist: DEFAULT_MIGRATION_CHECKLIST, scanResult: DEFAULT_SCAN, runEvents: DEFAULT_RUN_EVENTS };
}

export function simulateZipScan(file?: MigrationSourceFile): MigrationScanResult {
  if (!file) return DEFAULT_SCAN;
  const mb = Math.max(1, Math.round(file.size / 1024 / 1024));
  const hasSupabase = /supabase|import|export|wakilisha/i.test(file.name);
  const hasZip = /\.zip$/i.test(file.name);
  const multiplier = Math.max(1, Math.min(8, Math.round(mb / 20)));
  const counts = { articles: 80 * multiplier + (hasSupabase ? 120 : 0), media: 420 * multiplier + (hasSupabase ? 900 : 0), authors: 12 * multiplier, taxonomy: 45 * multiplier, customPostTypes: hasSupabase ? 8 : 3, relationships: 900 * multiplier + (hasSupabase ? 4200 : 0) };
  const warnings = [!hasZip ? 'The selected file is not named like a ZIP archive.' : '', mb > 800 ? 'Large archive: server-side upload/resume should be used for production.' : '', counts.customPostTypes > 5 ? 'Several custom post types detected. Keep ACF/custom mappings under review.' : ''].filter(Boolean);
  return { status: warnings.length ? 'warning' : 'complete', summary: `Scanned ${file.name}. The wizard found content, media, taxonomy and relationship-like data to stage for migration.`, counts, warnings, detected: ['wp_posts', 'wp_postmeta', 'wp_terms', 'wp_users', 'media attachments', 'redirect candidates', ...(hasSupabase ? ['WAKILISHA registry exports', 'chart/entity relationships'] : [])], generatedAt: new Date().toISOString() };
}

export function migrationReadinessScore(state: MigrationWizardState): number {
  const mappingScore = state.mappings.filter((mapping) => mapping.status === 'auto_matched').length / Math.max(state.mappings.length, 1);
  const checklistScore = state.checklist.filter((item) => item.status === 'done').length / Math.max(state.checklist.length, 1);
  const authScore = state.authState === 'approved' ? 1 : 0.25;
  const scanScore = state.scanResult.status === 'complete' || state.scanResult.status === 'warning' ? 1 : 0;
  return Math.round(((mappingScore * 0.35) + (checklistScore * 0.3) + (authScore * 0.2) + (scanScore * 0.15)) * 100);
}

const STORAGE_KEY = 'wakilisha.wp-react-migration.sessions.v1';
export function createMigrationSession(name = 'WordPress migration'): MigrationWizardSession { const now = new Date().toISOString(); return { id: `mig_${Date.now()}`, name, createdAt: now, updatedAt: now, activeStep: 'welcome', state: defaultMigrationWizardState() }; }
export function loadMigrationSessions(): MigrationWizardSession[] { if (typeof window === 'undefined') return []; try { const raw = window.localStorage.getItem(STORAGE_KEY); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
export function saveMigrationSession(session: MigrationWizardSession) { if (typeof window === 'undefined') return; const sessions = loadMigrationSessions(); const updated = { ...session, updatedAt: new Date().toISOString() }; window.localStorage.setItem(STORAGE_KEY, JSON.stringify([updated, ...sessions.filter((item) => item.id !== session.id)].slice(0, 12))); }
export function deleteMigrationSession(id: string) { if (typeof window === 'undefined') return; window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loadMigrationSessions().filter((item) => item.id !== id))); }
