
-- Phase 7A K5A: Video editorial command and admin read boundary.
-- K4B remains lifecycle authority. The private Video schema remains non-browser-facing.

do $preflight$
declare v_count bigint;
begin
  if to_regclass('video.publications') is null
     or to_regclass('video.sources') is null
     or to_regclass('video.caption_tracks') is null
     or to_regclass('video.publication_chapters') is null
     or to_regclass('editorial.video_publication_resources') is null
     or to_regclass('editorial.video_episode_shared_links') is null
     or to_regclass('editorial.resource_versions') is null
     or to_regclass('editorial.resource_lifecycle_events') is null
     or to_regclass('editorial.resource_review_events') is null
  then
    raise exception 'STOP: K5A requires the accepted Video/Resource kernel.';
  end if;

  select count(*) into v_count
  from platform_private.command_types c
  where c.command_type in (
    'video.publication.create',
    'video.publication.metadata.update',
    'video.source.register',
    'video.publication.source.set',
    'video.publication.show_episode.bind',
    'video.publication.poster.set',
    'video.publication.transcript.set',
    'video.publication.captions.replace',
    'video.publication.chapters.replace'
  ) and c.enabled;

  if v_count <> 9 then
    raise exception 'STOP: K2 Video editorial command vocabulary is incomplete (%/9).', v_count;
  end if;

  if to_regprocedure('public.create_video_publication(text,text,text,text,text,uuid,text,text,jsonb,uuid)') is not null
     or to_regprocedure('public.get_admin_video_publication_workspace(uuid)') is not null
  then
    raise exception 'STOP: K5A public surface already exists.';
  end if;
end;
$preflight$;

create or replace function video.normalize_slug(p_value text)
returns text
language sql
immutable
parallel safe
set search_path to 'pg_catalog'
as $f$
  select nullif(
    regexp_replace(
      regexp_replace(lower(btrim(coalesce(p_value,''))),'[^a-z0-9]+','-','g'),
      '(^-+|-+$)','','g'
    ),
    ''
  );
$f$;

create or replace function video.assert_exact_media_revision(
  p_asset_id uuid,
  p_asset_revision_id uuid,
  p_expected_asset_kind text
)
returns void
language plpgsql
stable
security definer
set search_path to 'pg_catalog','media'
as $f$
declare
  v_kind text;
  v_lifecycle text;
  v_verified text;
  v_rights text;
  v_consent text;
  v_embargo text;
  v_embargo_until timestamptz;
  v_protection text;
  v_retention text;
  v_safety text;
begin
  if p_asset_id is null
     or p_asset_revision_id is null
     or nullif(btrim(p_expected_asset_kind),'') is null
  then
    raise exception using errcode='22023',message='Exact Video Media identity is required.';
  end if;

  select
    a.asset_kind,
    a.lifecycle_state,
    f.verification_state,
    g.rights_status,
    g.consent_status,
    g.embargo_state,
    g.embargo_until,
    g.source_protection_class,
    g.retention_state,
    g.public_safety_state
  into
    v_kind,v_lifecycle,v_verified,v_rights,v_consent,
    v_embargo,v_embargo_until,v_protection,v_retention,v_safety
  from media.assets a
  join media.asset_revisions r
    on r.asset_id=a.id and r.id=p_asset_revision_id
  join media.file_objects f
    on f.id=r.original_file_object_id
  join media.asset_governance_versions g
    on g.id=a.current_governance_version_id
  where a.id=p_asset_id;

  if not found then
    raise exception using errcode='P0002',message='Exact Video Media revision does not exist.';
  end if;

  if v_kind <> p_expected_asset_kind
     or v_lifecycle <> 'active'
     or v_verified <> 'verified'
  then
    raise exception using errcode='55000',message='Video Media kind/lifecycle/verification is not eligible.';
  end if;

  if v_safety not in ('approved_public','approved_redacted')
     or v_rights not in ('owned','licensed','public_domain','fair_use')
     or v_consent not in ('granted','not_required')
     or v_protection not in ('public','public_redacted')
     or v_retention not in ('retain','review_required')
     or v_embargo='active'
     or (v_embargo='scheduled' and v_embargo_until is not null and v_embargo_until > now())
  then
    raise exception using errcode='55000',message='Current Media governance does not permit this Video usage.';
  end if;
end;
$f$;

create or replace function video.replace_working_media_usage(
  p_publication_id uuid,
  p_usage_role text,
  p_asset_id uuid,
  p_asset_revision_id uuid,
  p_placement_data jsonb,
  p_actor_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','auth','video','editorial','media','extensions'
as $f$
declare
  v_binding editorial.video_publication_resources%rowtype;
  v_current media.usage_links%rowtype;
  v_count bigint;
  v_kind text;
  v_usage_id uuid;
  v_placement jsonb := coalesce(p_placement_data,'{}'::jsonb);
begin
  if p_usage_role not in ('video_master','video_poster','video_transcript')
     or ((p_asset_id is null) <> (p_asset_revision_id is null))
     or jsonb_typeof(v_placement) <> 'object'
  then
    raise exception using errcode='22023',message='Video Media usage request is invalid.';
  end if;

  select * into v_binding
  from editorial.video_publication_resources b
  where b.publication_id=p_publication_id;

  if not found then
    raise exception 'Video publication Resource binding is missing.';
  end if;

  if p_actor_id is null
     or p_actor_id is distinct from auth.uid()
     or not editorial.current_user_can_edit_video(v_binding.resource_id)
  then
    raise exception using errcode='42501',message='Video edit permission is required.';
  end if;

  select count(*) into v_count
  from media.usage_links u
  where u.target_authority='video'
    and u.target_kind='video_publication'
    and u.target_id=p_publication_id
    and u.target_version_id is null
    and u.usage_role=p_usage_role
    and u.usage_state='active';

  if v_count > 1 then
    raise exception 'Video publication has duplicate active % usages.',p_usage_role;
  end if;

  if v_count=1 then
    select * into v_current
    from media.usage_links u
    where u.target_authority='video'
      and u.target_kind='video_publication'
      and u.target_id=p_publication_id
      and u.target_version_id is null
      and u.usage_role=p_usage_role
      and u.usage_state='active'
    for update;

    if p_asset_id is not null
       and v_current.asset_id=p_asset_id
       and v_current.asset_revision_id=p_asset_revision_id
       and v_current.resolution_mode='exact_revision'
       and v_current.placement_data=v_placement
    then
      return jsonb_build_object('usage_link_id',v_current.id,'changed',false);
    end if;

    update media.usage_links u
    set usage_state='archived',
        usage_revision=u.usage_revision+1,
        state_reason='Replaced by governed Video command',
        state_changed_by=p_actor_id,
        state_changed_at=now(),
        updated_at=now()
    where u.id=v_current.id;

    insert into media.events(
      asset_id,asset_revision_id,usage_link_id,event_type,actor_id,reason,
      prior_state,resulting_state,correlation_id
    ) values (
      v_current.asset_id,v_current.asset_revision_id,v_current.id,
      'usage_archived',p_actor_id,'Governed Video Media usage replaced',
      jsonb_build_object('usage_state','active','usage_revision',v_current.usage_revision),
      jsonb_build_object('usage_state','archived','usage_revision',v_current.usage_revision+1),
      p_correlation_id
    );
  elsif p_asset_id is null then
    return jsonb_build_object('usage_link_id',null,'changed',false);
  end if;

  if p_asset_id is null then
    return jsonb_build_object('usage_link_id',null,'changed',true);
  end if;

  v_kind := case p_usage_role
    when 'video_master' then 'video'
    when 'video_poster' then 'image'
    when 'video_transcript' then 'transcript'
  end;

  perform video.assert_exact_media_revision(p_asset_id,p_asset_revision_id,v_kind);
  perform media.validate_usage_target(
    p_actor_id,'video','video_publication',p_publication_id,
    null,null,true,true
  );

  v_usage_id := extensions.gen_random_uuid();

  insert into media.usage_links(
    id,asset_id,asset_revision_id,resolution_mode,
    target_authority,target_kind,target_id,target_version_kind,target_version_id,
    usage_role,placement_data,display_order,usage_state,usage_revision,created_by
  ) values (
    v_usage_id,p_asset_id,p_asset_revision_id,'exact_revision',
    'video','video_publication',p_publication_id,null,null,
    p_usage_role,v_placement,0,'active',1,p_actor_id
  );

  insert into media.events(
    asset_id,asset_revision_id,usage_link_id,event_type,actor_id,reason,
    resulting_state,correlation_id
  ) values (
    p_asset_id,p_asset_revision_id,v_usage_id,'usage_attached',p_actor_id,
    'Governed Video Media usage attached',
    jsonb_build_object(
      'usage_state','active','usage_revision',1,
      'target_authority','video','target_kind','video_publication',
      'target_id',p_publication_id,'usage_role',p_usage_role,
      'resolution_mode','exact_revision'
    ),
    p_correlation_id
  );

  return jsonb_build_object('usage_link_id',v_usage_id,'changed',true);
end;
$f$;

create or replace function video.source_capabilities(p_source_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog','video'
as $f$
  select case s.source_kind
    when 'native_media' then jsonb_build_object(
      'can_embed',false,
      'can_seek',true,
      'can_use_wakilisha_captions',true,
      'can_expose_provider_captions',false,
      'can_use_native_poster',true
    )
    else jsonb_build_object(
      'can_embed',true,
      'can_seek',true,
      'can_use_wakilisha_captions',true,
      'can_expose_provider_captions',s.provider_key in ('youtube','vimeo'),
      'can_use_native_poster',false
    )
  end
  from video.sources s
  where s.id=p_source_id;
$f$;

create or replace function public.create_video_publication(
  p_publication_kind text,
  p_title text,
  p_slug text,
  p_classification text,
  p_idempotency_key text,
  p_show_episode_resource_id uuid default null,
  p_summary text default null,
  p_visibility text default 'internal',
  p_metadata jsonb default '{}'::jsonb,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
  resource_id uuid,
  resource_kind text,
  authority_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','editorial','platform_private','video','extensions'
as $f$
declare
  v_context record;
  v_kind text := lower(coalesce(p_publication_kind,''));
  v_resource_kind text;
  v_title text := nullif(btrim(p_title),'');
  v_slug text := video.normalize_slug(p_slug);
  v_summary text := nullif(btrim(p_summary),'');
  v_classification text := lower(coalesce(p_classification,''));
  v_visibility text := lower(coalesce(p_visibility,'internal'));
  v_metadata jsonb := coalesce(p_metadata,'{}'::jsonb);
  v_correlation uuid := coalesce(p_correlation_id,extensions.gen_random_uuid());
  v_request jsonb;
  v_existing platform_private.command_receipts%rowtype;
  v_fingerprint text;
  v_resource_id uuid;
  v_begin record;
  v_read record;
  v_result jsonb;
begin
  select * into v_context from platform_private.command_actor_context();

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('edit_own_video')
    or public.current_user_has_capability('edit_others_video')
  ) then
    raise exception using errcode='42501',message='Video creation permission is required.';
  end if;

  if p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     or v_kind not in ('standalone','episode')
     or v_visibility not in ('private','internal','public')
     or jsonb_typeof(v_metadata)<>'object'
     or octet_length(v_metadata::text)>32768
     or not exists(
       select 1 from video.publication_classifications c
       where c.classification=v_classification and c.enabled
     )
  then
    raise exception using errcode='22023',message='Video publication input is invalid.';
  end if;

  if v_kind='standalone' then
    if v_title is null or length(v_title)>300
       or v_slug is null or length(v_slug)>200
       or length(coalesce(v_summary,''))>30000
       or p_show_episode_resource_id is not null
    then
      raise exception using errcode='22023',message='Standalone Video identity is invalid.';
    end if;
    v_resource_kind := 'standalone_video';
  else
    if p_show_episode_resource_id is null
       or not exists(
         select 1 from editorial.show_episodes e
         where e.resource_id=p_show_episode_resource_id
       )
    then
      raise exception using errcode='22023',message='Video Episode requires an existing shared Show Episode.';
    end if;
    v_resource_kind := 'video_episode';
    v_title := null; v_slug := null; v_summary := null;
  end if;

  v_request := jsonb_build_object(
    'publication_kind',v_kind,'title',v_title,'slug',v_slug,'summary',v_summary,
    'classification',v_classification,'show_episode_resource_id',p_show_episode_resource_id,
    'visibility',v_visibility,'metadata',v_metadata,'correlation_id',v_correlation
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_context.principal_key||':video.publication.create:'||p_idempotency_key,0)
  );

  select r.* into v_existing
  from platform_private.command_receipts r
  where r.principal_key=v_context.principal_key
    and r.command_type='video.publication.create'
    and r.idempotency_key=p_idempotency_key
  for update;

  if found then
    v_fingerprint := platform_private.command_request_fingerprint(
      'video.publication.create',v_existing.resource_id,v_request
    );
    if v_existing.request_fingerprint<>v_fingerprint then
      raise exception using errcode='23505',message='Video create idempotency key was reused for a different request.';
    end if;

    select * into v_read
    from platform_private.read_authenticated_resource_command_result(v_existing.id,true);

    command_receipt_id:=v_read.command_receipt_id;
    receipt_status:=v_read.receipt_status;
    publication_id:=nullif(v_read.result_payload->>'publication_id','')::uuid;
    resource_id:=v_read.resource_id;
    resource_kind:=v_read.result_payload->>'resource_kind';
    authority_revision:=nullif(v_read.result_payload->>'authority_revision','')::bigint;
    result_payload:=v_read.result_payload;
    idempotent_replay:=true;
    return next; return;
  end if;

  v_resource_id := extensions.gen_random_uuid();

  insert into editorial.resources(
    id,resource_kind,owner_id,visibility,lifecycle_state,created_by
  ) values (
    v_resource_id,v_resource_kind,v_context.actor_user_id,
    v_visibility,'draft',v_context.actor_user_id
  );

  insert into video.publications(
    id,publication_kind,standalone_slug,standalone_title,standalone_summary,
    classification,selected_source_id,authority_revision,metadata,created_by,updated_by
  ) values (
    v_resource_id,v_kind,v_slug,v_title,v_summary,
    v_classification,null,1,v_metadata,v_context.actor_user_id,v_context.actor_user_id
  );

  insert into editorial.video_publication_resources(resource_id,resource_kind,publication_id)
  values(v_resource_id,v_resource_kind,v_resource_id);

  if v_kind='episode' then
    insert into editorial.video_episode_shared_links(video_publication_id,show_episode_resource_id)
    values(v_resource_id,p_show_episode_resource_id);
  end if;

  select * into v_begin
  from platform_private.begin_authenticated_resource_command(
    'video.publication.create',v_resource_id,p_idempotency_key,v_request
  );

  if v_begin.idempotent_replay then
    raise exception 'Unexpected Video create replay after serialized preflight.';
  end if;

  v_result := jsonb_build_object(
    'publication_id',v_resource_id,'resource_id',v_resource_id,
    'resource_kind',v_resource_kind,'publication_kind',v_kind,
    'authority_revision',1,'show_episode_resource_id',p_show_episode_resource_id
  );
  perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result);

  command_receipt_id:=v_begin.command_receipt_id;
  receipt_status:='succeeded';
  publication_id:=v_resource_id;
  resource_id:=v_resource_id;
  resource_kind:=v_resource_kind;
  authority_revision:=1;
  result_payload:=v_result;
  idempotent_replay:=false;
  return next;
end;
$f$;

create or replace function public.update_video_publication_metadata(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_payload jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
  resource_id uuid,
  authority_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','editorial','platform_private','video','extensions'
as $f$
declare
  v_publication video.publications%rowtype;
  v_binding editorial.video_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
  v_begin record; v_read record; v_result jsonb;
  v_title text; v_slug text; v_summary text; v_classification text; v_visibility text;
  v_metadata jsonb; v_changed boolean:=false;
  v_correlation uuid:=coalesce(p_correlation_id,extensions.gen_random_uuid());
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_payload='{}'::jsonb
     or p_payload-array['title','slug','summary','classification','visibility','metadata']<>'{}'::jsonb
  then
    raise exception using errcode='22023',message='Video metadata request is invalid.';
  end if;

  select * into v_publication from video.publications p where p.id=p_publication_id for update;
  if not found then raise exception using errcode='P0002',message='Video publication does not exist.'; end if;

  select * into v_binding from editorial.video_publication_resources b
  where b.publication_id=p_publication_id for update;
  select * into v_resource from editorial.resources r
  where r.id=v_binding.resource_id for update;

  if not editorial.current_user_can_edit_video(v_binding.resource_id) then
    raise exception using errcode='42501',message='Video edit permission is required.';
  end if;

  select * into v_begin from platform_private.begin_authenticated_resource_command(
    'video.publication.metadata.update',v_binding.resource_id,p_idempotency_key,
    jsonb_build_object(
      'publication_id',p_publication_id,'expected_authority_revision',p_expected_authority_revision,
      'payload',p_payload,'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,true);
    command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status;
    publication_id:=p_publication_id; resource_id:=v_binding.resource_id;
    authority_revision:=nullif(v_read.result_payload->>'authority_revision','')::bigint;
    result_payload:=v_read.result_payload; idempotent_replay:=true; return next; return;
  end if;

  if v_publication.authority_revision<>p_expected_authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,'video_publication_revision_changed',
      'The Video publication changed before this update could be applied.',
      jsonb_build_object('publication_id',p_publication_id,'authority_revision',v_publication.authority_revision)
    );
  else
    v_classification:=case when p_payload?'classification'
      then lower(coalesce(p_payload->>'classification','')) else v_publication.classification end;
    v_visibility:=case when p_payload?'visibility'
      then lower(coalesce(p_payload->>'visibility','')) else v_resource.visibility end;
    v_metadata:=case when p_payload?'metadata' then coalesce(p_payload->'metadata','{}'::jsonb) else v_publication.metadata end;

    if not exists(select 1 from video.publication_classifications c where c.classification=v_classification and c.enabled)
       or v_visibility not in ('private','internal','public')
       or jsonb_typeof(v_metadata)<>'object' or octet_length(v_metadata::text)>32768
    then raise exception using errcode='22023',message='Video metadata values are invalid.'; end if;

    if v_publication.publication_kind='standalone' then
      v_title:=case when p_payload?'title' then nullif(btrim(p_payload->>'title'),'') else v_publication.standalone_title end;
      v_slug:=case when p_payload?'slug' then video.normalize_slug(p_payload->>'slug') else v_publication.standalone_slug end;
      v_summary:=case when p_payload?'summary' then nullif(btrim(p_payload->>'summary'),'') else v_publication.standalone_summary end;

      if v_title is null or length(v_title)>300 or v_slug is null or length(v_slug)>200
         or length(coalesce(v_summary,''))>30000
      then raise exception using errcode='22023',message='Standalone Video metadata is invalid.'; end if;

      if v_slug<>v_publication.standalone_slug and exists(
        select 1 from video.publications other
        where other.publication_kind='standalone'
          and other.standalone_slug=v_slug and other.id<>p_publication_id
      ) then raise exception using errcode='23505',message='Standalone Video slug already exists.'; end if;
    else
      if p_payload?'title' or p_payload?'slug' or p_payload?'summary' then
        raise exception using errcode='22023',message='Video Episode identity comes from the shared Show Episode.';
      end if;
      v_title:=null; v_slug:=null; v_summary:=null;
    end if;

    v_changed :=
      v_title is distinct from v_publication.standalone_title
      or v_slug is distinct from v_publication.standalone_slug
      or v_summary is distinct from v_publication.standalone_summary
      or v_classification is distinct from v_publication.classification
      or v_visibility is distinct from v_resource.visibility
      or v_metadata is distinct from v_publication.metadata;

    if v_changed then
      update video.publications p
      set standalone_title=v_title,standalone_slug=v_slug,standalone_summary=v_summary,
          classification=v_classification,metadata=v_metadata,
          authority_revision=p.authority_revision+1,updated_by=auth.uid(),updated_at=now()
      where p.id=p_publication_id returning * into v_publication;

      update editorial.resources r
      set visibility=v_visibility,updated_at=now()
      where r.id=v_binding.resource_id;
    end if;

    v_result:=jsonb_build_object(
      'publication_id',p_publication_id,'resource_id',v_binding.resource_id,
      'authority_revision',v_publication.authority_revision,'changed',v_changed,
      'correlation_id',v_correlation
    );
    perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result);
  end if;

  select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,false);
  command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status;
  publication_id:=p_publication_id; resource_id:=v_binding.resource_id;
  authority_revision:=coalesce(nullif(v_read.result_payload->>'authority_revision','')::bigint,v_publication.authority_revision);
  result_payload:=v_read.result_payload; idempotent_replay:=false; return next;
end;
$f$;

create or replace function public.register_video_source(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_source_kind text,
  p_idempotency_key text,
  p_media_asset_id uuid default null,
  p_media_asset_revision_id uuid default null,
  p_provider_key text default null,
  p_provider_object_id text default null,
  p_canonical_url text default null,
  p_source_metadata jsonb default '{}'::jsonb,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
  resource_id uuid,
  authority_revision bigint,
  source_id uuid,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','editorial','platform_private','video','extensions'
as $f$
declare
  v_publication video.publications%rowtype;
  v_binding editorial.video_publication_resources%rowtype;
  v_kind text:=lower(coalesce(p_source_kind,''));
  v_provider text:=lower(nullif(btrim(p_provider_key),''));
  v_object text:=nullif(btrim(p_provider_object_id),'');
  v_url text:=nullif(btrim(p_canonical_url),'');
  v_metadata jsonb:=coalesce(p_source_metadata,'{}'::jsonb);
  v_begin record; v_read record; v_result jsonb; v_source_id uuid;
  v_correlation uuid:=coalesce(p_correlation_id,extensions.gen_random_uuid());
begin
  select * into v_publication from video.publications p where p.id=p_publication_id for update;
  if not found then raise exception using errcode='P0002',message='Video publication does not exist.'; end if;
  select * into v_binding from editorial.video_publication_resources b where b.publication_id=p_publication_id;

  if not editorial.current_user_can_edit_video(v_binding.resource_id) then
    raise exception using errcode='42501',message='Video edit permission is required.';
  end if;

  if v_kind not in ('native_media','external_provider')
     or jsonb_typeof(v_metadata)<>'object' or octet_length(v_metadata::text)>32768
  then raise exception using errcode='22023',message='Video source request is invalid.'; end if;

  if v_kind='native_media' then
    if p_media_asset_id is null or p_media_asset_revision_id is null
       or v_provider is not null or v_object is not null or v_url is not null
    then raise exception using errcode='22023',message='Native Video source identity is invalid.'; end if;
    perform video.assert_exact_media_revision(p_media_asset_id,p_media_asset_revision_id,'video');
  else
    if p_media_asset_id is not null or p_media_asset_revision_id is not null
       or v_provider is null or v_object is null or v_url is null
       or v_url !~ '^https://'
       or not exists(select 1 from video.source_providers s where s.provider_key=v_provider and s.enabled)
    then raise exception using errcode='22023',message='Provider Video source identity is invalid.'; end if;
  end if;

  select * into v_begin from platform_private.begin_authenticated_resource_command(
    'video.source.register',v_binding.resource_id,p_idempotency_key,
    jsonb_build_object(
      'publication_id',p_publication_id,'expected_authority_revision',p_expected_authority_revision,
      'source_kind',v_kind,'media_asset_id',p_media_asset_id,
      'media_asset_revision_id',p_media_asset_revision_id,'provider_key',v_provider,
      'provider_object_id',v_object,'canonical_url',v_url,'source_metadata',v_metadata,
      'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,true);
    command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status;
    publication_id:=p_publication_id; resource_id:=v_binding.resource_id;
    authority_revision:=nullif(v_read.result_payload->>'authority_revision','')::bigint;
    source_id:=nullif(v_read.result_payload->>'source_id','')::uuid;
    result_payload:=v_read.result_payload; idempotent_replay:=true; return next; return;
  end if;

  if v_publication.authority_revision<>p_expected_authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,'video_publication_revision_changed',
      'The Video publication changed before this source could be registered.',
      jsonb_build_object('publication_id',p_publication_id,'authority_revision',v_publication.authority_revision)
    );
  else
    if v_kind='native_media' then
      select s.id into v_source_id from video.sources s
      where s.source_kind='native_media'
        and s.media_asset_id=p_media_asset_id
        and s.media_asset_revision_id=p_media_asset_revision_id;
    else
      select s.id into v_source_id from video.sources s
      where s.source_kind='external_provider'
        and s.provider_key=v_provider and s.provider_object_id=v_object;
    end if;

    if v_source_id is null then
      insert into video.sources(
        source_kind,provider_key,provider_object_id,canonical_url,
        media_asset_id,media_asset_revision_id,source_metadata,created_by
      ) values (
        v_kind,v_provider,v_object,v_url,p_media_asset_id,p_media_asset_revision_id,
        v_metadata,auth.uid()
      ) returning id into v_source_id;
    end if;

    v_result:=jsonb_build_object(
      'publication_id',p_publication_id,'resource_id',v_binding.resource_id,
      'authority_revision',v_publication.authority_revision,'source_id',v_source_id,
      'source_kind',v_kind,'capabilities',video.source_capabilities(v_source_id),
      'correlation_id',v_correlation
    );
    perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result);
  end if;

  select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,false);
  command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status;
  publication_id:=p_publication_id; resource_id:=v_binding.resource_id;
  authority_revision:=coalesce(nullif(v_read.result_payload->>'authority_revision','')::bigint,v_publication.authority_revision);
  source_id:=nullif(v_read.result_payload->>'source_id','')::uuid;
  result_payload:=v_read.result_payload; idempotent_replay:=false; return next;
end;
$f$;

create or replace function public.set_video_publication_source(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_source_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,receipt_status text,publication_id uuid,resource_id uuid,
  authority_revision bigint,source_id uuid,result_payload jsonb,idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','editorial','platform_private','video','extensions'
as $f$
declare
  v_publication video.publications%rowtype;
  v_binding editorial.video_publication_resources%rowtype;
  v_source video.sources%rowtype;
  v_begin record; v_read record; v_result jsonb; v_usage jsonb;
  v_changed boolean:=false;
  v_correlation uuid:=coalesce(p_correlation_id,extensions.gen_random_uuid());
begin
  select * into v_publication from video.publications p where p.id=p_publication_id for update;
  if not found then raise exception using errcode='P0002',message='Video publication does not exist.'; end if;
  select * into v_binding from editorial.video_publication_resources b where b.publication_id=p_publication_id;
  if not editorial.current_user_can_edit_video(v_binding.resource_id) then
    raise exception using errcode='42501',message='Video edit permission is required.';
  end if;

  select * into v_source from video.sources s where s.id=p_source_id;
  if not found then raise exception using errcode='P0002',message='Video source does not exist.'; end if;

  select * into v_begin from platform_private.begin_authenticated_resource_command(
    'video.publication.source.set',v_binding.resource_id,p_idempotency_key,
    jsonb_build_object(
      'publication_id',p_publication_id,'expected_authority_revision',p_expected_authority_revision,
      'source_id',p_source_id,'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,true);
    command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status;
    publication_id:=p_publication_id; resource_id:=v_binding.resource_id;
    authority_revision:=nullif(v_read.result_payload->>'authority_revision','')::bigint;
    source_id:=nullif(v_read.result_payload->>'source_id','')::uuid;
    result_payload:=v_read.result_payload; idempotent_replay:=true; return next; return;
  end if;

  if v_publication.authority_revision<>p_expected_authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,'video_publication_revision_changed',
      'The Video publication changed before its source could be selected.',
      jsonb_build_object('publication_id',p_publication_id,'authority_revision',v_publication.authority_revision)
    );
  else
    if v_source.source_kind='native_media' then
      v_usage:=video.replace_working_media_usage(
        p_publication_id,'video_master',v_source.media_asset_id,v_source.media_asset_revision_id,
        jsonb_build_object('source_id',v_source.id),auth.uid(),v_correlation
      );
    else
      v_usage:=video.replace_working_media_usage(
        p_publication_id,'video_master',null,null,'{}'::jsonb,auth.uid(),v_correlation
      );
    end if;

    v_changed:=v_publication.selected_source_id is distinct from p_source_id
      or coalesce((v_usage->>'changed')::boolean,false);

    if v_changed then
      update video.publications p
      set selected_source_id=p_source_id,authority_revision=p.authority_revision+1,
          updated_by=auth.uid(),updated_at=now()
      where p.id=p_publication_id returning * into v_publication;
    end if;

    v_result:=jsonb_build_object(
      'publication_id',p_publication_id,'resource_id',v_binding.resource_id,
      'authority_revision',v_publication.authority_revision,'source_id',p_source_id,
      'source_kind',v_source.source_kind,'master_usage',v_usage,
      'changed',v_changed,'correlation_id',v_correlation
    );
    perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result);
  end if;

  select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,false);
  command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status;
  publication_id:=p_publication_id; resource_id:=v_binding.resource_id;
  authority_revision:=coalesce(nullif(v_read.result_payload->>'authority_revision','')::bigint,v_publication.authority_revision);
  source_id:=nullif(v_read.result_payload->>'source_id','')::uuid;
  result_payload:=v_read.result_payload; idempotent_replay:=false; return next;
end;
$f$;

create or replace function public.bind_video_publication_show_episode(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_show_episode_resource_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,receipt_status text,publication_id uuid,resource_id uuid,
  authority_revision bigint,show_episode_resource_id uuid,result_payload jsonb,idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','editorial','platform_private','video','extensions'
as $f$
declare
  v_publication video.publications%rowtype;
  v_binding editorial.video_publication_resources%rowtype;
  v_link editorial.video_episode_shared_links%rowtype;
  v_begin record; v_read record; v_result jsonb; v_changed boolean:=false;
  v_correlation uuid:=coalesce(p_correlation_id,extensions.gen_random_uuid());
begin
  select * into v_publication from video.publications p where p.id=p_publication_id for update;
  if not found then raise exception using errcode='P0002',message='Video publication does not exist.'; end if;
  if v_publication.publication_kind<>'episode' then
    raise exception using errcode='22023',message='Only a Video Episode can bind a shared Show Episode.';
  end if;
  if not exists(select 1 from editorial.show_episodes e where e.resource_id=p_show_episode_resource_id) then
    raise exception using errcode='P0002',message='Shared Show Episode does not exist.';
  end if;

  select * into v_binding from editorial.video_publication_resources b where b.publication_id=p_publication_id;
  if not editorial.current_user_can_edit_video(v_binding.resource_id) then
    raise exception using errcode='42501',message='Video edit permission is required.';
  end if;

  select * into v_begin from platform_private.begin_authenticated_resource_command(
    'video.publication.show_episode.bind',v_binding.resource_id,p_idempotency_key,
    jsonb_build_object(
      'publication_id',p_publication_id,'expected_authority_revision',p_expected_authority_revision,
      'show_episode_resource_id',p_show_episode_resource_id,'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,true);
    command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status;
    publication_id:=p_publication_id; resource_id:=v_binding.resource_id;
    authority_revision:=nullif(v_read.result_payload->>'authority_revision','')::bigint;
    show_episode_resource_id:=nullif(v_read.result_payload->>'show_episode_resource_id','')::uuid;
    result_payload:=v_read.result_payload; idempotent_replay:=true; return next; return;
  end if;

  if v_publication.authority_revision<>p_expected_authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,'video_publication_revision_changed',
      'The Video publication changed before its Show Episode could be rebound.',
      jsonb_build_object('publication_id',p_publication_id,'authority_revision',v_publication.authority_revision)
    );
  else
    select * into v_link from editorial.video_episode_shared_links l
    where l.video_publication_id=p_publication_id for update;

    v_changed:=not found or v_link.show_episode_resource_id is distinct from p_show_episode_resource_id;
    if v_changed then
      insert into editorial.video_episode_shared_links(video_publication_id,show_episode_resource_id)
      values(p_publication_id,p_show_episode_resource_id)
      on conflict(video_publication_id) do update
      set show_episode_resource_id=excluded.show_episode_resource_id;

      update video.publications p
      set authority_revision=p.authority_revision+1,updated_by=auth.uid(),updated_at=now()
      where p.id=p_publication_id returning * into v_publication;
    end if;

    v_result:=jsonb_build_object(
      'publication_id',p_publication_id,'resource_id',v_binding.resource_id,
      'authority_revision',v_publication.authority_revision,
      'show_episode_resource_id',p_show_episode_resource_id,
      'changed',v_changed,'correlation_id',v_correlation
    );
    perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result);
  end if;

  select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,false);
  command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status;
  publication_id:=p_publication_id; resource_id:=v_binding.resource_id;
  authority_revision:=coalesce(nullif(v_read.result_payload->>'authority_revision','')::bigint,v_publication.authority_revision);
  show_episode_resource_id:=nullif(v_read.result_payload->>'show_episode_resource_id','')::uuid;
  result_payload:=v_read.result_payload; idempotent_replay:=false; return next;
end;
$f$;

create or replace function video.set_single_media_command(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_usage_role text,
  p_asset_id uuid,
  p_asset_revision_id uuid,
  p_placement_data jsonb,
  p_command_type text,
  p_idempotency_key text,
  p_correlation_id uuid
)
returns table(
  command_receipt_id uuid,receipt_status text,publication_id uuid,resource_id uuid,
  authority_revision bigint,usage_link_id uuid,result_payload jsonb,idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','editorial','platform_private','video','extensions'
as $f$
declare
  v_publication video.publications%rowtype;
  v_binding editorial.video_publication_resources%rowtype;
  v_begin record; v_read record; v_result jsonb; v_usage jsonb;
  v_correlation uuid:=coalesce(p_correlation_id,extensions.gen_random_uuid());
begin
  select * into v_publication from video.publications p where p.id=p_publication_id for update;
  if not found then raise exception using errcode='P0002',message='Video publication does not exist.'; end if;
  select * into v_binding from editorial.video_publication_resources b where b.publication_id=p_publication_id;
  if not editorial.current_user_can_edit_video(v_binding.resource_id) then
    raise exception using errcode='42501',message='Video edit permission is required.';
  end if;

  select * into v_begin from platform_private.begin_authenticated_resource_command(
    p_command_type,v_binding.resource_id,p_idempotency_key,
    jsonb_build_object(
      'publication_id',p_publication_id,'expected_authority_revision',p_expected_authority_revision,
      'asset_id',p_asset_id,'asset_revision_id',p_asset_revision_id,
      'placement_data',coalesce(p_placement_data,'{}'::jsonb),'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,true);
    command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status;
    publication_id:=p_publication_id; resource_id:=v_binding.resource_id;
    authority_revision:=nullif(v_read.result_payload->>'authority_revision','')::bigint;
    usage_link_id:=nullif(v_read.result_payload->>'usage_link_id','')::uuid;
    result_payload:=v_read.result_payload; idempotent_replay:=true; return next; return;
  end if;

  if v_publication.authority_revision<>p_expected_authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,'video_publication_revision_changed',
      'The Video publication changed before its Media relationship could be updated.',
      jsonb_build_object('publication_id',p_publication_id,'authority_revision',v_publication.authority_revision)
    );
  else
    v_usage:=video.replace_working_media_usage(
      p_publication_id,p_usage_role,p_asset_id,p_asset_revision_id,
      coalesce(p_placement_data,'{}'::jsonb),auth.uid(),v_correlation
    );

    if coalesce((v_usage->>'changed')::boolean,false) then
      update video.publications p
      set authority_revision=p.authority_revision+1,updated_by=auth.uid(),updated_at=now()
      where p.id=p_publication_id returning * into v_publication;
    end if;

    v_result:=jsonb_build_object(
      'publication_id',p_publication_id,'resource_id',v_binding.resource_id,
      'authority_revision',v_publication.authority_revision,
      'usage_link_id',nullif(v_usage->>'usage_link_id','')::uuid,
      'changed',coalesce((v_usage->>'changed')::boolean,false),
      'correlation_id',v_correlation
    );
    perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result);
  end if;

  select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,false);
  command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status;
  publication_id:=p_publication_id; resource_id:=v_binding.resource_id;
  authority_revision:=coalesce(nullif(v_read.result_payload->>'authority_revision','')::bigint,v_publication.authority_revision);
  usage_link_id:=nullif(v_read.result_payload->>'usage_link_id','')::uuid;
  result_payload:=v_read.result_payload; idempotent_replay:=false; return next;
end;
$f$;

create or replace function public.set_video_publication_poster(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_asset_id uuid,
  p_asset_revision_id uuid,
  p_placement_data jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,receipt_status text,publication_id uuid,resource_id uuid,
  authority_revision bigint,usage_link_id uuid,result_payload jsonb,idempotent_replay boolean
)
language sql
security definer
set search_path to 'pg_catalog','video'
as $f$
  select * from video.set_single_media_command(
    p_publication_id,p_expected_authority_revision,'video_poster',
    p_asset_id,p_asset_revision_id,coalesce(p_placement_data,'{}'::jsonb),
    'video.publication.poster.set',p_idempotency_key,p_correlation_id
  );
$f$;

create or replace function public.set_video_publication_transcript(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_asset_id uuid,
  p_asset_revision_id uuid,
  p_placement_data jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,receipt_status text,publication_id uuid,resource_id uuid,
  authority_revision bigint,usage_link_id uuid,result_payload jsonb,idempotent_replay boolean
)
language sql
security definer
set search_path to 'pg_catalog','video'
as $f$
  select * from video.set_single_media_command(
    p_publication_id,p_expected_authority_revision,'video_transcript',
    p_asset_id,p_asset_revision_id,coalesce(p_placement_data,'{}'::jsonb),
    'video.publication.transcript.set',p_idempotency_key,p_correlation_id
  );
$f$;

create or replace function public.replace_video_publication_captions(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_tracks jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,receipt_status text,publication_id uuid,resource_id uuid,
  authority_revision bigint,caption_count integer,result_payload jsonb,idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','editorial','platform_private','video','media','extensions'
as $f$
declare
  v_publication video.publications%rowtype;
  v_binding editorial.video_publication_resources%rowtype;
  v_begin record; v_read record; v_result jsonb;
  v_actor uuid:=auth.uid(); v_count integer:=0;
  v_correlation uuid:=coalesce(p_correlation_id,extensions.gen_random_uuid());
  v_old record;
  v_usage_id uuid;
begin
  if jsonb_typeof(coalesce(p_tracks,'[]'::jsonb))<>'array' then
    raise exception using errcode='22023',message='Video captions must be a JSON array.';
  end if;

  if (
    select count(*) from jsonb_array_elements(coalesce(p_tracks,'[]'::jsonb)) item
    where coalesce((item->>'is_default')::boolean,false)
  ) > 1 then
    raise exception using errcode='22023',message='Video may have only one default caption track.';
  end if;

  select * into v_publication from video.publications p where p.id=p_publication_id for update;
  if not found then raise exception using errcode='P0002',message='Video publication does not exist.'; end if;
  select * into v_binding from editorial.video_publication_resources b where b.publication_id=p_publication_id;
  if not editorial.current_user_can_edit_video(v_binding.resource_id) then
    raise exception using errcode='42501',message='Video edit permission is required.';
  end if;

  if exists(
    select 1
    from jsonb_array_elements(coalesce(p_tracks,'[]'::jsonb)) with ordinality as x(item,ordinality)
    where nullif(btrim(x.item->>'label'),'') is null
       or nullif(btrim(x.item->>'language_tag'),'') is null
       or lower(replace(btrim(x.item->>'language_tag'),'_','-')) !~ '^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$'
       or not exists(
         select 1 from video.caption_track_kinds k
         where k.track_kind=lower(coalesce(x.item->>'track_kind','')) and k.enabled
       )
       or nullif(x.item->>'media_asset_id','') is null
       or nullif(x.item->>'media_asset_revision_id','') is null
  ) then
    raise exception using errcode='22023',message='Video caption track values are invalid.';
  end if;

  perform video.assert_exact_media_revision(
    (x.item->>'media_asset_id')::uuid,
    (x.item->>'media_asset_revision_id')::uuid,
    'caption'
  )
  from jsonb_array_elements(coalesce(p_tracks,'[]'::jsonb)) as x(item);

  select * into v_begin from platform_private.begin_authenticated_resource_command(
    'video.publication.captions.replace',v_binding.resource_id,p_idempotency_key,
    jsonb_build_object(
      'publication_id',p_publication_id,'expected_authority_revision',p_expected_authority_revision,
      'tracks',coalesce(p_tracks,'[]'::jsonb),'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,true);
    command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status;
    publication_id:=p_publication_id; resource_id:=v_binding.resource_id;
    authority_revision:=nullif(v_read.result_payload->>'authority_revision','')::bigint;
    caption_count:=coalesce(nullif(v_read.result_payload->>'caption_count','')::integer,0);
    result_payload:=v_read.result_payload; idempotent_replay:=true; return next; return;
  end if;

  if v_publication.authority_revision<>p_expected_authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,'video_publication_revision_changed',
      'The Video publication changed before its captions could be saved.',
      jsonb_build_object('publication_id',p_publication_id,'authority_revision',v_publication.authority_revision)
    );
  else
    for v_old in
      select * from media.usage_links u
      where u.target_authority='video' and u.target_kind='video_publication'
        and u.target_id=p_publication_id and u.target_version_id is null
        and u.usage_role='video_caption' and u.usage_state='active'
      for update
    loop
      update media.usage_links u
      set usage_state='archived',usage_revision=u.usage_revision+1,
          state_reason='Replaced by governed Video captions command',
          state_changed_by=v_actor,state_changed_at=now(),updated_at=now()
      where u.id=v_old.id;

      insert into media.events(
        asset_id,asset_revision_id,usage_link_id,event_type,actor_id,reason,
        prior_state,resulting_state,correlation_id
      ) values (
        v_old.asset_id,v_old.asset_revision_id,v_old.id,'usage_archived',v_actor,
        'Governed Video caption usage replaced',
        jsonb_build_object('usage_state','active','usage_revision',v_old.usage_revision),
        jsonb_build_object('usage_state','archived','usage_revision',v_old.usage_revision+1),
        v_correlation
      );
    end loop;

    delete from video.caption_tracks t where t.publication_id=p_publication_id;

    insert into video.caption_tracks(
      publication_id,media_asset_id,media_asset_revision_id,language_tag,track_kind,
      label,is_default,display_order,authority_revision,created_by,updated_by
    )
    select
      p_publication_id,
      (x.item->>'media_asset_id')::uuid,
      (x.item->>'media_asset_revision_id')::uuid,
      lower(replace(btrim(x.item->>'language_tag'),'_','-')),
      lower(x.item->>'track_kind'),
      btrim(x.item->>'label'),
      coalesce((x.item->>'is_default')::boolean,false),
      (x.ordinality-1)::integer,
      1,v_actor,v_actor
    from jsonb_array_elements(coalesce(p_tracks,'[]'::jsonb)) with ordinality as x(item,ordinality);

    get diagnostics v_count=row_count;

    for v_old in
      select
        t.media_asset_id as asset_id,
        t.media_asset_revision_id as asset_revision_id,
        t.id,
        t.display_order,
        t.language_tag,
        t.track_kind,
        t.label,
        t.is_default
      from video.caption_tracks t
      where t.publication_id=p_publication_id
      order by t.display_order,t.id
    loop
      perform media.validate_usage_target(
        v_actor,'video','video_publication',p_publication_id,null,null,true,true
      );
      v_usage_id:=extensions.gen_random_uuid();

      insert into media.usage_links(
        id,asset_id,asset_revision_id,resolution_mode,target_authority,target_kind,target_id,
        target_version_kind,target_version_id,usage_role,placement_data,display_order,
        usage_state,usage_revision,created_by
      ) values (
        v_usage_id,v_old.asset_id,v_old.asset_revision_id,'exact_revision',
        'video','video_publication',p_publication_id,null,null,'video_caption',
        jsonb_build_object(
          'caption_track_id',v_old.id,'language_tag',v_old.language_tag,
          'track_kind',v_old.track_kind,'label',v_old.label,'is_default',v_old.is_default
        ),
        v_old.display_order,'active',1,v_actor
      );

      insert into media.events(
        asset_id,asset_revision_id,usage_link_id,event_type,actor_id,reason,
        resulting_state,correlation_id
      ) values (
        v_old.asset_id,v_old.asset_revision_id,v_usage_id,'usage_attached',v_actor,
        'Governed Video caption usage attached',
        jsonb_build_object(
          'usage_state','active','usage_revision',1,'target_authority','video',
          'target_kind','video_publication','target_id',p_publication_id,
          'usage_role','video_caption','resolution_mode','exact_revision'
        ),
        v_correlation
      );
    end loop;

    update video.publications p
    set authority_revision=p.authority_revision+1,updated_by=v_actor,updated_at=now()
    where p.id=p_publication_id returning * into v_publication;

    v_result:=jsonb_build_object(
      'publication_id',p_publication_id,'resource_id',v_binding.resource_id,
      'authority_revision',v_publication.authority_revision,'caption_count',v_count,
      'correlation_id',v_correlation
    );
    perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result);
  end if;

  select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,false);
  command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status;
  publication_id:=p_publication_id; resource_id:=v_binding.resource_id;
  authority_revision:=coalesce(nullif(v_read.result_payload->>'authority_revision','')::bigint,v_publication.authority_revision);
  caption_count:=coalesce(nullif(v_read.result_payload->>'caption_count','')::integer,0);
  result_payload:=v_read.result_payload; idempotent_replay:=false; return next;
end;
$f$;

create or replace function public.replace_video_publication_chapters(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_chapters jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,receipt_status text,publication_id uuid,resource_id uuid,
  authority_revision bigint,chapter_count integer,result_payload jsonb,idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','editorial','platform_private','video','extensions'
as $f$
declare
  v_publication video.publications%rowtype;
  v_binding editorial.video_publication_resources%rowtype;
  v_begin record; v_read record; v_result jsonb; v_count integer:=0;
  v_correlation uuid:=coalesce(p_correlation_id,extensions.gen_random_uuid());
begin
  if jsonb_typeof(coalesce(p_chapters,'[]'::jsonb))<>'array' then
    raise exception using errcode='22023',message='Video chapters must be a JSON array.';
  end if;

  if exists(
    select 1 from (
      select
        x.ordinality,
        nullif(btrim(x.item->>'title'),'') title,
        nullif(x.item->>'start_seconds','')::numeric start_seconds,
        lag(nullif(x.item->>'start_seconds','')::numeric) over(order by x.ordinality) prior_start
      from jsonb_array_elements(coalesce(p_chapters,'[]'::jsonb)) with ordinality as x(item,ordinality)
    ) p
    where p.title is null or p.start_seconds is null or p.start_seconds<0
       or (p.prior_start is not null and p.start_seconds<=p.prior_start)
  ) then
    raise exception using errcode='22023',message='Video chapters require titles and strictly increasing non-negative start times.';
  end if;

  select * into v_publication from video.publications p where p.id=p_publication_id for update;
  if not found then raise exception using errcode='P0002',message='Video publication does not exist.'; end if;
  select * into v_binding from editorial.video_publication_resources b where b.publication_id=p_publication_id;
  if not editorial.current_user_can_edit_video(v_binding.resource_id) then
    raise exception using errcode='42501',message='Video edit permission is required.';
  end if;

  select * into v_begin from platform_private.begin_authenticated_resource_command(
    'video.publication.chapters.replace',v_binding.resource_id,p_idempotency_key,
    jsonb_build_object(
      'publication_id',p_publication_id,'expected_authority_revision',p_expected_authority_revision,
      'chapters',coalesce(p_chapters,'[]'::jsonb),'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,true);
    command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status;
    publication_id:=p_publication_id; resource_id:=v_binding.resource_id;
    authority_revision:=nullif(v_read.result_payload->>'authority_revision','')::bigint;
    chapter_count:=coalesce(nullif(v_read.result_payload->>'chapter_count','')::integer,0);
    result_payload:=v_read.result_payload; idempotent_replay:=true; return next; return;
  end if;

  if v_publication.authority_revision<>p_expected_authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,'video_publication_revision_changed',
      'The Video publication changed before its chapters could be saved.',
      jsonb_build_object('publication_id',p_publication_id,'authority_revision',v_publication.authority_revision)
    );
  else
    delete from video.publication_chapters c where c.publication_id=p_publication_id;

    insert into video.publication_chapters(
      publication_id,chapter_number,start_seconds,title,description,created_by,updated_by
    )
    select
      p_publication_id,x.ordinality::integer,(x.item->>'start_seconds')::numeric,
      btrim(x.item->>'title'),nullif(btrim(x.item->>'description'),''),
      auth.uid(),auth.uid()
    from jsonb_array_elements(coalesce(p_chapters,'[]'::jsonb)) with ordinality as x(item,ordinality);

    get diagnostics v_count=row_count;

    update video.publications p
    set authority_revision=p.authority_revision+1,updated_by=auth.uid(),updated_at=now()
    where p.id=p_publication_id returning * into v_publication;

    v_result:=jsonb_build_object(
      'publication_id',p_publication_id,'resource_id',v_binding.resource_id,
      'authority_revision',v_publication.authority_revision,'chapter_count',v_count,
      'correlation_id',v_correlation
    );
    perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result);
  end if;

  select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,false);
  command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status;
  publication_id:=p_publication_id; resource_id:=v_binding.resource_id;
  authority_revision:=coalesce(nullif(v_read.result_payload->>'authority_revision','')::bigint,v_publication.authority_revision);
  chapter_count:=coalesce(nullif(v_read.result_payload->>'chapter_count','')::integer,0);
  result_payload:=v_read.result_payload; idempotent_replay:=false; return next;
end;
$f$;

create or replace function public.list_admin_video_publications()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','auth','public','editorial','video'
as $f$
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Video access requires an authenticated editor.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('view_video')
    or public.current_user_has_capability('edit_own_video')
    or public.current_user_has_capability('edit_others_video')
  ) then
    raise exception using errcode='42501',message='Video access is required.';
  end if;

  return jsonb_build_object(
    'publications',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'resource_id',r.id,'resource_kind',r.resource_kind,
        'publication_kind',p.publication_kind,
        'slug',case when p.publication_kind='standalone' then p.standalone_slug else e.slug end,
        'title',case when p.publication_kind='standalone' then p.standalone_title else e.title end,
        'summary',case when p.publication_kind='standalone' then p.standalone_summary else e.summary end,
        'classification',p.classification,'authority_revision',p.authority_revision,
        'lifecycle_state',r.lifecycle_state,
        'selected_source',case when s.id is null then null else jsonb_build_object(
          'id',s.id,'source_kind',s.source_kind,'provider_key',s.provider_key,
          'provider_object_id',s.provider_object_id,'canonical_url',s.canonical_url,
          'media_asset_id',s.media_asset_id,'media_asset_revision_id',s.media_asset_revision_id
        ) end,
        'show',case when sh.resource_id is null then null else jsonb_build_object(
          'resource_id',sh.resource_id,'slug',sh.slug,'title',sh.title
        ) end,
        'show_episode',case when e.resource_id is null then null else jsonb_build_object(
          'resource_id',e.resource_id,'slug',e.slug,'title',e.title,'episode_number',e.episode_number
        ) end,
        'versions',jsonb_build_object(
          'working',r.current_working_version_id,'submitted',r.current_submitted_version_id,
          'approved',r.current_approved_version_id,'published',r.current_published_version_id
        ),
        'updated_at',p.updated_at
      ) order by p.updated_at desc,p.id)
      from video.publications p
      join editorial.video_publication_resources b on b.publication_id=p.id
      join editorial.resources r on r.id=b.resource_id
      left join editorial.video_episode_shared_links l on l.video_publication_id=p.id
      left join editorial.show_episodes e on e.resource_id=l.show_episode_resource_id
      left join editorial.shows sh on sh.resource_id=e.show_resource_id
      left join video.sources s on s.id=p.selected_source_id
      where editorial.current_user_can_view_video(r.id)
    ),'[]'::jsonb),
    'classifications',coalesce((
      select jsonb_agg(jsonb_build_object(
        'classification',c.classification,'label',c.label,'description',c.description
      ) order by c.sort_order,c.classification)
      from video.publication_classifications c where c.enabled
    ),'[]'::jsonb),
    'source_providers',coalesce((
      select jsonb_agg(jsonb_build_object(
        'provider_key',s.provider_key,'label',s.label,'description',s.description
      ) order by s.sort_order,s.provider_key)
      from video.source_providers s where s.enabled
    ),'[]'::jsonb),
    'caption_track_kinds',coalesce((
      select jsonb_agg(jsonb_build_object(
        'track_kind',k.track_kind,'label',k.label,'description',k.description
      ) order by k.sort_order,k.track_kind)
      from video.caption_track_kinds k where k.enabled
    ),'[]'::jsonb)
  );
end;
$f$;

create or replace function public.get_admin_video_publication_workspace(p_publication_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','auth','public','editorial','video','media'
as $f$
declare
  v_p video.publications%rowtype;
  v_b editorial.video_publication_resources%rowtype;
  v_r editorial.resources%rowtype;
  v_e editorial.show_episodes%rowtype;
  v_s editorial.shows%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Video access requires an authenticated editor.';
  end if;

  select * into v_p from video.publications p where p.id=p_publication_id;
  if not found then raise exception using errcode='P0002',message='Video publication does not exist.'; end if;
  select * into v_b from editorial.video_publication_resources b where b.publication_id=p_publication_id;
  select * into v_r from editorial.resources r where r.id=v_b.resource_id;

  if not editorial.current_user_can_view_video(v_r.id) then
    raise exception using errcode='42501',message='Video access is required.';
  end if;

  if v_p.publication_kind='episode' then
    select e.* into v_e
    from editorial.video_episode_shared_links l
    join editorial.show_episodes e on e.resource_id=l.show_episode_resource_id
    where l.video_publication_id=p_publication_id;
    if not found then raise exception 'Video Episode shared Show Episode binding is missing.'; end if;

    select * into v_s from editorial.shows s where s.resource_id=v_e.show_resource_id;
    if not found then raise exception 'Shared Show does not exist.'; end if;
  end if;

  return jsonb_build_object(
    'publication',jsonb_build_object(
      'id',v_p.id,'publication_kind',v_p.publication_kind,
      'slug',case when v_p.publication_kind='standalone' then v_p.standalone_slug else v_e.slug end,
      'title',case when v_p.publication_kind='standalone' then v_p.standalone_title else v_e.title end,
      'summary',case when v_p.publication_kind='standalone' then v_p.standalone_summary else v_e.summary end,
      'classification',v_p.classification,'authority_revision',v_p.authority_revision,
      'metadata',v_p.metadata,'created_at',v_p.created_at,'updated_at',v_p.updated_at
    ),
    'resource',jsonb_build_object(
      'id',v_r.id,'resource_kind',v_r.resource_kind,'owner_id',v_r.owner_id,
      'visibility',v_r.visibility,'lifecycle_state',v_r.lifecycle_state,
      'versions',jsonb_build_object(
        'working',v_r.current_working_version_id,'submitted',v_r.current_submitted_version_id,
        'approved',v_r.current_approved_version_id,'published',v_r.current_published_version_id
      )
    ),
    'show',case when v_s.resource_id is null then null else jsonb_build_object(
      'resource_id',v_s.resource_id,'slug',v_s.slug,'title',v_s.title,
      'description',v_s.description,'authority_revision',v_s.authority_revision
    ) end,
    'show_episode',case when v_e.resource_id is null then null else jsonb_build_object(
      'resource_id',v_e.resource_id,'show_resource_id',v_e.show_resource_id,
      'slug',v_e.slug,'title',v_e.title,'summary',v_e.summary,
      'episode_number',v_e.episode_number,'authority_revision',v_e.authority_revision
    ) end,
    'selected_source',(
      select case when s.id is null then null else jsonb_build_object(
        'id',s.id,'source_kind',s.source_kind,'provider_key',s.provider_key,
        'provider_object_id',s.provider_object_id,'canonical_url',s.canonical_url,
        'media_asset_id',s.media_asset_id,'media_asset_revision_id',s.media_asset_revision_id,
        'source_metadata',s.source_metadata,'capabilities',video.source_capabilities(s.id),
        'created_at',s.created_at
      ) end
      from (select v_p.selected_source_id id) x
      left join video.sources s on s.id=x.id
    ),
    'poster',(
      select jsonb_build_object(
        'usage_link_id',u.id,'usage_revision',u.usage_revision,
        'asset_id',u.asset_id,'asset_revision_id',u.asset_revision_id,
        'placement_data',u.placement_data
      )
      from media.usage_links u
      where u.target_authority='video' and u.target_kind='video_publication'
        and u.target_id=p_publication_id and u.target_version_id is null
        and u.usage_role='video_poster' and u.usage_state='active'
      order by u.created_at desc,u.id desc limit 1
    ),
    'transcript',(
      select jsonb_build_object(
        'usage_link_id',u.id,'usage_revision',u.usage_revision,
        'asset_id',u.asset_id,'asset_revision_id',u.asset_revision_id,
        'placement_data',u.placement_data
      )
      from media.usage_links u
      where u.target_authority='video' and u.target_kind='video_publication'
        and u.target_id=p_publication_id and u.target_version_id is null
        and u.usage_role='video_transcript' and u.usage_state='active'
      order by u.created_at desc,u.id desc limit 1
    ),
    'captions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',t.id,'media_asset_id',t.media_asset_id,'media_asset_revision_id',t.media_asset_revision_id,
        'language_tag',t.language_tag,'track_kind',t.track_kind,'label',t.label,
        'is_default',t.is_default,'display_order',t.display_order,'authority_revision',t.authority_revision
      ) order by t.display_order,t.id)
      from video.caption_tracks t where t.publication_id=p_publication_id
    ),'[]'::jsonb),
    'chapters',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'chapter_number',c.chapter_number,'start_seconds',c.start_seconds,
        'title',c.title,'description',c.description
      ) order by c.chapter_number)
      from video.publication_chapters c where c.publication_id=p_publication_id
    ),'[]'::jsonb),
    'version_history',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',v.id,'version_number',v.version_number,'version_kind',v.version_kind,
        'content_fingerprint',v.content_fingerprint,'source_id',v.source_id,
        'created_by',v.created_by,'created_at',v.created_at
      ) order by v.version_number,v.id)
      from video.publication_versions v where v.publication_id=p_publication_id
    ),'[]'::jsonb),
    'review_events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'event_number',e.event_number,'target_version_id',e.target_version_id,
        'result_version_id',e.result_version_id,'action',e.action,'prior_status',e.prior_status,
        'resulting_status',e.resulting_status,'reason',e.reason,'actor_id',e.actor_id,'created_at',e.created_at
      ) order by e.event_number,e.id)
      from editorial.resource_review_events e where e.resource_id=v_r.id
    ),'[]'::jsonb),
    'lifecycle_events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'event_number',e.event_number,'version_id',e.version_id,
        'action',e.action,'prior_status',e.prior_status,'resulting_status',e.resulting_status,
        'note',e.note,'actor_id',e.actor_id,'created_at',e.created_at
      ) order by e.event_number,e.id)
      from editorial.resource_lifecycle_events e where e.resource_id=v_r.id
    ),'[]'::jsonb),
    'classifications',coalesce((
      select jsonb_agg(jsonb_build_object(
        'classification',c.classification,'label',c.label,'description',c.description
      ) order by c.sort_order,c.classification)
      from video.publication_classifications c where c.enabled
    ),'[]'::jsonb),
    'source_providers',coalesce((
      select jsonb_agg(jsonb_build_object(
        'provider_key',s.provider_key,'label',s.label,'description',s.description
      ) order by s.sort_order,s.provider_key)
      from video.source_providers s where s.enabled
    ),'[]'::jsonb),
    'caption_track_kinds',coalesce((
      select jsonb_agg(jsonb_build_object(
        'track_kind',k.track_kind,'label',k.label,'description',k.description
      ) order by k.sort_order,k.track_kind)
      from video.caption_track_kinds k where k.enabled
    ),'[]'::jsonb),
    'capabilities',jsonb_build_object(
      'can_view',editorial.current_user_can_view_video(v_r.id),
      'can_edit',editorial.current_user_can_edit_video(v_r.id),
      'can_manage_review',coalesce(public.current_user_has_capability('manage_review_queue'),false),
      'can_publish',editorial.current_user_can_publish_video(v_r.id)
    )
  );
end;
$f$;

revoke all on function video.normalize_slug(text) from public,anon,authenticated,service_role;
revoke all on function video.assert_exact_media_revision(uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function video.replace_working_media_usage(uuid,text,uuid,uuid,jsonb,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function video.source_capabilities(uuid) from public,anon,authenticated,service_role;
revoke all on function video.set_single_media_command(uuid,bigint,text,uuid,uuid,jsonb,text,text,uuid) from public,anon,authenticated,service_role;

revoke all on function public.create_video_publication(text,text,text,text,text,uuid,text,text,jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function public.update_video_publication_metadata(uuid,bigint,jsonb,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.register_video_source(uuid,bigint,text,text,uuid,uuid,text,text,text,jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function public.set_video_publication_source(uuid,bigint,uuid,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.bind_video_publication_show_episode(uuid,bigint,uuid,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.set_video_publication_poster(uuid,bigint,uuid,uuid,jsonb,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.set_video_publication_transcript(uuid,bigint,uuid,uuid,jsonb,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.replace_video_publication_captions(uuid,bigint,jsonb,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.replace_video_publication_chapters(uuid,bigint,jsonb,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.list_admin_video_publications() from public,anon,authenticated,service_role;
revoke all on function public.get_admin_video_publication_workspace(uuid) from public,anon,authenticated,service_role;

grant execute on function public.create_video_publication(text,text,text,text,text,uuid,text,text,jsonb,uuid) to authenticated;
grant execute on function public.update_video_publication_metadata(uuid,bigint,jsonb,text,uuid) to authenticated;
grant execute on function public.register_video_source(uuid,bigint,text,text,uuid,uuid,text,text,text,jsonb,uuid) to authenticated;
grant execute on function public.set_video_publication_source(uuid,bigint,uuid,text,uuid) to authenticated;
grant execute on function public.bind_video_publication_show_episode(uuid,bigint,uuid,text,uuid) to authenticated;
grant execute on function public.set_video_publication_poster(uuid,bigint,uuid,uuid,jsonb,text,uuid) to authenticated;
grant execute on function public.set_video_publication_transcript(uuid,bigint,uuid,uuid,jsonb,text,uuid) to authenticated;
grant execute on function public.replace_video_publication_captions(uuid,bigint,jsonb,text,uuid) to authenticated;
grant execute on function public.replace_video_publication_chapters(uuid,bigint,jsonb,text,uuid) to authenticated;
grant execute on function public.list_admin_video_publications() to authenticated;
grant execute on function public.get_admin_video_publication_workspace(uuid) to authenticated;

do $postflight$
declare v_count bigint;
begin
  select count(*) into v_count
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (
    'create_video_publication','update_video_publication_metadata','register_video_source',
    'set_video_publication_source','bind_video_publication_show_episode',
    'set_video_publication_poster','set_video_publication_transcript',
    'replace_video_publication_captions','replace_video_publication_chapters',
    'list_admin_video_publications','get_admin_video_publication_workspace'
  );
  if v_count<>11 then raise exception 'STOP: expected eleven K5A public Video functions, found %',v_count; end if;

  if exists(
    select 1 from information_schema.role_table_grants g
    where g.table_schema='video' and g.grantee in ('anon','authenticated','service_role')
  ) then raise exception 'STOP: private Video tables gained application-role grants'; end if;

  if has_schema_privilege('anon','video','USAGE')
     or has_schema_privilege('authenticated','video','USAGE')
     or has_schema_privilege('service_role','video','USAGE')
  then raise exception 'STOP: private Video schema gained application-role USAGE'; end if;

  if to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
     or to_regclass('video.video_series') is not null
     or to_regclass('video.shows') is not null
     or to_regclass('video.series') is not null
  then raise exception 'STOP: K5A created competing lifecycle or Show authority'; end if;

  if not has_function_privilege('authenticated','public.get_admin_video_publication_workspace(uuid)','EXECUTE')
     or has_function_privilege('anon','public.get_admin_video_publication_workspace(uuid)','EXECUTE')
     or has_function_privilege('authenticated','video.replace_working_media_usage(uuid,text,uuid,uuid,jsonb,uuid,uuid)','EXECUTE')
  then raise exception 'STOP: K5A execute privilege boundary is incorrect'; end if;

  if to_regprocedure('public.snapshot_video_publication_working_version(uuid,bigint,text,uuid)') is null
     or to_regprocedure('public.submit_video_publication_for_review(uuid,bigint,text,text,uuid)') is null
     or to_regprocedure('public.review_video_publication(uuid,bigint,uuid,text,text,text,uuid)') is null
     or to_regprocedure('public.publish_video_publication_version(uuid,bigint,uuid,text,text,uuid)') is null
  then raise exception 'STOP: accepted K4B lifecycle commands are missing'; end if;
end;
$postflight$;
