-- MIZIZI Slice 1: narrow existing authenticated Registry review/decision reads.
-- Forward-only candidate. Do not apply without disposable PostgreSQL replay,
-- real ordinary-user/reviewer JWT negative/positive reads and approved promotion.
-- No Registry decisions/receipts/operations are modified. No executor policy change.

-- Exact legacy policy, RLS, grants and capability are mandatory prerequisites.
do $preflight$
begin
  if to_regclass('public.registry_review_items') is null
     or to_regclass('public.registry_canonicalization_decisions') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null then
    raise exception 'STOP: expected Registry reader substrate absent';
  end if;

  if exists (
    select 1 from pg_class c
    where c.oid in ('public.registry_review_items'::regclass,
                    'public.registry_canonicalization_decisions'::regclass)
      and not c.relrowsecurity
  ) then
    raise exception 'STOP: Registry reader table RLS is not enabled';
  end if;

  if not has_function_privilege('authenticated',
       'public.current_user_has_capability(text)','EXECUTE') then
    raise exception 'STOP: authenticated cannot execute existing capability check';
  end if;

  if (select count(*) from pg_policies
      where schemaname='public' and tablename='registry_review_items'
        and policyname='Authenticated users can read registry review items'
        and cmd='SELECT' and roles=ARRAY['authenticated']::name[]
        and qual='true') <> 1
     or (select count(*) from pg_policies
      where schemaname='public' and tablename='registry_canonicalization_decisions'
        and policyname='Authenticated users can read registry canonicalization decision'
        and cmd='SELECT' and roles=ARRAY['authenticated']::name[]
        and qual='true') <> 1 then
    raise exception 'STOP: historical SELECT policy identity/predicate drifted';
  end if;

  if (select count(*) from pg_policies
      where schemaname='public' and tablename='registry_review_items'
        and cmd='SELECT' and 'mizizi_executor'=any(roles)
        and policyname='mizizi_executor_release_single_review_read') <> 1 then
    raise exception 'STOP: exact scoped MIZIZI executor reader policy missing';
  end if;
end;
$preflight$;

alter policy "Authenticated users can read registry review items"
  on public.registry_review_items
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select public.current_user_has_capability('view_review_queue'))
  );

alter policy "Authenticated users can read registry canonicalization decision"
  on public.registry_canonicalization_decisions
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select public.current_user_has_capability('view_review_queue'))
  );

-- Self-check policy identity and predicate after execution.
do $postflight$
declare v_tablename text; v_qual text;
begin
  foreach v_tablename in array ARRAY[
    'registry_review_items','registry_canonicalization_decisions'] loop
    select qual into v_qual from pg_policies
    where schemaname='public' and tablename=v_tablename
      and cmd='SELECT' and roles=ARRAY['authenticated']::name[];
    if v_qual is null
       or position('current_user_has_capability' in v_qual)=0
       or position('view_review_queue' in v_qual)=0
       or position('uid()' in v_qual)=0
       or v_qual='true' then
      raise exception 'STOP: % reader RLS not narrowed',v_tablename;
    end if;
  end loop;
end;
$postflight$;
