-- Disposable local replay parity for the existing Production pg_cron dependency.
-- Supabase CLI runs supabase/roles.sql BEFORE applying timestamped migrations.
-- This file is NOT a Production migration, not a cron scheduler, and does not
-- create custom roles. It prevents clean local replay from missing cron.job.
-- Production pg_cron is already installed. Do not use --include-roles remotely.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
