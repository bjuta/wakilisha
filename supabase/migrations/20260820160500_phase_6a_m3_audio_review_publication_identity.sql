-- Phase 6A M3: Audio Review and publication identity authority.
--
-- M3 extends accepted M1/M2 Audio authority with the smallest coherent
-- review-and-publication lifecycle. It intentionally does not build public
-- Audio routes, RSS delivery, Chapters, Transcripts, Trust adapters, or the
-- Audio Editor. Those remain in the final Phase 6A closure commit.

begin;

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-6a-audio-authority',
    0
  )
);

do $phase_6a_m3_preflight$
declare
  v_fingerprint_definition text;
begin
  if to_regclass('audio.publications') is null
     or to_regclass('audio.publication_versions') is null
     or to_regclass('editorial.audio_publication_resources') is null
     or to_regclass('media.assets') is null
     or to_regclass('media.asset_governance_versions') is null
     or to_regclass('media.variants') is null
     or to_regclass('media.file_objects') is null
     or to_regclass('platform_private.command_types') is null
     or to_regclass('platform_private.command_receipts') is null
  then
    raise exception
      'STOP: accepted Audio, Media, or command authority is incomplete';
  end if;

  if to_regprocedure(
       'audio.current_publication_master(uuid)'
     ) is null
     or to_regprocedure(
       'audio.publication_content_fingerprint(uuid)'
     ) is null
     or to_regprocedure(
       'audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)'
     ) is null
     or to_regprocedure(
       'editorial.current_user_can_edit_audio(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.read_authenticated_resource_command_result(uuid,boolean)'
     ) is null
     or to_regprocedure(
       'platform_private.complete_resource_command(uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.reject_resource_command(uuid,text,text,jsonb)'
     ) is null
  then
    raise exception
      'STOP: accepted Audio command helpers are incomplete';
  end if;

  if not exists (
    select 1
    from public.capability_definitions
    where capability_key = 'publish_audio'
  ) or not exists (
    select 1
    from public.capability_definitions
    where capability_key = 'view_review_queue'
  ) or not exists (
    select 1
    from public.capability_definitions
    where capability_key = 'manage_review_queue'
  ) then
    raise exception
      'STOP: Audio publish or shared Review capabilities are missing';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type in (
      'audio.publication.review.submit',
      'audio.publication.review.decide',
      'audio.publication.publish'
    )
  ) then
    raise exception
      'STOP: one or more M3 Audio command types already exist';
  end if;

  if to_regclass('audio.publication_review_events') is not null
     or to_regclass('audio.publication_feed_identities') is not null
     or to_regclass('audio.publication_snapshots') is not null
  then
    raise exception
      'STOP: one or more M3 Audio lifecycle tables already exist';
  end if;

  if to_regprocedure(
       'public.submit_audio_publication_for_review(uuid,bigint,text,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.review_audio_publication(uuid,bigint,uuid,text,text,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.publish_audio_publication_version(uuid,bigint,uuid,text,text,uuid)'
     ) is not null
  then
    raise exception
      'STOP: one or more M3 Audio RPCs already exist';
  end if;

  if exists (
    select 1
    from audio.publications publication
    where publication.status = 'published'
  ) then
    raise exception
      'STOP: M3 expects no pre-existing published Audio publication';
  end if;

  v_fingerprint_definition := pg_get_functiondef(
    'audio.publication_content_fingerprint(uuid)'::regprocedure
  );

  if position('master_media_asset_id' in v_fingerprint_definition) = 0
     or position('master_media_revision_id' in v_fingerprint_definition) = 0
     or position('audio_delivery_variant_id' in v_fingerprint_definition) = 0
  then
    raise exception
      'STOP: accepted M2 Audio fingerprint no longer freezes Media identity';
  end if;
end;
$phase_6a_m3_preflight$;

-- ---------------------------------------------------------------------------
-- Lifecycle state is not cultural content.
--
-- M1 included status in the working fingerprint because Review did not yet
-- exist. Once Review begins, draft -> ready_for_review -> approved must not
-- create different content fingerprints for identical editorial/media state.
-- Media identity remains exact and fingerprinted.
-- ---------------------------------------------------------------------------

create or replace function audio.publication_content_fingerprint(
  p_publication_id uuid
)
returns text
language sql
stable
set search_path to
  'pg_catalog',
  'audio',
  'media',
  'extensions'
as $function$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'publication_kind',
            publication.publication_kind,
          'show_id',
            publication.show_id,
          'season_id',
            publication.season_id,
          'episode_number',
            publication.episode_number,
          'slug',
            publication.slug,
          'title',
            publication.title,
          'summary',
            publication.summary,
          'metadata',
            publication.metadata,
          'master_media_asset_id',
            master.asset_id,
          'master_media_revision_id',
            master.asset_revision_id,
          'audio_delivery_variant_id',
            master.audio_delivery_variant_id
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
  from audio.publications publication
  left join lateral
    audio.current_publication_master(
      publication.id
    ) master
    on true
  where publication.id = p_publication_id;
$function$;

revoke execute
on function audio.publication_content_fingerprint(uuid)
from public, anon, authenticated, service_role;

-- When editable content changes while a submission is waiting, invalidate the
-- lifecycle state rather than allowing Review to approve a stale snapshot.
create or replace function audio.normalize_publication_status_after_content_change()
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
     and (
       new.publication_kind is distinct from old.publication_kind
       or new.show_id is distinct from old.show_id
       or new.season_id is distinct from old.season_id
       or new.episode_number is distinct from old.episode_number
       or new.slug is distinct from old.slug
       or new.title is distinct from old.title
       or new.summary is distinct from old.summary
       or new.metadata is distinct from old.metadata
     )
  then
    new.status := 'draft';
  end if;

  return new;
end;
$function$;

create trigger audio_publication_content_change_normalizes_status
before update of
  publication_kind,
  show_id,
  season_id,
  episode_number,
  slug,
  title,
  summary,
  metadata,
  authority_revision,
  status
on audio.publications
for each row
execute function audio.normalize_publication_status_after_content_change();

-- ---------------------------------------------------------------------------
-- Exact immutable copy helper for submitted -> approved -> published.
-- ---------------------------------------------------------------------------

create or replace function audio.copy_publication_version_snapshot(
  p_source_version_id uuid,
  p_version_kind text,
  p_status text,
  p_actor_id uuid
)
returns table(
  version_id uuid,
  version_number bigint,
  content_fingerprint text
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'audio',
  'extensions'
as $function$
declare
  v_source audio.publication_versions%rowtype;
  v_version_id uuid;
  v_version_number bigint;
begin
  if p_version_kind not in ('approved', 'published') then
    raise exception
      'Unsupported copied Audio version kind.';
  end if;

  if (p_version_kind = 'approved' and p_status <> 'approved')
     or (p_version_kind = 'published' and p_status <> 'published')
  then
    raise exception
      'Audio copied version lifecycle status is invalid.';
  end if;

  select version.*
  into v_source
  from audio.publication_versions version
  where version.id = p_source_version_id;

  if not found then
    raise exception
      'Source Audio version does not exist.';
  end if;

  if p_version_kind = 'approved'
     and v_source.version_kind <> 'submitted'
  then
    raise exception
      'Approved Audio versions must copy an exact submitted version.';
  end if;

  if p_version_kind = 'published'
     and v_source.version_kind <> 'approved'
  then
    raise exception
      'Published Audio versions must copy an exact approved version.';
  end if;

  select coalesce(max(version.version_number), 0) + 1
  into v_version_number
  from audio.publication_versions version
  where version.publication_id = v_source.publication_id;

  v_version_id := extensions.gen_random_uuid();

  insert into audio.publication_versions (
    id,
    resource_id,
    publication_id,
    version_number,
    version_kind,
    source_authority_revision,
    publication_kind,
    show_id,
    season_id,
    episode_number,
    title,
    slug,
    summary,
    status,
    metadata,
    master_media_asset_id,
    master_media_revision_id,
    audio_delivery_variant_id,
    content_fingerprint,
    created_by
  )
  values (
    v_version_id,
    v_source.resource_id,
    v_source.publication_id,
    v_version_number,
    p_version_kind,
    v_source.source_authority_revision,
    v_source.publication_kind,
    v_source.show_id,
    v_source.season_id,
    v_source.episode_number,
    v_source.title,
    v_source.slug,
    v_source.summary,
    p_status,
    v_source.metadata,
    v_source.master_media_asset_id,
    v_source.master_media_revision_id,
    v_source.audio_delivery_variant_id,
    v_source.content_fingerprint,
    p_actor_id
  );

  version_id := v_version_id;
  version_number := v_version_number;
  content_fingerprint := v_source.content_fingerprint;
  return next;
end;
$function$;

revoke execute
on function audio.copy_publication_version_snapshot(uuid,text,text,uuid)
from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Typed Audio Review ledger.
-- ---------------------------------------------------------------------------

create table audio.publication_review_events (
  id uuid primary key default extensions.gen_random_uuid(),
  resource_id uuid not null,
  publication_id uuid not null,
  event_number bigint not null,
  target_version_id uuid not null,
  result_version_id uuid,
  action text not null,
  prior_status text not null,
  resulting_status text not null,
  reason text,
  actor_id uuid references auth.users(id) on delete set null,
  command_receipt_id uuid not null
    references platform_private.command_receipts(id)
    on delete restrict,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),

  constraint audio_review_events_binding_fkey
    foreign key (resource_id, publication_id)
    references editorial.audio_publication_resources(resource_id, publication_id)
    on update cascade
    on delete restrict,

  constraint audio_review_events_target_version_fkey
    foreign key (target_version_id, resource_id, publication_id)
    references audio.publication_versions(id, resource_id, publication_id)
    on update cascade
    on delete restrict,

  constraint audio_review_events_result_version_fkey
    foreign key (result_version_id, resource_id, publication_id)
    references audio.publication_versions(id, resource_id, publication_id)
    on update cascade
    on delete restrict,

  constraint audio_review_events_number_check
    check (event_number >= 1),

  constraint audio_review_events_action_check
    check (
      action in (
        'submitted',
        'review_started',
        'changes_requested',
        'approved'
      )
    ),

  constraint audio_review_events_status_check
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

  constraint audio_review_events_reason_check
    check (
      action <> 'changes_requested'
      or nullif(btrim(reason), '') is not null
    ),

  constraint audio_review_events_result_shape_check
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

  constraint audio_review_events_resource_number_key
    unique (resource_id, event_number),

  constraint audio_review_events_receipt_key
    unique (command_receipt_id)
);

create index audio_review_events_publication_created_idx
  on audio.publication_review_events(
    publication_id,
    created_at desc,
    id
  );

create or replace function audio.assert_publication_review_event_integrity()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog', 'audio'
as $function$
declare
  v_target audio.publication_versions%rowtype;
  v_result audio.publication_versions%rowtype;
begin
  select version.*
  into v_target
  from audio.publication_versions version
  where version.id = new.target_version_id
    and version.resource_id = new.resource_id
    and version.publication_id = new.publication_id;

  if not found
     or v_target.version_kind <> 'submitted'
  then
    raise exception
      'Audio Review events must target an exact submitted Audio version';
  end if;

  if new.action = 'approved' then
    select version.*
    into v_result
    from audio.publication_versions version
    where version.id = new.result_version_id
      and version.resource_id = new.resource_id
      and version.publication_id = new.publication_id;

    if not found
       or v_result.version_kind <> 'approved'
       or v_result.content_fingerprint is distinct from
            v_target.content_fingerprint
    then
      raise exception
        'Audio approval events must produce an exact approved copy of the submitted version';
    end if;
  end if;

  return new;
end;
$function$;

create trigger audio_publication_review_events_integrity
before insert
on audio.publication_review_events
for each row
execute function audio.assert_publication_review_event_integrity();

create or replace function audio.protect_publication_review_event()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog'
as $function$
begin
  raise exception
    'Audio Review events are append-only';
end;
$function$;

create trigger audio_publication_review_events_append_only
before update or delete
on audio.publication_review_events
for each row
execute function audio.protect_publication_review_event();

alter table audio.publication_review_events
  enable row level security;

-- ---------------------------------------------------------------------------
-- Stable podcast feed identity and immutable publication snapshots.
--
-- The enclosure URL is a stable contract owned by Audio. Phase 6B will make
-- this route publicly resolvable against the exact immutable source URL stored
-- in each publication snapshot.
-- ---------------------------------------------------------------------------

create table audio.publication_feed_identities (
  publication_id uuid primary key,
  resource_id uuid not null,
  guid text not null unique,
  enclosure_url text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint audio_feed_identity_binding_fkey
    foreign key (resource_id, publication_id)
    references editorial.audio_publication_resources(resource_id, publication_id)
    on update cascade
    on delete restrict,

  constraint audio_feed_identity_guid_check
    check (
      guid = 'urn:uuid:' || publication_id::text
    ),

  constraint audio_feed_identity_enclosure_check
    check (
      enclosure_url =
        'https://wakilisha.africa/audio/enclosures/'
        || publication_id::text
        || '.mp3'
    )
);

create table audio.publication_snapshots (
  id uuid primary key default extensions.gen_random_uuid(),
  resource_id uuid not null,
  publication_id uuid not null,
  published_version_id uuid not null,
  guid text not null,
  enclosure_url text not null,
  enclosure_variant_id uuid not null
    references media.variants(id)
    on delete restrict,
  enclosure_source_url text not null,
  enclosure_mime_type text not null,
  enclosure_byte_size bigint not null
    check (enclosure_byte_size > 0),
  enclosure_sha256 text not null
    check (enclosure_sha256 ~ '^[0-9a-f]{64}$'),
  enclosure_duration_seconds numeric,
  published_at timestamptz not null,
  command_receipt_id uuid not null unique
    references platform_private.command_receipts(id)
    on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint audio_publication_snapshots_binding_fkey
    foreign key (resource_id, publication_id)
    references editorial.audio_publication_resources(resource_id, publication_id)
    on update cascade
    on delete restrict,

  constraint audio_publication_snapshots_version_fkey
    foreign key (published_version_id, resource_id, publication_id)
    references audio.publication_versions(id, resource_id, publication_id)
    on update cascade
    on delete restrict,

  constraint audio_publication_snapshots_version_key
    unique (published_version_id),

  constraint audio_publication_snapshots_guid_check
    check (
      guid = 'urn:uuid:' || publication_id::text
    ),

  constraint audio_publication_snapshots_enclosure_check
    check (
      enclosure_url =
        'https://wakilisha.africa/audio/enclosures/'
        || publication_id::text
        || '.mp3'
    ),

  constraint audio_publication_snapshots_mime_check
    check (enclosure_mime_type = 'audio/mpeg'),

  constraint audio_publication_snapshots_source_url_check
    check (
      enclosure_source_url like
        'https://media.wakilisha.africa/derivatives/%'
    ),

  constraint audio_publication_snapshots_duration_check
    check (
      enclosure_duration_seconds is null
      or enclosure_duration_seconds > 0
    )
);

create index audio_publication_snapshots_publication_published_idx
  on audio.publication_snapshots(
    publication_id,
    published_at desc,
    id
  );

create or replace function audio.assert_publication_snapshot_integrity()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog', 'audio'
as $function$
begin
  if not exists (
    select 1
    from audio.publication_versions version
    where version.id = new.published_version_id
      and version.resource_id = new.resource_id
      and version.publication_id = new.publication_id
      and version.version_kind = 'published'
      and version.audio_delivery_variant_id = new.enclosure_variant_id
  ) then
    raise exception
      'Audio publication snapshot must bind the exact published delivery variant';
  end if;

  if not exists (
    select 1
    from audio.publication_feed_identities feed
    where feed.publication_id = new.publication_id
      and feed.resource_id = new.resource_id
      and feed.guid = new.guid
      and feed.enclosure_url = new.enclosure_url
  ) then
    raise exception
      'Audio publication snapshot must use the immutable feed identity';
  end if;

  return new;
end;
$function$;

create trigger audio_publication_snapshots_integrity
before insert
on audio.publication_snapshots
for each row
execute function audio.assert_publication_snapshot_integrity();

create or replace function audio.protect_publication_feed_identity()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog'
as $function$
begin
  raise exception
    'Audio publication feed identity is immutable';
end;
$function$;

create trigger audio_publication_feed_identity_immutable
before update or delete
on audio.publication_feed_identities
for each row
execute function audio.protect_publication_feed_identity();

create or replace function audio.protect_publication_snapshot()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog'
as $function$
begin
  raise exception
    'Audio publication snapshots are immutable';
end;
$function$;

create trigger audio_publication_snapshots_immutable
before update or delete
on audio.publication_snapshots
for each row
execute function audio.protect_publication_snapshot();

alter table audio.publication_feed_identities
  enable row level security;

alter table audio.publication_snapshots
  enable row level security;

revoke all
on audio.publication_review_events,
   audio.publication_feed_identities,
   audio.publication_snapshots
from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Audio Review and publish capability helpers.
-- ---------------------------------------------------------------------------

create or replace function editorial.current_user_can_publish_audio(
  p_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from editorial.audio_publication_resources binding
      where binding.resource_id = p_resource_id
    )
    and (
      coalesce(
        public.current_user_is_administrator(),
        false
      )
      or coalesce(
        public.current_user_has_capability(
          'publish_audio'
        ),
        false
      )
    );
$function$;

create or replace function editorial.current_user_can_participate_audio_review(
  p_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
  select
    auth.uid() is not null
    and (
      coalesce(
        editorial.current_user_can_edit_audio(
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
on function editorial.current_user_can_publish_audio(uuid)
from public, anon;

grant execute
on function editorial.current_user_can_publish_audio(uuid)
to authenticated, service_role;

revoke all
on function editorial.current_user_can_participate_audio_review(uuid)
from public, anon;

grant execute
on function editorial.current_user_can_participate_audio_review(uuid)
to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- Public-safety helper for exact approved Audio Media identity.
-- ---------------------------------------------------------------------------

create or replace function audio.assert_publishable_version_media(
  p_version_id uuid
)
returns table(
  asset_id uuid,
  asset_revision_id uuid,
  delivery_variant_id uuid,
  delivery_url text,
  mime_type text,
  byte_size bigint,
  sha256 text,
  duration_seconds numeric
)
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'audio',
  'media'
as $function$
declare
  v_version audio.publication_versions%rowtype;
begin
  select version.*
  into v_version
  from audio.publication_versions version
  where version.id = p_version_id;

  if not found
     or v_version.master_media_asset_id is null
     or v_version.master_media_revision_id is null
     or v_version.audio_delivery_variant_id is null
  then
    raise exception
      'Audio publication requires an exact master and full-length delivery before publication.';
  end if;

  return query
  select
    asset.id,
    revision.id,
    variant.id,
    file_object.delivery_url,
    file_object.mime_type,
    file_object.byte_size,
    file_object.sha256,
    nullif(
      file_object.technical_metadata
        #>> '{source_probe,duration_seconds}',
      ''
    )::numeric
  from media.assets asset
  join media.asset_revisions revision
    on revision.id = v_version.master_media_revision_id
   and revision.asset_id = asset.id
  join media.variants variant
    on variant.id = v_version.audio_delivery_variant_id
   and variant.asset_id = asset.id
   and variant.asset_revision_id = revision.id
   and variant.variant_role = 'audio_delivery'
  join media.file_objects file_object
    on file_object.id = variant.derived_file_object_id
  join media.asset_governance_versions governance
    on governance.id = asset.current_governance_version_id
   and governance.asset_id = asset.id
  where asset.id = v_version.master_media_asset_id
    and asset.asset_kind = 'audio'
    and asset.lifecycle_state = 'active'
    and file_object.verification_state = 'verified'
    and file_object.mime_type = 'audio/mpeg'
    and file_object.byte_size > 0
    and file_object.sha256 ~ '^[0-9a-f]{64}$'
    and file_object.delivery_url like
          'https://media.wakilisha.africa/derivatives/%'
    and governance.public_safety_state in (
          'approved_public',
          'approved_redacted'
        )
    and governance.consent_status in (
          'granted',
          'not_required'
        )
    and governance.rights_status <> 'restricted'
    and governance.embargo_state in (
          'none',
          'released'
        );

  if not found then
    raise exception
      'Audio publication Media is not approved for public delivery.';
  end if;
end;
$function$;

revoke all
on function audio.assert_publishable_version_media(uuid)
from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Register synchronous Audio Review/publish command vocabulary.
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
    'audio.publication.review.submit',
    'audio.publication.review.submit.sync',
    'audio.publication.review.submit.accepted',
    'audio.publication.review.submit.succeeded',
    'audio.publication.review.submit.failed',
    'audio.publication.review.submit.retry_scheduled',
    true
  ),
  (
    'audio.publication.review.decide',
    'audio.publication.review.decide.sync',
    'audio.publication.review.decide.accepted',
    'audio.publication.review.decide.succeeded',
    'audio.publication.review.decide.failed',
    'audio.publication.review.decide.retry_scheduled',
    true
  ),
  (
    'audio.publication.publish',
    'audio.publication.publish.sync',
    'audio.publication.publish.accepted',
    'audio.publication.publish.succeeded',
    'audio.publication.publish.failed',
    'audio.publication.publish.retry_scheduled',
    true
  );

-- ---------------------------------------------------------------------------
-- Submit exact current Audio content for Review.
-- ---------------------------------------------------------------------------

create or replace function public.submit_audio_publication_for_review(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_idempotency_key text,
  p_note text default null,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
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
  'platform_private',
  'audio',
  'media',
  'extensions'
as $function$
declare
  v_actor uuid := auth.uid();
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_snapshot record;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_event_number bigint;
  v_prior_status text;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    extensions.gen_random_uuid()
  );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select publication.*
  into v_publication
  from audio.publications publication
  where publication.id = p_publication_id
  for update;

  if not found then
    raise exception 'Audio publication does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id = p_publication_id
  for update;

  if not found then
    raise exception
      'Audio publication Resource binding does not exist';
  end if;

  if not editorial.current_user_can_edit_audio(
    v_binding.resource_id
  ) then
    raise exception
      'Audio edit permission is required';
  end if;

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.publication.review.submit',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id', p_publication_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'note', nullif(btrim(p_note), ''),
      'correlation_id', v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    publication_id := p_publication_id;
    resource_id := v_read.resource_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    version_id := nullif(
      v_read.result_payload ->> 'version_id',
      ''
    )::uuid;
    version_number := nullif(
      v_read.result_payload ->> 'version_number',
      ''
    )::bigint;
    lifecycle_status :=
      v_read.result_payload ->> 'lifecycle_status';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_publication.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_revision_changed',
      'The Audio publication changed before it could be submitted.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'authority_revision',
          v_publication.authority_revision,
        'lifecycle_status', v_publication.status
      )
    );

  elsif v_publication.status not in (
    'draft',
    'changes_requested'
  ) then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_not_submittable',
      'Only a draft or changes-requested Audio publication can be submitted.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'authority_revision',
          v_publication.authority_revision,
        'lifecycle_status', v_publication.status
      )
    );

  else
    -- Freeze the current Media governance and selected delivery for the short
    -- transaction that validates and snapshots the submission. M2 master
    -- mutation already serializes on the Audio publication row locked above.
    perform 1
    from media.assets asset
    where asset.id = (
      select master.asset_id
      from audio.current_publication_master(
        p_publication_id
      ) master
      limit 1
    )
    for share;

    perform 1
    from media.variant_selections selection
    where selection.asset_revision_id = (
      select master.asset_revision_id
      from audio.current_publication_master(
        p_publication_id
      ) master
      limit 1
    )
      and selection.variant_role = 'audio_delivery'
    for share;

    -- Review must use the current Audio identity, not merely a stale working
    -- version. Validate current master + delivery directly before snapshot.
    if not exists (
      select 1
      from audio.current_publication_master(
        p_publication_id
      ) master
      join media.assets asset
        on asset.id = master.asset_id
      join media.asset_revisions revision
        on revision.id = master.asset_revision_id
       and revision.asset_id = asset.id
      join media.variants variant
        on variant.id = master.audio_delivery_variant_id
       and variant.asset_id = asset.id
       and variant.asset_revision_id = revision.id
       and variant.variant_role = 'audio_delivery'
      join media.file_objects file_object
        on file_object.id = variant.derived_file_object_id
      join media.asset_governance_versions governance
        on governance.id = asset.current_governance_version_id
       and governance.asset_id = asset.id
      where asset.asset_kind = 'audio'
        and asset.lifecycle_state = 'active'
        and file_object.verification_state = 'verified'
        and file_object.mime_type = 'audio/mpeg'
        and file_object.byte_size > 0
        and file_object.sha256 ~ '^[0-9a-f]{64}$'
        and file_object.delivery_url like
              'https://media.wakilisha.africa/derivatives/%'
        and governance.public_safety_state in (
              'approved_public',
              'approved_redacted'
            )
        and governance.consent_status in (
              'granted',
              'not_required'
            )
        and governance.rights_status <> 'restricted'
        and governance.embargo_state in (
              'none',
              'released'
            )
    ) then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'audio_publication_media_not_publishable',
        'Approve the exact Audio master and full-length delivery for public use before Review.',
        jsonb_build_object(
          'publication_id', p_publication_id,
          'authority_revision',
            v_publication.authority_revision,
          'lifecycle_status', v_publication.status
        )
      );
    end if;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id = v_begin.command_receipt_id
        and receipt.status = 'accepted'
    ) then
      v_prior_status := v_publication.status;

      select *
      into v_snapshot
      from audio.insert_current_publication_snapshot(
        p_publication_id,
        v_publication.authority_revision,
        'submitted',
        v_actor
      );

      update editorial.audio_publication_resources binding_update
      set
        current_submitted_version_id = v_snapshot.version_id,
        current_approved_version_id = null
      where binding_update.publication_id = p_publication_id;

      update audio.publications publication
      set
        status = 'ready_for_review',
        authority_revision = publication.authority_revision + 1,
        updated_by = v_actor,
        updated_at = now()
      where publication.id = p_publication_id
      returning publication.*
      into v_publication;

      select coalesce(max(event.event_number), 0) + 1
      into v_event_number
      from audio.publication_review_events event
      where event.resource_id = v_binding.resource_id;

      insert into audio.publication_review_events (
        resource_id,
        publication_id,
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
        p_publication_id,
        v_event_number,
        v_snapshot.version_id,
        null,
        'submitted',
        v_prior_status,
        'ready_for_review',
        nullif(btrim(p_note), ''),
        v_actor,
        v_begin.command_receipt_id,
        v_correlation_id
      );

      v_result := jsonb_build_object(
        'publication_id', p_publication_id,
        'resource_id', v_binding.resource_id,
        'authority_revision',
          v_publication.authority_revision,
        'version_id', v_snapshot.version_id,
        'version_number', v_snapshot.version_number,
        'content_fingerprint',
          v_snapshot.content_fingerprint,
        'lifecycle_status', 'ready_for_review',
        'correlation_id', v_correlation_id
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

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  publication_id := p_publication_id;
  resource_id := v_read.resource_id;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  version_id := nullif(
    v_read.result_payload ->> 'version_id',
    ''
  )::uuid;
  version_number := nullif(
    v_read.result_payload ->> 'version_number',
    ''
  )::bigint;
  lifecycle_status :=
    v_read.result_payload ->> 'lifecycle_status';
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Start Review, request changes, or approve the exact submitted version.
-- ---------------------------------------------------------------------------

create or replace function public.review_audio_publication(
  p_publication_id uuid,
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
  publication_id uuid,
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
  'platform_private',
  'audio',
  'extensions'
as $function$
declare
  v_actor uuid := auth.uid();
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_submitted audio.publication_versions%rowtype;
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
  v_current_fingerprint text;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    extensions.gen_random_uuid()
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
      'Choose a supported Audio review decision';
  end if;

  if p_decision = 'request_changes'
     and nullif(btrim(p_note), '') is null
  then
    raise exception
      'Requested changes require a review note';
  end if;

  select publication.*
  into v_publication
  from audio.publications publication
  where publication.id = p_publication_id
  for update;

  if not found then
    raise exception 'Audio publication does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id = p_publication_id
  for update;

  if not found then
    raise exception
      'Audio publication Resource binding does not exist';
  end if;

  select submitted.*
  into v_submitted
  from audio.publication_versions submitted
  where submitted.id = p_submitted_version_id
    and submitted.resource_id = v_binding.resource_id
    and submitted.publication_id = p_publication_id
    and submitted.version_kind = 'submitted';

  -- Hold the current selected delivery stable while comparing it with the
  -- exact submitted fingerprint. If processing advances selection, it waits
  -- until this Review decision has completed.
  perform 1
  from media.assets asset
  where asset.id = (
    select master.asset_id
    from audio.current_publication_master(
      p_publication_id
    ) master
    limit 1
  )
  for share;

  perform 1
  from media.variant_selections selection
  where selection.asset_revision_id = (
    select master.asset_revision_id
    from audio.current_publication_master(
      p_publication_id
    ) master
    limit 1
  )
    and selection.variant_role = 'audio_delivery'
  for share;

  v_current_fingerprint :=
    audio.publication_content_fingerprint(
      p_publication_id
    );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.publication.review.decide',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id', p_publication_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'submitted_version_id', p_submitted_version_id,
      'decision', p_decision,
      'note', nullif(btrim(p_note), ''),
      'correlation_id', v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    publication_id := p_publication_id;
    resource_id := v_read.resource_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    version_id := nullif(
      v_read.result_payload ->> 'version_id',
      ''
    )::uuid;
    version_number := nullif(
      v_read.result_payload ->> 'version_number',
      ''
    )::bigint;
    lifecycle_status :=
      v_read.result_payload ->> 'lifecycle_status';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_publication.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_revision_changed',
      'The Audio publication changed before the Review decision could be applied.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'authority_revision',
          v_publication.authority_revision,
        'lifecycle_status', v_publication.status
      )
    );

  elsif v_binding.current_submitted_version_id
          is distinct from p_submitted_version_id
        or v_submitted.id is null
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_submitted_version_changed',
      'Review must target the exact current submitted Audio version.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'current_submitted_version_id',
          v_binding.current_submitted_version_id
      )
    );

  elsif v_submitted.content_fingerprint
          is distinct from v_current_fingerprint
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_submitted_version_stale',
      'The Audio publication changed after submission and must be submitted again.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'submitted_content_fingerprint',
          v_submitted.content_fingerprint,
        'current_content_fingerprint',
          v_current_fingerprint
      )
    );

  else
    v_prior_status := v_publication.status;

    if p_decision = 'start_review' then
      if v_publication.status <> 'ready_for_review' then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'audio_invalid_review_transition',
          'Only ready Audio can enter Review.',
          jsonb_build_object(
            'publication_id', p_publication_id,
            'lifecycle_status', v_publication.status
          )
        );
      else
        v_result_status := 'in_review';
        v_action := 'review_started';
        v_result_version_id := v_submitted.id;
        v_result_version_number := v_submitted.version_number;
      end if;

    elsif p_decision = 'request_changes' then
      if v_publication.status not in (
        'ready_for_review',
        'in_review'
      ) then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'audio_invalid_review_transition',
          'The Audio publication is not currently reviewable.',
          jsonb_build_object(
            'publication_id', p_publication_id,
            'lifecycle_status', v_publication.status
          )
        );
      else
        v_result_status := 'changes_requested';
        v_action := 'changes_requested';
        v_result_version_id := v_submitted.id;
        v_result_version_number := v_submitted.version_number;
      end if;

    else
      if v_publication.status not in (
        'ready_for_review',
        'in_review'
      ) then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'audio_invalid_review_transition',
          'The Audio publication is not currently reviewable.',
          jsonb_build_object(
            'publication_id', p_publication_id,
            'lifecycle_status', v_publication.status
          )
        );
      else
        select *
        into v_approved
        from audio.copy_publication_version_snapshot(
          v_submitted.id,
          'approved',
          'approved',
          v_actor
        );

        v_result_status := 'approved';
        v_action := 'approved';
        v_result_version_id := v_approved.version_id;
        v_result_version_number := v_approved.version_number;
      end if;
    end if;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id = v_begin.command_receipt_id
        and receipt.status = 'accepted'
    ) then
      if p_decision = 'approve' then
        update editorial.audio_publication_resources binding_update
        set current_approved_version_id = v_result_version_id
        where binding_update.publication_id = p_publication_id;
      elsif p_decision = 'request_changes' then
        update editorial.audio_publication_resources binding_update
        set current_approved_version_id = null
        where binding_update.publication_id = p_publication_id;
      end if;

      update audio.publications publication
      set
        status = v_result_status,
        authority_revision = publication.authority_revision + 1,
        updated_by = v_actor,
        updated_at = now()
      where publication.id = p_publication_id
      returning publication.*
      into v_publication;

      select coalesce(max(event.event_number), 0) + 1
      into v_event_number
      from audio.publication_review_events event
      where event.resource_id = v_binding.resource_id;

      insert into audio.publication_review_events (
        resource_id,
        publication_id,
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
        p_publication_id,
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
        nullif(btrim(p_note), ''),
        v_actor,
        v_begin.command_receipt_id,
        v_correlation_id
      );

      v_result := jsonb_build_object(
        'publication_id', p_publication_id,
        'resource_id', v_binding.resource_id,
        'authority_revision',
          v_publication.authority_revision,
        'submitted_version_id', v_submitted.id,
        'version_id', v_result_version_id,
        'version_number', v_result_version_number,
        'lifecycle_status', v_result_status,
        'decision', p_decision,
        'correlation_id', v_correlation_id
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

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  publication_id := p_publication_id;
  resource_id := v_read.resource_id;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  version_id := nullif(
    v_read.result_payload ->> 'version_id',
    ''
  )::uuid;
  version_number := nullif(
    v_read.result_payload ->> 'version_number',
    ''
  )::bigint;
  lifecycle_status :=
    v_read.result_payload ->> 'lifecycle_status';
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Publish the exact current approved Audio version.
-- ---------------------------------------------------------------------------

create or replace function public.publish_audio_publication_version(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_approved_version_id uuid,
  p_idempotency_key text,
  p_note text default null,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
  resource_id uuid,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
  publication_snapshot_id uuid,
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
  'platform_private',
  'audio',
  'media',
  'extensions'
as $function$
declare
  v_actor uuid := auth.uid();
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_approved audio.publication_versions%rowtype;
  v_published record;
  v_media record;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_feed audio.publication_feed_identities%rowtype;
  v_snapshot_id uuid;
  v_published_at timestamptz := now();
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    extensions.gen_random_uuid()
  );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select publication.*
  into v_publication
  from audio.publications publication
  where publication.id = p_publication_id
  for update;

  if not found then
    raise exception 'Audio publication does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id = p_publication_id
  for update;

  if not found then
    raise exception
      'Audio publication Resource binding does not exist';
  end if;

  if not editorial.current_user_can_publish_audio(
    v_binding.resource_id
  ) then
    raise exception
      'Audio publication permission is required';
  end if;

  select approved.*
  into v_approved
  from audio.publication_versions approved
  where approved.id = p_approved_version_id
    and approved.resource_id = v_binding.resource_id
    and approved.publication_id = p_publication_id
    and approved.version_kind = 'approved';

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.publication.publish',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id', p_publication_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'approved_version_id', p_approved_version_id,
      'note', nullif(btrim(p_note), ''),
      'correlation_id', v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    publication_id := p_publication_id;
    resource_id := v_read.resource_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    version_id := nullif(
      v_read.result_payload ->> 'version_id',
      ''
    )::uuid;
    version_number := nullif(
      v_read.result_payload ->> 'version_number',
      ''
    )::bigint;
    publication_snapshot_id := nullif(
      v_read.result_payload ->> 'publication_snapshot_id',
      ''
    )::uuid;
    lifecycle_status :=
      v_read.result_payload ->> 'lifecycle_status';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_publication.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_revision_changed',
      'The Audio publication changed before it could be published.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'authority_revision',
          v_publication.authority_revision,
        'lifecycle_status', v_publication.status
      )
    );

  elsif v_publication.status <> 'approved'
        or v_binding.current_approved_version_id
             is distinct from p_approved_version_id
        or v_approved.id is null
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_not_publishable',
      'Only the exact current approved Audio version can be published.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'lifecycle_status', v_publication.status,
        'current_approved_version_id',
          v_binding.current_approved_version_id
      )
    );

  else
    -- Freeze the approved Media asset governance pointer for this publication
    -- transaction so a concurrent governance change cannot race the final
    -- public-safety check. Variants and file objects are already immutable.
    perform 1
    from media.assets asset
    where asset.id = v_approved.master_media_asset_id
    for share;

    begin
      select *
      into strict v_media
      from audio.assert_publishable_version_media(
        v_approved.id
      );
    exception
      when raise_exception then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'audio_publication_media_not_publishable',
          'The approved Audio Media is no longer cleared for public delivery.',
          jsonb_build_object(
            'publication_id', p_publication_id,
            'approved_version_id', v_approved.id
          )
        );
    end;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id = v_begin.command_receipt_id
        and receipt.status = 'accepted'
    ) then
      insert into audio.publication_feed_identities (
        publication_id,
        resource_id,
        guid,
        enclosure_url,
        created_by
      )
      values (
        p_publication_id,
        v_binding.resource_id,
        'urn:uuid:' || p_publication_id::text,
        'https://wakilisha.africa/audio/enclosures/'
          || p_publication_id::text
          || '.mp3',
        v_actor
      )
      on conflict on constraint publication_feed_identities_pkey
      do nothing;

      select feed.*
      into v_feed
      from audio.publication_feed_identities feed
      where feed.publication_id = p_publication_id;

      if v_feed.resource_id is distinct from v_binding.resource_id
         or v_feed.guid is distinct from
              'urn:uuid:' || p_publication_id::text
         or v_feed.enclosure_url is distinct from
              'https://wakilisha.africa/audio/enclosures/'
              || p_publication_id::text
              || '.mp3'
      then
        raise exception
          'Audio feed identity drifted from stable publication identity';
      end if;

      select *
      into v_published
      from audio.copy_publication_version_snapshot(
        v_approved.id,
        'published',
        'published',
        v_actor
      );

      update editorial.audio_publication_resources binding_update
      set current_published_version_id = v_published.version_id
      where binding_update.publication_id = p_publication_id;

      update editorial.resources resource_row
      set
        lifecycle_state = 'published',
        visibility = 'public',
        updated_at = now()
      where resource_row.id = v_binding.resource_id;

      update audio.publications publication
      set
        status = 'published',
        authority_revision = publication.authority_revision + 1,
        updated_by = v_actor,
        updated_at = now()
      where publication.id = p_publication_id
      returning publication.*
      into v_publication;

      v_snapshot_id := extensions.gen_random_uuid();

      insert into audio.publication_snapshots (
        id,
        resource_id,
        publication_id,
        published_version_id,
        guid,
        enclosure_url,
        enclosure_variant_id,
        enclosure_source_url,
        enclosure_mime_type,
        enclosure_byte_size,
        enclosure_sha256,
        enclosure_duration_seconds,
        published_at,
        command_receipt_id,
        created_by
      )
      values (
        v_snapshot_id,
        v_binding.resource_id,
        p_publication_id,
        v_published.version_id,
        v_feed.guid,
        v_feed.enclosure_url,
        v_media.delivery_variant_id,
        v_media.delivery_url,
        v_media.mime_type,
        v_media.byte_size,
        v_media.sha256,
        v_media.duration_seconds,
        v_published_at,
        v_begin.command_receipt_id,
        v_actor
      );

      v_result := jsonb_build_object(
        'publication_id', p_publication_id,
        'resource_id', v_binding.resource_id,
        'authority_revision',
          v_publication.authority_revision,
        'approved_version_id', v_approved.id,
        'version_id', v_published.version_id,
        'version_number', v_published.version_number,
        'publication_snapshot_id', v_snapshot_id,
        'guid', v_feed.guid,
        'enclosure_url', v_feed.enclosure_url,
        'enclosure_source_url', v_media.delivery_url,
        'published_at', v_published_at,
        'lifecycle_status', 'published',
        'correlation_id', v_correlation_id
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

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  publication_id := p_publication_id;
  resource_id := v_read.resource_id;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  version_id := nullif(
    v_read.result_payload ->> 'version_id',
    ''
  )::uuid;
  version_number := nullif(
    v_read.result_payload ->> 'version_number',
    ''
  )::bigint;
  publication_snapshot_id := nullif(
    v_read.result_payload ->> 'publication_snapshot_id',
    ''
  )::uuid;
  lifecycle_status :=
    v_read.result_payload ->> 'lifecycle_status';
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all
on function public.submit_audio_publication_for_review(
  uuid,
  bigint,
  text,
  text,
  uuid
)
from public, anon;

grant execute
on function public.submit_audio_publication_for_review(
  uuid,
  bigint,
  text,
  text,
  uuid
)
to authenticated, service_role;

revoke all
on function public.review_audio_publication(
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
on function public.review_audio_publication(
  uuid,
  bigint,
  uuid,
  text,
  text,
  text,
  uuid
)
to authenticated, service_role;

revoke all
on function public.publish_audio_publication_version(
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
)
from public, anon;

grant execute
on function public.publish_audio_publication_version(
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
)
to authenticated, service_role;

comment on table audio.publication_review_events is
  'Append-only typed Audio Review history anchored to exact immutable Audio versions.';

comment on table audio.publication_feed_identities is
  'Immutable stable podcast GUID and enclosure URL identity per Audio publication. Phase 6B resolves enclosure_url publicly.';

comment on table audio.publication_snapshots is
  'Immutable publication-time Audio snapshot binding the published version, stable feed identity, and exact public delivery source.';

commit;
