-- WAKILISHA M8C.3-M7: authored Thread publication actor resolution fix.
-- PostgreSQL does not define min(uuid). Resolve the authored identity from the
-- first deterministic Draft row, then retain the existing same-author guard.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $m8c3_publish_actor_fix_preflight$
begin
  if to_regclass('private.community_post_drafts') is null
     or to_regclass('public.community_post_threads') is null
     or to_regprocedure('public.community_publish_post_draft_group(uuid)') is null
     or to_regprocedure('private.community_resolve_post_command_actor(text,uuid)') is null
     or to_regprocedure('public.community_publish_post(text,uuid,text,text,text,text,uuid)') is null
     or to_regprocedure('public.community_quote_post(text,uuid,uuid,text,text,text,text,uuid)') is null
     or to_regprocedure('public.community_get_post(uuid)') is null then
    raise exception 'STOP: M8C.3 authored Thread authority is incomplete';
  end if;
end;
$m8c3_publish_actor_fix_preflight$;

create or replace function public.community_publish_post_draft_group(
  p_draft_group_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial,private
as $function$
declare
  v_user uuid:=auth.uid();
  v_count integer;
  v_actor_type text;
  v_actor_id uuid;
  v_person_id uuid;
  v_artist_id uuid;
  v_actor record;
  v_thread_id uuid;
  v_draft private.community_post_drafts%rowtype;
  v_payload jsonb;
  v_post_id uuid;
  v_posts jsonb:='[]'::jsonb;
  v_expected_position integer:=0;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_draft_group_id is null then raise exception 'post_draft_group_required'; end if;

  select count(*) into v_count
  from private.community_post_drafts draft
  where draft.author_user_id=v_user
    and draft.draft_group_id=p_draft_group_id;

  if v_count<1 then raise exception 'post_draft_group_not_found'; end if;
  if v_count>50 then raise exception 'thread_too_long'; end if;

  select
    draft.actor_type,
    draft.person_resource_id,
    draft.artist_id
  into v_actor_type,v_person_id,v_artist_id
  from private.community_post_drafts draft
  where draft.author_user_id=v_user
    and draft.draft_group_id=p_draft_group_id
  order by draft.position,draft.id
  limit 1;

  if v_actor_type is null then raise exception 'post_draft_group_not_found'; end if;

  if exists (
    select 1
    from private.community_post_drafts draft
    where draft.author_user_id=v_user
      and draft.draft_group_id=p_draft_group_id
      and (
        draft.actor_type is distinct from v_actor_type
        or draft.person_resource_id is distinct from v_person_id
        or draft.artist_id is distinct from v_artist_id
      )
  ) then
    raise exception 'thread_draft_actor_mismatch';
  end if;

  v_actor_id:=case when v_actor_type='person' then v_person_id else v_artist_id end;
  select * into v_actor
  from private.community_resolve_post_command_actor(v_actor_type,v_actor_id);

  if v_count>1 then
    insert into public.community_post_threads (
      actor_type,person_resource_id,artist_id,author_user_id
    ) values (
      v_actor.resolved_actor_type,
      v_actor.person_resource_id,
      v_actor.artist_id,
      v_user
    ) returning id into v_thread_id;
  end if;

  for v_draft in
    select *
    from private.community_post_drafts draft
    where draft.author_user_id=v_user
      and draft.draft_group_id=p_draft_group_id
    order by draft.position,draft.id
    for update
  loop
    v_expected_position:=v_expected_position+1;

    if nullif(btrim(v_draft.body),'') is null
       and nullif(btrim(coalesce(v_draft.image_url,'')),'') is null
       and nullif(btrim(coalesce(v_draft.link_url,'')),'') is null
       and v_draft.registry_track_id is null then
      raise exception 'invalid_post_content';
    end if;

    if v_draft.quoted_post_id is null then
      v_payload:=public.community_publish_post(
        v_actor.resolved_actor_type,
        v_actor_id,
        v_draft.body,
        v_draft.image_url,
        v_draft.link_url,
        v_draft.link_label,
        v_draft.registry_track_id
      );
    else
      v_payload:=public.community_quote_post(
        v_actor.resolved_actor_type,
        v_actor_id,
        v_draft.quoted_post_id,
        v_draft.body,
        v_draft.image_url,
        v_draft.link_url,
        v_draft.link_label,
        v_draft.registry_track_id
      );
    end if;

    v_post_id:=nullif(v_payload->>'id','')::uuid;
    if v_post_id is null then raise exception 'post_publish_failed'; end if;

    if v_thread_id is not null then
      update public.community_posts
      set thread_id=v_thread_id,
          thread_position=v_expected_position,
          updated_at=now()
      where id=v_post_id
        and author_user_id=v_user;

      if not found then raise exception 'thread_post_link_failed'; end if;
    end if;

    v_posts:=v_posts || jsonb_build_array(public.community_get_post(v_post_id));
  end loop;

  delete from private.community_post_drafts draft
  where draft.author_user_id=v_user
    and draft.draft_group_id=p_draft_group_id;

  return jsonb_build_object(
    'draft_group_id',p_draft_group_id,
    'thread_id',v_thread_id,
    'post_count',v_count,
    'posts',v_posts
  );
end;
$function$;

revoke all on function public.community_publish_post_draft_group(uuid) from public,anon;
grant execute on function public.community_publish_post_draft_group(uuid) to authenticated;

update private.phase_0a_rpc_classification
set
  rationale='Atomically publishes one draft or an ordered same-author Thread by resolving the authored identity deterministically and reusing the canonical Post and Quote Post writers.',
  reviewed_at=now()
where function_signature='community_publish_post_draft_group(uuid)';

do $m8c3_publish_actor_fix_postcondition$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.community_publish_post_draft_group(uuid)'::regprocedure)
  into v_definition;

  if position('min(draft.person_resource_id)' in lower(v_definition))>0
     or position('min(draft.artist_id)' in lower(v_definition))>0 then
    raise exception 'STOP: UUID aggregate actor resolution is still present';
  end if;

  if position('order by draft.position,draft.id' in lower(v_definition))=0
     or position('limit 1' in lower(v_definition))=0 then
    raise exception 'STOP: deterministic authored identity resolution did not land';
  end if;
end;
$m8c3_publish_actor_fix_postcondition$;

commit;
