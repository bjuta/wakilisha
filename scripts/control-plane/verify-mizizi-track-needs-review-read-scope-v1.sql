do $verify$
declare
  v_policy text;
begin
  select lower(pg_get_expr(policy.polqual,policy.polrelid))
  into v_policy
  from pg_policy policy
  where policy.polrelid='public.registry_tracks'::regclass
    and policy.polname='mizizi_executor_registry_tracks_read';

  if v_policy is null
     or position('active' in v_policy)=0
     or position('needs_review' in v_policy)=0
  then
    raise exception
      'MIZIZI Track read policy does not expose the bounded active plus needs_review corpus';
  end if;

  if not has_column_privilege(
       'mizizi_executor','public.registry_tracks','id','SELECT'
     )
     or not has_column_privilege(
       'mizizi_executor','public.registry_tracks','slug','SELECT'
     )
     or not has_column_privilege(
       'mizizi_executor','public.registry_tracks','title','SELECT'
     )
     or not has_column_privilege(
       'mizizi_executor','public.registry_tracks','status','SELECT'
     )
     or not has_column_privilege(
       'mizizi_executor','public.registry_tracks','updated_at','SELECT'
     )
  then
    raise exception
      'MIZIZI Track read columns drifted';
  end if;

  if has_table_privilege(
       'mizizi_executor','public.registry_tracks','INSERT'
     )
     or has_table_privilege(
       'mizizi_executor','public.registry_tracks','UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor','public.registry_tracks','DELETE'
     )
     or has_table_privilege(
       'mizizi_executor','public.registry_review_items','INSERT'
     )
     or has_table_privilege(
       'mizizi_executor','public.registry_review_items','UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor','public.registry_review_items','DELETE'
     )
  then
    raise exception
      'MIZIZI needs-review discovery widened write authority';
  end if;

  if exists (
    select 1
    from pg_roles
    where rolname='mizizi_executor'
      and (
        rolsuper
        or rolbypassrls
        or rolcreatedb
        or rolcreaterole
        or rolreplication
        or rolinherit
      )
  ) then
    raise exception
      'mizizi_executor role shape is unsafe';
  end if;

  if to_regprocedure(
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)'
     ) is null
  then
    raise exception
      'Typed Public Music Identity review broker is missing';
  end if;

  raise notice
    'MIZIZI_TRACK_NEEDS_REVIEW_READ_SCOPE_V1_PASS';
end
$verify$;
