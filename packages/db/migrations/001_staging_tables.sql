-- WAKILISHA React Rebuild
-- 001_staging_tables.sql
--
-- These tables are raw import landing zones for the Supabase CSV export.
-- They intentionally preserve messy old data. Do not build React pages directly from these tables.

create schema if not exists wakilisha_staging;

create table if not exists wakilisha_staging.import_runs (
  id uuid primary key default gen_random_uuid(),
  import_name text not null,
  source_note text,
  created_at timestamptz not null default now()
);

create table if not exists wakilisha_staging.raw_csv_files (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid references wakilisha_staging.import_runs(id) on delete cascade,
  detected_table text not null,
  file_name text not null,
  row_count integer not null default 0,
  headers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Store raw rows as jsonb first. Typed clean tables are created in the repaired schema.
-- This makes the importer resilient to CSV shape drift and old WordPress payload changes.
create table if not exists wakilisha_staging.raw_rows (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid references wakilisha_staging.import_runs(id) on delete cascade,
  detected_table text not null,
  source_file text not null,
  source_row_number integer not null,
  row_data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists raw_rows_import_table_idx
  on wakilisha_staging.raw_rows(import_run_id, detected_table);

create index if not exists raw_rows_detected_table_idx
  on wakilisha_staging.raw_rows(detected_table);

create index if not exists raw_rows_data_gin_idx
  on wakilisha_staging.raw_rows using gin(row_data);
