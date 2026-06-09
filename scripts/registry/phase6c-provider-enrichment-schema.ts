import { Pool } from 'pg';

/**
 * Phase 6C: Provider Tables for Enrichment
 * 
 * This script defines SQL tables for storing provider field observations, enrichment suggestions,
 * links between registry and provider entities, and canonicalization job tracking.
 */

export const createEnrichmentTables = async (pool: Pool) => {
  await pool.query(`
    create table if not exists public.provider_field_observations (
      id uuid primary key default gen_random_uuid(),
      provider_item_id uuid not null references public.provider_items(id) on delete cascade,
      entity_type text not null,
      field_name text not null,
      field_value text,
      provider text not null,
      confidence_score numeric(5,4),
      source_path text,
      observed_at timestamptz not null default now(),
      raw_payload jsonb not null default '{}'::jsonb
    );

    create table if not exists public.registry_enrichment_suggestions (
      id uuid primary key default gen_random_uuid(),
      registry_entity_type text not null,
      registry_entity_id uuid not null,
      field_name text not null,
      current_value text,
      suggested_value text,
      provider_item_id uuid references public.provider_items(id) on delete set null,
      confidence_score numeric(5,4),
      decision_status text not null default 'draft',
      decision_reason text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists public.provider_entity_links (
      id uuid primary key default gen_random_uuid(),
      registry_entity_type text not null,
      registry_entity_id uuid not null,
      provider text not null,
      provider_entity_id text not null,
      provider_url text,
      match_status text not null default 'candidate',
      confidence_score numeric(5,4),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists public.canonicalization_jobs (
      id uuid primary key default gen_random_uuid(),
      job_type text not null,
      status text not null default 'draft',
      registry_entity_id uuid,
      provider_run_id uuid,
      summary jsonb not null default '{}'::jsonb,
      errors jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
};