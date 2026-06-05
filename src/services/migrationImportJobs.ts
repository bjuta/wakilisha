import { supabase } from '@/lib/supabase';

export type IngestionRun = {
  id: string;
  source_name: string;
  source_kind: string;
  source_manifest: Record<string, unknown> | null;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  imported_counts: Record<string, number> | null;
  warnings: string[] | null;
  errors: string[] | null;
};

const IMPORT_BUCKET = 'migration-imports';

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 160);
}

export async function uploadZipAndCreateIngestionRun(file: File): Promise<IngestionRun> {
  if (!file.name.toLowerCase().endsWith('.zip')) throw new Error('Only .zip exports are accepted.');

  const timestamp = new Date().toISOString();
  const randomId = Math.random().toString(36).slice(2);
  const storagePath = `wordpress/${timestamp.slice(0, 10)}/${randomId}-${safeName(file.name)}`;

  const uploadResult = await supabase.storage.from(IMPORT_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/zip',
  });
  if (uploadResult.error) {
    throw new Error(`ZIP upload failed: ${uploadResult.error.message}. Confirm Supabase storage bucket '${IMPORT_BUCKET}' exists and has upload permission.`);
  }

  const manifest = {
    filename: file.name,
    size: file.size,
    content_type: file.type || 'application/zip',
    last_modified: file.lastModified,
    uploaded_at: timestamp,
    storage_bucket: IMPORT_BUCKET,
    storage_path: storagePath,
    processor_required: true,
  };

  const { data, error } = await supabase
    .from('wk_ingestion_runs')
    .insert({
      source_name: file.name,
      source_kind: 'wordpress_export_zip',
      source_manifest: manifest,
      status: 'queued',
      imported_counts: null,
      warnings: ['ZIP uploaded and queued. Waiting for backend processor to validate and import.'],
      errors: [],
    })
    .select('id, source_name, source_kind, source_manifest, status, started_at, finished_at, created_at, imported_counts, warnings, errors')
    .single();

  if (error) {
    await supabase.storage.from(IMPORT_BUCKET).remove([storagePath]);
    throw new Error(`Import job creation failed: ${error.message}`);
  }
  return data as IngestionRun;
}

export async function listZipIngestionRuns(limit = 20): Promise<IngestionRun[]> {
  const { data, error } = await supabase
    .from('wk_ingestion_runs')
    .select('id, source_name, source_kind, source_manifest, status, started_at, finished_at, created_at, imported_counts, warnings, errors')
    .eq('source_kind', 'wordpress_export_zip')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as IngestionRun[];
}

export async function getIngestionRun(id: string): Promise<IngestionRun | null> {
  const { data, error } = await supabase
    .from('wk_ingestion_runs')
    .select('id, source_name, source_kind, source_manifest, status, started_at, finished_at, created_at, imported_counts, warnings, errors')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as IngestionRun | null;
}

export function totalImported(run?: Pick<IngestionRun, 'imported_counts'> | null) {
  if (!run?.imported_counts) return 0;
  return Object.values(run.imported_counts).reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0);
}

// ---- Trigger the processor ----
export type ProcessResult = {
  success: boolean;
  runId: string;
  stats: { total: number; imported: number; failed: number; skipped: number };
  importedCounts: Record<string, number>;
  errorCount: number;
  warningCount: number;
  error?: string;
};

export async function processImportRun(runId: string, maxItems = 500): Promise<ProcessResult> {
  const { data, error } = await supabase.functions.invoke("process-wp-import", {
    body: { runId, maxItems },
  });

  if (error) {
    return {
      success: false,
      runId,
      stats: { total: 0, imported: 0, failed: 0, skipped: 0 },
      importedCounts: {},
      errorCount: 0,
      warningCount: 0,
      error: error.message,
    };
  }

  return data as ProcessResult;
}