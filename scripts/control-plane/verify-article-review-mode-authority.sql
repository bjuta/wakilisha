-- Run only after the Article review mode authority migration is applied.

do $article_review_mode_verification$
declare
  object_name text;
begin
  foreach object_name in array array[
    'editorial.article_review_threads',
    'editorial.article_review_comments',
    'editorial.article_suggestions',
    'editorial.article_suggestion_events'
  ]
  loop
    if to_regclass(object_name) is null then
      raise exception 'STOP: Missing review object %', object_name;
    end if;
  end loop;

  if to_regprocedure(
    'public.get_article_review_workspace(uuid)'
  ) is null then
    raise exception
      'STOP: Missing get_article_review_workspace RPC';
  end if;

  if to_regprocedure(
    'public.create_article_suggestion(uuid,uuid,text,integer,integer,text,text,text,text,text,text,text,text)'
  ) is null then
    raise exception
      'STOP: Missing create_article_suggestion RPC';
  end if;

  if to_regprocedure(
    'public.add_article_review_comment(uuid,text)'
  ) is null then
    raise exception
      'STOP: Missing add_article_review_comment RPC';
  end if;

  if to_regprocedure(
    'public.reject_article_suggestion(uuid,text)'
  ) is null then
    raise exception
      'STOP: Missing reject_article_suggestion RPC';
  end if;

  if to_regprocedure(
    'public.withdraw_article_suggestion(uuid,text)'
  ) is null then
    raise exception
      'STOP: Missing withdraw_article_suggestion RPC';
  end if;

  if to_regprocedure(
    'public.mark_article_suggestion_stale(uuid,text)'
  ) is null then
    raise exception
      'STOP: Missing mark_article_suggestion_stale RPC';
  end if;

  if to_regprocedure(
    'public.accept_article_suggestion(uuid,bigint,text)'
  ) is null then
    raise exception
      'STOP: Missing accept_article_suggestion RPC';
  end if;

  if exists (
    select 1
    from pg_class relation
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'editorial'
      and relation.relname in (
        'article_review_threads',
        'article_review_comments',
        'article_suggestions',
        'article_suggestion_events'
      )
      and relation.relrowsecurity = false
  ) then
    raise exception
      'STOP: One or more Article review tables do not have RLS enabled';
  end if;

  if has_table_privilege(
    'anon',
    'editorial.article_review_threads',
    'SELECT'
  ) then
    raise exception
      'STOP: anon can read internal Article review threads';
  end if;

  if not has_table_privilege(
    'authenticated',
    'editorial.article_review_threads',
    'SELECT'
  ) then
    raise exception
      'STOP: authenticated lacks Article review read access';
  end if;

  if has_table_privilege(
    'authenticated',
    'editorial.article_suggestions',
    'INSERT,UPDATE,DELETE'
  ) then
    raise exception
      'STOP: authenticated has direct Article suggestion write privileges';
  end if;

  if has_function_privilege(
    'anon',
    'public.accept_article_suggestion(uuid,bigint,text)',
    'EXECUTE'
  ) then
    raise exception
      'STOP: anon can execute Article suggestion acceptance';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.accept_article_suggestion(uuid,bigint,text)',
    'EXECUTE'
  ) then
    raise exception
      'STOP: authenticated cannot execute governed suggestion acceptance';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_record
    join pg_class relation
      on relation.oid = constraint_record.conrelid
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'editorial'
      and relation.relname = 'article_versions'
      and constraint_record.conname =
        'article_versions_kind_check'
      and pg_get_constraintdef(
        constraint_record.oid
      ) like '%review_applied%'
  ) then
    raise exception
      'STOP: review_applied is missing from Article version authority';
  end if;
end;
$article_review_mode_verification$;

select
  'PASS: Article review mode authority verified.' as result;

-- Quality PR 2 semantic authority verification

do $verify_semantic_authority$
declare
  acceptance_definition text;
  workspace_definition text;
begin
  if to_regprocedure(
    'editorial.apply_article_review_snapshot(uuid,uuid,bigint,text)'
  ) is null then
    raise exception
      'STOP: Private review snapshot authority is missing.';
  end if;

  if to_regprocedure(
    'editorial.protect_article_review_version()'
  ) is null then
    raise exception
      'STOP: Additive review version protection is missing.';
  end if;

  if to_regprocedure(
    'editorial.protect_article_version()'
  ) is null then
    raise exception
      'STOP: Foundational Article version protection is missing.';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger
    join pg_class relation
      on relation.oid = trigger.tgrelid
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'editorial'
      and relation.relname = 'article_versions'
      and trigger.tgname =
        'article_review_versions_durable'
      and not trigger.tgisinternal
  ) then
    raise exception
      'STOP: Additive review-version delete trigger is missing.';
  end if;

  select pg_get_functiondef(
    to_regprocedure(
      'public.accept_article_suggestion(uuid,bigint,text)'
    )
  )
  into acceptance_definition;

  if acceptance_definition not like
    '%editorial.apply_article_review_snapshot%'
  then
    raise exception
      'STOP: Suggestion acceptance does not use the private review snapshot authority.';
  end if;

  if acceptance_definition like
       '%insert into editorial.article_versions%'
     or acceptance_definition like
       '%update editorial.resources%'
     or acceptance_definition like
       '%update public.wk_articles%'
  then
    raise exception
      'STOP: Suggestion acceptance still contains direct Article persistence writes.';
  end if;

  if acceptance_definition not like
    '%remaining_open_suggestions_marked_stale%'
  then
    raise exception
      'STOP: Review-round closure metadata is missing.';
  end if;

  select pg_get_functiondef(
    to_regprocedure(
      'public.get_article_review_workspace(uuid)'
    )
  )
  into workspace_definition;

  if workspace_definition like
       '%left join auth.users%'
     or workspace_definition like
       '%.email%'
  then
    raise exception
      'STOP: Review workspace still exposes auth.users email authority.';
  end if;

  if workspace_definition not like
    '%public.user_profiles%'
  then
    raise exception
      'STOP: Review workspace does not use account profile labels.';
  end if;
end
$verify_semantic_authority$;
