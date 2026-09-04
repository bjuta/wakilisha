-- WAKILISHA Artist Studio claimant international phone.
-- Additive and backward-compatible. Existing v1 claim RPCs remain available
-- while the frontend transitions to the phone-aware v2 submission contract.

begin;

do $preflight$
begin
  if to_regclass('public.artist_claim_requests') is null
     or to_regprocedure('public.community_submit_artist_claim(uuid,text,text,jsonb)') is null
     or to_regprocedure('public.community_submit_new_artist_claim(text,text,text,text[],text,text,jsonb)') is null
     or to_regprocedure('public.community_admin_get_artist_claims(text,integer)') is null
  then
    raise exception
      'STOP: Artist Claim authority required by claimant phone migration is missing';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'artist_claim_requests'
      and column_name in (
        'claimant_phone_country_iso2',
        'claimant_phone_calling_code',
        'claimant_phone_national_number',
        'claimant_phone_e164'
      )
  )
  then
    raise exception
      'STOP: claimant phone columns already exist';
  end if;

  if to_regprocedure('public.community_submit_artist_claim_v2(uuid,text,text,text,text,text,text,jsonb)') is not null
     or to_regprocedure('public.community_submit_new_artist_claim_v2(text,text,text,text[],text,text,text,text,text,text,jsonb)') is not null
     or to_regprocedure('public.community_admin_get_artist_claims_v2(text,integer)') is not null
  then
    raise exception
      'STOP: claimant phone v2 function authority already exists';
  end if;
end;
$preflight$;

alter table public.artist_claim_requests
  add column claimant_phone_country_iso2 text,
  add column claimant_phone_calling_code text,
  add column claimant_phone_national_number text,
  add column claimant_phone_e164 text;

alter table public.artist_claim_requests
  add constraint artist_claim_requests_phone_all_or_none
    check (
      (
        claimant_phone_country_iso2 is null
        and claimant_phone_calling_code is null
        and claimant_phone_national_number is null
        and claimant_phone_e164 is null
      )
      or (
        claimant_phone_country_iso2 is not null
        and claimant_phone_calling_code is not null
        and claimant_phone_national_number is not null
        and claimant_phone_e164 is not null
      )
    ),
  add constraint artist_claim_requests_phone_country_iso2_shape
    check (
      claimant_phone_country_iso2 is null
      or claimant_phone_country_iso2 ~ '^[A-Z]{2}$'
    ),
  add constraint artist_claim_requests_phone_calling_code_shape
    check (
      claimant_phone_calling_code is null
      or claimant_phone_calling_code ~ '^\+[1-9][0-9]{0,2}$'
    ),
  add constraint artist_claim_requests_phone_national_number_shape
    check (
      claimant_phone_national_number is null
      or claimant_phone_national_number ~ '^[0-9]{1,14}$'
    ),
  add constraint artist_claim_requests_phone_e164_shape
    check (
      claimant_phone_e164 is null
      or claimant_phone_e164 ~ '^\+[1-9][0-9]{3,14}$'
    ),
  add constraint artist_claim_requests_phone_parts_match_e164
    check (
      claimant_phone_e164 is null
      or claimant_phone_e164 =
         claimant_phone_calling_code ||
         claimant_phone_national_number
    );

create or replace function public.community_submit_artist_claim_v2(
  p_artist_id uuid,
  p_claimant_role text,
  p_statement text,
  p_phone_country_iso2 text,
  p_phone_calling_code text,
  p_phone_national_number text,
  p_phone_e164 text,
  p_evidence jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, editorial
as $function$
declare
  v_actor uuid := auth.uid();
  v_country_iso2 text :=
    upper(trim(coalesce(p_phone_country_iso2, '')));
  v_calling_code text :=
    trim(coalesce(p_phone_calling_code, ''));
  v_national_number text :=
    trim(coalesce(p_phone_national_number, ''));
  v_e164 text :=
    trim(coalesce(p_phone_e164, ''));
  v_result jsonb;
  v_claim_id uuid;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if v_country_iso2 !~ '^[A-Z]{2}$'
     or v_calling_code !~ '^\+[1-9][0-9]{0,2}$'
     or v_national_number !~ '^[0-9]{1,14}$'
     or v_e164 !~ '^\+[1-9][0-9]{3,14}$'
     or v_e164 <> v_calling_code || v_national_number
  then
    raise exception 'invalid_claimant_phone';
  end if;

  v_result :=
    public.community_submit_artist_claim(
      p_artist_id,
      p_claimant_role,
      p_statement,
      p_evidence
    );

  v_claim_id :=
    nullif(v_result->>'claim_id', '')::uuid;

  if v_claim_id is null then
    raise exception 'claim_submission_missing_id';
  end if;

  update public.artist_claim_requests
  set
    claimant_phone_country_iso2 = v_country_iso2,
    claimant_phone_calling_code = v_calling_code,
    claimant_phone_national_number = v_national_number,
    claimant_phone_e164 = v_e164,
    updated_at = now()
  where id = v_claim_id
    and claimant_user_id = v_actor;

  if not found then
    raise exception 'claimant_phone_update_not_authorized';
  end if;

  return v_result ||
    jsonb_build_object(
      'claimant_phone_e164',
      v_e164
    );
end;
$function$;

revoke all on function public.community_submit_artist_claim_v2(
  uuid,text,text,text,text,text,text,jsonb
)
from public, anon;
grant execute on function public.community_submit_artist_claim_v2(
  uuid,text,text,text,text,text,text,jsonb
)
to authenticated, service_role;

create or replace function public.community_submit_new_artist_claim_v2(
  p_display_name text,
  p_artist_type text,
  p_origin_iso2 text,
  p_alternate_names text[],
  p_claimant_role text,
  p_statement text,
  p_phone_country_iso2 text,
  p_phone_calling_code text,
  p_phone_national_number text,
  p_phone_e164 text,
  p_evidence jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, editorial, platform_private, extensions
as $function$
declare
  v_actor uuid := auth.uid();
  v_country_iso2 text :=
    upper(trim(coalesce(p_phone_country_iso2, '')));
  v_calling_code text :=
    trim(coalesce(p_phone_calling_code, ''));
  v_national_number text :=
    trim(coalesce(p_phone_national_number, ''));
  v_e164 text :=
    trim(coalesce(p_phone_e164, ''));
  v_result jsonb;
  v_claim_id uuid;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if v_country_iso2 !~ '^[A-Z]{2}$'
     or v_calling_code !~ '^\+[1-9][0-9]{0,2}$'
     or v_national_number !~ '^[0-9]{1,14}$'
     or v_e164 !~ '^\+[1-9][0-9]{3,14}$'
     or v_e164 <> v_calling_code || v_national_number
  then
    raise exception 'invalid_claimant_phone';
  end if;

  v_result :=
    public.community_submit_new_artist_claim(
      p_display_name,
      p_artist_type,
      p_origin_iso2,
      p_alternate_names,
      p_claimant_role,
      p_statement,
      p_evidence
    );

  v_claim_id :=
    nullif(v_result->>'claim_id', '')::uuid;

  if v_claim_id is null then
    raise exception 'claim_submission_missing_id';
  end if;

  update public.artist_claim_requests
  set
    claimant_phone_country_iso2 = v_country_iso2,
    claimant_phone_calling_code = v_calling_code,
    claimant_phone_national_number = v_national_number,
    claimant_phone_e164 = v_e164,
    updated_at = now()
  where id = v_claim_id
    and claimant_user_id = v_actor;

  if not found then
    raise exception 'claimant_phone_update_not_authorized';
  end if;

  return v_result ||
    jsonb_build_object(
      'claimant_phone_e164',
      v_e164
    );
end;
$function$;

revoke all on function public.community_submit_new_artist_claim_v2(
  text,text,text,text[],text,text,text,text,text,text,jsonb
)
from public, anon;
grant execute on function public.community_submit_new_artist_claim_v2(
  text,text,text,text[],text,text,text,text,text,text,jsonb
)
to authenticated, service_role;

create or replace function public.community_admin_get_artist_claims_v2(
  p_status text default 'pending',
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path to pg_catalog, public, editorial
as $function$
declare
  v_base jsonb;
  v_result jsonb;
begin
  v_base :=
    public.community_admin_get_artist_claims(
      p_status,
      p_limit
    );

  select coalesce(
    jsonb_agg(
      item.value ||
      jsonb_build_object(
        'claimant_phone_country_iso2',
          claim.claimant_phone_country_iso2,
        'claimant_phone_calling_code',
          claim.claimant_phone_calling_code,
        'claimant_phone_national_number',
          claim.claimant_phone_national_number,
        'claimant_phone_e164',
          claim.claimant_phone_e164
      )
      order by item.ordinality
    ),
    '[]'::jsonb
  )
  into v_result
  from jsonb_array_elements(v_base)
    with ordinality as item(value, ordinality)
  join public.artist_claim_requests claim
    on claim.id =
       (item.value->>'id')::uuid;

  return v_result;
end;
$function$;

revoke all on function public.community_admin_get_artist_claims_v2(
  text,integer
)
from public, anon;
grant execute on function public.community_admin_get_artist_claims_v2(
  text,integer
)
to authenticated, service_role;

comment on column public.artist_claim_requests.claimant_phone_e164
  is 'Canonical E.164 claimant contact number captured by Artist Studio.';

commit;
