do $verify$
declare
  v_redirect_count bigint;
begin
  if to_regclass('public.wk_slug_redirects') is null then
    raise exception 'STOP: wk_slug_redirects is missing';
  end if;

  if to_regprocedure('platform_private.reject_slug_redirect_mutation()') is null then
    raise exception 'STOP: redirect mutation rejection function is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger
    where trigger.tgrelid = 'public.wk_slug_redirects'::regclass
      and trigger.tgname = 'wk_slug_redirects_historical_read_only'
      and not trigger.tgisinternal
      and trigger.tgenabled <> 'D'
  ) then
    raise exception 'STOP: historical read-only redirect trigger is missing or disabled';
  end if;

  if exists (
    select 1
    from pg_proc proc
    join pg_namespace namespace
      on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname in (
        'save_article_versioned',
        'apply_article_correction'
      )
      and pg_get_functiondef(proc.oid) ilike '%wk_slug_redirects%'
  ) then
    raise exception 'STOP: current Article function still references wk_slug_redirects';
  end if;

  select count(*)
  into v_redirect_count
  from public.wk_slug_redirects;

  begin
    update public.wk_slug_redirects
    set old_slug = old_slug
    where false;

    raise exception 'STOP: redirect mutation barrier did not fire';
  exception
    when sqlstate '55000' then
      null;
  end;

  raise notice
    'PASS: redirect retirement verifier; historical rows=%',
    v_redirect_count;
end;
$verify$;
