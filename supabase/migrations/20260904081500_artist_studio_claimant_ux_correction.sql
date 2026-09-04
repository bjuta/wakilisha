-- WAKILISHA Artist Studio claimant UX correction.
-- Additive role-detail authority for the conditional Other Role field.
-- Existing v1 and v2 claim RPCs remain intact while corrected clients use v3.

begin;

do $preflight$
begin
  if to_regclass('public.artist_claim_requests') is null
     or to_regprocedure(
          'public.community_submit_artist_claim_v2(uuid,text,text,text,text,text,text,jsonb)'
        ) is null
     or to_regprocedure(
          'public.community_submit_new_artist_claim_v2(text,text,text,text[],text,text,text,text,text,text,jsonb)'
        ) is null
     or to_regprocedure(
          'public.community_admin_get_artist_claims_v2(text,integer)'
        ) is null
  then
    raise exception
      'STOP: accepted claimant phone v2 authority is missing';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'artist_claim_requests'
      and column_name = 'claimant_role_other'
  ) then
    raise exception
      'STOP: claimant_role_other already exists';
  end if;

  if to_regprocedure(
       'public.community_submit_artist_claim_v3(uuid,text,text,text,text,text,text,text,jsonb)'
     ) is not null
     or to_regprocedure(
       'public.community_submit_new_artist_claim_v3(text,text,text,text[],text,text,text,text,text,text,text,jsonb)'
     ) is not null
     or to_regprocedure(
       'public.community_admin_get_artist_claims_v3(text,integer)'
     ) is not null
  then
    raise exception
      'STOP: claimant UX v3 function authority already exists';
  end if;
end;
$preflight$;

alter table public.artist_claim_requests
  add column claimant_role_other text;

alter table public.artist_claim_requests
  add constraint artist_claim_requests_role_other_shape
    check (
      claimant_role_other is null
      or (
        claimant_role = 'other'
        and char_length(trim(claimant_role_other))
            between 1 and 140
      )
    );

create or replace function public.community_submit_artist_claim_v3(
  p_artist_id uuid,
  p_claimant_role text,
  p_claimant_role_other text,
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
  v_role_other text :=
    nullif(trim(coalesce(p_claimant_role_other, '')), '');
  v_result jsonb;
  v_claim_id uuid;
begin
  if p_claimant_role = 'other' then
    if v_role_other is null
       or char_length(v_role_other) > 140
    then
      raise exception 'invalid_claimant_role_other';
    end if;
  elsif v_role_other is not null then
    raise exception 'invalid_claimant_role_other';
  end if;

  v_result :=
    public.community_submit_artist_claim_v2(
      p_artist_id,
      p_claimant_role,
      p_statement,
      p_phone_country_iso2,
      p_phone_calling_code,
      p_phone_national_number,
      p_phone_e164,
      p_evidence
    );

  v_claim_id :=
    nullif(v_result->>'claim_id', '')::uuid;

  if v_claim_id is null then
    raise exception 'claim_submission_missing_id';
  end if;

  update public.artist_claim_requests
  set
    claimant_role_other = v_role_other,
    updated_at = now()
  where id = v_claim_id
    and claimant_user_id = v_actor;

  if not found then
    raise exception 'claimant_role_other_update_not_authorized';
  end if;

  return v_result ||
    jsonb_build_object(
      'claimant_role_other',
      v_role_other
    );
end;
$function$;

revoke all on function public.community_submit_artist_claim_v3(
  uuid,text,text,text,text,text,text,text,jsonb
)
from public, anon;

grant execute on function public.community_submit_artist_claim_v3(
  uuid,text,text,text,text,text,text,text,jsonb
)
to authenticated, service_role;

create or replace function public.community_submit_new_artist_claim_v3(
  p_display_name text,
  p_artist_type text,
  p_origin_iso2 text,
  p_alternate_names text[],
  p_claimant_role text,
  p_claimant_role_other text,
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
  v_role_other text :=
    nullif(trim(coalesce(p_claimant_role_other, '')), '');
  v_result jsonb;
  v_claim_id uuid;
begin
  if p_claimant_role = 'other' then
    if v_role_other is null
       or char_length(v_role_other) > 140
    then
      raise exception 'invalid_claimant_role_other';
    end if;
  elsif v_role_other is not null then
    raise exception 'invalid_claimant_role_other';
  end if;

  v_result :=
    public.community_submit_new_artist_claim_v2(
      p_display_name,
      p_artist_type,
      p_origin_iso2,
      p_alternate_names,
      p_claimant_role,
      p_statement,
      p_phone_country_iso2,
      p_phone_calling_code,
      p_phone_national_number,
      p_phone_e164,
      p_evidence
    );

  v_claim_id :=
    nullif(v_result->>'claim_id', '')::uuid;

  if v_claim_id is null then
    raise exception 'claim_submission_missing_id';
  end if;

  update public.artist_claim_requests
  set
    claimant_role_other = v_role_other,
    updated_at = now()
  where id = v_claim_id
    and claimant_user_id = v_actor;

  if not found then
    raise exception 'claimant_role_other_update_not_authorized';
  end if;

  return v_result ||
    jsonb_build_object(
      'claimant_role_other',
      v_role_other
    );
end;
$function$;

revoke all on function public.community_submit_new_artist_claim_v3(
  text,text,text,text[],text,text,text,text,text,text,text,jsonb
)
from public, anon;

grant execute on function public.community_submit_new_artist_claim_v3(
  text,text,text,text[],text,text,text,text,text,text,text,jsonb
)
to authenticated, service_role;

create or replace function public.community_admin_get_artist_claims_v3(
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
    public.community_admin_get_artist_claims_v2(
      p_status,
      p_limit
    );

  select coalesce(
    jsonb_agg(
      item.value ||
      jsonb_build_object(
        'claimant_role_other',
        claim.claimant_role_other
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

revoke all on function public.community_admin_get_artist_claims_v3(
  text,integer
)
from public, anon;

grant execute on function public.community_admin_get_artist_claims_v3(
  text,integer
)
to authenticated, service_role;

comment on column public.artist_claim_requests.claimant_role_other
  is 'Plain-text claimant role detail when claimant_role is other. Maximum 140 characters.';

commit;
