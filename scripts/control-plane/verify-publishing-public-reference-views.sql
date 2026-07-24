do $publishing_reference_views_verify$
declare
  v_content_options text[];
  v_channel_options text[];
begin
  if to_regclass(
    'public.wk_publishing_content_kinds'
  ) is null then
    raise exception
      'FAIL: wk_publishing_content_kinds is missing';
  end if;

  if to_regclass(
    'public.wk_publishing_channels'
  ) is null then
    raise exception
      'FAIL: wk_publishing_channels is missing';
  end if;

  if not has_table_privilege(
    'authenticated',
    'public.wk_publishing_content_kinds',
    'SELECT'
  ) then
    raise exception
      'FAIL: authenticated cannot read content types';
  end if;

  if not has_table_privilege(
    'authenticated',
    'public.wk_publishing_channels',
    'SELECT'
  ) then
    raise exception
      'FAIL: authenticated cannot read channels';
  end if;

  if has_table_privilege(
    'anon',
    'public.wk_publishing_content_kinds',
    'SELECT'
  ) then
    raise exception
      'FAIL: anon can read Publishing content types';
  end if;

  if has_table_privilege(
    'anon',
    'public.wk_publishing_channels',
    'SELECT'
  ) then
    raise exception
      'FAIL: anon can read Publishing channels';
  end if;

  select relation.reloptions
  into v_content_options
  from pg_class relation
  join pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname =
      'wk_publishing_content_kinds';

  select relation.reloptions
  into v_channel_options
  from pg_class relation
  join pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname =
      'wk_publishing_channels';

  if not coalesce(
    'security_invoker=true' =
      any(v_content_options),
    false
  ) then
    raise exception
      'FAIL: Content type view is not security invoker';
  end if;

  if not coalesce(
    'security_invoker=true' =
      any(v_channel_options),
    false
  ) then
    raise exception
      'FAIL: Channel view is not security invoker';
  end if;

  raise notice
    'PASS: Publishing reference views are correctly protected';
end;
$publishing_reference_views_verify$;

select
  'content_types' as reference_set,
  count(*) as total,
  count(*) filter (where enabled) as enabled
from public.wk_publishing_content_kinds

union all

select
  'channels' as reference_set,
  count(*) as total,
  count(*) filter (where enabled) as enabled
from public.wk_publishing_channels;
