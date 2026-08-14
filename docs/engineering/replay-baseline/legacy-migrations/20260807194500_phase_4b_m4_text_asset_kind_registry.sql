begin;

set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $phase_4b_m4_text_kind_preflight$
begin
  if to_regclass('media.asset_kinds') is null then
    raise exception
      'STOP: Canonical Media asset-kind registry is missing';
  end if;

  if exists (
    select 1
    from media.asset_kinds
    where asset_kind in ('transcript', 'caption')
  ) then
    raise exception
      'STOP: Transcript or caption Media asset kind already exists before migration 207';
  end if;

  if to_regprocedure(
       'public.create_media_asset(text,text,text,uuid,uuid)'
     ) is null
  then
    raise exception
      'STOP: Canonical Media asset creation authority is missing';
  end if;
end;
$phase_4b_m4_text_kind_preflight$;

insert into media.asset_kinds (
  asset_kind,
  label,
  description,
  enabled,
  sort_order
)
values
  (
    'transcript',
    'Transcript',
    'Transcript file Media.',
    true,
    60
  ),
  (
    'caption',
    'Caption',
    'Caption or subtitle file Media.',
    true,
    70
  );

do $phase_4b_m4_text_kind_postflight$
begin
  if (
    select count(*)
    from media.asset_kinds
    where asset_kind in ('transcript', 'caption')
      and enabled
  ) <> 2
  then
    raise exception
      'STOP: Canonical transcript/caption Media asset kinds were not enabled';
  end if;
end;
$phase_4b_m4_text_kind_postflight$;

commit;
