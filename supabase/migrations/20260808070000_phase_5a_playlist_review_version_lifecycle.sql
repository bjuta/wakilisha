-- Phase 5A Migration 211: Playlist Review and immutable version lifecycle authority.
--
-- Typed Playlist Review reuses shared Review capabilities while keeping Playlist
-- versions and lifecycle authority inside the Playlist domain.

begin;

do $phase_5a_m211_preflight$
begin
  if to_regclass('public.wk_playlists') is null
     or to_regclass('public.wk_playlist_items') is null
     or to_regclass('editorial.playlist_resources') is null
     or to_regclass('editorial.playlist_item_resources') is null
     or to_regclass('editorial.playlist_versions') is null
     or to_regclass('editorial.playlist_version_items') is null
  then
    raise exception
      'STOP: Phase 5A Playlist authority foundation is incomplete';
  end if;

  if to_regprocedure(
       'platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.complete_resource_command(uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.reject_resource_command(uuid,text,text,jsonb)'
     ) is null
  then
    raise exception
      'STOP: Authenticated command substrate is incomplete';
  end if;

  if to_regprocedure(
       'editorial.current_user_can_edit_playlist(uuid)'
     ) is null
  then
    raise exception
      'STOP: Canonical Playlist edit authority is missing';
  end if;

  if not exists (
    select 1
    from public.capability_definitions
    where capability_key = 'manage_review_queue'
  ) or not exists (
    select 1
    from public.capability_definitions
    where capability_key = 'view_review_queue'
  ) then
    raise exception
      'STOP: Shared Review capability authority is missing';
  end if;

  if exists (select 1 from public.wk_playlists)
     or exists (select 1 from public.wk_playlist_items)
     or exists (select 1 from editorial.playlist_versions)
     or exists (select 1 from editorial.playlist_version_items)
  then
    raise exception
      'STOP: Migration 211 expects the accepted zero-Playlist production state';
  end if;

  if to_regclass('editorial.playlist_review_events') is not null then
    raise exception
      'STOP: Playlist Review event ledger already exists';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type in (
      'playlist.version.snapshot_working',
      'playlist.review.submit',
      'playlist.review.decide'
    )
  ) then
    raise exception
      'STOP: Migration 211 Playlist Review command types already exist';
  end if;
end;
$phase_5a_m211_preflight$;

-- ---------------------------------------------------------------------------
-- One Playlist lifecycle truth.
-- ---------------------------------------------------------------------------

alter table public.wk_playlists
  drop constraint if exists wk_playlists_status_check;

alter table public.wk_playlists
  add constraint wk_playlists_status_check
  check (
    status in (
      'draft',
      'ready_for_review',
      'in_review',
      'changes_requested',
      'approved',
      'scheduled',
      'published',
      'archived'
    )
  );

comment on column public.wk_playlists.status is
  'Canonical Playlist lifecycle state.';

create or replace function
  editorial.normalize_playlist_status_after_content_change()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog'
as $function$
begin
  if new.authority_revision > old.authority_revision
     and new.status = old.status
     and old.status in (
       'ready_for_review',
       'in_review',
       'approved'
     )
  then
    new.status := 'draft';
  end if;

  return new;
end;
$function$;

create trigger playlist_content_change_normalizes_status
before update of authority_revision, status
on public.wk_playlists
for each row
execute function
  editorial.normalize_playlist_status_after_content_change();

-- ---------------------------------------------------------------------------
-- Exact cover identity belongs in the immutable Playlist snapshot.
--
-- Media remains the authority for assets, revisions, governance, and usage.
-- Playlist versions cache only the exact cover identity/presentation needed
-- to reconstruct the reviewed snapshot.
-- ---------------------------------------------------------------------------

alter table editorial.playlist_versions
  add column cover_asset_id uuid,
  add column cover_asset_revision_id uuid,
  add column cover_placement_data jsonb not null default '{}'::jsonb,
  add column cover_display_order integer not null default 0,
  add column cover_alt_text_snapshot text,
  add column cover_caption_snapshot text,
  add column cover_credit_snapshot text;

alter table editorial.playlist_versions
  add constraint playlist_versions_cover_asset_fkey
  foreign key (cover_asset_id)
  references media.assets(id)
  on delete restrict;

alter table editorial.playlist_versions
  add constraint playlist_versions_cover_revision_fkey
  foreign key (cover_asset_revision_id)
  references media.asset_revisions(id)
  on delete restrict;

alter table editorial.playlist_versions
  add constraint playlist_versions_cover_pair_check
  check (
    (
      cover_asset_id is null
      and cover_asset_revision_id is null
    )
    or (
      cover_asset_id is not null
      and cover_asset_revision_id is not null
    )
  );

alter table editorial.playlist_versions
  add constraint playlist_versions_cover_placement_check
  check (jsonb_typeof(cover_placement_data) = 'object');

alter table editorial.playlist_versions
  add constraint playlist_versions_cover_display_order_check
  check (cover_display_order >= 0);

create or replace function
  editorial.assert_playlist_version_cover_identity()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog', 'media'
as $function$
begin
  if new.cover_asset_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from media.asset_revisions revision
    where revision.id = new.cover_asset_revision_id
      and revision.asset_id = new.cover_asset_id
  ) then
    raise exception
      'Playlist version cover revision must belong to the same Media asset';
  end if;

  return new;
end;
$function$;

create trigger playlist_versions_cover_identity
before insert
on editorial.playlist_versions
for each row
execute function
  editorial.assert_playlist_version_cover_identity();

-- ---------------------------------------------------------------------------
-- Immutable version protection.
-- ---------------------------------------------------------------------------

create or replace function
  editorial.protect_playlist_version_snapshot()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog'
as $function$
begin
  raise exception
    'Playlist version snapshots are immutable';
end;
$function$;

create or replace function
  editorial.protect_playlist_version_item_snapshot()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog'
as $function$
begin
  raise exception
    'Playlist version item snapshots are immutable';
end;
$function$;

create trigger playlist_versions_immutable
before update or delete
on editorial.playlist_versions
for each row
execute function
  editorial.protect_playlist_version_snapshot();

create trigger playlist_version_items_immutable
before update or delete
on editorial.playlist_version_items
for each row
execute function
  editorial.protect_playlist_version_item_snapshot();

-- ---------------------------------------------------------------------------
-- Typed Playlist Review ledger.
-- ---------------------------------------------------------------------------

create table editorial.playlist_review_events (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null,
  playlist_id uuid not null,
  event_number bigint not null,
  target_version_id uuid not null,
  result_version_id uuid,
  action text not null,
  prior_status text not null,
  resulting_status text not null,
  reason text,
  actor_id uuid,
  command_receipt_id uuid not null,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),

  constraint playlist_review_events_resource_playlist_fkey
    foreign key (resource_id, playlist_id)
    references editorial.playlist_resources(resource_id, playlist_id)
    on update cascade
    on delete restrict,

  constraint playlist_review_events_target_version_fkey
    foreign key (target_version_id, resource_id, playlist_id)
    references editorial.playlist_versions(id, resource_id, playlist_id)
    on update cascade
    on delete restrict,

  constraint playlist_review_events_result_version_fkey
    foreign key (result_version_id, resource_id, playlist_id)
    references editorial.playlist_versions(id, resource_id, playlist_id)
    on update cascade
    on delete restrict,

  constraint playlist_review_events_actor_fkey
    foreign key (actor_id)
    references auth.users(id)
    on delete set null,

  constraint playlist_review_events_receipt_fkey
    foreign key (command_receipt_id)
    references platform_private.command_receipts(id)
    on delete restrict,

  constraint playlist_review_events_number_check
    check (event_number >= 1),

  constraint playlist_review_events_action_check
    check (
      action in (
        'submitted',
        'review_started',
        'changes_requested',
        'approved'
      )
    ),

  constraint playlist_review_events_status_check
    check (
      prior_status in (
        'draft',
        'ready_for_review',
        'in_review',
        'changes_requested',
        'approved',
        'scheduled',
        'published',
        'archived'
      )
      and resulting_status in (
        'draft',
        'ready_for_review',
        'in_review',
        'changes_requested',
        'approved',
        'scheduled',
        'published',
        'archived'
      )
    ),

  constraint playlist_review_events_reason_check
    check (
      action <> 'changes_requested'
      or nullif(btrim(reason), '') is not null
    ),

  constraint playlist_review_events_result_shape_check
    check (
      (
        action = 'approved'
        and result_version_id is not null
      )
      or (
        action <> 'approved'
        and result_version_id is null
      )
    ),

  constraint playlist_review_events_resource_number_key
    unique (resource_id, event_number),

  constraint playlist_review_events_receipt_key
    unique (command_receipt_id)
);

create index playlist_review_events_playlist_created_idx
  on editorial.playlist_review_events (
    playlist_id,
    created_at desc
  );

comment on table editorial.playlist_review_events is
  'Append-only typed Playlist Review history anchored to exact immutable Playlist versions.';

create or replace function editorial.protect_playlist_review_event()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog'
as $function$
begin
  raise exception
    'Playlist Review events are append-only';
end;
$function$;

create trigger playlist_review_events_append_only
before update or delete
on editorial.playlist_review_events
for each row
execute function editorial.protect_playlist_review_event();

alter table editorial.playlist_review_events
  enable row level security;

create or replace function
  editorial.current_user_can_participate_playlist_review(
    p_resource_id uuid
  )
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select
    auth.uid() is not null
    and (
      coalesce(
        editorial.current_user_can_edit_playlist(
          p_resource_id
        ),
        false
      )
      or coalesce(
        public.current_user_is_administrator(),
        false
      )
      or coalesce(
        public.current_user_has_capability(
          'view_review_queue'
        ),
        false
      )
      or coalesce(
        public.current_user_has_capability(
          'manage_review_queue'
        ),
        false
      )
    );
$function$;

revoke all
on function
  editorial.current_user_can_participate_playlist_review(uuid)
from public, anon;

grant execute
on function
  editorial.current_user_can_participate_playlist_review(uuid)
to authenticated, service_role;

create policy playlist_review_events_participant_read
on editorial.playlist_review_events
for select
to authenticated
using (
  editorial.current_user_can_participate_playlist_review(
    resource_id
  )
);

revoke all
on editorial.playlist_review_events
from public, anon, authenticated;

grant select
on editorial.playlist_review_events
to authenticated;

grant select, insert
on editorial.playlist_review_events
to service_role;

-- ---------------------------------------------------------------------------
-- Shared Trust adapter for Playlist versions.
--
-- Citations and Credits remain owned by the shared Trust authority. This
-- adapter makes the existing version-bound attachment tables genuinely usable
-- for Playlist and Playlist-item Resources without changing Article semantics.
-- ---------------------------------------------------------------------------

drop index if exists editorial.resource_citations_order_unique;

create unique index resource_citations_order_unique
  on editorial.resource_citations (
    target_version_id,
    resource_id,
    display_order
  );

drop index if exists editorial.resource_credits_identity_unique;

create unique index resource_credits_identity_unique
  on editorial.resource_credits (
    target_version_id,
    resource_id,
    credit_id
  );

drop index if exists editorial.resource_credits_order_unique;

create unique index resource_credits_order_unique
  on editorial.resource_credits (
    target_version_id,
    resource_id,
    display_order
  );

create table editorial.playlist_version_trust_revisions (
  playlist_version_id uuid primary key
    references editorial.playlist_versions(id)
    on delete restrict,

  citation_revision bigint not null default 1
    check (citation_revision >= 1),

  credit_revision bigint not null default 1
    check (credit_revision >= 1),

  updated_by uuid
    references auth.users(id)
    on delete set null,

  updated_at timestamptz not null default now()
);

comment on table editorial.playlist_version_trust_revisions is
  'Optimistic concurrency revisions for shared Citation and Credit attachments on one Playlist version.';

revoke all
on editorial.playlist_version_trust_revisions
from public, anon, authenticated;

grant select, insert, update
on editorial.playlist_version_trust_revisions
to service_role;

create or replace function
  editorial.assert_resource_version_trust_attachment()
returns trigger
language plpgsql
security invoker
set search_path to
  'pg_catalog',
  'editorial'
as $function$
declare
  v_playlist_version
    editorial.playlist_versions%rowtype;
begin
  if new.resource_kind = 'article' then
    if new.target_version_type <> 'article_version'
    then
      raise exception
        'Article Trust attachments require article_version targets';
    end if;

    if not exists (
      select 1
      from editorial.article_versions version
      where version.id = new.target_version_id
        and version.resource_id = new.resource_id
    ) then
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
            and version.article_id =
                  binding.article_id
        )
    ) then
      raise exception
        'Trust attachment requires a valid Article resource binding';
    end if;

    insert into editorial.article_version_trust_revisions (
      article_version_id
    )
    values (
      new.target_version_id
    )
    on conflict (article_version_id)
    do nothing;

    perform 1
    from editorial.article_version_trust_revisions revision
    where revision.article_version_id =
            new.target_version_id
    for update;

  elsif new.resource_kind in (
    'playlist',
    'playlist_item'
  ) then
    if new.target_version_type <> 'playlist_version'
    then
      raise exception
        'Playlist Trust attachments require playlist_version targets';
    end if;

    select version.*
    into v_playlist_version
    from editorial.playlist_versions version
    where version.id = new.target_version_id;

    if not found then
      raise exception
        'Playlist Trust attachment version was not found';
    end if;

    if new.resource_kind = 'playlist' then
      if v_playlist_version.resource_id <>
           new.resource_id
      then
        raise exception
          'Playlist Trust attachment must target the Playlist Resource belonging to the version';
      end if;

    elsif not exists (
      select 1
      from editorial.playlist_version_items item
      where item.playlist_version_id =
              new.target_version_id
        and item.playlist_item_resource_id =
              new.resource_id
    ) then
      raise exception
        'Playlist-item Trust attachment must target an item present in the Playlist version';
    end if;

    insert into editorial.playlist_version_trust_revisions (
      playlist_version_id
    )
    values (
      new.target_version_id
    )
    on conflict (playlist_version_id)
    do nothing;

    perform 1
    from editorial.playlist_version_trust_revisions revision
    where revision.playlist_version_id =
            new.target_version_id
    for update;

  else
    raise exception
      'Unsupported Trust attachment Resource kind: %',
      new.resource_kind;
  end if;

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
      'Unsupported Trust attachment table: %',
      tg_table_name;
  end if;

  return new;
end;
$function$;

drop trigger if exists resource_citations_integrity
  on editorial.resource_citations;

create trigger resource_citations_integrity
before insert or update
on editorial.resource_citations
for each row
execute function
  editorial.assert_resource_version_trust_attachment();

drop trigger if exists resource_credits_integrity
  on editorial.resource_credits;

create trigger resource_credits_integrity
before insert or update
on editorial.resource_credits
for each row
execute function
  editorial.assert_resource_version_trust_attachment();

create or replace function
  editorial.protect_playlist_immutable_trust_attachment()
returns trigger
language plpgsql
security invoker
set search_path to
  'pg_catalog',
  'editorial'
as $function$
declare
  v_version_kind text;
begin
  if old.target_version_type <> 'playlist_version'
  then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  select version.version_kind
  into v_version_kind
  from editorial.playlist_versions version
  where version.id = old.target_version_id;

  if v_version_kind in (
    'submitted',
    'approved',
    'published'
  ) then
    raise exception
      'Trust attachments on submitted, approved, or published Playlist versions are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;

create trigger resource_citations_playlist_immutable
before update or delete
on editorial.resource_citations
for each row
execute function
  editorial.protect_playlist_immutable_trust_attachment();

create trigger resource_credits_playlist_immutable
before update or delete
on editorial.resource_credits
for each row
execute function
  editorial.protect_playlist_immutable_trust_attachment();

create or replace function
  editorial.playlist_working_trust_target(
    p_playlist_version_id uuid,
    p_target_resource_id uuid
  )
returns table(
  root_resource_id uuid,
  target_resource_kind text,
  playlist_id uuid
)
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_version editorial.playlist_versions%rowtype;
  v_current_fingerprint text;
begin
  select version.*
  into v_version
  from editorial.playlist_versions version
  where version.id = p_playlist_version_id
    and version.version_kind = 'working';

  if not found then
    raise exception
      'Playlist Trust can be edited only on a working Playlist version';
  end if;

  if not exists (
    select 1
    from editorial.playlist_resources binding
    where binding.resource_id = v_version.resource_id
      and binding.playlist_id = v_version.playlist_id
      and binding.current_working_version_id =
            p_playlist_version_id
  ) then
    raise exception
      'Playlist Trust target must be the current working version';
  end if;

  v_current_fingerprint :=
    editorial.playlist_current_content_fingerprint(
      v_version.playlist_id
    );

  if v_version.content_fingerprint <>
       v_current_fingerprint
  then
    raise exception
      'Create a fresh working Playlist snapshot before changing version-bound Trust';
  end if;

  if p_target_resource_id = v_version.resource_id
  then
    root_resource_id := v_version.resource_id;
    target_resource_kind := 'playlist';
    playlist_id := v_version.playlist_id;
    return next;
    return;
  end if;

  if exists (
    select 1
    from editorial.playlist_version_items item
    where item.playlist_version_id =
            p_playlist_version_id
      and item.playlist_item_resource_id =
            p_target_resource_id
  ) then
    root_resource_id := v_version.resource_id;
    target_resource_kind := 'playlist_item';
    playlist_id := v_version.playlist_id;
    return next;
    return;
  end if;

  raise exception
    'Trust target Resource is not part of the working Playlist version';
end;
$function$;

revoke all
on function editorial.playlist_working_trust_target(
  uuid,
  uuid
)
from public, anon, authenticated;

create or replace function
  public.replace_playlist_version_citations(
    p_playlist_version_id uuid,
    p_target_resource_id uuid,
    p_attachments jsonb,
    p_expected_citation_revision bigint,
    p_correlation_id uuid default null
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'auth'
as $function$
declare
  v_actor_id uuid;
  v_target record;
  v_revision
    editorial.playlist_version_trust_revisions%rowtype;
  v_requested_count integer;
  v_resulting_revision bigint;
  v_attachments jsonb;
begin
  v_actor_id :=
    editorial.assert_citation_command_actor();

  if p_attachments is null
     or jsonb_typeof(p_attachments) <> 'array'
  then
    raise exception
      'Citation attachments must be a JSON array';
  end if;

  if p_expected_citation_revision is null
     or p_expected_citation_revision < 1
  then
    raise exception
      'Expected Citation revision must be one or greater';
  end if;

  select *
  into v_target
  from editorial.playlist_working_trust_target(
    p_playlist_version_id,
    p_target_resource_id
  );

  if auth.role() <> 'service_role'
     and not editorial.current_user_can_edit_playlist(
       v_target.root_resource_id
     )
  then
    raise exception
      'You do not have authority to edit this Playlist';
  end if;

  insert into editorial.playlist_version_trust_revisions (
    playlist_version_id,
    citation_revision,
    credit_revision,
    updated_by,
    updated_at
  )
  values (
    p_playlist_version_id,
    1,
    1,
    v_actor_id,
    now()
  )
  on conflict (playlist_version_id)
  do nothing;

  select *
  into v_revision
  from editorial.playlist_version_trust_revisions revision
  where revision.playlist_version_id =
          p_playlist_version_id
  for update;

  if v_revision.citation_revision <>
       p_expected_citation_revision
  then
    raise exception
      'Citation revision conflict. Expected %, found %',
      p_expected_citation_revision,
      v_revision.citation_revision;
  end if;

  v_requested_count :=
    jsonb_array_length(p_attachments);

  if exists (
    select 1
    from jsonb_array_elements(p_attachments) item(value)
    where jsonb_typeof(item.value) <> 'object'
       or not item.value ? 'citation_id'
       or not item.value ? 'citation_purpose'
       or not item.value ? 'target_anchor_type'
       or not item.value ? 'target_anchor_data'
       or not item.value ? 'display_order'
       or not item.value ? 'public_safe'
       or jsonb_typeof(
            item.value -> 'target_anchor_data'
          ) <> 'object'
       or jsonb_typeof(
            item.value -> 'public_safe'
          ) <> 'boolean'
       or jsonb_typeof(
            item.value -> 'display_order'
          ) <> 'number'
  ) then
    raise exception
      'Every Citation attachment requires a complete valid object';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_attachments) as requested(
      citation_id uuid,
      citation_purpose text,
      target_anchor_type text,
      target_anchor_data jsonb,
      display_order integer,
      public_safe boolean
    )
    where requested.citation_id is null
       or requested.citation_purpose not in (
            'supports',
            'challenges',
            'contextualizes',
            'quotes',
            'documents',
            'methodology',
            'other'
          )
       or requested.target_anchor_type is null
       or requested.target_anchor_data is null
       or requested.display_order is null
       or requested.display_order < 0
       or requested.public_safe is null
  ) then
    raise exception
      'Citation attachment contains an invalid required value';
  end if;

  if exists (
    select 1
    from (
      select requested.citation_id
      from jsonb_to_recordset(p_attachments) as requested(
        citation_id uuid,
        citation_purpose text,
        target_anchor_type text,
        target_anchor_data jsonb,
        display_order integer,
        public_safe boolean
      )
      group by requested.citation_id
      having count(*) > 1
    ) duplicate_citations
  ) then
    raise exception
      'Citation attachments contain duplicate Citation identities';
  end if;

  if exists (
    select 1
    from (
      select requested.display_order
      from jsonb_to_recordset(p_attachments) as requested(
        citation_id uuid,
        citation_purpose text,
        target_anchor_type text,
        target_anchor_data jsonb,
        display_order integer,
        public_safe boolean
      )
      group by requested.display_order
      having count(*) > 1
    ) duplicate_orders
  ) then
    raise exception
      'Citation attachments contain duplicate display orders';
  end if;

  if v_requested_count > 0
     and (
       (
         select min(requested.display_order)
         from jsonb_to_recordset(p_attachments) as requested(
           citation_id uuid,
           citation_purpose text,
           target_anchor_type text,
           target_anchor_data jsonb,
           display_order integer,
           public_safe boolean
         )
       ) <> 0
       or
       (
         select max(requested.display_order)
         from jsonb_to_recordset(p_attachments) as requested(
           citation_id uuid,
           citation_purpose text,
           target_anchor_type text,
           target_anchor_data jsonb,
           display_order integer,
           public_safe boolean
         )
       ) <> v_requested_count - 1
     )
  then
    raise exception
      'Citation display order must be zero-based and contiguous per Playlist target';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_attachments) as requested(
      citation_id uuid,
      citation_purpose text,
      target_anchor_type text,
      target_anchor_data jsonb,
      display_order integer,
      public_safe boolean
    )
    where not exists (
      select 1
      from editorial.citations citation
      where citation.id = requested.citation_id
        and citation.citation_state = 'active'
    )
  ) then
    raise exception
      'Every attached Citation must exist and be active';
  end if;

  perform editorial.validate_citation_target_anchor(
    requested.target_anchor_type,
    requested.target_anchor_data
  )
  from jsonb_to_recordset(p_attachments) as requested(
    citation_id uuid,
    citation_purpose text,
    target_anchor_type text,
    target_anchor_data jsonb,
    display_order integer,
    public_safe boolean
  );

  if exists (
    select 1
    from jsonb_to_recordset(p_attachments) as requested(
      citation_id uuid,
      citation_purpose text,
      target_anchor_type text,
      target_anchor_data jsonb,
      display_order integer,
      public_safe boolean
    )
    join editorial.citations citation
      on citation.id = requested.citation_id
    join editorial.sources source
      on source.id = citation.source_id
    where requested.public_safe
      and (
        not citation.public_safe
        or source.source_state <> 'active'
        or source.review_status <> 'approved'
        or source.current_approved_version_id
             is distinct from
             citation.source_version_id
        or source.exposure_class not in (
             'public',
             'public_redacted'
           )
      )
  ) then
    raise exception
      'A requested public Citation attachment is not publicly eligible';
  end if;

  delete from editorial.resource_citations attachment
  where attachment.target_version_type =
          'playlist_version'
    and attachment.target_version_id =
          p_playlist_version_id
    and attachment.resource_id =
          p_target_resource_id;

  insert into editorial.resource_citations (
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    citation_id,
    citation_purpose,
    target_anchor_type,
    target_anchor_data,
    display_order,
    public_safe,
    created_by
  )
  select
    p_target_resource_id,
    v_target.target_resource_kind,
    'playlist_version',
    p_playlist_version_id,
    requested.citation_id,
    requested.citation_purpose,
    requested.target_anchor_type,
    requested.target_anchor_data,
    requested.display_order,
    requested.public_safe,
    v_actor_id
  from jsonb_to_recordset(p_attachments) as requested(
    citation_id uuid,
    citation_purpose text,
    target_anchor_type text,
    target_anchor_data jsonb,
    display_order integer,
    public_safe boolean
  )
  order by requested.display_order;

  v_resulting_revision :=
    v_revision.citation_revision + 1;

  update editorial.playlist_version_trust_revisions
  set
    citation_revision =
      v_resulting_revision,
    updated_by = v_actor_id,
    updated_at = now()
  where playlist_version_id =
          p_playlist_version_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'attachment_id',
          attachment.id,
        'resource_id',
          attachment.resource_id,
        'resource_kind',
          attachment.resource_kind,
        'citation_id',
          attachment.citation_id,
        'citation_purpose',
          attachment.citation_purpose,
        'target_anchor_type',
          attachment.target_anchor_type,
        'target_anchor_data',
          attachment.target_anchor_data,
        'display_order',
          attachment.display_order,
        'public_safe',
          attachment.public_safe
      )
      order by attachment.display_order
    ),
    '[]'::jsonb
  )
  into v_attachments
  from editorial.resource_citations attachment
  where attachment.target_version_type =
          'playlist_version'
    and attachment.target_version_id =
          p_playlist_version_id
    and attachment.resource_id =
          p_target_resource_id;

  return jsonb_build_object(
    'playlist_version_id',
      p_playlist_version_id,
    'target_resource_id',
      p_target_resource_id,
    'target_resource_kind',
      v_target.target_resource_kind,
    'citation_revision',
      v_resulting_revision,
    'correlation_id',
      p_correlation_id,
    'attachments',
      v_attachments
  );
end;
$function$;

revoke execute
on function public.replace_playlist_version_citations(
  uuid,
  uuid,
  jsonb,
  bigint,
  uuid
)
from public, anon;

grant execute
on function public.replace_playlist_version_citations(
  uuid,
  uuid,
  jsonb,
  bigint,
  uuid
)
to authenticated;

create or replace function
  public.replace_playlist_version_credits(
    p_playlist_version_id uuid,
    p_target_resource_id uuid,
    p_attachments jsonb,
    p_expected_credit_revision bigint,
    p_correlation_id uuid default null
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'auth'
as $function$
declare
  v_actor_id uuid;
  v_target record;
  v_revision
    editorial.playlist_version_trust_revisions%rowtype;
  v_requested_count integer;
  v_resulting_revision bigint;
  v_attachments jsonb;
begin
  v_actor_id :=
    editorial.assert_credit_command_actor();

  if p_attachments is null
     or jsonb_typeof(p_attachments) <> 'array'
  then
    raise exception
      'Credit attachments must be a JSON array';
  end if;

  if p_expected_credit_revision is null
     or p_expected_credit_revision < 1
  then
    raise exception
      'Expected Credit revision must be one or greater';
  end if;

  select *
  into v_target
  from editorial.playlist_working_trust_target(
    p_playlist_version_id,
    p_target_resource_id
  );

  if auth.role() <> 'service_role'
     and not editorial.current_user_can_edit_playlist(
       v_target.root_resource_id
     )
  then
    raise exception
      'You do not have authority to edit this Playlist';
  end if;

  insert into editorial.playlist_version_trust_revisions (
    playlist_version_id,
    citation_revision,
    credit_revision,
    updated_by,
    updated_at
  )
  values (
    p_playlist_version_id,
    1,
    1,
    v_actor_id,
    now()
  )
  on conflict (playlist_version_id)
  do nothing;

  select *
  into v_revision
  from editorial.playlist_version_trust_revisions revision
  where revision.playlist_version_id =
          p_playlist_version_id
  for update;

  if v_revision.credit_revision <>
       p_expected_credit_revision
  then
    raise exception
      'Credit revision conflict. Expected %, found %',
      p_expected_credit_revision,
      v_revision.credit_revision;
  end if;

  v_requested_count :=
    jsonb_array_length(p_attachments);

  if exists (
    select 1
    from jsonb_array_elements(p_attachments) item(value)
    where jsonb_typeof(item.value) <> 'object'
       or not item.value ? 'credit_id'
       or not item.value ? 'display_order'
       or not item.value ? 'is_primary'
       or not item.value ? 'public_safe'
       or jsonb_typeof(
            item.value -> 'display_order'
          ) <> 'number'
       or jsonb_typeof(
            item.value -> 'is_primary'
          ) <> 'boolean'
       or jsonb_typeof(
            item.value -> 'public_safe'
          ) <> 'boolean'
  ) then
    raise exception
      'Every Credit attachment requires a complete valid object';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_attachments) as requested(
      credit_id uuid,
      display_order integer,
      is_primary boolean,
      public_safe boolean
    )
    where requested.credit_id is null
       or requested.display_order is null
       or requested.display_order < 0
       or requested.is_primary is null
       or requested.public_safe is null
  ) then
    raise exception
      'Credit attachment contains an invalid required value';
  end if;

  if exists (
    select 1
    from (
      select requested.credit_id
      from jsonb_to_recordset(p_attachments) as requested(
        credit_id uuid,
        display_order integer,
        is_primary boolean,
        public_safe boolean
      )
      group by requested.credit_id
      having count(*) > 1
    ) duplicate_credits
  ) then
    raise exception
      'Credit attachments contain duplicate Credit identities';
  end if;

  if exists (
    select 1
    from (
      select requested.display_order
      from jsonb_to_recordset(p_attachments) as requested(
        credit_id uuid,
        display_order integer,
        is_primary boolean,
        public_safe boolean
      )
      group by requested.display_order
      having count(*) > 1
    ) duplicate_orders
  ) then
    raise exception
      'Credit attachments contain duplicate display orders';
  end if;

  if v_requested_count > 0
     and (
       (
         select min(requested.display_order)
         from jsonb_to_recordset(p_attachments) as requested(
           credit_id uuid,
           display_order integer,
           is_primary boolean,
           public_safe boolean
         )
       ) <> 0
       or
       (
         select max(requested.display_order)
         from jsonb_to_recordset(p_attachments) as requested(
           credit_id uuid,
           display_order integer,
           is_primary boolean,
           public_safe boolean
         )
       ) <> v_requested_count - 1
     )
  then
    raise exception
      'Credit display order must be zero-based and contiguous per Playlist target';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_attachments) as requested(
      credit_id uuid,
      display_order integer,
      is_primary boolean,
      public_safe boolean
    )
    where not exists (
      select 1
      from editorial.credits credit
      join editorial.credit_governance governance
        on governance.credit_id = credit.id
      where credit.id = requested.credit_id
        and governance.credit_state = 'active'
    )
  ) then
    raise exception
      'Every attached Credit must exist and be active';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_attachments) as requested(
      credit_id uuid,
      display_order integer,
      is_primary boolean,
      public_safe boolean
    )
    join editorial.credits credit
      on credit.id = requested.credit_id
    join editorial.credit_governance governance
      on governance.credit_id = credit.id
    left join editorial.external_contributors contributor
      on contributor.id =
        credit.external_contributor_id
    where requested.public_safe
      and (
        governance.credit_state <> 'active'
        or not governance.public_safe
        or (
          credit.external_contributor_id is not null
          and (
            contributor.id is null
            or contributor.contributor_state <> 'active'
            or not contributor.public_safe
            or contributor.consent_status not in (
              'granted',
              'not_required'
            )
          )
        )
      )
  ) then
    raise exception
      'A requested public Credit attachment is not publicly eligible';
  end if;

  delete from editorial.resource_credits attachment
  where attachment.target_version_type =
          'playlist_version'
    and attachment.target_version_id =
          p_playlist_version_id
    and attachment.resource_id =
          p_target_resource_id;

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
    p_target_resource_id,
    v_target.target_resource_kind,
    'playlist_version',
    p_playlist_version_id,
    requested.credit_id,
    requested.display_order,
    requested.is_primary,
    requested.public_safe,
    v_actor_id
  from jsonb_to_recordset(p_attachments) as requested(
    credit_id uuid,
    display_order integer,
    is_primary boolean,
    public_safe boolean
  )
  order by requested.display_order;

  v_resulting_revision :=
    v_revision.credit_revision + 1;

  update editorial.playlist_version_trust_revisions
  set
    credit_revision =
      v_resulting_revision,
    updated_by = v_actor_id,
    updated_at = now()
  where playlist_version_id =
          p_playlist_version_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'attachment_id',
          attachment.id,
        'resource_id',
          attachment.resource_id,
        'resource_kind',
          attachment.resource_kind,
        'credit_id',
          attachment.credit_id,
        'display_order',
          attachment.display_order,
        'is_primary',
          attachment.is_primary,
        'public_safe',
          attachment.public_safe
      )
      order by attachment.display_order
    ),
    '[]'::jsonb
  )
  into v_attachments
  from editorial.resource_credits attachment
  where attachment.target_version_type =
          'playlist_version'
    and attachment.target_version_id =
          p_playlist_version_id
    and attachment.resource_id =
          p_target_resource_id;

  return jsonb_build_object(
    'playlist_version_id',
      p_playlist_version_id,
    'target_resource_id',
      p_target_resource_id,
    'target_resource_kind',
      v_target.target_resource_kind,
    'credit_revision',
      v_resulting_revision,
    'correlation_id',
      p_correlation_id,
    'attachments',
      v_attachments
  );
end;
$function$;

revoke execute
on function public.replace_playlist_version_credits(
  uuid,
  uuid,
  jsonb,
  bigint,
  uuid
)
from public, anon;

grant execute
on function public.replace_playlist_version_credits(
  uuid,
  uuid,
  jsonb,
  bigint,
  uuid
)
to authenticated;

-- ---------------------------------------------------------------------------
-- Governed command vocabulary.
-- ---------------------------------------------------------------------------

insert into platform_private.command_types (
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type,
  enabled
)
values
  (
    'playlist.version.snapshot_working',
    'playlist.version.snapshot_working.sync',
    'playlist.version.snapshot_working.accepted',
    'playlist.version.snapshot_working.succeeded',
    'playlist.version.snapshot_working.failed',
    'playlist.version.snapshot_working.retry_scheduled',
    true
  ),
  (
    'playlist.review.submit',
    'playlist.review.submit.sync',
    'playlist.review.submit.accepted',
    'playlist.review.submit.succeeded',
    'playlist.review.submit.failed',
    'playlist.review.submit.retry_scheduled',
    true
  ),
  (
    'playlist.review.decide',
    'playlist.review.decide.sync',
    'playlist.review.decide.accepted',
    'playlist.review.decide.succeeded',
    'playlist.review.decide.failed',
    'playlist.review.decide.retry_scheduled',
    true
  );

-- ---------------------------------------------------------------------------
-- Current-state fingerprint.
-- ---------------------------------------------------------------------------

create or replace function
  editorial.playlist_current_content_fingerprint(
    p_playlist_id uuid
  )
returns text
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'media',
  'extensions'
as $function$
declare
  v_playlist public.wk_playlists%rowtype;
  v_resource_id uuid;
  v_items jsonb;
  v_cover_count integer;
  v_cover jsonb := null;
begin
  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  select binding.resource_id
  into v_resource_id
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if v_resource_id is null then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  select count(*)
  into v_cover_count
  from media.usage_links usage
  where usage.target_authority = 'editorial'
    and usage.target_kind = 'playlist'
    and usage.target_id = p_playlist_id
    and usage.target_version_id is null
    and usage.usage_role = 'playlist_cover'
    and usage.usage_state = 'active';

  if v_cover_count > 1 then
    raise exception
      'Playlist has more than one active canonical cover';
  end if;

  if v_cover_count = 1 then
    select jsonb_build_object(
      'asset_id', usage.asset_id,
      'asset_revision_id', usage.asset_revision_id,
      'resolution_mode', usage.resolution_mode,
      'placement_data', usage.placement_data,
      'alt_text_snapshot', usage.alt_text_snapshot,
      'caption_snapshot', usage.caption_snapshot,
      'credit_snapshot', usage.credit_snapshot
    )
    into v_cover
    from media.usage_links usage
    where usage.target_authority = 'editorial'
      and usage.target_kind = 'playlist'
      and usage.target_id = p_playlist_id
      and usage.target_version_id is null
      and usage.usage_role = 'playlist_cover'
      and usage.usage_state = 'active';

    if v_cover ->> 'resolution_mode'
         <> 'exact_revision'
       or nullif(
            v_cover ->> 'asset_revision_id',
            ''
          ) is null
    then
      raise exception
        'Playlist cover must resolve to an exact Media revision before snapshotting';
    end if;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'playlist_item_resource_id',
          binding.resource_id,
        'playlist_item_id',
          item.id,
        'position',
          item.position,
        'registry_track_id',
          item.registry_track_id,
        'registry_release_id',
          item.registry_release_id,
        'provider_key',
          item.provider_key,
        'provider_track_id',
          item.provider_track_id,
        'provider_url',
          item.provider_url,
        'title',
          item.title,
        'artist_names',
          to_jsonb(item.artist_names),
        'release_title',
          item.release_title,
        'artwork_url',
          item.artwork_url,
        'preview_url',
          item.preview_url,
        'duration_ms',
          item.duration_ms,
        'isrc',
          item.isrc,
        'match_status',
          item.match_status,
        'match_confidence',
          item.match_confidence,
        'normalization_payload',
          item.normalization_payload,
        'notes',
          item.notes
      )
      order by item.position
    ),
    '[]'::jsonb
  )
  into v_items
  from public.wk_playlist_items item
  join editorial.playlist_item_resources binding
    on binding.playlist_item_id = item.id
  where item.playlist_id = p_playlist_id
    and item.lifecycle_state = 'active';

  return encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'playlist_id', p_playlist_id,
          'title', v_playlist.title,
          'slug', v_playlist.slug,
          'description', v_playlist.description,
          'curator_label', v_playlist.curator_label,
          'metadata', v_playlist.metadata,
          'cover', v_cover,
          'items', v_items
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
end;
$function$;

revoke all
on function
  editorial.playlist_current_content_fingerprint(uuid)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Insert an immutable working/submitted snapshot from current state.
-- ---------------------------------------------------------------------------

create or replace function
  editorial.insert_playlist_current_snapshot(
    p_playlist_id uuid,
    p_expected_authority_revision bigint,
    p_version_kind text,
    p_snapshot_status text,
    p_actor_id uuid
  )
returns table(
  version_id uuid,
  version_number bigint,
  content_fingerprint text,
  item_count integer
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'media'
as $function$
declare
  v_playlist public.wk_playlists%rowtype;
  v_resource_id uuid;
  v_version_id uuid;
  v_version_number bigint;
  v_fingerprint text;
  v_item_count integer;
  v_cover media.usage_links%rowtype;
begin
  if p_version_kind not in (
    'working',
    'submitted'
  ) then
    raise exception
      'Current Playlist snapshot kind must be working or submitted';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_playlist.authority_revision
          <> p_expected_authority_revision
  then
    raise exception
      'Playlist authority revision conflict. Expected %, found %',
      p_expected_authority_revision,
      v_playlist.authority_revision;
  end if;

  select binding.resource_id
  into v_resource_id
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if v_resource_id is null then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  v_fingerprint :=
    editorial.playlist_current_content_fingerprint(
      p_playlist_id
    );

  select count(*)::integer
  into v_item_count
  from public.wk_playlist_items item
  where item.playlist_id = p_playlist_id
    and item.lifecycle_state = 'active';

  select coalesce(
    max(version.version_number),
    0
  ) + 1
  into v_version_number
  from editorial.playlist_versions version
  where version.resource_id = v_resource_id;

  v_version_id := gen_random_uuid();

  select usage.*
  into v_cover
  from media.usage_links usage
  where usage.target_authority = 'editorial'
    and usage.target_kind = 'playlist'
    and usage.target_id = p_playlist_id
    and usage.target_version_id is null
    and usage.usage_role = 'playlist_cover'
    and usage.usage_state = 'active';

  if found
     and (
       v_cover.resolution_mode <> 'exact_revision'
       or v_cover.asset_revision_id is null
     )
  then
    raise exception
      'Playlist cover must resolve to an exact Media revision before snapshotting';
  end if;

  insert into editorial.playlist_versions (
    id,
    resource_id,
    playlist_id,
    version_number,
    version_kind,
    source_authority_revision,
    title,
    slug,
    description,
    curator_label,
    status,
    metadata,
    item_count,
    content_fingerprint,
    cover_asset_id,
    cover_asset_revision_id,
    cover_placement_data,
    cover_display_order,
    cover_alt_text_snapshot,
    cover_caption_snapshot,
    cover_credit_snapshot,
    created_by
  )
  values (
    v_version_id,
    v_resource_id,
    p_playlist_id,
    v_version_number,
    p_version_kind,
    v_playlist.authority_revision,
    v_playlist.title,
    v_playlist.slug,
    v_playlist.description,
    v_playlist.curator_label,
    p_snapshot_status,
    v_playlist.metadata,
    v_item_count,
    v_fingerprint,
    v_cover.asset_id,
    v_cover.asset_revision_id,
    coalesce(v_cover.placement_data, '{}'::jsonb),
    coalesce(v_cover.display_order, 0),
    v_cover.alt_text_snapshot,
    v_cover.caption_snapshot,
    v_cover.credit_snapshot,
    p_actor_id
  );

  insert into editorial.playlist_version_trust_revisions (
    playlist_version_id,
    citation_revision,
    credit_revision,
    updated_by,
    updated_at
  )
  values (
    v_version_id,
    1,
    1,
    p_actor_id,
    now()
  );

  insert into editorial.playlist_version_items (
    playlist_version_id,
    playlist_item_resource_id,
    playlist_item_id,
    position,
    registry_track_id,
    registry_release_id,
    provider_key,
    provider_track_id,
    provider_url,
    title,
    artist_names,
    release_title,
    artwork_url,
    preview_url,
    duration_ms,
    isrc,
    match_status,
    match_confidence,
    normalization_payload,
    notes
  )
  select
    v_version_id,
    binding.resource_id,
    item.id,
    item.position,
    item.registry_track_id,
    item.registry_release_id,
    item.provider_key,
    item.provider_track_id,
    item.provider_url,
    item.title,
    item.artist_names,
    item.release_title,
    item.artwork_url,
    item.preview_url,
    item.duration_ms,
    item.isrc,
    item.match_status,
    item.match_confidence,
    item.normalization_payload,
    item.notes
  from public.wk_playlist_items item
  join editorial.playlist_item_resources binding
    on binding.playlist_item_id = item.id
  where item.playlist_id = p_playlist_id
    and item.lifecycle_state = 'active'
  order by item.position;

  version_id := v_version_id;
  version_number := v_version_number;
  content_fingerprint := v_fingerprint;
  item_count := v_item_count;
  return next;
end;
$function$;

revoke all
on function editorial.insert_playlist_current_snapshot(
  uuid,
  bigint,
  text,
  text,
  uuid
)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Carry version-bound Trust from an exact current working snapshot.
-- ---------------------------------------------------------------------------

create or replace function
  editorial.copy_playlist_working_trust_to_version(
    p_resource_id uuid,
    p_source_working_version_id uuid,
    p_target_version_id uuid
  )
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial'
as $function$
declare
  v_copy_authorization uuid;
begin
  if p_source_working_version_id is null then
    return;
  end if;

  v_copy_authorization :=
    platform_private.begin_playlist_trust_copy_authorization(
      p_source_working_version_id,
      p_target_version_id
    );

  insert into editorial.resource_citations (
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    citation_id,
    citation_purpose,
    target_anchor_type,
    target_anchor_data,
    display_order,
    public_safe,
    created_by
  )
  select
    citation.resource_id,
    citation.resource_kind,
    'playlist_version',
    p_target_version_id,
    citation.citation_id,
    citation.citation_purpose,
    citation.target_anchor_type,
    citation.target_anchor_data,
    citation.display_order,
    citation.public_safe,
    citation.created_by
  from editorial.resource_citations citation
  where citation.target_version_type =
          'playlist_version'
    and citation.target_version_id =
          p_source_working_version_id
    and (
      (
        citation.resource_kind = 'playlist'
        and citation.resource_id = p_resource_id
      )
      or (
        citation.resource_kind = 'playlist_item'
        and exists (
          select 1
          from editorial.playlist_version_items item
          where item.playlist_version_id =
                  p_target_version_id
            and item.playlist_item_resource_id =
                  citation.resource_id
        )
      )
    );

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
    credit.resource_id,
    credit.resource_kind,
    'playlist_version',
    p_target_version_id,
    credit.credit_id,
    credit.display_order,
    credit.is_primary,
    credit.public_safe,
    credit.created_by
  from editorial.resource_credits credit
  where credit.target_version_type =
          'playlist_version'
    and credit.target_version_id =
          p_source_working_version_id
    and (
      (
        credit.resource_kind = 'playlist'
        and credit.resource_id = p_resource_id
      )
      or (
        credit.resource_kind = 'playlist_item'
        and exists (
          select 1
          from editorial.playlist_version_items item
          where item.playlist_version_id =
                  p_target_version_id
            and item.playlist_item_resource_id =
                  credit.resource_id
        )
      )
    );

  perform platform_private.end_playlist_trust_copy_authorization(
    v_copy_authorization
  );
end;
$function$;

revoke all
on function
  editorial.copy_playlist_working_trust_to_version(
    uuid,
    uuid,
    uuid
  )
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Copy submitted snapshot exactly into an approved snapshot.
-- ---------------------------------------------------------------------------

create or replace function
  editorial.copy_playlist_version_snapshot(
    p_source_version_id uuid,
    p_actor_id uuid
  )
returns table(
  version_id uuid,
  version_number bigint,
  content_fingerprint text,
  item_count integer
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'media'
as $function$
declare
  v_source editorial.playlist_versions%rowtype;
  v_version_id uuid;
  v_version_number bigint;
  v_copy_authorization uuid;
begin
  select source.*
  into v_source
  from editorial.playlist_versions source
  where source.id = p_source_version_id;

  if not found then
    raise exception
      'Source Playlist version does not exist';
  end if;

  if v_source.version_kind <> 'submitted' then
    raise exception
      'Only a submitted Playlist version can be approved';
  end if;

  perform 1
  from public.wk_playlists playlist
  where playlist.id = v_source.playlist_id
  for update;

  select coalesce(
    max(version.version_number),
    0
  ) + 1
  into v_version_number
  from editorial.playlist_versions version
  where version.resource_id =
          v_source.resource_id;

  v_version_id := gen_random_uuid();

  insert into editorial.playlist_versions (
    id,
    resource_id,
    playlist_id,
    version_number,
    version_kind,
    source_authority_revision,
    title,
    slug,
    description,
    curator_label,
    status,
    metadata,
    item_count,
    content_fingerprint,
    cover_asset_id,
    cover_asset_revision_id,
    cover_placement_data,
    cover_display_order,
    cover_alt_text_snapshot,
    cover_caption_snapshot,
    cover_credit_snapshot,
    created_by
  )
  values (
    v_version_id,
    v_source.resource_id,
    v_source.playlist_id,
    v_version_number,
    'approved',
    v_source.source_authority_revision,
    v_source.title,
    v_source.slug,
    v_source.description,
    v_source.curator_label,
    'approved',
    v_source.metadata,
    v_source.item_count,
    v_source.content_fingerprint,
    v_source.cover_asset_id,
    v_source.cover_asset_revision_id,
    v_source.cover_placement_data,
    v_source.cover_display_order,
    v_source.cover_alt_text_snapshot,
    v_source.cover_caption_snapshot,
    v_source.cover_credit_snapshot,
    p_actor_id
  );

  insert into editorial.playlist_version_trust_revisions (
    playlist_version_id,
    citation_revision,
    credit_revision,
    updated_by,
    updated_at
  )
  values (
    v_version_id,
    1,
    1,
    p_actor_id,
    now()
  );

  insert into editorial.playlist_version_items (
    playlist_version_id,
    playlist_item_resource_id,
    playlist_item_id,
    position,
    registry_track_id,
    registry_release_id,
    provider_key,
    provider_track_id,
    provider_url,
    title,
    artist_names,
    release_title,
    artwork_url,
    preview_url,
    duration_ms,
    isrc,
    match_status,
    match_confidence,
    normalization_payload,
    notes
  )
  select
    v_version_id,
    item.playlist_item_resource_id,
    item.playlist_item_id,
    item.position,
    item.registry_track_id,
    item.registry_release_id,
    item.provider_key,
    item.provider_track_id,
    item.provider_url,
    item.title,
    item.artist_names,
    item.release_title,
    item.artwork_url,
    item.preview_url,
    item.duration_ms,
    item.isrc,
    item.match_status,
    item.match_confidence,
    item.normalization_payload,
    item.notes
  from editorial.playlist_version_items item
  where item.playlist_version_id =
          p_source_version_id
  order by item.position;

  v_copy_authorization :=
    platform_private.begin_playlist_trust_copy_authorization(
      p_source_version_id,
      v_version_id
    );

  insert into editorial.resource_citations (
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    citation_id,
    citation_purpose,
    target_anchor_type,
    target_anchor_data,
    display_order,
    public_safe,
    created_by
  )
  select
    citation.resource_id,
    citation.resource_kind,
    'playlist_version',
    v_version_id,
    citation.citation_id,
    citation.citation_purpose,
    citation.target_anchor_type,
    citation.target_anchor_data,
    citation.display_order,
    citation.public_safe,
    citation.created_by
  from editorial.resource_citations citation
  where citation.target_version_type =
          'playlist_version'
    and citation.target_version_id =
          p_source_version_id;

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
    credit.resource_id,
    credit.resource_kind,
    'playlist_version',
    v_version_id,
    credit.credit_id,
    credit.display_order,
    credit.is_primary,
    credit.public_safe,
    credit.created_by
  from editorial.resource_credits credit
  where credit.target_version_type =
          'playlist_version'
    and credit.target_version_id =
          p_source_version_id;

  perform platform_private.end_playlist_trust_copy_authorization(
    v_copy_authorization
  );

  version_id := v_version_id;
  version_number := v_version_number;
  content_fingerprint :=
    v_source.content_fingerprint;
  item_count := v_source.item_count;
  return next;
end;
$function$;

revoke all
on function editorial.copy_playlist_version_snapshot(
  uuid,
  uuid
)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Working snapshot command.
-- ---------------------------------------------------------------------------

create or replace function
  public.snapshot_playlist_working_version(
    p_playlist_id uuid,
    p_expected_authority_revision bigint,
    p_idempotency_key text,
    p_correlation_id uuid default null
  )
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_current editorial.playlist_versions%rowtype;
  v_snapshot record;
  v_fingerprint text;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_reused boolean := false;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      gen_random_uuid()
    );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id
  for update;

  if v_binding.resource_id is null then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  if not editorial.current_user_can_edit_playlist(
    v_binding.resource_id
  ) then
    raise exception
      'Playlist edit permission is required';
  end if;

  v_fingerprint :=
    editorial.playlist_current_content_fingerprint(
      p_playlist_id
    );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.version.snapshot_working',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'content_fingerprint',
        v_fingerprint,
      'correlation_id',
        v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id :=
      v_read.command_receipt_id;
    receipt_status :=
      v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_read.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload
          ->> 'authority_revision',
        ''
      )::bigint;
    version_id :=
      nullif(
        v_read.result_payload
          ->> 'version_id',
        ''
      )::uuid;
    version_number :=
      nullif(
        v_read.result_payload
          ->> 'version_number',
        ''
      )::bigint;
    lifecycle_status :=
      v_read.result_payload
        ->> 'lifecycle_status';
    result_payload :=
      v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_playlist.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before the working snapshot could be created.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision
      )
    );
  else
    if v_binding.current_working_version_id
         is not null
    then
      select version.*
      into v_current
      from editorial.playlist_versions version
      where version.id =
        v_binding.current_working_version_id;

      if found
         and v_current.version_kind =
               'working'
         and v_current.content_fingerprint =
               v_fingerprint
      then
        select
          v_current.id as version_id,
          v_current.version_number as version_number,
          v_current.content_fingerprint as content_fingerprint,
          v_current.item_count as item_count
        into v_snapshot;

        v_reused := true;
      end if;
    end if;

    if not v_reused then
      select *
      into v_snapshot
      from editorial.insert_playlist_current_snapshot(
        p_playlist_id,
        v_playlist.authority_revision,
        'working',
        v_playlist.status,
        v_actor
      );

      update editorial.playlist_resources binding_update
      set current_working_version_id =
            v_snapshot.version_id
      where binding_update.playlist_id = p_playlist_id;
    end if;

    v_result := jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'resource_id',
        v_binding.resource_id,
      'authority_revision',
        v_playlist.authority_revision,
      'version_id',
        v_snapshot.version_id,
      'version_number',
        v_snapshot.version_number,
      'content_fingerprint',
        v_snapshot.content_fingerprint,
      'item_count',
        v_snapshot.item_count,
      'lifecycle_status',
        v_playlist.status,
      'reused_existing_snapshot',
        v_reused,
      'correlation_id',
        v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id :=
    v_read.command_receipt_id;
  receipt_status :=
    v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  authority_revision :=
    nullif(
      v_read.result_payload
        ->> 'authority_revision',
      ''
    )::bigint;
  version_id :=
    nullif(
      v_read.result_payload
        ->> 'version_id',
      ''
    )::uuid;
  version_number :=
    nullif(
      v_read.result_payload
        ->> 'version_number',
      ''
    )::bigint;
  lifecycle_status :=
    v_read.result_payload
      ->> 'lifecycle_status';
  result_payload :=
    v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Submit exact current state for Review.
-- ---------------------------------------------------------------------------

create or replace function
  public.submit_playlist_for_review(
    p_playlist_id uuid,
    p_expected_authority_revision bigint,
    p_idempotency_key text,
    p_note text default null,
    p_correlation_id uuid default null
  )
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_working editorial.playlist_versions%rowtype;
  v_snapshot record;
  v_fingerprint text;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_prior_status text;
  v_event_number bigint;
  v_trust_count bigint := 0;
  v_copy_working_trust boolean := false;
  v_active_item_count bigint;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      gen_random_uuid()
    );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id
  for update;

  if v_binding.resource_id is null then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  if not editorial.current_user_can_edit_playlist(
    v_binding.resource_id
  ) then
    raise exception
      'Playlist edit permission is required';
  end if;

  v_fingerprint :=
    editorial.playlist_current_content_fingerprint(
      p_playlist_id
    );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.review.submit',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'content_fingerprint',
        v_fingerprint,
      'note',
        nullif(
          btrim(p_note),
          ''
        ),
      'correlation_id',
        v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id :=
      v_read.command_receipt_id;
    receipt_status :=
      v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_read.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload
          ->> 'authority_revision',
        ''
      )::bigint;
    version_id :=
      nullif(
        v_read.result_payload
          ->> 'version_id',
        ''
      )::uuid;
    version_number :=
      nullif(
        v_read.result_payload
          ->> 'version_number',
        ''
      )::bigint;
    lifecycle_status :=
      v_read.result_payload
        ->> 'lifecycle_status';
    result_payload :=
      v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_playlist.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before it could be submitted.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status
      )
    );

  elsif v_playlist.status not in (
    'draft',
    'changes_requested'
  ) then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_not_submittable',
      'Only a draft or changes-requested Playlist can be submitted.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status
      )
    );

  else
    select count(*)
    into v_active_item_count
    from public.wk_playlist_items item
    where item.playlist_id = p_playlist_id
      and item.lifecycle_state = 'active';

    if v_active_item_count = 0 then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'playlist_empty',
        'A Playlist needs at least one track before Review.',
        jsonb_build_object(
          'playlist_id',
            p_playlist_id,
          'authority_revision',
            v_playlist.authority_revision
        )
      );
    end if;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id =
              v_begin.command_receipt_id
        and receipt.status = 'accepted'
    )
       and v_binding.current_working_version_id
             is not null
    then
      select version.*
      into v_working
      from editorial.playlist_versions version
      where version.id =
        v_binding.current_working_version_id;

      if found
         and v_working.content_fingerprint =
               v_fingerprint
      then
        v_copy_working_trust := true;
      elsif found then
        select
          (
            select count(*)
            from editorial.resource_citations citation
            where citation.target_version_type =
                    'playlist_version'
              and citation.target_version_id =
                    v_working.id
          )
          +
          (
            select count(*)
            from editorial.resource_credits credit
            where credit.target_version_type =
                    'playlist_version'
              and credit.target_version_id =
                    v_working.id
          )
        into v_trust_count;

        if v_trust_count > 0 then
          perform platform_private.reject_resource_command(
            v_begin.command_receipt_id,
            'playlist_working_trust_stale',
            'Version-bound Playlist Trust is attached to an older working snapshot.',
            jsonb_build_object(
              'playlist_id',
                p_playlist_id,
              'authority_revision',
                v_playlist.authority_revision,
              'working_version_id',
                v_working.id,
              'working_source_authority_revision',
                v_working.source_authority_revision,
              'trust_binding_count',
                v_trust_count
            )
          );
        end if;
      end if;
    end if;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id =
              v_begin.command_receipt_id
        and receipt.status = 'accepted'
    )
    then
      v_prior_status := v_playlist.status;

      select *
      into v_snapshot
      from editorial.insert_playlist_current_snapshot(
        p_playlist_id,
        v_playlist.authority_revision,
        'submitted',
        'ready_for_review',
        v_actor
      );

      if v_copy_working_trust then
        perform
          editorial.copy_playlist_working_trust_to_version(
            v_binding.resource_id,
            v_working.id,
            v_snapshot.version_id
          );
      end if;

      update editorial.playlist_resources binding_update
      set
        current_submitted_version_id =
          v_snapshot.version_id,
        current_approved_version_id = null
      where binding_update.playlist_id = p_playlist_id;

      update public.wk_playlists playlist
      set
        status = 'ready_for_review',
        authority_revision =
          playlist.authority_revision + 1
      where playlist.id = p_playlist_id
      returning playlist.*
      into v_playlist;

      select coalesce(
        max(event.event_number),
        0
      ) + 1
      into v_event_number
      from editorial.playlist_review_events event
      where event.resource_id =
              v_binding.resource_id;

      insert into editorial.playlist_review_events (
        resource_id,
        playlist_id,
        event_number,
        target_version_id,
        result_version_id,
        action,
        prior_status,
        resulting_status,
        reason,
        actor_id,
        command_receipt_id,
        correlation_id
      )
      values (
        v_binding.resource_id,
        p_playlist_id,
        v_event_number,
        v_snapshot.version_id,
        null,
        'submitted',
        v_prior_status,
        'ready_for_review',
        nullif(
          btrim(p_note),
          ''
        ),
        v_actor,
        v_begin.command_receipt_id,
        v_correlation_id
      );

      v_result := jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'resource_id',
          v_binding.resource_id,
        'authority_revision',
          v_playlist.authority_revision,
        'version_id',
          v_snapshot.version_id,
        'version_number',
          v_snapshot.version_number,
        'content_fingerprint',
          v_snapshot.content_fingerprint,
        'item_count',
          v_snapshot.item_count,
        'lifecycle_status',
          'ready_for_review',
        'correlation_id',
          v_correlation_id
      );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id :=
    v_read.command_receipt_id;
  receipt_status :=
    v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  authority_revision :=
    nullif(
      v_read.result_payload
        ->> 'authority_revision',
      ''
    )::bigint;
  version_id :=
    nullif(
      v_read.result_payload
        ->> 'version_id',
      ''
    )::uuid;
  version_number :=
    nullif(
      v_read.result_payload
        ->> 'version_number',
      ''
    )::bigint;
  lifecycle_status :=
    v_read.result_payload
      ->> 'lifecycle_status';
  result_payload :=
    v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Start Review, request changes, or approve the exact submitted version.
-- ---------------------------------------------------------------------------

create or replace function public.review_playlist(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_submitted_version_id uuid,
  p_decision text,
  p_idempotency_key text,
  p_note text default null,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_submitted editorial.playlist_versions%rowtype;
  v_approved record;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_event_number bigint;
  v_prior_status text;
  v_result_status text;
  v_action text;
  v_result_version_id uuid;
  v_result_version_number bigint;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      gen_random_uuid()
    );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    coalesce(
      public.current_user_is_administrator(),
      false
    )
    or coalesce(
      public.current_user_has_capability(
        'manage_review_queue'
      ),
      false
    )
  ) then
    raise exception
      'Review queue management permission is required';
  end if;

  if p_decision not in (
    'start_review',
    'request_changes',
    'approve'
  ) then
    raise exception
      'Choose a supported Playlist review decision';
  end if;

  if p_decision = 'request_changes'
     and nullif(
           btrim(p_note),
           ''
         ) is null
  then
    raise exception
      'Requested changes require a review note';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id
  for update;

  if v_binding.resource_id is null then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  select submitted.*
  into v_submitted
  from editorial.playlist_versions submitted
  where submitted.id = p_submitted_version_id
    and submitted.resource_id =
          v_binding.resource_id
    and submitted.playlist_id =
          p_playlist_id
    and submitted.version_kind =
          'submitted';

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.review.decide',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'submitted_version_id',
        p_submitted_version_id,
      'decision',
        p_decision,
      'note',
        nullif(
          btrim(p_note),
          ''
        ),
      'correlation_id',
        v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id :=
      v_read.command_receipt_id;
    receipt_status :=
      v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_read.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload
          ->> 'authority_revision',
        ''
      )::bigint;
    version_id :=
      nullif(
        v_read.result_payload
          ->> 'version_id',
        ''
      )::uuid;
    version_number :=
      nullif(
        v_read.result_payload
          ->> 'version_number',
        ''
      )::bigint;
    lifecycle_status :=
      v_read.result_payload
        ->> 'lifecycle_status';
    result_payload :=
      v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_playlist.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before the review decision could be applied.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status
      )
    );

  elsif v_binding.current_submitted_version_id
          is distinct from p_submitted_version_id
        or v_submitted.id is null
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'submitted_version_changed',
      'Review must target the exact current submitted Playlist version.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'current_submitted_version_id',
          v_binding.current_submitted_version_id
      )
    );

  else
    v_prior_status := v_playlist.status;

    if p_decision = 'start_review' then
      if v_playlist.status <> 'ready_for_review' then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'invalid_review_transition',
          'Only a ready Playlist can enter Review.',
          jsonb_build_object(
            'playlist_id',
              p_playlist_id,
            'authority_revision',
              v_playlist.authority_revision,
            'lifecycle_status',
              v_playlist.status
          )
        );
      else
        v_result_status := 'in_review';
        v_action := 'review_started';
        v_result_version_id :=
          v_submitted.id;
        v_result_version_number :=
          v_submitted.version_number;
      end if;

    elsif p_decision = 'request_changes' then
      if v_playlist.status not in (
        'ready_for_review',
        'in_review'
      ) then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'invalid_review_transition',
          'The Playlist is not currently reviewable.',
          jsonb_build_object(
            'playlist_id',
              p_playlist_id,
            'authority_revision',
              v_playlist.authority_revision,
            'lifecycle_status',
              v_playlist.status
          )
        );
      else
        v_result_status :=
          'changes_requested';
        v_action :=
          'changes_requested';
        v_result_version_id :=
          v_submitted.id;
        v_result_version_number :=
          v_submitted.version_number;
      end if;

    else
      if v_playlist.status not in (
        'ready_for_review',
        'in_review'
      ) then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'invalid_review_transition',
          'The Playlist is not currently reviewable.',
          jsonb_build_object(
            'playlist_id',
              p_playlist_id,
            'authority_revision',
              v_playlist.authority_revision,
            'lifecycle_status',
              v_playlist.status
          )
        );
      else
        select *
        into v_approved
        from editorial.copy_playlist_version_snapshot(
          v_submitted.id,
          v_actor
        );

        v_result_status := 'approved';
        v_action := 'approved';
        v_result_version_id :=
          v_approved.version_id;
        v_result_version_number :=
          v_approved.version_number;
      end if;
    end if;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id =
              v_begin.command_receipt_id
        and receipt.status = 'accepted'
    )
    then
      if p_decision = 'approve' then
        update editorial.playlist_resources binding_update
        set current_approved_version_id =
              v_result_version_id
        where binding_update.playlist_id = p_playlist_id;

      elsif p_decision = 'request_changes' then
        update editorial.playlist_resources binding_update
        set current_approved_version_id = null
        where binding_update.playlist_id = p_playlist_id;
      end if;

      update public.wk_playlists playlist
      set
        status = v_result_status,
        authority_revision =
          playlist.authority_revision + 1
      where playlist.id = p_playlist_id
      returning playlist.*
      into v_playlist;

      select coalesce(
        max(event.event_number),
        0
      ) + 1
      into v_event_number
      from editorial.playlist_review_events event
      where event.resource_id =
              v_binding.resource_id;

      insert into editorial.playlist_review_events (
        resource_id,
        playlist_id,
        event_number,
        target_version_id,
        result_version_id,
        action,
        prior_status,
        resulting_status,
        reason,
        actor_id,
        command_receipt_id,
        correlation_id
      )
      values (
        v_binding.resource_id,
        p_playlist_id,
        v_event_number,
        v_submitted.id,
        case
          when p_decision = 'approve'
            then v_result_version_id
          else null
        end,
        v_action,
        v_prior_status,
        v_result_status,
        nullif(
          btrim(p_note),
          ''
        ),
        v_actor,
        v_begin.command_receipt_id,
        v_correlation_id
      );

      v_result := jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'resource_id',
          v_binding.resource_id,
        'authority_revision',
          v_playlist.authority_revision,
        'submitted_version_id',
          v_submitted.id,
        'version_id',
          v_result_version_id,
        'version_number',
          v_result_version_number,
        'lifecycle_status',
          v_result_status,
        'decision',
          p_decision,
        'correlation_id',
          v_correlation_id
      );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id :=
    v_read.command_receipt_id;
  receipt_status :=
    v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  authority_revision :=
    nullif(
      v_read.result_payload
        ->> 'authority_revision',
      ''
    )::bigint;
  version_id :=
    nullif(
      v_read.result_payload
        ->> 'version_id',
      ''
    )::uuid;
  version_number :=
    nullif(
      v_read.result_payload
        ->> 'version_number',
      ''
    )::bigint;
  lifecycle_status :=
    v_read.result_payload
      ->> 'lifecycle_status';
  result_payload :=
    v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Exact version-bound Review workspace.
-- ---------------------------------------------------------------------------

create or replace function editorial.playlist_version_snapshot_json(
  p_version_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'editorial'
as $function$
  select case
    when version.id is null then null
    else jsonb_build_object(
      'id', version.id,
      'resource_id', version.resource_id,
      'playlist_id', version.playlist_id,
      'version_number', version.version_number,
      'version_kind', version.version_kind,
      'source_authority_revision', version.source_authority_revision,
      'title', version.title,
      'slug', version.slug,
      'description', version.description,
      'curator_label', version.curator_label,
      'status', version.status,
      'metadata', version.metadata,
      'item_count', version.item_count,
      'content_fingerprint', version.content_fingerprint,
      'cover', case
        when version.cover_asset_id is null then null
        else jsonb_build_object(
          'asset_id', version.cover_asset_id,
          'asset_revision_id', version.cover_asset_revision_id,
          'placement_data', version.cover_placement_data,
          'display_order', version.cover_display_order,
          'alt_text_snapshot', version.cover_alt_text_snapshot,
          'caption_snapshot', version.cover_caption_snapshot,
          'credit_snapshot', version.cover_credit_snapshot
        )
      end,
      'created_by', version.created_by,
      'created_at', version.created_at,
      'trust_revisions', coalesce(
        (
          select jsonb_build_object(
            'citation_revision', revision.citation_revision,
            'credit_revision', revision.credit_revision,
            'updated_by', revision.updated_by,
            'updated_at', revision.updated_at
          )
          from editorial.playlist_version_trust_revisions revision
          where revision.playlist_version_id = version.id
        ),
        jsonb_build_object(
          'citation_revision', 1,
          'credit_revision', 1
        )
      ),
      'citations', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', attachment.id,
              'resource_id', attachment.resource_id,
              'resource_kind', attachment.resource_kind,
              'citation_id', attachment.citation_id,
              'citation_purpose', attachment.citation_purpose,
              'target_anchor_type', attachment.target_anchor_type,
              'target_anchor_data', attachment.target_anchor_data,
              'display_order', attachment.display_order,
              'public_safe', attachment.public_safe,
              'created_by', attachment.created_by,
              'created_at', attachment.created_at
            )
            order by
              attachment.resource_kind,
              attachment.resource_id,
              attachment.display_order
          )
          from editorial.resource_citations attachment
          where attachment.target_version_type = 'playlist_version'
            and attachment.target_version_id = version.id
        ),
        '[]'::jsonb
      ),
      'credits', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', attachment.id,
              'resource_id', attachment.resource_id,
              'resource_kind', attachment.resource_kind,
              'credit_id', attachment.credit_id,
              'display_order', attachment.display_order,
              'is_primary', attachment.is_primary,
              'public_safe', attachment.public_safe,
              'created_by', attachment.created_by,
              'created_at', attachment.created_at
            )
            order by
              attachment.resource_kind,
              attachment.resource_id,
              attachment.display_order
          )
          from editorial.resource_credits attachment
          where attachment.target_version_type = 'playlist_version'
            and attachment.target_version_id = version.id
        ),
        '[]'::jsonb
      ),
      'items', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'playlist_item_resource_id', item.playlist_item_resource_id,
              'playlist_item_id', item.playlist_item_id,
              'position', item.position,
              'registry_track_id', item.registry_track_id,
              'registry_release_id', item.registry_release_id,
              'provider_key', item.provider_key,
              'provider_track_id', item.provider_track_id,
              'provider_url', item.provider_url,
              'title', item.title,
              'artist_names', to_jsonb(item.artist_names),
              'release_title', item.release_title,
              'artwork_url', item.artwork_url,
              'preview_url', item.preview_url,
              'duration_ms', item.duration_ms,
              'isrc', item.isrc,
              'match_status', item.match_status,
              'match_confidence', item.match_confidence,
              'normalization_payload', item.normalization_payload,
              'notes', item.notes
            )
            order by item.position
          )
          from editorial.playlist_version_items item
          where item.playlist_version_id = version.id
        ),
        '[]'::jsonb
      )
    )
  end
  from (
    select candidate.*
    from editorial.playlist_versions candidate
    where candidate.id = p_version_id
  ) version;
$function$;

revoke all
on function editorial.playlist_version_snapshot_json(uuid)
from public, anon, authenticated;

create or replace function public.get_playlist_review_workspace(
  p_playlist_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial'
as $function$
declare
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_events jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if v_binding.resource_id is null then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  if not editorial.current_user_can_participate_playlist_review(
    v_binding.resource_id
  ) then
    raise exception
      'Playlist Review participation permission is required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', event.id,
        'event_number', event.event_number,
        'target_version_id', event.target_version_id,
        'result_version_id', event.result_version_id,
        'action', event.action,
        'prior_status', event.prior_status,
        'resulting_status', event.resulting_status,
        'reason', event.reason,
        'actor_id', event.actor_id,
        'command_receipt_id', event.command_receipt_id,
        'correlation_id', event.correlation_id,
        'created_at', event.created_at
      )
      order by event.event_number
    ),
    '[]'::jsonb
  )
  into v_events
  from editorial.playlist_review_events event
  where event.resource_id = v_binding.resource_id;

  return jsonb_build_object(
    'playlist', jsonb_build_object(
      'id', v_playlist.id,
      'title', v_playlist.title,
      'slug', v_playlist.slug,
      'description', v_playlist.description,
      'curator_label', v_playlist.curator_label,
      'status', v_playlist.status,
      'authority_revision', v_playlist.authority_revision,
      'metadata', v_playlist.metadata,
      'created_at', v_playlist.created_at,
      'updated_at', v_playlist.updated_at
    ),
    'resource_id', v_binding.resource_id,
    'current_working_version_id', v_binding.current_working_version_id,
    'current_submitted_version_id', v_binding.current_submitted_version_id,
    'current_approved_version_id', v_binding.current_approved_version_id,
    'working_version',
      editorial.playlist_version_snapshot_json(
        v_binding.current_working_version_id
      ),
    'submitted_version',
      editorial.playlist_version_snapshot_json(
        v_binding.current_submitted_version_id
      ),
    'approved_version',
      editorial.playlist_version_snapshot_json(
        v_binding.current_approved_version_id
      ),
    'review_events', v_events,
    'can_edit',
      editorial.current_user_can_edit_playlist(
        v_binding.resource_id
      ),
    'can_manage_review',
      coalesce(
        public.current_user_is_administrator(),
        false
      )
      or coalesce(
        public.current_user_has_capability(
          'manage_review_queue'
        ),
        false
      )
  );
end;
$function$;

revoke execute
on function public.get_playlist_review_workspace(uuid)
from public, anon;

grant execute
on function public.get_playlist_review_workspace(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- RPC execution perimeter.
-- ---------------------------------------------------------------------------

revoke execute
on function public.snapshot_playlist_working_version(
  uuid,
  bigint,
  text,
  uuid
)
from public, anon;

grant execute
on function public.snapshot_playlist_working_version(
  uuid,
  bigint,
  text,
  uuid
)
to authenticated;

revoke execute
on function public.submit_playlist_for_review(
  uuid,
  bigint,
  text,
  text,
  uuid
)
from public, anon;

grant execute
on function public.submit_playlist_for_review(
  uuid,
  bigint,
  text,
  text,
  uuid
)
to authenticated;

revoke execute
on function public.review_playlist(
  uuid,
  bigint,
  uuid,
  text,
  text,
  text,
  uuid
)
from public, anon;

grant execute
on function public.review_playlist(
  uuid,
  bigint,
  uuid,
  text,
  text,
  text,
  uuid
)
to authenticated;

do $phase_5a_m211_postconditions$
declare
  v_command_count bigint;
  v_rpc_count bigint;
begin
  select count(*)
  into v_command_count
  from platform_private.command_types
  where command_type in (
    'playlist.version.snapshot_working',
    'playlist.review.submit',
    'playlist.review.decide'
  )
    and enabled;

  if v_command_count <> 3 then
    raise exception
      'STOP: Expected 3 enabled Playlist Review command types, found %',
      v_command_count;
  end if;

  select count(*)
  into v_rpc_count
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid =
      procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname in (
      'snapshot_playlist_working_version',
      'submit_playlist_for_review',
      'review_playlist'
    );

  if v_rpc_count <> 3 then
    raise exception
      'STOP: Expected 3 Playlist Review/version RPCs, found %',
      v_rpc_count;
  end if;

  if to_regclass(
       'editorial.playlist_review_events'
     ) is null
     or to_regprocedure(
       'editorial.playlist_current_content_fingerprint(uuid)'
     ) is null
     or to_regprocedure(
       'editorial.insert_playlist_current_snapshot(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'editorial.copy_playlist_version_snapshot(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.get_playlist_review_workspace(uuid)'
     ) is null
     or to_regclass(
       'editorial.playlist_version_trust_revisions'
     ) is null
     or to_regprocedure(
       'public.replace_playlist_version_citations(uuid,uuid,jsonb,bigint,uuid)'
     ) is null
     or to_regprocedure(
       'public.replace_playlist_version_credits(uuid,uuid,jsonb,bigint,uuid)'
     ) is null
  then
    raise exception
      'STOP: Playlist Review/version authority is incomplete';
  end if;
end;
$phase_5a_m211_postconditions$;


-- ---------------------------------------------------------------------------
-- PHASE_5A_M211_PLAYLIST_BINDING_POINTER_MUTABILITY_V1
--
-- Playlist Resource identity is immutable, while current version pointers are
-- lifecycle state and must be mutable by governed Playlist commands.
-- ---------------------------------------------------------------------------

create or replace function
  editorial.prevent_playlist_resource_binding_retarget()
returns trigger
language plpgsql
set search_path to
  'pg_catalog',
  'editorial'
as $function$
begin
  if new.resource_id is distinct from old.resource_id
     or new.resource_kind is distinct from old.resource_kind
     or new.playlist_id is distinct from old.playlist_id
  then
    raise exception
      'Typed Playlist binding identity for resource % is immutable.',
      old.resource_id;
  end if;

  return new;
end
$function$;

revoke execute
on function editorial.prevent_playlist_resource_binding_retarget()
from public, anon, authenticated;

drop trigger if exists
  playlist_resources_prevent_retarget
on editorial.playlist_resources;

create trigger playlist_resources_prevent_retarget
before update
on editorial.playlist_resources
for each row
execute function
  editorial.prevent_playlist_resource_binding_retarget();


-- ---------------------------------------------------------------------------
-- PHASE_5A_M211_GOVERNED_IMMUTABLE_PLAYLIST_TRUST_V2
--
-- Mutable working Trust may be edited only through governed replacement RPCs.
--
-- Submitted, approved and published Playlist Trust is immutable after it is
-- frozen. The only allowed INSERT into a new immutable version is an exact
-- copy performed by the two internal SECURITY DEFINER snapshot functions.
-- ---------------------------------------------------------------------------

create table platform_private.playlist_trust_copy_authorizations (
  authorization_token uuid primary key,
  backend_pid integer not null,
  transaction_id bigint not null,
  source_version_id uuid not null
    references editorial.playlist_versions(id)
    on delete cascade,
  target_version_id uuid not null
    references editorial.playlist_versions(id)
    on delete cascade,
  created_at timestamptz not null default now(),
  check (source_version_id <> target_version_id)
);

revoke all
on platform_private.playlist_trust_copy_authorizations
from public, anon, authenticated, service_role;

create or replace function
  platform_private.begin_playlist_trust_copy_authorization(
    p_source_version_id uuid,
    p_target_version_id uuid
  )
returns uuid
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial',
  'platform_private'
as $function$
declare
  v_source editorial.playlist_versions%rowtype;
  v_target editorial.playlist_versions%rowtype;
  v_token uuid := gen_random_uuid();
begin
  select source.*
  into v_source
  from editorial.playlist_versions source
  where source.id = p_source_version_id;

  if not found then
    raise exception
      'Playlist Trust copy source version does not exist';
  end if;

  select target.*
  into v_target
  from editorial.playlist_versions target
  where target.id = p_target_version_id;

  if not found then
    raise exception
      'Playlist Trust copy target version does not exist';
  end if;

  if v_source.resource_id is distinct from v_target.resource_id
     or v_source.playlist_id is distinct from v_target.playlist_id
     or v_source.content_fingerprint
          is distinct from v_target.content_fingerprint
     or v_source.item_count
          is distinct from v_target.item_count
     or v_source.source_authority_revision
          is distinct from v_target.source_authority_revision
  then
    raise exception
      'Playlist Trust can only be copied between exact snapshots of the same Playlist';
  end if;

  if not (
    (
      v_source.version_kind = 'working'
      and v_target.version_kind = 'submitted'
    )
    or
    (
      v_source.version_kind = 'submitted'
      and v_target.version_kind = 'approved'
    )
  ) then
    raise exception
      'Unsupported Playlist Trust copy transition: % to %',
      v_source.version_kind,
      v_target.version_kind;
  end if;

  insert into
    platform_private.playlist_trust_copy_authorizations (
      authorization_token,
      backend_pid,
      transaction_id,
      source_version_id,
      target_version_id
    )
  values (
    v_token,
    pg_backend_pid(),
    txid_current(),
    p_source_version_id,
    p_target_version_id
  );

  perform set_config(
    'wakilisha.playlist_trust_copy_token',
    v_token::text,
    true
  );

  return v_token;
end
$function$;

revoke execute
on function
  platform_private.begin_playlist_trust_copy_authorization(uuid,uuid)
from public, anon, authenticated, service_role;

create or replace function
  platform_private.end_playlist_trust_copy_authorization(
    p_authorization_token uuid
  )
returns void
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'platform_private'
as $function$
begin
  delete from
    platform_private.playlist_trust_copy_authorizations copy_auth
  where copy_auth.authorization_token =
          p_authorization_token
    and copy_auth.backend_pid =
          pg_backend_pid()
    and copy_auth.transaction_id =
          txid_current();

  if not found then
    raise exception
      'Playlist Trust copy authorization is missing or no longer valid';
  end if;

  perform set_config(
    'wakilisha.playlist_trust_copy_token',
    '',
    true
  );
end
$function$;

revoke execute
on function
  platform_private.end_playlist_trust_copy_authorization(uuid)
from public, anon, authenticated, service_role;

create or replace function
  editorial.prevent_immutable_playlist_trust_mutation()
returns trigger
language plpgsql
set search_path to
  'pg_catalog',
  'editorial',
  'platform_private'
as $function$
declare
  v_version_kind text;
  v_token_text text;
  v_token uuid;
  v_authorization
    platform_private.playlist_trust_copy_authorizations%rowtype;
begin
  -- Article Trust remains governed by its existing Article authority.
  if tg_op in ('UPDATE', 'DELETE')
     and old.target_version_type = 'playlist_version'
  then
    select version.version_kind
    into v_version_kind
    from editorial.playlist_versions version
    where version.id = old.target_version_id;

    if v_version_kind in (
      'submitted',
      'approved',
      'published'
    ) then
      raise exception
        'Trust attached to immutable Playlist version % cannot be changed.',
        old.target_version_id;
    end if;
  end if;

  if tg_op not in ('INSERT', 'UPDATE')
     or new.target_version_type <> 'playlist_version'
  then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  select version.version_kind
  into v_version_kind
  from editorial.playlist_versions version
  where version.id = new.target_version_id;

  if v_version_kind not in (
    'submitted',
    'approved',
    'published'
  ) then
    return new;
  end if;

  -- Moving an existing row into immutable history is never a copy operation.
  if tg_op = 'UPDATE' then
    raise exception
      'Trust cannot be moved into immutable Playlist version %.',
      new.target_version_id;
  end if;

  v_token_text :=
    nullif(
      current_setting(
        'wakilisha.playlist_trust_copy_token',
        true
      ),
      ''
    );

  if v_token_text is null
     or v_token_text !~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  then
    raise exception
      'Trust cannot be attached directly to immutable Playlist version %.',
      new.target_version_id;
  end if;

  v_token := v_token_text::uuid;

  select copy_auth.*
  into v_authorization
  from platform_private.playlist_trust_copy_authorizations copy_auth
  where copy_auth.authorization_token = v_token
    and copy_auth.backend_pid = pg_backend_pid()
    and copy_auth.transaction_id = txid_current()
    and copy_auth.target_version_id =
          new.target_version_id;

  if not found then
    raise exception
      'Immutable Playlist Trust copy authorization is invalid.';
  end if;

  if tg_table_name = 'resource_citations' then
    if not exists (
      select 1
      from editorial.resource_citations source
      where source.target_version_type =
              'playlist_version'
        and source.target_version_id =
              v_authorization.source_version_id
        and source.resource_id = new.resource_id
        and source.resource_kind = new.resource_kind
        and source.citation_id = new.citation_id
        and source.citation_purpose =
              new.citation_purpose
        and source.target_anchor_type =
              new.target_anchor_type
        and source.target_anchor_data =
              new.target_anchor_data
        and source.display_order =
              new.display_order
        and source.public_safe =
              new.public_safe
        and source.created_by
              is not distinct from new.created_by
    ) then
      raise exception
        'Immutable Playlist Citation copy does not match its authorized source snapshot.';
    end if;

  elsif tg_table_name = 'resource_credits' then
    if not exists (
      select 1
      from editorial.resource_credits source
      where source.target_version_type =
              'playlist_version'
        and source.target_version_id =
              v_authorization.source_version_id
        and source.resource_id = new.resource_id
        and source.resource_kind = new.resource_kind
        and source.credit_id = new.credit_id
        and source.display_order =
              new.display_order
        and source.is_primary =
              new.is_primary
        and source.public_safe =
              new.public_safe
        and source.created_by
              is not distinct from new.created_by
    ) then
      raise exception
        'Immutable Playlist Credit copy does not match its authorized source snapshot.';
    end if;

  else
    raise exception
      'Unsupported Playlist Trust attachment table: %',
      tg_table_name;
  end if;

  return new;
end
$function$;

revoke execute
on function editorial.prevent_immutable_playlist_trust_mutation()
from public, anon, authenticated, service_role;

drop trigger if exists
  resource_citations_prevent_immutable_playlist_trust
on editorial.resource_citations;

create trigger resource_citations_prevent_immutable_playlist_trust
before insert or update or delete
on editorial.resource_citations
for each row
execute function
  editorial.prevent_immutable_playlist_trust_mutation();

drop trigger if exists
  resource_credits_prevent_immutable_playlist_trust
on editorial.resource_credits;

create trigger resource_credits_prevent_immutable_playlist_trust
before insert or update or delete
on editorial.resource_credits
for each row
execute function
  editorial.prevent_immutable_playlist_trust_mutation();

revoke execute
on function
  editorial.copy_playlist_working_trust_to_version(uuid,uuid,uuid)
from public, anon, authenticated, service_role;

revoke execute
on function
  editorial.copy_playlist_version_snapshot(uuid,uuid)
from public, anon, authenticated, service_role;


commit;
