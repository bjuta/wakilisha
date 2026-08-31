set local lock_timeout = '5s';

alter table video.caption_tracks
  drop constraint if exists caption_tracks_language_tag_check;

alter table video.caption_tracks
  add constraint caption_tracks_language_tag_check
  check (
    language_tag = lower(replace(btrim(language_tag), '_', '-'))
    and language_tag ~ '^[a-z]{2,3}(?:-[a-z0-9]{2,8})*(?:-x(?:-[a-z0-9]{1,8})+)?$'
  );

alter table video.publication_version_caption_tracks
  drop constraint if exists publication_version_caption_tracks_language_tag_check;

alter table video.publication_version_caption_tracks
  add constraint publication_version_caption_tracks_language_tag_check
  check (
    language_tag = lower(replace(btrim(language_tag), '_', '-'))
    and language_tag ~ '^[a-z]{2,3}(?:-[a-z0-9]{2,8})*(?:-x(?:-[a-z0-9]{1,8})+)?$'
  );

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
       or lower(replace(btrim(x.item->>'language_tag'),'_','-')) !~ '^[a-z]{2,3}(?:-[a-z0-9]{2,8})*(?:-x(?:-[a-z0-9]{1,8})+)?$'
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