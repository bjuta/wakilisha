do $$
declare
  target_view text;
  view_options text[];
  guide_policy_count integer;
  anonymous_guide_count bigint;
  anonymous_view_count bigint;
begin
  foreach target_view in array array[
    'registry_release_tracklists',
    'wk_guides'
  ]
  loop
    select c.reloptions
      into view_options
    from pg_class c
    join pg_namespace n
      on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = target_view
      and c.relkind = 'v';

    if view_options is null
      or not (
        'security_invoker=true'
        = any(view_options)
      )
    then
      raise exception
        'View public.% is not security_invoker',
        target_view;
    end if;
  end loop;

  select count(*)
    into guide_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'guides'
    and policyname =
      'guides_public_field_guide_read'
    and cmd = 'SELECT'
    and roles @> array[
      'anon',
      'authenticated'
    ]::name[];

  if guide_policy_count <> 1 then
    raise exception
      'Expected one public field-guide read policy';
  end if;

  execute 'set local role anon';

  select count(*)
    into anonymous_guide_count
  from public.guides
  where status = 'published'
    and metadata ->> 'post_type'
      = 'wk_field_guide';

  select count(*)
    into anonymous_view_count
  from public.wk_guides;

  if anonymous_guide_count
    <> anonymous_view_count
  then
    raise exception
      'Anon guide visibility mismatch: base %, view %',
      anonymous_guide_count,
      anonymous_view_count;
  end if;

  if anonymous_view_count < 1 then
    raise exception
      'Public wk_guides unexpectedly has no rows';
  end if;

  reset role;
end
$$;

select
  c.relname as view_name,
  c.reloptions
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'registry_release_tracklists',
    'wk_guides'
  )
order by c.relname;

select
  policyname,
  roles,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and tablename = 'guides'
  and policyname =
    'guides_public_field_guide_read';
