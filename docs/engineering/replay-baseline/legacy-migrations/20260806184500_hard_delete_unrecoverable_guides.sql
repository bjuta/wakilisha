begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select set_config(
  'request.jwt.claim.sub',
  '27937fb0-147f-4d0f-b735-3b9b9b82f38f',
  true
);

select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);

create temporary table target_guides
on commit drop
as
select
  id,
  slug,
  hero_image_id
from public.guide_pages
where slug in (
  'in-minor-keys',
  'dakar-biennale-2026'
);

do $preflight$
begin
  if (
    select count(*)
    from target_guides
  ) <> 2 then
    raise exception
      'STOP: Expected exactly two guide_pages targets';
  end if;

  if (
    select count(*)
    from public.guides
    where slug in (
      'in-minor-keys',
      'dakar-biennale-2026'
    )
  ) <> 2 then
    raise exception
      'STOP: Expected exactly two guides compatibility targets';
  end if;

  if (
    select count(*)
    from media.usage_links
    where target_id in (
      select id
      from target_guides
    )
      and usage_state = 'active'
  ) <> 2 then
    raise exception
      'STOP: Expected exactly two active Media guide usages';
  end if;

  if (
    select count(*)
    from media.assets
    where id in (
      select hero_image_id
      from target_guides
    )
      and lifecycle_state = 'active'
  ) <> 2 then
    raise exception
      'STOP: Expected exactly two active Media guide assets';
  end if;
end
$preflight$;

select *
from public.detach_media_usage(
  '12c7377e-0372-8b97-9e00-f85d517a8bc5'::uuid,
  1,
  'Guide hard-deleted by explicit product decision: dakar-biennale-2026 is permanently retired',
  'd3583d4f-0c53-44df-93ef-9d9c063ab5a1'::uuid
);

select *
from public.detach_media_usage(
  '740d6490-2223-201f-82a7-726cf9c6884d'::uuid,
  1,
  'Guide hard-deleted by explicit product decision: in-minor-keys is permanently retired',
  'f35c11e8-b3f2-4e94-9784-dccebf720e02'::uuid
);

select *
from public.archive_media_asset(
  '05151bd9-5f1e-4db2-bfed-367cc79274af'::uuid,
  1,
  'Guide hard-deleted by explicit product decision: Dakar Biennale guide asset is unrecoverable and permanently retired',
  'ce7700e0-c947-4380-92d7-fdc1d5a2ff90'::uuid
);

select *
from public.archive_media_asset(
  'fe59fbdb-45e3-49c6-aed5-cb67f50ee137'::uuid,
  1,
  'Guide hard-deleted by explicit product decision: In Minor Keys guide asset set is unrecoverable and permanently retired',
  '536fbf55-65c0-4520-b4b0-3f7e9dff8420'::uuid
);

update public.registry_media_assets
set
  status = 'archived',
  internal_notes = concat_ws(
    E'\n',
    nullif(internal_notes, ''),
    'Guide hard-deleted by explicit product decision on 2026-08-06; legacy asset is unrecoverable and retained only as an archived compatibility tombstone.'
  ),
  updated_at = now()
where id in (
  '05151bd9-5f1e-4db2-bfed-367cc79274af'::uuid,
  'fe59fbdb-45e3-49c6-aed5-cb67f50ee137'::uuid
);

delete from public.wk_magazine_featured_guides
where guide_slug in (
  'in-minor-keys',
  'dakar-biennale-2026'
);

delete from public.audience_interests
where entity_slug in (
  'in-minor-keys',
  'dakar-biennale-2026'
);

delete from public.signal_os_entity_daily_metrics
where entity_slug in (
  'in-minor-keys',
  'dakar-biennale-2026'
);

delete from public.signal_os_entity_signal_scores
where entity_slug in (
  'in-minor-keys',
  'dakar-biennale-2026'
);

delete from public.guide_pages
where slug in (
  'in-minor-keys',
  'dakar-biennale-2026'
);

delete from public.guides
where slug in (
  'in-minor-keys',
  'dakar-biennale-2026'
);

do $verification$
begin
  if exists (
    select 1
    from public.guide_pages
    where slug in (
      'in-minor-keys',
      'dakar-biennale-2026'
    )
  ) then
    raise exception
      'STOP: guide_pages targets remain';
  end if;

  if exists (
    select 1
    from public.guides
    where slug in (
      'in-minor-keys',
      'dakar-biennale-2026'
    )
  ) then
    raise exception
      'STOP: guides compatibility targets remain';
  end if;

  if exists (
    select 1
    from public.wk_magazine_featured_guides
    where guide_slug in (
      'in-minor-keys',
      'dakar-biennale-2026'
    )
  ) then
    raise exception
      'STOP: featured guide targets remain';
  end if;

  if exists (
    select 1
    from public.audience_interests
    where entity_slug in (
      'in-minor-keys',
      'dakar-biennale-2026'
    )
  ) then
    raise exception
      'STOP: audience-interest targets remain';
  end if;

  if exists (
    select 1
    from public.signal_os_entity_daily_metrics
    where entity_slug in (
      'in-minor-keys',
      'dakar-biennale-2026'
    )
  ) or exists (
    select 1
    from public.signal_os_entity_signal_scores
    where entity_slug in (
      'in-minor-keys',
      'dakar-biennale-2026'
    )
  ) then
    raise exception
      'STOP: Signal OS guide targets remain';
  end if;

  if (
    select count(*)
    from media.usage_links
    where target_id in (
      '087158e4-863a-4396-b70a-2afaa4bb439a'::uuid,
      '3f2d006e-e35b-429a-aff4-e45b65f752b5'::uuid
    )
      and usage_state = 'detached'
      and usage_revision = 2
  ) <> 2 then
    raise exception
      'STOP: Media usages were not detached';
  end if;

  if (
    select count(*)
    from media.assets
    where id in (
      '05151bd9-5f1e-4db2-bfed-367cc79274af'::uuid,
      'fe59fbdb-45e3-49c6-aed5-cb67f50ee137'::uuid
    )
      and lifecycle_state = 'archived'
      and authority_revision = 2
  ) <> 2 then
    raise exception
      'STOP: Media assets were not archived';
  end if;

  if (
    select count(*)
    from public.registry_media_assets
    where id in (
      '05151bd9-5f1e-4db2-bfed-367cc79274af'::uuid,
      'fe59fbdb-45e3-49c6-aed5-cb67f50ee137'::uuid
    )
      and status = 'archived'
  ) <> 2 then
    raise exception
      'STOP: Compatibility assets were not archived';
  end if;
end
$verification$;

commit;
