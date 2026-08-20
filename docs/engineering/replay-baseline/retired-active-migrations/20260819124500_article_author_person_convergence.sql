-- Article Author → canonical Person convergence.
--
-- This migration is intentionally narrow:
-- - require the existing governed person.merge command but do not bypass it;
-- - leave throwaway-account erasure to its own identity-retirement gate;
-- - backfill only the locked 109 missing current public human Author Credit attachments;
-- - add one narrow Registry Author → canonical Person compatibility resolver;
-- - preserve every legacy Article byline and historical Article version snapshot;
-- - leave all 73 Wakilisha Staff Articles outside Person authority.

begin;

do $author_person_preflight$
declare
  v_human_count bigint;
  v_existing_credit_count bigint;
  v_missing_credit_count bigint;
  v_human_digest text;
  v_missing_digest text;
begin
  if not exists (
    select 1
    from pg_extension
    where extname = 'pgcrypto'
  ) then
    raise exception
      'STOP: pgcrypto is required for the locked Article manifest digest';
  end if;

  if to_regprocedure(
       'public.merge_people(uuid,uuid,bigint,bigint,text,text,uuid)'
     ) is null
  then
    raise exception
      'STOP: governed Person merge command authority is missing';
  end if;

  if (
    select count(*)
    from public.community_follows
    where target_type = 'person'
      and target_id in (
        '75100f5b-0e76-47c4-91b8-d5f5557212c0',
        'e0fa2ef4-8ec4-49f5-8fff-4b4230a9a65a',
        '891bbfed-1d67-42a5-93d2-984e3f4ffe9f'
      )
  ) <> 0 then
    raise exception
      'STOP: reviewed Beautah Person Follow boundary changed';
  end if;

  if not exists (
    select 1
    from editorial.people
    where resource_id =
          '891bbfed-1d67-42a5-93d2-984e3f4ffe9f'::uuid
      and person_state = 'active'
      and identity_revision = 1
  ) then
    raise exception
      'STOP: canonical Beautah Person moved from reviewed revision 1';
  end if;

  if not exists (
    select 1
    from editorial.resource_aliases
    where resource_id =
          '891bbfed-1d67-42a5-93d2-984e3f4ffe9f'::uuid
      and path = '/people/beautah'
      and is_canonical
      and retired_at is null
  ) then
    raise exception
      'STOP: canonical Beautah route moved';
  end if;


  if not exists (
    select 1
    from editorial.people
    where resource_id =
          '75100f5b-0e76-47c4-91b8-d5f5557212c0'::uuid
      and person_state = 'active'
      and identity_revision = 1
  ) then
    raise exception
      'STOP: reviewed external Muiruri Person moved';
  end if;

  if not exists (
    select 1
    from editorial.person_identity_links
    where person_resource_id =
          '75100f5b-0e76-47c4-91b8-d5f5557212c0'::uuid
      and external_contributor_id =
          '9c2d46a6-97f3-4d71-bb76-40211abce2e3'::uuid
      and link_state = 'active'
  ) then
    raise exception
      'STOP: reviewed Muiruri external identity link moved';
  end if;

  if not exists (
    select 1
    from editorial.people
    where resource_id =
          'e0fa2ef4-8ec4-49f5-8fff-4b4230a9a65a'::uuid
      and person_state = 'active'
      and identity_revision = 1
  ) then
    raise exception
      'STOP: reviewed Registry Author Muiruri Person moved';
  end if;

  if not exists (
    select 1
    from editorial.person_identity_links
    where person_resource_id =
          'e0fa2ef4-8ec4-49f5-8fff-4b4230a9a65a'::uuid
      and registry_author_id =
          '9262021a-6b53-422f-96ae-d970004e04a9'::uuid
      and link_state = 'active'
  ) then
    raise exception
      'STOP: reviewed Muiruri Registry Author identity link moved';
  end if;

  create temporary table pg_temp.article_author_person_manifest
  on commit drop
  as
  with current_articles as (
    select
      article.id as article_id,
      binding.resource_id,
      resource.current_published_version_id as article_version_id,
      article.slug,
      btrim(
        coalesce(
          to_jsonb(article) ->> 'author',
          ''
        )
      ) as legacy_author
    from public.wk_articles article
    join editorial.article_resources binding
      on binding.article_id = article.id
    join editorial.resources resource
      on resource.id = binding.resource_id
     and resource.resource_kind = 'article'
     and resource.visibility = 'public'
     and resource.lifecycle_state = 'published'
     and resource.current_published_version_id is not null
  ),
  human as (
    select
      current_articles.*,
      author_record.id as registry_author_id,
      author_record.slug as registry_author_slug,
      link.person_resource_id as linked_person_id,
      exists (
        select 1
        from editorial.resource_credits attachment
        join editorial.credits credit
          on credit.id = attachment.credit_id
        join editorial.credit_governance governance
          on governance.credit_id = credit.id
        where attachment.target_version_id =
              current_articles.article_version_id
          and credit.credit_role = 'author'
          and attachment.is_primary
          and attachment.public_safe
          and governance.credit_state = 'active'
          and governance.public_safe
      ) as has_primary_public_author_credit
    from current_articles
    join public.registry_authors author_record
      on lower(btrim(author_record.name)) =
         lower(current_articles.legacy_author)
    join editorial.person_identity_links link
      on link.registry_author_id = author_record.id
     and link.link_state = 'active'
    where current_articles.legacy_author <>
          'Wakilisha Staff'
  )
  select *
  from human;

  select
    count(*),
    count(*) filter (
      where has_primary_public_author_credit
    ),
    count(*) filter (
      where not has_primary_public_author_credit
    ),
    encode(
      digest(
        string_agg(
          article_id::text || '|' ||
          resource_id::text || '|' ||
          article_version_id::text || '|' ||
          slug || '|' ||
          legacy_author || '|' ||
          registry_author_id::text || '|' ||
          registry_author_slug || '|' ||
          linked_person_id::text,
          E'\n'
          order by legacy_author, slug
        ),
        'sha256'
      ),
      'hex'
    ),
    encode(
      digest(
        string_agg(
          article_id::text || '|' ||
          resource_id::text || '|' ||
          article_version_id::text || '|' ||
          slug || '|' ||
          legacy_author || '|' ||
          registry_author_id::text || '|' ||
          registry_author_slug || '|' ||
          linked_person_id::text,
          E'\n'
          order by legacy_author, slug
        ) filter (
          where not has_primary_public_author_credit
        ),
        'sha256'
      ),
      'hex'
    )
  into
    v_human_count,
    v_existing_credit_count,
    v_missing_credit_count,
    v_human_digest,
    v_missing_digest
  from pg_temp.article_author_person_manifest;

  if v_human_count <> 134
     or v_existing_credit_count <> 25
     or v_missing_credit_count <> 109
  then
    raise exception
      'STOP: reviewed human Article cardinality moved: human %, existing %, missing %',
      v_human_count,
      v_existing_credit_count,
      v_missing_credit_count;
  end if;

  if v_human_digest <>
       '676c3a87f7e016715408d4f4f0f50699105a804fae7cfb11f540a2f216312ff0'
  then
    raise exception
      'STOP: full reviewed human Article manifest digest moved';
  end if;

  if v_missing_digest <>
       '1ff5ff3b56890cc9cf0d5004f899b679eef2225e19989d5fbd9bfdec424ee220'
  then
    raise exception
      'STOP: missing-credit Article manifest digest moved';
  end if;

  if (
    select count(*)
    from public.wk_articles article
    join editorial.article_resources binding
      on binding.article_id = article.id
    join editorial.resources resource
      on resource.id = binding.resource_id
    where resource.resource_kind = 'article'
      and resource.visibility = 'public'
      and resource.lifecycle_state = 'published'
      and resource.current_published_version_id is not null
      and btrim(
        coalesce(
          to_jsonb(article) ->> 'author',
          ''
        )
      ) = 'Wakilisha Staff'
  ) <> 73 then
    raise exception
      'STOP: Wakilisha Staff Article boundary moved';
  end if;
end;
$author_person_preflight$;



do $backfill_human_article_credits$
declare
  v_author record;
  v_credit_id uuid;
begin
  for v_author in
    select distinct
      legacy_author,
      registry_author_id,
      registry_author_slug
    from pg_temp.article_author_person_manifest
    where not has_primary_public_author_credit
    order by legacy_author
  loop
    select credit.id
    into v_credit_id
    from editorial.credits credit
    join editorial.credit_governance governance
      on governance.credit_id = credit.id
    where credit.credit_role = 'author'
      and credit.registry_author_id =
          v_author.registry_author_id
      and credit.display_name_snapshot =
          v_author.legacy_author
      and credit.registry_author_slug_snapshot =
          v_author.registry_author_slug
      and governance.credit_state = 'active'
      and governance.public_safe
    order by credit.created_at, credit.id
    limit 1;

    if v_credit_id is null then
      insert into editorial.credits (
        credit_role,
        user_id,
        registry_author_id,
        external_contributor_id,
        display_name_snapshot,
        role_label_snapshot,
        credit_note,
        created_by,
        registry_author_slug_snapshot,
        user_username_snapshot
      )
      values (
        'author',
        null,
        v_author.registry_author_id,
        null,
        v_author.legacy_author,
        'Author',
        'Canonical Article author reconciliation',
        null,
        v_author.registry_author_slug,
        null
      )
      returning id
      into v_credit_id;

      insert into editorial.credit_governance (
        credit_id,
        public_safe,
        credit_state,
        governance_revision,
        reason,
        updated_by
      )
      values (
        v_credit_id,
        true,
        'active',
        1,
        null,
        null
      );
    end if;

    insert into editorial.resource_credits (
      resource_id,
      resource_kind,
      target_version_type,
      target_version_id,
      credit_id,
      display_order,
      is_primary,
      public_safe,
      created_by
    )
    select
      manifest.resource_id,
      'article',
      'article_version',
      manifest.article_version_id,
      v_credit_id,
      0,
      true,
      true,
      null
    from pg_temp.article_author_person_manifest manifest
    where manifest.registry_author_id =
          v_author.registry_author_id
      and not manifest.has_primary_public_author_credit;
  end loop;
end;
$backfill_human_article_credits$;

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
