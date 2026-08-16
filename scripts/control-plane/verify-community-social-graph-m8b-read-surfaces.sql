\set ON_ERROR_STOP on

do $verify$
declare
  v_get_post text;
  v_social text;
begin
  if to_regprocedure(
       'private.community_present_post_actor(text,uuid,uuid)'
     ) is null then
    raise exception 'FAIL: Post actor presenter is missing';
  end if;

  if to_regprocedure(
       'public.community_get_social_feed_legacy_m8b(integer,timestamp with time zone,text)'
     ) is null then
    raise exception 'FAIL: M7 social feed was not preserved as a private legacy layer';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid='public.community_posts'::regclass
      and trigger_row.tgname='trg_community_posts_quoted_post_immutable'
      and not trigger_row.tgisinternal
  ) then
    raise exception 'FAIL: Quote Post link immutability trigger is missing';
  end if;

  select pg_get_functiondef(
    'public.community_get_post(uuid)'::regprocedure
  )
  into v_get_post;

  if position('quoted_post_id' in v_get_post)=0
     or position('quoted_post' in v_get_post)=0
     or position('available' in v_get_post)=0 then
    raise exception 'FAIL: Quote Post public presentation is incomplete';
  end if;

  select pg_get_functiondef(
    'public.community_get_social_feed(integer,timestamp with time zone,text)'::regprocedure
  )
  into v_social;

  if position('community_get_social_feed_legacy_m8b' in v_social)=0
     or position('community_post_reposts' in v_social)=0
     or position('community_is_blocked_target' in v_social)=0
     or position('repost_actor' in v_social)=0
     or position('repost_id' in v_social)=0
     or position('post_payload' in v_social)=0 then
    raise exception 'FAIL: Repost or Block-aware social feed presentation is incomplete';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.community_get_social_feed_legacy_m8b(integer,timestamp with time zone,text)',
       'EXECUTE'
     ) then
    raise exception 'FAIL: Legacy social feed remains directly executable';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.community_get_social_feed(integer,timestamp with time zone,text)',
       'EXECUTE'
     ) then
    raise exception 'FAIL: M8B social feed is not executable by authenticated users';
  end if;

  if not exists (
    select 1
    from private.phase_0a_rpc_classification classification
    where classification.function_signature=
      'community_get_social_feed(integer,timestamp with time zone,text)'
      and classification.access_class='authenticated_read'
  ) then
    raise exception 'FAIL: M8B social feed classification is missing';
  end if;
end;
$verify$;

select jsonb_build_object(
  'quote_posts',(
    select count(*)
    from public.community_posts
    where quoted_post_id is not null
  ),
  'active_reposts',(
    select count(*)
    from public.community_post_reposts
    where status='active'
  ),
  'active_blocks',(
    select count(*)
    from public.community_blocks
    where status='active'
  ),
  'social_feed_classified',(
    select count(*)
    from private.phase_0a_rpc_classification classification
    where classification.function_signature=
      'community_get_social_feed(integer,timestamp with time zone,text)'
      and classification.access_class='authenticated_read'
  )
) as wakilisha_m8b_m2_read_surface_verification;
