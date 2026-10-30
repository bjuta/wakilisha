-- WAKILISHA Charts #1326: exact 18 Kenya R&B V2 edition retirement.
-- CLI-generated migration authority: 20261030062819_retire_18_kenya_rnb_editions.sql
-- Owner authorization: remove ONLY the exact 18 published topRNB/KE V2 editions.
-- THIS IS A MUTATING PRODUCTION MIGRATION. Apply only after exact Preview acceptance.
-- No Registry Artist, Track or Release writes. No ingest source-run deletion.
-- The existing Chart Entry DELETE trigger must remain active. It records a
-- 'removed' version in registry_identity_projection_lineage.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '180s';

create temporary table wk_rnb18_exact_targets (
  edition_id text primary key,
  edition_date date not null
) on commit drop;

insert into wk_rnb18_exact_targets (edition_id, edition_date)
values
    ('f0bce9db-be97-4765-acda-c663a349fabc', DATE '2025-12-01'),
    ('f142d7a0-fc7d-4e3f-b87a-0eaa61bbdaa8', DATE '2025-12-29'),
    ('3e63b333-0e04-43ed-9674-a7d8b19d442a', DATE '2026-01-05'),
    ('15c7e7f8-4e2e-4e6b-9071-432e07b50181', DATE '2026-01-12'),
    ('779ca1e1-d23a-433a-952b-91d3df1ea80f', DATE '2026-01-19'),
    ('2f791ff8-2ee6-4517-a546-f96486e38887', DATE '2026-01-26'),
    ('c71843a8-79b6-44fe-b06e-817df252e92c', DATE '2026-02-02'),
    ('c51a414b-f17c-48b7-8004-3c2aada2930f', DATE '2026-02-09'),
    ('286d2b48-9fff-44c7-a213-20086af602a7', DATE '2026-02-16'),
    ('b1006fa6-81a3-401d-bb3f-7143749a7ff1', DATE '2026-02-23'),
    ('983f892b-d401-4c36-bbe1-5b38006f9301', DATE '2026-03-02'),
    ('573fc02d-c30e-48f2-87d5-ed708987a32e', DATE '2026-03-09'),
    ('187ffa0f-102a-4571-82d6-ffe0f276a00a', DATE '2026-03-16'),
    ('87e7897d-0a18-4300-9f32-ff8785a7c347', DATE '2026-03-23'),
    ('d93f9622-2aaa-472c-931f-bc1fb42a0ea6', DATE '2026-03-30'),
    ('caee0438-423a-45c6-885a-0f108fcfc01b', DATE '2026-04-06'),
    ('e863a742-c20f-45da-8d10-933365bc162d', DATE '2026-04-13'),
    ('399b4d80-18e8-409b-8d89-6f3fbb80e429', DATE '2026-04-20');

-- Hold all direct live subjects against concurrent DML for this transaction.
lock table
  public.wk_chart_editions_v2,
  public.wk_chart_entries_v2,
  public.chart_artist_resolution_decisions,
  public.wk_chart_playback_enrichment_runs,
  public.wk_chart_playback_enrichment_items,
  public.chart_ingest_runs,
  public.wk_chart_source_coverage_v2
in share row exclusive mode;

-- Fail closed on scope drift, foreign dependency rows or historical divergence.
do $wk_rnb18_preflight$
declare
  v_edition_count int;
  v_count int;
begin
  select count(*) into v_edition_count from wk_rnb18_exact_targets;
  if v_edition_count <> 18 then raise exception 'rnb18_target_manifest_mismatch:%', v_edition_count; end if;

  select count(*) into v_count
    from public.wk_chart_editions_v2 e
    join public.wk_chart_programs_v2 p on p.id=e.program_id
    join wk_rnb18_exact_targets t on t.edition_id=e.id and t.edition_date=e.edition_date
   where e.status='published' and p.series_slug='toprnb' and p.market_slug='KE'
     and e.entry_count=100;
  if v_count <> 18 then raise exception 'rnb18_edition_scope_drift:%', v_count; end if;

  select count(*) into v_count from public.wk_chart_editions_v2 e
     join public.wk_chart_programs_v2 p on p.id=e.program_id
    where e.status='published' and p.series_slug='toprnb' and p.market_slug='KE';
  if v_count <> 18 then raise exception 'rnb18_other_published_editions_present:%', v_count; end if;

  select count(*) into v_count from public.wk_chart_entries_v2 x
    join wk_rnb18_exact_targets t on t.edition_id=x.edition_id;
  if v_count <> 1800 then raise exception 'rnb18_entry_count_drift:%', v_count; end if;

  select count(*) into v_count from wk_rnb18_exact_targets t
    where (select count(*) from public.wk_chart_entries_v2 x where x.edition_id=t.edition_id)=100;
  if v_count <> 18 then raise exception 'rnb18_per_edition_row_count_drift:%', v_count; end if;

  select count(*) into v_count from public.chart_artist_resolution_decisions d
    where d.edition_id in (select edition_id from wk_rnb18_exact_targets);
  if v_count <> 58 then raise exception 'rnb18_artist_decision_drift:%', v_count; end if;

  select count(*) into v_count from public.chart_artist_resolution_decisions d
    where d.chart_entry_id in (select x.id from public.wk_chart_entries_v2 x
         join wk_rnb18_exact_targets t on t.edition_id=x.edition_id)
      and d.edition_id not in (select edition_id from wk_rnb18_exact_targets);
  if v_count <> 0 then raise exception 'rnb18_cross_edition_artist_decision'; end if;

  select count(*) into v_count from public.wk_chart_playback_enrichment_runs r
    where r.chart_edition_id::text in (select edition_id from wk_rnb18_exact_targets);
  if v_count <> 10 then raise exception 'rnb18_playback_runs_drift:%', v_count; end if;

  select count(*) into v_count from public.wk_chart_playback_enrichment_items i
    where i.run_id in (select r.id from public.wk_chart_playback_enrichment_runs r
      where r.chart_edition_id::text in (select edition_id from wk_rnb18_exact_targets));
  if v_count <> 1000 then raise exception 'rnb18_playback_items_drift:%', v_count; end if;

  select count(*) into v_count from public.wk_chart_playback_enrichment_items i
    where i.run_id in (select r.id from public.wk_chart_playback_enrichment_runs r
      where r.chart_edition_id::text in (select edition_id from wk_rnb18_exact_targets))
      and (i.chart_entry_id is null or i.chart_entry_id::text not in
        (select x.id from public.wk_chart_entries_v2 x
          where x.edition_id in (select edition_id from wk_rnb18_exact_targets)));
  if v_count <> 0 then raise exception 'rnb18_playback_run_has_foreign_items:%', v_count; end if;

  select count(*) into v_count from public.wk_chart_playback_enrichment_items i
    where i.chart_entry_id::text in
       (select x.id from public.wk_chart_entries_v2 x
          where x.edition_id in (select edition_id from wk_rnb18_exact_targets))
      and i.run_id not in (select r.id from public.wk_chart_playback_enrichment_runs r
          where r.chart_edition_id::text in (select edition_id from wk_rnb18_exact_targets));
  if v_count <> 0 then raise exception 'rnb18_cross_run_playback_reference:%', v_count; end if;

  select count(*) into v_count from public.chart_ingest_runs r
    where r.commit_edition_id in (select edition_id from wk_rnb18_exact_targets)
      and r.status='published';
  if v_count <> 18 then raise exception 'rnb18_ingest_run_reference_drift:%', v_count; end if;

  select count(*) into v_count from public.chart_ingest_runs r
    where r.commit_edition_id in (select edition_id from wk_rnb18_exact_targets);
  if v_count <> 18 then raise exception 'rnb18_ingest_run_count_drift:%', v_count; end if;

  select count(*) into v_count from public.chart_ingest_raw_rows r
    where r.run_id in (select id from public.chart_ingest_runs
      where commit_edition_id in (select edition_id from wk_rnb18_exact_targets));
  if v_count <> 7560 then raise exception 'rnb18_raw_source_evidence_drift:%', v_count; end if;

  select count(*) into v_count from public.chart_ingest_candidates r
    where r.run_id in (select id from public.chart_ingest_runs
      where commit_edition_id in (select edition_id from wk_rnb18_exact_targets));
  if v_count <> 7398 then raise exception 'rnb18_ingest_candidates_drift:%', v_count; end if;

  select count(*) into v_count from public.wk_chart_source_coverage_v2 c
    where c.edition_id in (select edition_id from wk_rnb18_exact_targets);
  if v_count <> 0 then raise exception 'rnb18_unexpected_source_coverage:%', v_count; end if;
end
$wk_rnb18_preflight$;

-- A sealed, private row-for-row recovery copy, independent of old June backups.
-- JSONB retains every DB column name and value for schema-aware restoration.
create table platform_private.wk_chart_rnb18_retirement_rows_20261030 (
  object_kind text not null,
  row_key text not null,
  payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  archived_at timestamptz not null default clock_timestamp(),
  primary key (object_kind,row_key)
);

create table platform_private.wk_chart_rnb18_retirement_receipt_20261030 (
  batch_key text primary key,
  issue_number int not null,
  edition_count int not null,
  entry_count int not null,
  archived_row_count int not null,
  archive_sha256 text not null check (archive_sha256 ~ '^[0-9a-f]{64}$'),
  archived_at timestamptz not null default clock_timestamp(),
  notes text not null
);

revoke all on table platform_private.wk_chart_rnb18_retirement_rows_20261030 from public, anon, authenticated, service_role;
revoke all on table platform_private.wk_chart_rnb18_retirement_receipt_20261030 from public, anon, authenticated, service_role;
alter table platform_private.wk_chart_rnb18_retirement_rows_20261030 enable row level security;
alter table platform_private.wk_chart_rnb18_retirement_receipt_20261030 enable row level security;

insert into platform_private.wk_chart_rnb18_retirement_rows_20261030 (object_kind,row_key,payload,payload_sha256)
select 'edition', e.id, to_jsonb(e), encode(extensions.digest(to_jsonb(e)::text,'sha256'),'hex')
from public.wk_chart_editions_v2 e join wk_rnb18_exact_targets t on t.edition_id=e.id;

insert into platform_private.wk_chart_rnb18_retirement_rows_20261030 (object_kind,row_key,payload,payload_sha256)
select 'entry', x.id, to_jsonb(x), encode(extensions.digest(to_jsonb(x)::text,'sha256'),'hex')
from public.wk_chart_entries_v2 x join wk_rnb18_exact_targets t on t.edition_id=x.edition_id;

insert into platform_private.wk_chart_rnb18_retirement_rows_20261030 (object_kind,row_key,payload,payload_sha256)
select 'artist_decision', d.id::text, to_jsonb(d), encode(extensions.digest(to_jsonb(d)::text,'sha256'),'hex')
from public.chart_artist_resolution_decisions d
where d.edition_id in (select edition_id from wk_rnb18_exact_targets);

insert into platform_private.wk_chart_rnb18_retirement_rows_20261030 (object_kind,row_key,payload,payload_sha256)
select 'playback_run', r.id::text, to_jsonb(r), encode(extensions.digest(to_jsonb(r)::text,'sha256'),'hex')
from public.wk_chart_playback_enrichment_runs r
where r.chart_edition_id::text in (select edition_id from wk_rnb18_exact_targets);

insert into platform_private.wk_chart_rnb18_retirement_rows_20261030 (object_kind,row_key,payload,payload_sha256)
select 'playback_item', i.id::text, to_jsonb(i), encode(extensions.digest(to_jsonb(i)::text,'sha256'),'hex')
from public.wk_chart_playback_enrichment_items i
where i.run_id in (select r.id from public.wk_chart_playback_enrichment_runs r
    where r.chart_edition_id::text in (select edition_id from wk_rnb18_exact_targets));

insert into platform_private.wk_chart_rnb18_retirement_rows_20261030 (object_kind,row_key,payload,payload_sha256)
select 'ingest_run', r.id, to_jsonb(r), encode(extensions.digest(to_jsonb(r)::text,'sha256'),'hex')
from public.chart_ingest_runs r
where r.commit_edition_id in (select edition_id from wk_rnb18_exact_targets);

-- Verify recovery archive BEFORE a single live row is altered.
do $wk_rnb18_seal$
declare
  v_count int;
  v_digest text;
  v_actual text;
begin
  for v_count, v_digest in
    select n, object_kind from (
      select count(*)::int as n, object_kind from platform_private.wk_chart_rnb18_retirement_rows_20261030 group by object_kind
    ) s
  loop
    if (v_digest='edition' and v_count<>18) or
       (v_digest='entry' and v_count<>1800) or
       (v_digest='artist_decision' and v_count<>58) or
       (v_digest='playback_run' and v_count<>10) or
       (v_digest='playback_item' and v_count<>1000) or
       (v_digest='ingest_run' and v_count<>18)
    then raise exception 'rnb18_archive_group_mismatch:%:%',v_digest,v_count; end if;
  end loop;

  select count(*) into v_count from platform_private.wk_chart_rnb18_retirement_rows_20261030;
  if v_count <> 2904 then raise exception 'rnb18_archive_total_mismatch:%',v_count; end if;

  select count(*) into v_count from platform_private.wk_chart_rnb18_retirement_rows_20261030 a
    where a.payload_sha256 <> encode(extensions.digest(a.payload::text,'sha256'),'hex');
  if v_count <> 0 then raise exception 'rnb18_archive_corrupt:%', v_count; end if;

  select encode(extensions.digest(string_agg(object_kind||':'||row_key||':'||payload_sha256,E'\n' order by object_kind,row_key),'sha256'),'hex')
    into v_actual from platform_private.wk_chart_rnb18_retirement_rows_20261030;

  insert into platform_private.wk_chart_rnb18_retirement_receipt_20261030 (batch_key,issue_number,edition_count,entry_count,archived_row_count,archive_sha256,notes)
  values ('rnb18-20261030',1326,18,1800,2904,v_actual,
          'Exact historical Kenya R&B V2 editions. Live entries removed only after archive seal; original ingestion sources preserved.');
end
$wk_rnb18_seal$;

-- Idempotency is intentionally NOT provided: this is a one-time retirement.
-- The new explicit retired state avoids misrepresenting a withdrawn edition
-- as still published or falsely claiming its original source run was cancelled.
alter table public.chart_ingest_runs drop constraint chart_ingest_runs_status_check;
alter table public.chart_ingest_runs add constraint chart_ingest_runs_status_check
check (status = any (array[
'draft','queued','running','preflight_passed','fetching','normalizing',
'scoring','reviewing','commit_pending','dry_run_complete',
'ready_to_commit','committing','committed','needs_review','publishing',
'published','failed','cancelled','source_fetch_failed','retired'
]::text[]));

-- Capture affected historical ingest-run metadata above, then retire its
-- live Edition link while preserving raw source/candidate/audit child rows.
update public.chart_ingest_runs r
  set status='retired',
      commit_edition_id=null,
      notes=concat_ws(E'\n',nullif(r.notes,''),
        'Retired 2026-10-30 by #1326; original published Edition and original run metadata preserved in platform_private.wk_chart_rnb18_retirement_rows_20261030.')
 where r.commit_edition_id in (select edition_id from wk_rnb18_exact_targets);

do $wk_rnb18_run_update_count$
declare v_count int;
begin
 select count(*) into v_count from public.chart_ingest_runs r
  where r.status='retired' and r.id in
    (select a.row_key from platform_private.wk_chart_rnb18_retirement_rows_20261030 a where a.object_kind='ingest_run');
 if v_count<>18 then raise exception 'rnb18_run_retirement_failed:%',v_count; end if;
end
$wk_rnb18_run_update_count$;

-- Dependents first, then public Entry rows (triggered identity tombstones),
-- then the exact Edition rows. No broad table or Programme deletes.
delete from public.chart_artist_resolution_decisions d
 where d.edition_id in (select edition_id from wk_rnb18_exact_targets);
delete from public.wk_chart_playback_enrichment_items i
 where i.run_id in (select r.id from public.wk_chart_playback_enrichment_runs r
   where r.chart_edition_id::text in (select edition_id from wk_rnb18_exact_targets));
delete from public.wk_chart_playback_enrichment_runs r
 where r.chart_edition_id::text in (select edition_id from wk_rnb18_exact_targets);
delete from public.wk_chart_entries_v2 x
 where x.edition_id in (select edition_id from wk_rnb18_exact_targets);
delete from public.wk_chart_editions_v2 e
 where e.id in (select edition_id from wk_rnb18_exact_targets);

-- Final transaction assertion: no wrong rows, no lost original source evidence.
do $wk_rnb18_verify$
declare v_count int;
  v_archive_sha text;
  v_receipt_sha text;
begin
 select count(*) into v_count from public.wk_chart_editions_v2 e
  where e.id in (select edition_id from wk_rnb18_exact_targets);
 if v_count<>0 then raise exception 'rnb18_editions_remain:%',v_count; end if;
 select count(*) into v_count from public.wk_chart_entries_v2 e
  where e.edition_id in (select edition_id from wk_rnb18_exact_targets);
 if v_count<>0 then raise exception 'rnb18_entries_remain:%',v_count; end if;
 select count(*) into v_count from public.chart_artist_resolution_decisions d
  where d.edition_id in (select edition_id from wk_rnb18_exact_targets);
 if v_count<>0 then raise exception 'rnb18_decisions_remain:%',v_count; end if;
 select count(*) into v_count from public.wk_chart_playback_enrichment_runs r
  where r.chart_edition_id::text in (select edition_id from wk_rnb18_exact_targets);
 if v_count<>0 then raise exception 'rnb18_playback_runs_remain:%',v_count; end if;
 select count(*) into v_count from public.wk_chart_playback_enrichment_items i
  where i.chart_entry_id::text in (select a.row_key from platform_private.wk_chart_rnb18_retirement_rows_20261030 a where a.object_kind='entry');
 if v_count<>0 then raise exception 'rnb18_playback_items_remain:%',v_count; end if;
 select count(*) into v_count from public.chart_ingest_runs r
  where r.id in (select a.row_key from platform_private.wk_chart_rnb18_retirement_rows_20261030 a where a.object_kind='ingest_run')
    and r.status='retired' and r.commit_edition_id is null;
 if v_count<>18 then raise exception 'rnb18_historical_ingest_run_retention_failed:%',v_count; end if;
 select count(*) into v_count from public.chart_ingest_raw_rows r
  where r.run_id in (select a.row_key from platform_private.wk_chart_rnb18_retirement_rows_20261030 a where a.object_kind='ingest_run');
 if v_count<>7560 then raise exception 'rnb18_raw_source_evidence_lost:%',v_count; end if;
 select count(*) into v_count from public.chart_ingest_candidates r
  where r.run_id in (select a.row_key from platform_private.wk_chart_rnb18_retirement_rows_20261030 a where a.object_kind='ingest_run');
 if v_count<>7398 then raise exception 'rnb18_source_candidates_lost:%',v_count; end if;
 select encode(extensions.digest(string_agg(object_kind||':'||row_key||':'||payload_sha256,E'\n' order by object_kind,row_key),'sha256'),'hex')
  into v_archive_sha from platform_private.wk_chart_rnb18_retirement_rows_20261030;
 select archive_sha256 into v_receipt_sha from platform_private.wk_chart_rnb18_retirement_receipt_20261030
  where batch_key='rnb18-20261030';
 if v_archive_sha is distinct from v_receipt_sha then raise exception 'rnb18_archive_seal_mismatch'; end if;
end
$wk_rnb18_verify$;

-- Block any subsequent UPDATE/DELETE/TRUNCATE against sealed recovery rows.
create function platform_private.wk_chart_rnb18_archive_immutable_20261030()
returns trigger language plpgsql set search_path = pg_catalog
as $wk_rnb18_immutability$
begin
  raise exception 'rnb18_archive_immutable';
end
$wk_rnb18_immutability$;
revoke all on function platform_private.wk_chart_rnb18_archive_immutable_20261030() from public,anon,authenticated;
create trigger trg_wk_rnb18_rows_immutable_update_delete
before update or delete on platform_private.wk_chart_rnb18_retirement_rows_20261030
for each row execute function platform_private.wk_chart_rnb18_archive_immutable_20261030();
create trigger trg_wk_rnb18_rows_immutable_truncate
before truncate on platform_private.wk_chart_rnb18_retirement_rows_20261030
for each statement execute function platform_private.wk_chart_rnb18_archive_immutable_20261030();
create trigger trg_wk_rnb18_receipt_immutable_update_delete
before update or delete on platform_private.wk_chart_rnb18_retirement_receipt_20261030
for each row execute function platform_private.wk_chart_rnb18_archive_immutable_20261030();
create trigger trg_wk_rnb18_receipt_immutable_truncate
before truncate on platform_private.wk_chart_rnb18_retirement_receipt_20261030
for each statement execute function platform_private.wk_chart_rnb18_archive_immutable_20261030();

commit;