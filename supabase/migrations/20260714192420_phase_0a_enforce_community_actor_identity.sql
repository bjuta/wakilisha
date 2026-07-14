begin;

alter table private.phase_0a_rpc_classification
  drop constraint if exists phase_0a_rpc_classification_access_class_check;

alter table private.phase_0a_rpc_classification
  add constraint phase_0a_rpc_classification_access_class_check
  check (access_class in (
    'public_read',
    'public_bounded_write',
    'authenticated_read',
    'authenticated_self_service',
    'authenticated_command',
    'service_command',
    'internal_trigger'
  ));

create or replace function public.community_get_notification_prefs(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_prefs public.community_notification_preferences%rowtype;
begin
  if current_user <> 'service_role'
     and (auth.uid() is null or auth.uid() <> p_user_id)
  then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  perform public.community_ensure_user_account(p_user_id);

  insert into public.community_notification_preferences (
    user_id, email_digest, chart_alerts, artist_drops,
    reply_notifications, mention_notifications, follow_notifications,
    contribution_notifications, marketing_emails, created_at, updated_at
  ) values (
    p_user_id, true, true, true, true, true, false, false, false, now(), now()
  )
  on conflict (user_id) do nothing;

  select * into v_prefs
  from public.community_notification_preferences
  where user_id = p_user_id;

  return jsonb_build_object(
    'user_id', v_prefs.user_id,
    'email_digest', coalesce(v_prefs.email_digest, true),
    'chart_alerts', coalesce(v_prefs.chart_alerts, true),
    'artist_drops', coalesce(v_prefs.artist_drops, true),
    'reply_notifications', coalesce(v_prefs.reply_notifications, true),
    'mention_notifications', coalesce(v_prefs.mention_notifications, true),
    'follow_notifications', coalesce(v_prefs.follow_notifications, false),
    'contribution_notifications', coalesce(v_prefs.contribution_notifications, false),
    'marketing_emails', coalesce(v_prefs.marketing_emails, false),
    'created_at', v_prefs.created_at,
    'updated_at', v_prefs.updated_at
  );
end;
$function$;

create or replace function public.community_update_notification_prefs(
  p_user_id uuid,
  p_email_digest boolean,
  p_chart_alerts boolean,
  p_artist_drops boolean,
  p_reply_notifications boolean,
  p_mention_notifications boolean,
  p_follow_notifications boolean,
  p_contribution_notifications boolean,
  p_marketing_emails boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_prefs public.community_notification_preferences%rowtype;
begin
  if current_user <> 'service_role'
     and (auth.uid() is null or auth.uid() <> p_user_id)
  then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  perform public.community_ensure_user_account(p_user_id);

  insert into public.community_notification_preferences (
    user_id, email_digest, chart_alerts, artist_drops,
    reply_notifications, mention_notifications, follow_notifications,
    contribution_notifications, marketing_emails, created_at, updated_at
  ) values (
    p_user_id,
    coalesce(p_email_digest, true),
    coalesce(p_chart_alerts, true),
    coalesce(p_artist_drops, true),
    coalesce(p_reply_notifications, true),
    coalesce(p_mention_notifications, true),
    coalesce(p_follow_notifications, false),
    coalesce(p_contribution_notifications, false),
    coalesce(p_marketing_emails, false),
    now(), now()
  )
  on conflict (user_id) do update set
    email_digest = excluded.email_digest,
    chart_alerts = excluded.chart_alerts,
    artist_drops = excluded.artist_drops,
    reply_notifications = excluded.reply_notifications,
    mention_notifications = excluded.mention_notifications,
    follow_notifications = excluded.follow_notifications,
    contribution_notifications = excluded.contribution_notifications,
    marketing_emails = excluded.marketing_emails,
    updated_at = now();

  select * into v_prefs
  from public.community_notification_preferences
  where user_id = p_user_id;

  return jsonb_build_object(
    'user_id', v_prefs.user_id,
    'email_digest', coalesce(v_prefs.email_digest, true),
    'chart_alerts', coalesce(v_prefs.chart_alerts, true),
    'artist_drops', coalesce(v_prefs.artist_drops, true),
    'reply_notifications', coalesce(v_prefs.reply_notifications, true),
    'mention_notifications', coalesce(v_prefs.mention_notifications, true),
    'follow_notifications', coalesce(v_prefs.follow_notifications, false),
    'contribution_notifications', coalesce(v_prefs.contribution_notifications, false),
    'marketing_emails', coalesce(v_prefs.marketing_emails, false),
    'created_at', v_prefs.created_at,
    'updated_at', v_prefs.updated_at
  );
end;
$function$;

create or replace function public.community_update_profile(
  p_user_id uuid,
  p_display_name text default null,
  p_bio text default null,
  p_country text default null,
  p_city text default null,
  p_is_public boolean default true,
  p_avatar_url text default null,
  p_clear_avatar boolean default false,
  p_cover_url text default null,
  p_clear_cover boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_profile public.user_profiles%rowtype;
begin
  if current_user <> 'service_role'
     and (auth.uid() is null or auth.uid() <> p_user_id)
  then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  perform public.community_ensure_user_account(p_user_id);

  update public.user_profiles
  set
    display_name = p_display_name,
    bio = p_bio,
    country = p_country,
    city = p_city,
    is_public = coalesce(p_is_public, true),
    avatar_url = case
      when coalesce(p_clear_avatar, false) then null
      when p_avatar_url is not null then p_avatar_url
      else avatar_url
    end,
    cover_url = case
      when coalesce(p_clear_cover, false) then null
      when p_cover_url is not null then p_cover_url
      else cover_url
    end,
    updated_at = now()
  where user_id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'profile % not found', p_user_id;
  end if;

  return public.community_profile_json(v_profile);
end;
$function$;

create or replace function public.community_get_or_create_thread(
  p_entity_type text,
  p_entity_id text default null,
  p_entity_slug text default null,
  p_entity_url text default null,
  p_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_thread public.community_threads%rowtype;
  v_created boolean := false;
  v_entity_type text := nullif(trim(coalesce(p_entity_type, '')), '');
  v_entity_id text := nullif(trim(coalesce(p_entity_id, '')), '');
  v_entity_slug text := nullif(trim(coalesce(p_entity_slug, '')), '');
  v_entity_url text := nullif(trim(coalesce(p_entity_url, '')), '');
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_lock_key text;
begin
  if current_user <> 'service_role' and auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_entity_type is null then
    raise exception 'Entity type is required' using errcode = '22023';
  end if;

  if v_entity_id is null and v_entity_slug is null and v_entity_url is null then
    raise exception 'Entity id, slug, or URL is required' using errcode = '22023';
  end if;

  v_lock_key := lower(v_entity_type)
    || ':' || coalesce(v_entity_id, '')
    || ':' || coalesce(v_entity_slug, '')
    || ':' || coalesce(v_entity_url, '');

  perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 20260624));

  select * into v_thread
  from public.community_threads
  where entity_type::text = v_entity_type
    and (
      (v_entity_id is not null and entity_id::text = v_entity_id)
      or (v_entity_slug is not null and entity_slug = v_entity_slug)
      or (v_entity_url is not null and entity_url = v_entity_url)
    )
  order by created_at asc
  limit 1;

  if not found then
    begin
      insert into public.community_threads (
        entity_type, entity_id, entity_slug, entity_url, title, status
      ) values (
        v_entity_type,
        v_entity_id,
        v_entity_slug,
        v_entity_url,
        coalesce(v_title, v_entity_slug, v_entity_id, v_entity_type),
        'open'
      )
      returning * into v_thread;
      v_created := true;
    exception
      when unique_violation then
        select * into v_thread
        from public.community_threads
        where entity_type::text = v_entity_type
          and (
            (v_entity_id is not null and entity_id::text = v_entity_id)
            or (v_entity_slug is not null and entity_slug = v_entity_slug)
            or (v_entity_url is not null and entity_url = v_entity_url)
          )
        order by created_at asc
        limit 1;
        v_created := false;
    end;
  end if;

  if v_thread.id is null then
    raise exception 'Could not resolve community thread' using errcode = 'P0002';
  end if;

  return jsonb_build_object('thread', to_jsonb(v_thread), 'created', v_created);
end;
$function$;

update private.phase_0a_rpc_classification
set access_class = 'authenticated_self_service',
    rationale = 'Authenticated self-service RPC enforces caller identity against auth.uid().',
    reviewed_at = now()
where function_signature in (
  'community_get_notification_prefs(uuid)',
  'community_update_notification_prefs(uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean)',
  'community_update_profile(uuid,text,text,text,text,boolean,text,boolean,text,boolean)'
);

update private.phase_0a_rpc_classification
set access_class = 'authenticated_command',
    rationale = 'Authenticated thread creation requires a resolved actor and validates the target identity.',
    reviewed_at = now()
where function_signature = 'community_get_or_create_thread(text,text,text,text,text)';

update private.phase_0a_rpc_classification
set access_class = 'authenticated_read',
    rationale = 'Authenticated operational read or integrity check; no state transition is performed.',
    reviewed_at = now()
where function_signature in (
  'chart_assert_committable_run(text)',
  'chart_assert_publishable_edition(text)',
  'chart_assert_rule_clean_run(text)',
  'chart_candidate_rule_decision(text,date,boolean)',
  'chart_get_edition_integrity_report(text)',
  'chart_get_run_candidate_origin_report(text)',
  'chart_get_run_integrity_report(text)',
  'chart_get_run_playback_readiness(text,text)'
);

grant execute on function public.registry_get_public_track_playback_providers(uuid[], text)
  to anon, authenticated, service_role;

insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale
) values (
  'registry_get_public_track_playback_providers(uuid[],text)',
  'public_read',
  'Reviewed public playback-provider read model.'
)
on conflict (function_signature) do update
  set access_class = excluded.access_class,
      rationale = excluded.rationale,
      reviewed_at = now();

commit;
