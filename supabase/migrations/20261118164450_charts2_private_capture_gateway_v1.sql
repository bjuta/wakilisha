-- Charts 2.0 Phase 1: narrowly privileged original-capture gateway.
-- CLI-generated filename from unlinked runner 44350752402, Supabase 2.107.0.
-- The new methods remain held. This migration enables no scheduler,
-- publisher, chart score, Registry writes or anonymous uploads.
begin;

alter table platform_private.charts2_capture_receipts_v1
  add column captured_by uuid null;

create function public.charts2_get_collector_method_v1(p_source_key text)
returns table (
  source_key text,
  exact_endpoint text,
  reviewed_method text,
  method_revision integer
)
language sql stable security definer
set search_path = ''
as $$
  select m.source_key, m.exact_endpoint, m.reviewed_method, m.method_revision
  from platform_private.charts2_source_methods_v1 m
  where m.source_key = p_source_key
    and m.review_state = 'collector_admitted'
    and m.authorization_expires_at > now()
    and m.reviewed_at is not null
    and m.access_evidence_sha256 is not null
    and m.method_revision > 0
    and m.reviewed_method = 'GET'
    and m.exact_endpoint like 'https://%';
$$;

revoke all on function public.charts2_get_collector_method_v1(text)
  from public, anon, authenticated;
grant execute on function public.charts2_get_collector_method_v1(text)
  to service_role;

create function public.charts2_commit_verified_original_v1(p_capture jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  src text;
  ep text;
  capture_mode text;
  sha text;
  storage_key text;
  row_data jsonb;
  row_depth integer;
  expected integer;
  receipt_id uuid;
  method_rev integer;
begin
  if p_capture is null or jsonb_typeof(p_capture) <> 'object' then
    raise exception 'charts2_receipt_payload_invalid';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_capture) as k(key)
    where k.key <> all(array[
      'source_key','source_endpoint','capture_mode','observed_at',
      'original_object_key','original_sha256','original_byte_length',
      'original_verified_at','original_content_type','expected_depth',
      'observations','parser_version','provider_updated_at',
      'provider_week_ending_date','native_period_authority',
      'method_revision','captured_by','verification_state'
    ])
  ) then
    raise exception 'charts2_receipt_extra_fields';
  end if;

  src := p_capture->>'source_key';
  ep := p_capture->>'source_endpoint';
  sha := p_capture->>'original_sha256';
  storage_key := p_capture->>'original_object_key';
  capture_mode := p_capture->>'capture_mode';
  row_data := p_capture->'observations';
  method_rev := nullif(p_capture->>'method_revision','')::integer;

  if p_capture->>'verification_state' <> 'server_sha256_storage_readback'
    or sha is null or sha !~ '^[a-f0-9]{64}$'
    or row_data is null or jsonb_typeof(row_data) <> 'array'
    or jsonb_array_length(row_data) not between 1 and 200
    or p_capture->>'captured_by' is null then
    raise exception 'charts2_receipt_unverified';
  end if;

  row_depth := jsonb_array_length(row_data);
  expected := case when src = 'shazam_ke' then 200
             when src in ('apple_ke','mdundo_ke','youtube_ke','audiomack_ke')
             then 100 else null end;
  if expected is null or p_capture->>'expected_depth' <> expected::text then
    raise exception 'charts2_receipt_source_depth_invalid';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'charts2-evidence-private-v1'
      and o.name = storage_key
  ) then
    raise exception 'charts2_private_original_missing';
  end if;

  if capture_mode = 'service_original' then
    if method_rev is null or not exists (
      select 1 from platform_private.charts2_source_methods_v1 m
      where m.source_key = src
        and m.exact_endpoint = ep
        and m.method_revision = method_rev
        and m.reviewed_method = 'GET'
        and m.review_state = 'collector_admitted'
        and m.authorization_expires_at > now()
        and m.access_evidence_sha256 is not null
    ) then
      raise exception 'charts2_source_method_not_admitted';
    end if;
  elsif capture_mode = 'research_original_upload' then
    if method_rev is not null then
      raise exception 'charts2_unadmitted_original_must_have_null_method_revision';
    end if;
  else
    raise exception 'charts2_capture_mode_invalid';
  end if;

  insert into platform_private.charts2_capture_receipts_v1
    (source_key,source_endpoint,capture_mode,observed_at,
     original_object_key,original_byte_length,original_sha256,
     original_verified_at,original_content_type,
     expected_depth,observed_depth,observations,parser_version,
     provider_updated_at,provider_week_ending_date,
     native_period_authority,method_revision,captured_by)
  values
    (src,ep,capture_mode,(p_capture->>'observed_at')::timestamptz,
     storage_key,(p_capture->>'original_byte_length')::integer,sha,
     (p_capture->>'original_verified_at')::timestamptz,
     p_capture->>'original_content_type',
     expected,row_depth,row_data,p_capture->>'parser_version',
     (p_capture->>'provider_updated_at')::timestamptz,
     (p_capture->>'provider_week_ending_date')::date,
     coalesce(p_capture->>'native_period_authority','unknown'),
     method_rev,(p_capture->>'captured_by')::uuid)
  on conflict (source_key,original_sha256) do nothing
  returning id into receipt_id;

  if receipt_id is null then
    select id into receipt_id
    from platform_private.charts2_capture_receipts_v1
    where source_key = src and original_sha256 = sha
      and original_object_key = storage_key
      and original_byte_length = (p_capture->>'original_byte_length')::integer;
    if receipt_id is null then
      raise exception 'charts2_duplicate_original_provenance_conflict';
    end if;
  end if;
  return receipt_id;
end;
$$;

revoke all on function public.charts2_commit_verified_original_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.charts2_commit_verified_original_v1(jsonb)
  to service_role;

comment on function public.charts2_commit_verified_original_v1(jsonb) is
  'Service-only candidate receipt persistence after independently verified private Storage byte readback; no scoring or publication authority.';

commit;
