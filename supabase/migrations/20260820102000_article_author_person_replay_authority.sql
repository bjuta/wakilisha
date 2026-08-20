-- Replay-safe enduring authority extracted from the retired production-data
-- reconciliation migration 20260819124500_article_author_person_convergence.
--
-- The original migration remains byte-identical under
-- docs/engineering/replay-baseline/retired-active-migrations/.
--
-- This active migration intentionally excludes:
-- - named production Person assertions;
-- - production Follow assertions;
-- - the 134-Article human manifest digest;
-- - the 109 missing-credit backfill;
-- - the 73 Wakilisha Staff boundary assertion.
--
-- It retains only the enduring public Registry Author -> canonical Person
-- compatibility resolver required by current runtime.

begin;

do $article_author_person_replay_preflight$
begin
  if to_regclass('public.registry_authors') is null
     or to_regclass('editorial.person_identity_links') is null
     or to_regclass('editorial.people') is null
     or to_regclass('editorial.resources') is null
     or to_regclass('editorial.resource_aliases') is null
  then
    raise exception
      'STOP: Article Author Person replay authority dependencies are missing';
  end if;
end;
$article_author_person_replay_preflight$;

create or replace function
public.resolve_public_registry_author_person(
  p_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_slug text;
  v_person_id uuid;
  v_person editorial.people%rowtype;
  v_path text;
  v_depth integer := 0;
begin
  v_slug :=
    lower(
      trim(
        both '/'
        from btrim(
          coalesce(
            p_slug,
            ''
          )
        )
      )
    );

  if v_slug = '' then
    return null;
  end if;

  select link.person_resource_id
  into v_person_id
  from public.registry_authors author_record
  join editorial.person_identity_links link
    on link.registry_author_id =
       author_record.id
   and link.link_state = 'active'
  where author_record.slug =
        v_slug
  limit 1;

  if not found then
    return null;
  end if;

  loop
    v_depth := v_depth + 1;

    if v_depth > 8 then
      return null;
    end if;

    select person.*
    into v_person
    from editorial.people person
    where person.resource_id =
          v_person_id;

    if not found then
      return null;
    end if;

    exit when
      v_person.person_state <>
      'merged';

    if v_person.merged_into_person_resource_id
         is null
    then
      return null;
    end if;

    v_person_id :=
      v_person.merged_into_person_resource_id;
  end loop;

  if v_person.person_state <> 'active' then
    return null;
  end if;

  if not exists (
    select 1
    from editorial.resources resource
    where resource.id = v_person_id
      and resource.resource_kind = 'person'
      and resource.visibility = 'public'
      and resource.lifecycle_state = 'active'
  ) then
    return null;
  end if;

  select alias.path
  into v_path
  from editorial.resource_aliases alias
  where alias.resource_id = v_person_id
    and alias.is_canonical
    and alias.retired_at is null;

  if v_path is null then
    return null;
  end if;

  return jsonb_build_object(
    'registry_author_slug',
      v_slug,
    'person_id',
      v_person_id,
    'canonical_path',
      v_path
  );
end;
$function$;

revoke all
on function
public.resolve_public_registry_author_person(text)
from public;

grant execute
on function
public.resolve_public_registry_author_person(text)
to anon, authenticated;

commit;
