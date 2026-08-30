-- Phase 7A K5B: Video Editor shared Show catalog
-- Extends the existing governed Video admin index so the UI can select
-- canonical shared Show / Show Episode identity without direct private-table reads.

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
          'resource_id',e.resource_id,'show_resource_id',e.show_resource_id,
          'slug',e.slug,'title',e.title,'episode_number',e.episode_number
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
    'shows',coalesce((
      select jsonb_agg(jsonb_build_object(
        'resource_id',s.resource_id,
        'slug',s.slug,
        'title',s.title,
        'description',s.description,
        'authority_revision',s.authority_revision,
        'lifecycle_state',r.lifecycle_state
      ) order by lower(s.title),s.resource_id)
      from editorial.shows s
      join editorial.resources r on r.id=s.resource_id
    ),'[]'::jsonb),
    'show_episodes',coalesce((
      select jsonb_agg(jsonb_build_object(
        'resource_id',e.resource_id,
        'show_resource_id',e.show_resource_id,
        'slug',e.slug,
        'title',e.title,
        'summary',e.summary,
        'episode_number',e.episode_number,
        'authority_revision',e.authority_revision,
        'lifecycle_state',r.lifecycle_state,
        'video_publication_id',l.video_publication_id
      ) order by lower(s.title),e.episode_number nulls last,lower(e.title),e.resource_id)
      from editorial.show_episodes e
      join editorial.shows s on s.resource_id=e.show_resource_id
      join editorial.resources r on r.id=e.resource_id
      left join editorial.video_episode_shared_links l
        on l.show_episode_resource_id=e.resource_id
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

revoke all on function public.list_admin_video_publications()
  from public,anon,authenticated,service_role;
grant execute on function public.list_admin_video_publications()
  to authenticated;
