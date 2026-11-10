-- WK100 W5C provider artist display evidence, distinct from immutable chart
-- observations and canonical Registry identity. The caller must use the
-- existing admin-read Edge function's signed-in import action.
create table public.wk100_source_artist_evidence_v1 (
  id uuid primary key default gen_random_uuid(),
  source_receipt_id uuid not null references public.wk_chart_capture_attempts_v1(id) on delete restrict,
  capture_row_id uuid not null references public.wk_chart_capture_rows_v1(id) on delete restrict,
  provider_track_id text not null check (provider_track_id ~ '^[0-9]{1,20}$'),
  source_title text not null check (length(btrim(source_title)) between 1 and 300),
  artist_name text not null check (length(btrim(artist_name)) between 1 and 300),
  lookup_retrieved_at timestamptz not null,
  original_sha256 text not null check (original_sha256 ~ '^[a-f0-9]{64}$'),
  report_sha256 text not null check (report_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  constraint wk100_artist_receipt_row_uniq unique (source_receipt_id,capture_row_id)
);
create index wk100_artist_evidence_receipt_read_idx
  on public.wk100_source_artist_evidence_v1(source_receipt_id,lookup_retrieved_at desc);

-- No direct browser access; service_role only. No policies or grant to authenticated.
alter table public.wk100_source_artist_evidence_v1 enable row level security;
revoke all on public.wk100_source_artist_evidence_v1 from public,anon,authenticated,service_role;
grant select,insert on public.wk100_source_artist_evidence_v1 to service_role;

-- An accepted evidence row is append-only, even for the service role.
create function public.wk100_reject_artist_evidence_change_v1()
returns trigger language plpgsql security invoker
set search_path=pg_catalog,public
as $$
begin
  raise exception 'WK100 artist observations are append-only' using errcode='42501';
end;
$$;
revoke all on function public.wk100_reject_artist_evidence_change_v1() from public,anon,authenticated;
create trigger wk100_artist_evidence_immutable
before update or delete on public.wk100_source_artist_evidence_v1
for each row execute function public.wk100_reject_artist_evidence_change_v1();

comment on table public.wk100_source_artist_evidence_v1 is
'WAKILISHA 100 read-only provider artist display name evidence. Must not change source observations, canonical Registry facts or edition eligibility.';
