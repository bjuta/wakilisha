-- Rollback-only behavior proof for Phase 7B V1 public Video reads.

begin;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

insert into editorial.resources(
  id, resource_kind, visibility, lifecycle_state
) values (
  '00000000-0000-4000-8000-000000007b01'::uuid,
  'standalone_video',
  'public',
  'draft'
);

insert into video.sources(
  id, source_kind, provider_key, provider_object_id, canonical_url
) values (
  '00000000-0000-4000-8000-000000007b02'::uuid,
  'external_provider',
  'youtube',
  'phase7b-v1-fixture',
  'https://www.youtube.com/watch?v=phase7b-v1-fixture'
);

insert into video.publications(
  id, publication_kind, standalone_slug, standalone_title,
  standalone_summary, classification, selected_source_id
) values (
  '00000000-0000-4000-8000-000000007b03'::uuid,
  'standalone',
  'phase-7b-v1-fixture',
  'Phase 7B V1 Fixture',
  'Rollback-only public Video read fixture.',
  'documentary',
  '00000000-0000-4000-8000-000000007b02'::uuid
);

insert into editorial.video_publication_resources(
  resource_id, resource_kind, publication_id
) values (
  '00000000-0000-4000-8000-000000007b01'::uuid,
  'standalone_video',
  '00000000-0000-4000-8000-000000007b03'::uuid
);

insert into video.publication_versions(
  id, resource_id, publication_id, version_number, version_kind,
  source_authority_revision, publication_kind, slug_snapshot, title_snapshot,
  summary_snapshot, classification, source_id, content_fingerprint
) values (
  '00000000-0000-4000-8000-000000007b04'::uuid,
  '00000000-0000-4000-8000-000000007b01'::uuid,
  '00000000-0000-4000-8000-000000007b03'::uuid,
  1,
  'published',
  1,
  'standalone',
  'phase-7b-v1-fixture',
  'Phase 7B V1 Fixture',
  'Rollback-only public Video read fixture.',
  'documentary',
  '00000000-0000-4000-8000-000000007b02'::uuid,
  repeat('7', 64)
);

update editorial.resources
set lifecycle_state = 'published',
    current_published_version_id =
      '00000000-0000-4000-8000-000000007b04'::uuid
where id = '00000000-0000-4000-8000-000000007b01'::uuid;


insert into editorial.resources(
  id, resource_kind, visibility, lifecycle_state
) values
(
  '00000000-0000-4000-8000-000000007b11'::uuid,
  'show',
  'internal',
  'active'
),
(
  '00000000-0000-4000-8000-000000007b12'::uuid,
  'show_episode',
  'internal',
  'active'
),
(
  '00000000-0000-4000-8000-000000007b13'::uuid,
  'video_episode',
  'public',
  'draft'
);

insert into editorial.shows(
  resource_id, slug, title, description
) values (
  '00000000-0000-4000-8000-000000007b11'::uuid,
  'phase-7b-v1-show',
  'Phase 7B V1 Show',
  'Rollback-only shared Show identity.'
);

insert into editorial.show_episodes(
  resource_id, show_resource_id, slug, title, summary, episode_number
) values (
  '00000000-0000-4000-8000-000000007b12'::uuid,
  '00000000-0000-4000-8000-000000007b11'::uuid,
  'phase-7b-v1-episode',
  'Phase 7B V1 Episode',
  'Rollback-only shared Show Episode identity.',
  1
);

insert into video.sources(
  id, source_kind, provider_key, provider_object_id, canonical_url
) values (
  '00000000-0000-4000-8000-000000007b14'::uuid,
  'external_provider',
  'vimeo',
  'phase7b-v1-episode-fixture',
  'https://vimeo.com/phase7b-v1-episode-fixture'
);

insert into video.publications(
  id, publication_kind, classification, selected_source_id
) values (
  '00000000-0000-4000-8000-000000007b15'::uuid,
  'episode',
  'documentary',
  '00000000-0000-4000-8000-000000007b14'::uuid
);

insert into editorial.video_publication_resources(
  resource_id, resource_kind, publication_id
) values (
  '00000000-0000-4000-8000-000000007b13'::uuid,
  'video_episode',
  '00000000-0000-4000-8000-000000007b15'::uuid
);

insert into editorial.video_episode_shared_links(
  video_publication_id, show_episode_resource_id
) values (
  '00000000-0000-4000-8000-000000007b15'::uuid,
  '00000000-0000-4000-8000-000000007b12'::uuid
);

insert into video.publication_versions(
  id, resource_id, publication_id, version_number, version_kind,
  source_authority_revision, publication_kind, show_resource_id,
  show_episode_resource_id, slug_snapshot, title_snapshot, summary_snapshot,
  classification, source_id, content_fingerprint
) values (
  '00000000-0000-4000-8000-000000007b16'::uuid,
  '00000000-0000-4000-8000-000000007b13'::uuid,
  '00000000-0000-4000-8000-000000007b15'::uuid,
  1,
  'published',
  1,
  'episode',
  '00000000-0000-4000-8000-000000007b11'::uuid,
  '00000000-0000-4000-8000-000000007b12'::uuid,
  'phase-7b-v1-episode',
  'Phase 7B V1 Episode',
  'Rollback-only shared Show Episode Video.',
  'documentary',
  '00000000-0000-4000-8000-000000007b14'::uuid,
  repeat('8', 64)
);

update editorial.resources
set lifecycle_state = 'published',
    current_published_version_id =
      '00000000-0000-4000-8000-000000007b16'::uuid
where id = '00000000-0000-4000-8000-000000007b13'::uuid;

set constraints all immediate;
set local role anon;

do $phase_7b_v1_behavior$
declare
  v_publication jsonb;
  v_index jsonb;
begin
  v_publication := public.get_public_video_publication(
    'phase-7b-v1-fixture',
    null
  );

  if v_publication is null
     or v_publication->>'version_id' <>
        '00000000-0000-4000-8000-000000007b04'
     or v_publication->>'canonical_path' <>
        '/video/phase-7b-v1-fixture'
     or v_publication #>> '{delivery,kind}' <> 'provider'
     or v_publication #>> '{delivery,provider_key}' <> 'youtube'
  then
    raise exception
      'PHASE_7B_V1_BEHAVIOR_FAIL: anonymous public Video read is not exact published authority';
  end if;

  if (
    public.get_public_video_publication(
      'phase-7b-v1-episode',
      'phase-7b-v1-show'
    ) #>> '{canonical_path}'
  ) <> '/video/phase-7b-v1-show/phase-7b-v1-episode'
  then
    raise exception
      'PHASE_7B_V1_BEHAVIOR_FAIL: shared Show Episode Video route is not resolved';
  end if;

  if (
    public.get_public_video_publication(
      'phase-7b-v1-episode',
      'phase-7b-v1-show'
    ) #>> '{show,title}'
  ) <> 'Phase 7B V1 Show'
  then
    raise exception
      'PHASE_7B_V1_BEHAVIOR_FAIL: bound active Show identity is not composed';
  end if;

  v_index := public.get_public_video_index(10);

  if not exists (
    select 1
    from jsonb_array_elements(
      coalesce(v_index->'items', '[]'::jsonb)
    ) item
    where item->>'version_id' =
      '00000000-0000-4000-8000-000000007b04'
  ) then
    raise exception
      'PHASE_7B_V1_BEHAVIOR_FAIL: public Video index omitted published fixture';
  end if;

  if public.get_public_video_publication(
    'not-the-fixture',
    null
  ) is not null then
    raise exception
      'PHASE_7B_V1_BEHAVIOR_FAIL: public Video reader exposed a missing slug';
  end if;

  raise notice 'PHASE_7B_V1_PUBLIC_VIDEO_READ_DELIVERY_BEHAVIOR_PASS';
end;
$phase_7b_v1_behavior$;

reset role;
rollback;
