begin;

-- Phase 3A Migration 2
-- Trust attachment foundation.
--
-- Creates:
-- 1. Source Registry links
-- 2. immutable Citations
-- 3. Article-version Citation attachments
-- 4. Article-version Credit attachments
-- 5. independent Article-version trust revisions
--
-- This migration does not change Article content, ownership, lifecycle,
-- byline text, publication pointers, or publication snapshots.

do $preflight$
begin
  if to_regclass('editorial.sources') is null then
    raise exception 'STOP: editorial.sources does not exist';
  end if;

  if to_regclass('editorial.source_versions') is null then
    raise exception 'STOP: editorial.source_versions does not exist';
  end if;

  if to_regclass('editorial.citation_locator_types') is null then
    raise exception 'STOP: editorial.citation_locator_types does not exist';
  end if;

  if to_regclass('editorial.credits') is null then
    raise exception 'STOP: editorial.credits does not exist';
  end if;

  if to_regclass('editorial.credit_governance') is null then
    raise exception 'STOP: editorial.credit_governance does not exist';
  end if;

  if to_regclass('editorial.resources') is null then
    raise exception 'STOP: editorial.resources does not exist';
  end if;

  if to_regclass('editorial.article_resources') is null then
    raise exception 'STOP: editorial.article_resources does not exist';
  end if;

  if to_regclass('editorial.article_versions') is null then
    raise exception 'STOP: editorial.article_versions does not exist';
  end if;

  if to_regclass('public.registry_artists') is null
     or to_regclass('public.registry_authors') is null
     or to_regclass('public.registry_genres') is null
     or to_regclass('public.registry_labels') is null
     or to_regclass('public.registry_releases') is null
     or to_regclass('public.registry_tracks') is null
  then
    raise exception 'STOP: Required Registry authorities do not exist';
  end if;

  if to_regprocedure(
       'editorial.current_user_can_edit_article(uuid)'
     ) is null
  then
    raise exception
      'STOP: editorial.current_user_can_edit_article(uuid) does not exist';
  end if;

  if to_regprocedure(
       'public.current_user_has_capability(text)'
     ) is null
  then
    raise exception
      'STOP: public.current_user_has_capability(text) does not exist';
  end if;
end;
$preflight$;

create table editorial.source_registry_links (
  source_id uuid not null,
  source_version_id uuid not null,
  registry_entity_type text not null,
  registry_entity_id uuid not null,
  relationship_role text not null default 'context',
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint source_registry_links_pkey
    primary key (
      source_version_id,
      registry_entity_type,
      registry_entity_id,
      relationship_role
    ),

  constraint source_registry_links_source_fkey
    foreign key (source_id)
    references editorial.sources(id)
    on delete restrict,

  constraint source_registry_links_source_version_fkey
    foreign key (source_version_id)
    references editorial.source_versions(id)
    on delete restrict,

  constraint source_registry_links_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint source_registry_links_entity_type_check
    check (
      registry_entity_type in (
        'artist',
        'author',
        'genre',
        'label',
        'release',
        'track'
      )
    ),

  constraint source_registry_links_relationship_role_check
    check (
      relationship_role in (
        'subject',
        'creator',
        'publisher',
        'custodian',
        'mentioned',
        'context'
      )
    )
);

create table editorial.citations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  source_version_id uuid not null,
  locator_type text not null,
  locator_data jsonb not null default '{}'::jsonb,
  quotation text,
  editor_note text,
  public_label text,
  public_safe boolean not null default false,
  citation_state text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint citations_source_fkey
    foreign key (source_id)
    references editorial.sources(id)
    on delete restrict,

  constraint citations_source_version_fkey
    foreign key (source_version_id)
    references editorial.source_versions(id)
    on delete restrict,

  constraint citations_locator_type_fkey
    foreign key (locator_type)
    references editorial.citation_locator_types(locator_type)
    on update cascade
    on delete restrict,

  constraint citations_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint citations_locator_object_check
    check (jsonb_typeof(locator_data) = 'object'),

  constraint citations_state_check
    check (
      citation_state in (
        'active',
        'withdrawn',
        'archived'
      )
    ),

  constraint citations_quotation_length_check
    check (
      quotation is null
      or char_length(quotation) <= 4000
    ),

  constraint citations_editor_note_length_check
    check (
      editor_note is null
      or char_length(editor_note) <= 8000
    ),

  constraint citations_public_label_length_check
    check (
      public_label is null
      or char_length(public_label) <= 500
    )
);

create table editorial.article_version_trust_revisions (
  article_version_id uuid primary key,
  citation_revision bigint not null default 1,
  credit_revision bigint not null default 1,
  updated_by uuid,
  updated_at timestamptz not null default now(),

  constraint article_version_trust_revisions_version_fkey
    foreign key (article_version_id)
    references editorial.article_versions(id)
    on delete cascade,

  constraint article_version_trust_revisions_updated_by_fkey
    foreign key (updated_by)
    references auth.users(id)
    on delete set null,

  constraint article_version_trust_revisions_citation_check
    check (citation_revision >= 1),

  constraint article_version_trust_revisions_credit_check
    check (credit_revision >= 1)
);

create table editorial.resource_citations (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null,
  resource_kind text not null,
  target_version_type text not null,
  target_version_id uuid not null,
  citation_id uuid not null,
  citation_purpose text not null default 'supports',
  target_anchor_type text not null default 'whole_version',
  target_anchor_data jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  public_safe boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint resource_citations_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete cascade,

  constraint resource_citations_citation_fkey
    foreign key (citation_id)
    references editorial.citations(id)
    on delete restrict,

  constraint resource_citations_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint resource_citations_resource_kind_check
    check (resource_kind = 'article'),

  constraint resource_citations_target_type_check
    check (target_version_type = 'article_version'),

  constraint resource_citations_purpose_check
    check (
      citation_purpose in (
        'supports',
        'challenges',
        'contextualizes',
        'quotes',
        'documents',
        'methodology',
        'other'
      )
    ),

  constraint resource_citations_anchor_type_check
    check (
      target_anchor_type in (
        'whole_version',
        'block_id',
        'heading_id',
        'paragraph_id',
        'character_range',
        'structured_node'
      )
    ),

  constraint resource_citations_anchor_object_check
    check (jsonb_typeof(target_anchor_data) = 'object'),

  constraint resource_citations_display_order_check
    check (display_order >= 0)
);

create table editorial.resource_credits (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null,
  resource_kind text not null,
  target_version_type text not null,
  target_version_id uuid not null,
  credit_id uuid not null,
  display_order integer not null default 0,
  is_primary boolean not null default false,
  public_safe boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint resource_credits_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete cascade,

  constraint resource_credits_credit_fkey
    foreign key (credit_id)
    references editorial.credits(id)
    on delete restrict,

  constraint resource_credits_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint resource_credits_resource_kind_check
    check (resource_kind = 'article'),

  constraint resource_credits_target_type_check
    check (target_version_type = 'article_version'),

  constraint resource_credits_display_order_check
    check (display_order >= 0)
);

create or replace function editorial.validate_citation_locator(
  p_locator_type text,
  p_locator_data jsonb
)
returns void
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $function$
declare
  v_keys text[];
  v_value_text text;
begin
  if p_locator_data is null
     or jsonb_typeof(p_locator_data) <> 'object'
  then
    raise exception 'Citation locator data must be a JSON object';
  end if;

  select coalesce(array_agg(key order by key), array[]::text[])
  into v_keys
  from jsonb_object_keys(p_locator_data) key;

  case p_locator_type
    when 'page' then
      if v_keys <> array['page']::text[]
         or jsonb_typeof(p_locator_data -> 'page') <> 'number'
         or (p_locator_data ->> 'page') !~ '^[0-9]+$'
         or (p_locator_data ->> 'page')::bigint < 1
      then
        raise exception 'Page locator requires one integer page of at least 1';
      end if;

    when 'page_range' then
      if v_keys <> array['endPage', 'startPage']::text[]
         or jsonb_typeof(p_locator_data -> 'startPage') <> 'number'
         or jsonb_typeof(p_locator_data -> 'endPage') <> 'number'
         or (p_locator_data ->> 'startPage') !~ '^[0-9]+$'
         or (p_locator_data ->> 'endPage') !~ '^[0-9]+$'
         or (p_locator_data ->> 'startPage')::bigint < 1
         or (p_locator_data ->> 'endPage')::bigint
              < (p_locator_data ->> 'startPage')::bigint
      then
        raise exception
          'Page-range locator requires valid startPage and endPage integers';
      end if;

    when 'paragraph' then
      if v_keys <> array['paragraph']::text[]
         or jsonb_typeof(p_locator_data -> 'paragraph') <> 'number'
         or (p_locator_data ->> 'paragraph') !~ '^[0-9]+$'
         or (p_locator_data ->> 'paragraph')::bigint < 1
      then
        raise exception
          'Paragraph locator requires one integer paragraph of at least 1';
      end if;

    when 'quotation' then
      if v_keys <> array['quotation']::text[]
         or jsonb_typeof(p_locator_data -> 'quotation') <> 'string'
         or btrim(p_locator_data ->> 'quotation') = ''
      then
        raise exception
          'Quotation locator requires one non-blank quotation';
      end if;

    when 'timestamp' then
      if v_keys <> array['milliseconds']::text[]
         or jsonb_typeof(p_locator_data -> 'milliseconds') <> 'number'
         or (p_locator_data ->> 'milliseconds') !~ '^[0-9]+$'
      then
        raise exception
          'Timestamp locator requires non-negative integer milliseconds';
      end if;

    when 'timestamp_range', 'transcript_range' then
      if v_keys <> array[
           'endMilliseconds',
           'startMilliseconds'
         ]::text[]
         or jsonb_typeof(
              p_locator_data -> 'startMilliseconds'
            ) <> 'number'
         or jsonb_typeof(
              p_locator_data -> 'endMilliseconds'
            ) <> 'number'
         or (p_locator_data ->> 'startMilliseconds') !~ '^[0-9]+$'
         or (p_locator_data ->> 'endMilliseconds') !~ '^[0-9]+$'
         or (p_locator_data ->> 'endMilliseconds')::bigint
              < (p_locator_data ->> 'startMilliseconds')::bigint
      then
        raise exception
          'Range locator requires valid non-negative millisecond bounds';
      end if;

    when 'chapter' then
      if v_keys <> array['chapter']::text[]
         or jsonb_typeof(p_locator_data -> 'chapter') <> 'string'
         or btrim(p_locator_data ->> 'chapter') = ''
      then
        raise exception 'Chapter locator requires one non-blank chapter';
      end if;

    when 'image_frame' then
      if v_keys <> array['frame']::text[]
         or jsonb_typeof(p_locator_data -> 'frame') <> 'number'
         or (p_locator_data ->> 'frame') !~ '^[0-9]+$'
      then
        raise exception
          'Image-frame locator requires one non-negative integer frame';
      end if;

    when 'spreadsheet_row' then
      if v_keys <> array['row', 'sheet']::text[]
         or jsonb_typeof(p_locator_data -> 'sheet') <> 'string'
         or btrim(p_locator_data ->> 'sheet') = ''
         or jsonb_typeof(p_locator_data -> 'row') <> 'number'
         or (p_locator_data ->> 'row') !~ '^[0-9]+$'
         or (p_locator_data ->> 'row')::bigint < 1
      then
        raise exception
          'Spreadsheet-row locator requires a sheet and row of at least 1';
      end if;

    when 'spreadsheet_cell' then
      v_value_text := p_locator_data ->> 'cell';

      if v_keys <> array['cell', 'sheet']::text[]
         or jsonb_typeof(p_locator_data -> 'sheet') <> 'string'
         or btrim(p_locator_data ->> 'sheet') = ''
         or jsonb_typeof(p_locator_data -> 'cell') <> 'string'
         or v_value_text !~ '^[A-Za-z]+[1-9][0-9]*$'
      then
        raise exception
          'Spreadsheet-cell locator requires a sheet and A1-style cell';
      end if;

    when 'archive_identifier' then
      if v_keys <> array['identifier']::text[]
         or jsonb_typeof(p_locator_data -> 'identifier') <> 'string'
         or btrim(p_locator_data ->> 'identifier') = ''
      then
        raise exception
          'Archive locator requires one non-blank identifier';
      end if;

    when 'section_heading' then
      if v_keys <> array['heading']::text[]
         or jsonb_typeof(p_locator_data -> 'heading') <> 'string'
         or btrim(p_locator_data ->> 'heading') = ''
      then
        raise exception
          'Section-heading locator requires one non-blank heading';
      end if;

    when 'whole_source' then
      if p_locator_data <> '{}'::jsonb then
        raise exception 'Whole-source locator requires an empty object';
      end if;

    when 'other' then
      if v_keys <> array['label']::text[]
         or jsonb_typeof(p_locator_data -> 'label') <> 'string'
         or btrim(p_locator_data ->> 'label') = ''
      then
        raise exception 'Other locator requires one non-blank label';
      end if;

    else
      raise exception 'Unsupported Citation locator type: %', p_locator_type;
  end case;
end;
$function$;

create or replace function editorial.validate_citation_target_anchor(
  p_anchor_type text,
  p_anchor_data jsonb
)
returns void
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $function$
declare
  v_keys text[];
begin
  if p_anchor_data is null
     or jsonb_typeof(p_anchor_data) <> 'object'
  then
    raise exception 'Citation target anchor data must be a JSON object';
  end if;

  select coalesce(array_agg(key order by key), array[]::text[])
  into v_keys
  from jsonb_object_keys(p_anchor_data) key;

  case p_anchor_type
    when 'whole_version' then
      if p_anchor_data <> '{}'::jsonb then
        raise exception 'Whole-version anchor requires an empty object';
      end if;

    when 'block_id' then
      if v_keys <> array['blockId']::text[]
         or jsonb_typeof(p_anchor_data -> 'blockId') <> 'string'
         or btrim(p_anchor_data ->> 'blockId') = ''
      then
        raise exception 'Block anchor requires one non-blank blockId';
      end if;

    when 'heading_id' then
      if v_keys <> array['headingId']::text[]
         or jsonb_typeof(p_anchor_data -> 'headingId') <> 'string'
         or btrim(p_anchor_data ->> 'headingId') = ''
      then
        raise exception 'Heading anchor requires one non-blank headingId';
      end if;

    when 'paragraph_id' then
      if v_keys <> array['paragraphId']::text[]
         or jsonb_typeof(p_anchor_data -> 'paragraphId') <> 'string'
         or btrim(p_anchor_data ->> 'paragraphId') = ''
      then
        raise exception
          'Paragraph anchor requires one non-blank paragraphId';
      end if;

    when 'character_range' then
      if v_keys <> array['end', 'start']::text[]
         or jsonb_typeof(p_anchor_data -> 'start') <> 'number'
         or jsonb_typeof(p_anchor_data -> 'end') <> 'number'
         or (p_anchor_data ->> 'start') !~ '^[0-9]+$'
         or (p_anchor_data ->> 'end') !~ '^[0-9]+$'
         or (p_anchor_data ->> 'end')::bigint
              < (p_anchor_data ->> 'start')::bigint
      then
        raise exception
          'Character-range anchor requires valid non-negative bounds';
      end if;

    when 'structured_node' then
      if v_keys <> array['nodeId']::text[]
         or jsonb_typeof(p_anchor_data -> 'nodeId') <> 'string'
         or btrim(p_anchor_data ->> 'nodeId') = ''
      then
        raise exception
          'Structured-node anchor requires one non-blank nodeId';
      end if;

    else
      raise exception
        'Unsupported Citation target anchor type: %',
        p_anchor_type;
  end case;
end;
$function$;

create or replace function editorial.assert_source_registry_link_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial, public
as $function$
begin
  if not exists (
    select 1
    from editorial.source_versions version
    where version.id = new.source_version_id
      and version.source_id = new.source_id
  )
  then
    raise exception
      'Source Registry link version must belong to the supplied Source';
  end if;

  case new.registry_entity_type
    when 'artist' then
      if not exists (
        select 1
        from public.registry_artists entity
        where entity.id = new.registry_entity_id
          and entity.status = 'active'
      )
      then
        raise exception
          'Source Registry artist must exist and be active';
      end if;

    when 'author' then
      if not exists (
        select 1
        from public.registry_authors entity
        where entity.id = new.registry_entity_id
      )
      then
        raise exception 'Source Registry author does not exist';
      end if;

    when 'genre' then
      if not exists (
        select 1
        from public.registry_genres entity
        where entity.id = new.registry_entity_id
          and entity.status = 'active'
      )
      then
        raise exception
          'Source Registry genre must exist and be active';
      end if;

    when 'label' then
      if not exists (
        select 1
        from public.registry_labels entity
        where entity.id = new.registry_entity_id
          and entity.status = 'active'
      )
      then
        raise exception
          'Source Registry label must exist and be active';
      end if;

    when 'release' then
      if not exists (
        select 1
        from public.registry_releases entity
        where entity.id = new.registry_entity_id
          and entity.status = 'active'
      )
      then
        raise exception
          'Source Registry release must exist and be active';
      end if;

    when 'track' then
      if not exists (
        select 1
        from public.registry_tracks entity
        where entity.id = new.registry_entity_id
          and entity.status = 'active'
      )
      then
        raise exception
          'Source Registry track must exist and be active';
      end if;

    else
      raise exception
        'Unsupported Source Registry entity type: %',
        new.registry_entity_type;
  end case;

  return new;
end;
$function$;

create or replace function editorial.protect_source_registry_link()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  raise exception 'Source Registry links are append-only';
end;
$function$;

create or replace function editorial.assert_citation_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
declare
  v_source editorial.sources%rowtype;
begin
  perform editorial.validate_citation_locator(
    new.locator_type,
    new.locator_data
  );

  if not exists (
    select 1
    from editorial.source_versions version
    where version.id = new.source_version_id
      and version.source_id = new.source_id
  )
  then
    raise exception
      'Citation Source version must belong to the supplied Source';
  end if;

  select source.*
  into v_source
  from editorial.sources source
  where source.id = new.source_id;

  if not found then
    raise exception 'Citation Source does not exist';
  end if;

  if new.public_safe then
    if v_source.review_status <> 'approved'
       or v_source.current_approved_version_id
            is distinct from new.source_version_id
    then
      raise exception
        'Public-safe Citation requires the approved Source version';
    end if;

    if v_source.exposure_class not in (
      'public',
      'public_redacted'
    )
    then
      raise exception
        'Public-safe Citation requires public or public-redacted exposure';
    end if;

    if v_source.source_state = 'withdrawn'
       or v_source.withdrawn_at is not null
    then
      raise exception
        'Public-safe Citation cannot use a withdrawn Source';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function editorial.protect_citation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Citations cannot be deleted';
  end if;

  if current_setting(
       'wakilisha.trusted_citation_lifecycle',
       true
     ) is distinct from 'on'
  then
    raise exception
      'Citations are immutable outside trusted lifecycle commands';
  end if;

  if new.id is distinct from old.id
     or new.source_id is distinct from old.source_id
     or new.source_version_id is distinct from old.source_version_id
     or new.locator_type is distinct from old.locator_type
     or new.locator_data is distinct from old.locator_data
     or new.quotation is distinct from old.quotation
     or new.editor_note is distinct from old.editor_note
     or new.public_label is distinct from old.public_label
     or new.public_safe is distinct from old.public_safe
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
  then
    raise exception
      'Trusted Citation lifecycle commands may only change citation_state';
  end if;

  if old.citation_state <> 'active'
     or new.citation_state not in (
       'withdrawn',
       'archived'
     )
  then
    raise exception
      'Citation lifecycle permits only active to withdrawn or archived';
  end if;

  return new;
end;
$function$;

create or replace function
  editorial.assert_article_version_trust_attachment()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
begin
  if new.resource_kind <> 'article'
     or new.target_version_type <> 'article_version'
  then
    raise exception
      'Trust attachments currently support Article versions only';
  end if;

  if not exists (
    select 1
    from editorial.article_versions version
    where version.id = new.target_version_id
      and version.resource_id = new.resource_id
  )
  then
    raise exception
      'Trust attachment Article version must belong to the supplied resource';
  end if;

  if not exists (
    select 1
    from editorial.article_resources binding
    where binding.resource_id = new.resource_id
      and binding.resource_kind = 'article'
      and exists (
        select 1
        from editorial.article_versions version
        where version.id = new.target_version_id
          and version.article_id = binding.article_id
      )
  )
  then
    raise exception
      'Trust attachment requires a valid Article resource binding';
  end if;

  insert into editorial.article_version_trust_revisions (
    article_version_id
  )
  values (
    new.target_version_id
  )
  on conflict (article_version_id) do nothing;

  perform 1
  from editorial.article_version_trust_revisions revision
  where revision.article_version_id = new.target_version_id
  for update;

  if tg_table_name = 'resource_citations' then
    perform editorial.validate_citation_target_anchor(
      new.target_anchor_type,
      new.target_anchor_data
    );

    if new.public_safe
       and not exists (
         select 1
         from editorial.citations citation
         where citation.id = new.citation_id
           and citation.public_safe
           and citation.citation_state = 'active'
       )
    then
      raise exception
        'Public-safe Citation attachment requires an active public-safe Citation';
    end if;
  elsif tg_table_name = 'resource_credits' then
    if new.public_safe
       and not exists (
         select 1
         from editorial.credit_governance governance
         where governance.credit_id = new.credit_id
           and governance.public_safe
           and governance.credit_state = 'active'
       )
    then
      raise exception
        'Public-safe Credit attachment requires active public-safe governance';
    end if;
  else
    raise exception
      'Unsupported trust attachment table: %',
      tg_table_name;
  end if;

  return new;
end;
$function$;

create or replace function editorial.assert_primary_author_credit()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
declare
  v_credit_role text;
begin
  select credit.credit_role
  into v_credit_role
  from editorial.credits credit
  where credit.id = new.credit_id;

  if not found then
    raise exception 'Credit does not exist';
  end if;

  if new.is_primary
     and v_credit_role = 'author'
     and exists (
       select 1
       from editorial.resource_credits attachment
       join editorial.credits credit
         on credit.id = attachment.credit_id
       where attachment.target_version_id = new.target_version_id
         and attachment.target_version_type = 'article_version'
         and attachment.is_primary
         and credit.credit_role = 'author'
         and attachment.id is distinct from new.id
     )
  then
    raise exception
      'An Article version can have at most one primary author Credit';
  end if;

  return new;
end;
$function$;

create constraint trigger source_registry_links_integrity
after insert or update
on editorial.source_registry_links
deferrable initially immediate
for each row
execute function editorial.assert_source_registry_link_integrity();

create trigger source_registry_links_append_only
before update or delete
on editorial.source_registry_links
for each row
execute function editorial.protect_source_registry_link();

create trigger citations_integrity
before insert or update
on editorial.citations
for each row
execute function editorial.assert_citation_integrity();

create trigger citations_immutable
before update or delete
on editorial.citations
for each row
execute function editorial.protect_citation();

create trigger resource_citations_integrity
before insert or update
on editorial.resource_citations
for each row
execute function editorial.assert_article_version_trust_attachment();

create trigger resource_credits_integrity
before insert or update
on editorial.resource_credits
for each row
execute function editorial.assert_article_version_trust_attachment();

create trigger resource_credits_primary_author
before insert or update
on editorial.resource_credits
for each row
execute function editorial.assert_primary_author_credit();

create index source_registry_links_target_idx
on editorial.source_registry_links (
  registry_entity_type,
  registry_entity_id,
  created_at desc
);

create index source_registry_links_source_idx
on editorial.source_registry_links (
  source_id,
  source_version_id,
  created_at desc
);

create index citations_source_created_idx
on editorial.citations (
  source_id,
  created_at desc
);

create index citations_source_version_idx
on editorial.citations (
  source_version_id,
  created_at desc
);

create index citations_state_created_idx
on editorial.citations (
  citation_state,
  created_at desc
);

create unique index resource_citations_identity_unique
on editorial.resource_citations (
  resource_id,
  target_version_type,
  target_version_id,
  citation_id,
  citation_purpose,
  target_anchor_type,
  md5(target_anchor_data::text)
);

create unique index resource_citations_order_unique
on editorial.resource_citations (
  target_version_id,
  display_order
);

create index resource_citations_version_order_idx
on editorial.resource_citations (
  target_version_id,
  display_order,
  created_at
);

create index resource_citations_citation_idx
on editorial.resource_citations (
  citation_id,
  target_version_id
);

create unique index resource_credits_identity_unique
on editorial.resource_credits (
  target_version_id,
  credit_id
);

create unique index resource_credits_order_unique
on editorial.resource_credits (
  target_version_id,
  display_order
);

create index resource_credits_version_order_idx
on editorial.resource_credits (
  target_version_id,
  display_order,
  created_at
);

create index resource_credits_credit_idx
on editorial.resource_credits (
  credit_id,
  target_version_id
);

create index article_version_trust_revisions_updated_idx
on editorial.article_version_trust_revisions (
  updated_at desc
);

alter table editorial.source_registry_links
  enable row level security;

alter table editorial.citations
  enable row level security;

alter table editorial.resource_citations
  enable row level security;

alter table editorial.resource_credits
  enable row level security;

alter table editorial.article_version_trust_revisions
  enable row level security;

create policy source_registry_links_authorized_read
on editorial.source_registry_links
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('view_trust_records')
  or public.current_user_has_capability('manage_sources')
  or public.current_user_has_capability('manage_citations')
);

create policy citations_authorized_read
on editorial.citations
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('view_trust_records')
  or public.current_user_has_capability('manage_sources')
  or public.current_user_has_capability('manage_citations')
);

create policy resource_citations_authorized_read
on editorial.resource_citations
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('view_trust_records')
  or public.current_user_has_capability('manage_citations')
  or editorial.current_user_can_edit_article(resource_id)
);

create policy resource_credits_authorized_read
on editorial.resource_credits
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('view_trust_records')
  or public.current_user_has_capability('manage_credits')
  or editorial.current_user_can_edit_article(resource_id)
);

create policy article_version_trust_revisions_authorized_read
on editorial.article_version_trust_revisions
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('view_trust_records')
  or public.current_user_has_capability('manage_citations')
  or public.current_user_has_capability('manage_credits')
  or exists (
    select 1
    from editorial.article_versions version
    where version.id = article_version_id
      and editorial.current_user_can_edit_article(
        version.resource_id
      )
  )
);

revoke all
on editorial.source_registry_links,
   editorial.citations,
   editorial.resource_citations,
   editorial.resource_credits,
   editorial.article_version_trust_revisions
from public, anon, authenticated;

grant select
on editorial.source_registry_links,
   editorial.citations,
   editorial.resource_citations,
   editorial.resource_credits,
   editorial.article_version_trust_revisions
to authenticated;

grant all
on editorial.source_registry_links,
   editorial.citations,
   editorial.resource_citations,
   editorial.resource_credits,
   editorial.article_version_trust_revisions
to service_role;

revoke all on function
  editorial.validate_citation_locator(text, jsonb)
from public, anon, authenticated;

revoke all on function
  editorial.validate_citation_target_anchor(text, jsonb)
from public, anon, authenticated;

grant execute on function
  editorial.validate_citation_locator(text, jsonb),
  editorial.validate_citation_target_anchor(text, jsonb)
to service_role;

comment on table editorial.source_registry_links is
  'Append-only reviewed links from exact Source versions to canonical Registry entities.';

comment on table editorial.citations is
  'Immutable Citation identity pointing to one exact Source version and structured locator.';

comment on table editorial.resource_citations is
  'Citation attachments to exact immutable Article versions.';

comment on table editorial.resource_credits is
  'Credit attachments to exact immutable Article versions.';

comment on table editorial.article_version_trust_revisions is
  'Independent optimistic-concurrency authority for Article-version Citation and Credit attachment sets.';

commit;
