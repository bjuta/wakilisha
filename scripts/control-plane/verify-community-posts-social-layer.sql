\set ON_ERROR_STOP on

do $verify$
declare
  v_kind "char";
  v_save text;
  v_social text;
begin
  select c.relkind into v_kind
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='community_posts';
  if v_kind is distinct from 'r'::"char" then
    raise exception 'FAIL: community_posts is not a table';
  end if;

  select c.relkind into v_kind
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='artist_updates';
  if v_kind is distinct from 'v'::"char" then
    raise exception 'FAIL: artist_updates is not the compatibility view';
  end if;

  if to_regprocedure('public.community_get_post(uuid)') is null
     or to_regprocedure('public.community_publish_post(text,uuid,text,text,text,text)') is null
     or to_regprocedure('public.community_edit_post(uuid,text,text,text,text)') is null
     or to_regprocedure('public.community_withdraw_post(uuid,text)') is null
     or to_regprocedure('public.community_get_social_feed(integer,timestamp with time zone,text)') is null then
    raise exception 'FAIL: M7 Post RPC surface is incomplete';
  end if;

  select pg_get_constraintdef(c.oid) into v_save
  from pg_constraint c
  where c.conrelid='public.community_saves'::regclass
    and c.conname='community_saves_entity_type_capability_check';
  if position('post' in coalesce(v_save,''))=0 then
    raise exception 'FAIL: Save capability does not include post';
  end if;

  select pg_get_functiondef(
    'public.community_get_social_feed(integer,timestamp with time zone,text)'::regprocedure
  ) into v_social;
  if position('community_posts' in v_social)=0
     or position('community_get_following_feed' in v_social)=0
     or position('viewer_actor' in v_social)=0 then
    raise exception 'FAIL: social feed is not layered on Following + Posts';
  end if;

  if (
    select count(*)
    from private.phase_0a_rpc_classification c
    where c.function_signature in (
      'community_get_post(uuid)',
      'community_publish_post(text,uuid,text,text,text,text)',
      'community_edit_post(uuid,text,text,text,text)',
      'community_withdraw_post(uuid,text)',
      'community_get_social_feed(integer,timestamp with time zone,text)'
    )
  )<>5 then
    raise exception 'FAIL: M7 RPC classifications are incomplete';
  end if;
end;
$verify$;

select jsonb_build_object(
  'community_posts_total',(select count(*) from public.community_posts),
  'artist_posts',(select count(*) from public.community_posts where actor_type='artist'),
  'person_posts',(select count(*) from public.community_posts where actor_type='person'),
  'artist_compatibility_rows',(select count(*) from public.artist_updates),
  'post_saves',(select count(*) from public.community_saves where entity_type='post'),
  'post_reactions',(select count(*) from public.community_reactions where target_type='post'),
  'm7_classifications',(
    select count(*) from private.phase_0a_rpc_classification c
    where c.function_signature in (
      'community_get_post(uuid)',
      'community_publish_post(text,uuid,text,text,text,text)',
      'community_edit_post(uuid,text,text,text,text)',
      'community_withdraw_post(uuid,text)',
      'community_get_social_feed(integer,timestamp with time zone,text)'
    )
  )
) as wakilisha_m7_posts_verification;
