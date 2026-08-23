-- Candidate only. Final repository migration is created through the Supabase
-- CLI workflow. Historical generic lyrics_correction rows remain readable.
-- New Lyrics work must use the governed Track Lyrics contribution authority.

begin;

create or replace function public.community_create_contribution(
  p_source_comment_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_entity_slug text,
  p_contribution_type text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_entity_type text := nullif(trim(coalesce(p_entity_type, '')), '');
  v_entity_id text := nullif(trim(coalesce(p_entity_id, '')), '');
  v_entity_slug text := nullif(trim(coalesce(p_entity_slug, '')), '');
  v_contribution_type text := nullif(trim(coalesce(p_contribution_type, '')), '');
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_contribution jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if v_entity_type is null then
    raise exception 'Entity type is required' using errcode = '22023';
  end if;

  if v_entity_id is null and v_entity_slug is null then
    raise exception 'Entity identity is required' using errcode = '22023';
  end if;

  if v_contribution_type is null then
    raise exception 'Contribution type is required' using errcode = '22023';
  end if;

  if v_contribution_type = 'lyrics_correction' then
    raise exception
      'Lyrics corrections use the governed Track Lyrics contribution flow'
      using errcode = '22023';
  end if;

  if p_source_comment_id is not null
     and not exists (
       select 1
       from public.community_comments comment
       where comment.id = p_source_comment_id
     )
  then
    raise exception 'Source comment not found' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
      || '|contribution|'
      || coalesce(p_source_comment_id::text, '')
      || '|'
      || v_entity_type
      || '|'
      || coalesce(v_entity_id, '')
      || '|'
      || coalesce(v_entity_slug, '')
      || '|'
      || v_contribution_type
      || '|'
      || v_payload::text,
      0
    )
  );

  select to_jsonb(contribution.*)
  into v_contribution
  from public.community_contributions contribution
  where contribution.user_id = v_user_id
    and contribution.source_comment_id is not distinct from p_source_comment_id
    and contribution.entity_type = v_entity_type
    and contribution.entity_id is not distinct from v_entity_id
    and contribution.entity_slug is not distinct from v_entity_slug
    and contribution.contribution_type = v_contribution_type
    and contribution.payload = v_payload
    and contribution.status = 'pending'
  order by contribution.created_at desc
  limit 1;

  if v_contribution is not null then
    return jsonb_build_object(
      'contribution', v_contribution,
      'created', false
    );
  end if;

  insert into public.community_contributions (
    user_id,
    source_comment_id,
    entity_type,
    entity_id,
    entity_slug,
    contribution_type,
    payload
  )
  values (
    v_user_id,
    p_source_comment_id,
    v_entity_type,
    v_entity_id,
    v_entity_slug,
    v_contribution_type,
    v_payload
  )
  returning to_jsonb(community_contributions.*)
  into v_contribution;

  return jsonb_build_object(
    'contribution', v_contribution,
    'created', true
  );
end;
$function$;

revoke all on function public.community_create_contribution(uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.community_create_contribution(uuid, text, text, text, text, jsonb)
  to authenticated, service_role;

commit;
