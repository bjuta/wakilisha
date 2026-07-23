-- Quality PR 2: Article review mode authority.
--
-- Establishes authenticated-only review threads, comments, suggestions,
-- and append-only suggestion events anchored to immutable Article versions.

do $article_review_authority_preflight$
begin
  if to_regclass('editorial.resources') is null then
    raise exception 'STOP: editorial.resources does not exist';
  end if;

  if to_regclass('editorial.article_resources') is null then
    raise exception 'STOP: editorial.article_resources does not exist';
  end if;

  if to_regclass('editorial.article_versions') is null then
    raise exception 'STOP: editorial.article_versions does not exist';
  end if;

  if to_regclass('public.user_profiles') is null then
    raise exception 'STOP: public.user_profiles does not exist';
  end if;

  if to_regclass('editorial.article_lifecycle_events') is null then
    raise exception 'STOP: editorial.article_lifecycle_events does not exist';
  end if;

  if to_regclass('public.wk_articles') is null then
    raise exception 'STOP: public.wk_articles does not exist';
  end if;

  if to_regprocedure(
    'editorial.current_user_can_review_article()'
  ) is null then
    raise exception
      'STOP: governed Article review authority does not exist';
  end if;
end;
$article_review_authority_preflight$;

create or replace function editorial.current_user_can_participate_article_review(
  p_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
  select
    auth.uid() is not null
    and (
      coalesce(
        editorial.current_user_can_review_article(),
        false
      )
      or coalesce(
        editorial.current_user_can_edit_article(
          p_resource_id
        ),
        false
      )
    );
$function$;

revoke all on function
  editorial.current_user_can_participate_article_review(uuid)
from public;

grant execute on function
  editorial.current_user_can_participate_article_review(uuid)
to authenticated;

create table editorial.article_review_threads (
  id uuid primary key default gen_random_uuid(),

  resource_id uuid not null
    references editorial.resources(id)
    on update cascade
    on delete cascade,

  article_id uuid not null
    references public.wk_articles(id)
    on update cascade
    on delete cascade,

  target_version_id uuid not null
    references editorial.article_versions(id)
    on update cascade
    on delete restrict,

  thread_kind text not null,
  target_field text not null default 'content_html',
  anchor_kind text not null default 'document',

  anchor_from integer,
  anchor_to integer,
  anchor_quote text,
  anchor_prefix text,
  anchor_suffix text,

  status text not null default 'open',

  created_by uuid default auth.uid()
    references auth.users(id)
    on delete set null,

  resolved_by uuid
    references auth.users(id)
    on delete set null,

  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint article_review_threads_kind_check
    check (
      thread_kind in (
        'comment',
        'suggestion'
      )
    ),

  constraint article_review_threads_field_check
    check (
      target_field in (
        'title',
        'excerpt',
        'content_html'
      )
    ),

  constraint article_review_threads_anchor_kind_check
    check (
      anchor_kind in (
        'document',
        'field',
        'text_range'
      )
    ),

  constraint article_review_threads_status_check
    check (
      status in (
        'open',
        'resolved'
      )
    ),

  constraint article_review_threads_anchor_from_check
    check (
      anchor_from is null
      or anchor_from >= 0
    ),

  constraint article_review_threads_anchor_to_check
    check (
      anchor_to is null
      or anchor_to >= 0
    ),

  constraint article_review_threads_anchor_order_check
    check (
      anchor_from is null
      or anchor_to is null
      or anchor_to >= anchor_from
    ),

  constraint article_review_threads_resolution_check
    check (
      (
        status = 'open'
        and resolved_at is null
        and resolved_by is null
      )
      or (
        status = 'resolved'
        and resolved_at is not null
      )
    )
);

create index article_review_threads_article_idx
  on editorial.article_review_threads (
    article_id,
    created_at desc
  );

create index article_review_threads_version_idx
  on editorial.article_review_threads (
    target_version_id,
    status,
    created_at desc
  );

create index article_review_threads_resource_idx
  on editorial.article_review_threads (
    resource_id,
    status,
    created_at desc
  );

create table editorial.article_review_comments (
  id uuid primary key default gen_random_uuid(),

  thread_id uuid not null
    references editorial.article_review_threads(id)
    on update cascade
    on delete cascade,

  body_text text not null,

  created_by uuid default auth.uid()
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,

  constraint article_review_comments_body_not_blank
    check (
      btrim(body_text) <> ''
    )
);

create index article_review_comments_thread_idx
  on editorial.article_review_comments (
    thread_id,
    created_at
  );

create table editorial.article_suggestions (
  id uuid primary key default gen_random_uuid(),

  thread_id uuid not null unique
    references editorial.article_review_threads(id)
    on update cascade
    on delete cascade,

  operation_kind text not null,
  original_text text not null default '',
  replacement_text text not null default '',

  proposed_content_html text not null,
  target_version_fingerprint text not null,

  status text not null default 'open',

  decided_by uuid
    references auth.users(id)
    on delete set null,

  decided_at timestamptz,
  decision_note text,

  applied_version_id uuid
    references editorial.article_versions(id)
    on update cascade
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint article_suggestions_operation_check
    check (
      operation_kind in (
        'insert',
        'replace',
        'delete'
      )
    ),

  constraint article_suggestions_status_check
    check (
      status in (
        'open',
        'accepted',
        'rejected',
        'withdrawn',
        'stale'
      )
    ),

  constraint article_suggestions_fingerprint_not_blank
    check (
      btrim(target_version_fingerprint) <> ''
    ),

  constraint article_suggestions_operation_shape_check
    check (
      (
        operation_kind = 'insert'
        and original_text = ''
        and replacement_text <> ''
      )
      or (
        operation_kind = 'replace'
        and original_text <> ''
        and replacement_text <> ''
      )
      or (
        operation_kind = 'delete'
        and original_text <> ''
        and replacement_text = ''
      )
    ),

  constraint article_suggestions_decision_check
    check (
      (
        status = 'open'
        and decided_at is null
        and decided_by is null
        and applied_version_id is null
      )
      or (
        status = 'accepted'
        and decided_at is not null
        and applied_version_id is not null
      )
      or (
        status in (
          'rejected',
          'withdrawn',
          'stale'
        )
        and decided_at is not null
        and applied_version_id is null
      )
    )
);

create index article_suggestions_status_idx
  on editorial.article_suggestions (
    status,
    created_at desc
  );

create table editorial.article_suggestion_events (
  id uuid primary key default gen_random_uuid(),

  suggestion_id uuid not null
    references editorial.article_suggestions(id)
    on update cascade
    on delete cascade,

  action text not null,

  actor_id uuid default auth.uid()
    references auth.users(id)
    on delete set null,

  note text,

  applied_version_id uuid
    references editorial.article_versions(id)
    on update cascade
    on delete set null,

  created_at timestamptz not null default now(),

  constraint article_suggestion_events_action_check
    check (
      action in (
        'created',
        'accepted',
        'rejected',
        'withdrawn',
        'marked_stale'
      )
    ),

  constraint article_suggestion_events_applied_version_check
    check (
      (
        action = 'accepted'
        and applied_version_id is not null
      )
      or (
        action <> 'accepted'
        and applied_version_id is null
      )
    )
);

create index article_suggestion_events_suggestion_idx
  on editorial.article_suggestion_events (
    suggestion_id,
    created_at
  );

create or replace function editorial.assert_article_review_thread_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
declare
  target_version editorial.article_versions%rowtype;
  target_resource editorial.resources%rowtype;
begin
  select version.*
  into target_version
  from editorial.article_versions version
  where version.id = new.target_version_id;

  if not found then
    raise exception 'Article review target version not found';
  end if;

  if target_version.resource_id <> new.resource_id
     or target_version.article_id <> new.article_id
  then
    raise exception
      'Article review target version must belong to the same Article resource';
  end if;

  select resource.*
  into target_resource
  from editorial.resources resource
  where resource.id = new.resource_id;

  if not found then
    raise exception 'Article review resource not found';
  end if;

  if new.thread_kind = 'suggestion'
     and target_resource.current_submitted_version_id
       is distinct from new.target_version_id
  then
    raise exception
      'Suggestions must target the current submitted Article version';
  end if;

  return new;
end;
$function$;

create trigger article_review_threads_integrity
before insert or update of
  resource_id,
  article_id,
  target_version_id,
  thread_kind
on editorial.article_review_threads
for each row
execute function editorial.assert_article_review_thread_integrity();

create or replace function editorial.assert_article_suggestion_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
declare
  target_thread editorial.article_review_threads%rowtype;
  target_version editorial.article_versions%rowtype;
begin
  select thread.*
  into target_thread
  from editorial.article_review_threads thread
  where thread.id = new.thread_id;

  if not found then
    raise exception 'Article suggestion thread not found';
  end if;

  if target_thread.thread_kind <> 'suggestion' then
    raise exception
      'Article suggestion must belong to a suggestion thread';
  end if;

  if target_thread.target_field <> 'content_html' then
    raise exception
      'Initial Article suggestions may target content_html only';
  end if;

  if target_thread.anchor_kind <> 'text_range' then
    raise exception
      'Initial Article suggestions require a text-range anchor';
  end if;

  select version.*
  into target_version
  from editorial.article_versions version
  where version.id = target_thread.target_version_id;

  if not found then
    raise exception 'Article suggestion target version not found';
  end if;

  if target_version.content_fingerprint
     <> new.target_version_fingerprint
  then
    raise exception
      'Article suggestion fingerprint does not match its target version';
  end if;

  if coalesce(target_version.content_html, '')
     = new.proposed_content_html
  then
    raise exception
      'Article suggestion must change the submitted Article content';
  end if;

  if new.operation_kind = 'insert' then
    if target_thread.anchor_from is null
       or target_thread.anchor_to is null
       or target_thread.anchor_from
          <> target_thread.anchor_to
       or new.original_text <> ''
       or new.replacement_text = ''
    then
      raise exception
        'Insert suggestions require a collapsed anchor and replacement text';
    end if;
  elsif new.operation_kind = 'replace' then
    if target_thread.anchor_from is null
       or target_thread.anchor_to is null
       or target_thread.anchor_to
          <= target_thread.anchor_from
       or new.original_text = ''
       or new.replacement_text = ''
       or coalesce(target_thread.anchor_quote, '')
          <> new.original_text
    then
      raise exception
        'Replace suggestions require a matching non-empty text-range anchor';
    end if;
  elsif new.operation_kind = 'delete' then
    if target_thread.anchor_from is null
       or target_thread.anchor_to is null
       or target_thread.anchor_to
          <= target_thread.anchor_from
       or new.original_text = ''
       or new.replacement_text <> ''
       or coalesce(target_thread.anchor_quote, '')
          <> new.original_text
    then
      raise exception
        'Delete suggestions require a matching non-empty text-range anchor';
    end if;
  end if;

  return new;
end;
$function$;

create trigger article_suggestions_integrity
before insert or update of
  thread_id,
  target_version_fingerprint
on editorial.article_suggestions
for each row
execute function editorial.assert_article_suggestion_integrity();

create or replace function editorial.touch_article_review_record()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create trigger article_review_threads_touch
before update
on editorial.article_review_threads
for each row
execute function editorial.touch_article_review_record();

create trigger article_suggestions_touch
before update
on editorial.article_suggestions
for each row
execute function editorial.touch_article_review_record();

create or replace function editorial.protect_article_suggestion_event()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  raise exception
    'Article suggestion events are append-only';
end;
$function$;

create trigger article_suggestion_events_append_only
before update or delete
on editorial.article_suggestion_events
for each row
execute function editorial.protect_article_suggestion_event();

alter table editorial.article_review_threads
  enable row level security;

alter table editorial.article_review_comments
  enable row level security;

alter table editorial.article_suggestions
  enable row level security;

alter table editorial.article_suggestion_events
  enable row level security;

create policy "Article review participants can read threads"
on editorial.article_review_threads
for select
to authenticated
using (
  editorial.current_user_can_participate_article_review(
    resource_id
  )
);

create policy "Article review participants can read comments"
on editorial.article_review_comments
for select
to authenticated
using (
  exists (
    select 1
    from editorial.article_review_threads thread
    where thread.id = article_review_comments.thread_id
      and editorial.current_user_can_participate_article_review(
        thread.resource_id
      )
  )
);

create policy "Article review participants can read suggestions"
on editorial.article_suggestions
for select
to authenticated
using (
  exists (
    select 1
    from editorial.article_review_threads thread
    where thread.id = article_suggestions.thread_id
      and editorial.current_user_can_participate_article_review(
        thread.resource_id
      )
  )
);

create policy "Article review participants can read suggestion events"
on editorial.article_suggestion_events
for select
to authenticated
using (
  exists (
    select 1
    from editorial.article_suggestions suggestion
    join editorial.article_review_threads thread
      on thread.id = suggestion.thread_id
    where suggestion.id =
      article_suggestion_events.suggestion_id
      and editorial.current_user_can_participate_article_review(
        thread.resource_id
      )
  )
);

revoke all
on editorial.article_review_threads,
   editorial.article_review_comments,
   editorial.article_suggestions,
   editorial.article_suggestion_events
from anon, authenticated;

grant select
on editorial.article_review_threads,
   editorial.article_review_comments,
   editorial.article_suggestions,
   editorial.article_suggestion_events
to authenticated;

grant usage on schema editorial
to authenticated;

comment on table editorial.article_review_threads is
  'Authenticated internal review threads anchored to immutable Article versions.';

comment on column editorial.article_review_threads.anchor_from is
  'ProseMirror document position used for editor navigation and highlighting. It is not an HTML string offset.';

comment on column editorial.article_review_threads.anchor_to is
  'ProseMirror document position used for editor navigation and highlighting. It is not an HTML string offset.';

comment on column editorial.article_suggestions.proposed_content_html is
  'Complete proposed editor HTML snapshot. Acceptance applies this snapshot only after version, fingerprint, and draft-lock verification.';

comment on table editorial.article_review_comments is
  'Internal editorial comments belonging to Article review threads.';

comment on table editorial.article_suggestions is
  'Bounded Article text operations proposed against the current submitted version.';

comment on table editorial.article_suggestion_events is
  'Append-only Article suggestion decision history.';

-- ARTICLE_REVIEW_TRANSACTIONAL_RPCS_V1

-- Accepted suggestions require a durable version kind that is not part of
-- ordinary manual-save pruning.
alter table editorial.article_versions
  drop constraint if exists article_versions_kind_check;

alter table editorial.article_versions
  add constraint article_versions_kind_check
  check (
    version_kind in (
      'baseline',
      'autosave',
      'manual_save',
      'submitted',
      'approved',
      'scheduled',
      'published',
      'review_applied'
    )
  );

create or replace function
  editorial.protect_article_review_version()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
begin
  if old.version_kind = 'review_applied' then
    raise exception
      'Review-applied Article versions cannot be deleted';
  end if;

  if exists (
    select 1
    from editorial.resources resource
    where resource.current_approved_version_id = old.id
       or resource.current_published_version_id = old.id
  ) then
    raise exception
      'An Article version referenced by an approval or publication pointer cannot be deleted';
  end if;

  return old;
end;
$function$;

drop trigger if exists
  article_review_versions_durable
on editorial.article_versions;

create trigger article_review_versions_durable
before delete
on editorial.article_versions
for each row
execute function
  editorial.protect_article_review_version();

comment on function
  editorial.protect_article_review_version()
is
  'Adds review-applied, approval-pointer, and publication-pointer deletion protection without replacing the foundational Article version immutability authority.';

create or replace function public.get_article_review_workspace(
  p_article_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_resource editorial.resources%rowtype;
  v_target editorial.article_versions%rowtype;
  v_threads jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  if not editorial.current_user_can_participate_article_review(
    v_resource.id
  ) then
    raise exception 'Permission denied';
  end if;

  if v_resource.current_submitted_version_id is not null then
    select version.*
    into v_target
    from editorial.article_versions version
    where version.id =
      v_resource.current_submitted_version_id;
  end if;

  select coalesce(
    jsonb_agg(
      rows.thread_payload
      order by rows.thread_created_at desc
    ),
    '[]'::jsonb
  )
  into v_threads
  from (
    select
      thread.created_at as thread_created_at,
      jsonb_build_object(
        'id',
        thread.id,
        'resource_id',
        thread.resource_id,
        'article_id',
        thread.article_id,
        'target_version_id',
        thread.target_version_id,
        'thread_kind',
        thread.thread_kind,
        'target_field',
        thread.target_field,
        'anchor_kind',
        thread.anchor_kind,
        'anchor_from',
        thread.anchor_from,
        'anchor_to',
        thread.anchor_to,
        'anchor_quote',
        thread.anchor_quote,
        'anchor_prefix',
        thread.anchor_prefix,
        'anchor_suffix',
        thread.anchor_suffix,
        'status',
        thread.status,
        'created_by',
        thread.created_by,
        'created_by_label',
        coalesce(
          creator.display_name,
          thread.created_by::text,
          'system'
        ),
        'resolved_by',
        thread.resolved_by,
        'resolved_by_label',
        coalesce(
          resolver.display_name,
          thread.resolved_by::text
        ),
        'resolved_at',
        thread.resolved_at,
        'created_at',
        thread.created_at,
        'updated_at',
        thread.updated_at,
        'suggestion',
        case
          when suggestion.id is null then null
          else jsonb_build_object(
            'id',
            suggestion.id,
            'operation_kind',
            suggestion.operation_kind,
            'original_text',
            suggestion.original_text,
            'replacement_text',
            suggestion.replacement_text,
            'proposed_content_html',
            suggestion.proposed_content_html,
            'target_version_fingerprint',
            suggestion.target_version_fingerprint,
            'status',
            suggestion.status,
            'decided_by',
            suggestion.decided_by,
            'decided_at',
            suggestion.decided_at,
            'decision_note',
            suggestion.decision_note,
            'applied_version_id',
            suggestion.applied_version_id,
            'created_at',
            suggestion.created_at,
            'updated_at',
            suggestion.updated_at
          )
        end,
        'comments',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id',
                comment.id,
                'thread_id',
                comment.thread_id,
                'body_text',
                comment.body_text,
                'created_by',
                comment.created_by,
                'created_by_label',
                coalesce(
                  comment_actor.display_name,
                  comment.created_by::text,
                  'system'
                ),
                'created_at',
                comment.created_at,
                'edited_at',
                comment.edited_at,
                'deleted_at',
                comment.deleted_at
              )
              order by comment.created_at
            )
            from editorial.article_review_comments comment
            left join public.user_profiles comment_actor
              on comment_actor.user_id = comment.created_by
            where comment.thread_id = thread.id
          ),
          '[]'::jsonb
        ),
        'events',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id',
                event.id,
                'suggestion_id',
                event.suggestion_id,
                'action',
                event.action,
                'actor_id',
                event.actor_id,
                'actor_label',
                coalesce(
                  event_actor.display_name,
                  event.actor_id::text,
                  'system'
                ),
                'note',
                event.note,
                'applied_version_id',
                event.applied_version_id,
                'created_at',
                event.created_at
              )
              order by event.created_at
            )
            from editorial.article_suggestion_events event
            left join public.user_profiles event_actor
              on event_actor.user_id = event.actor_id
            where event.suggestion_id = suggestion.id
          ),
          '[]'::jsonb
        )
      ) as thread_payload
    from editorial.article_review_threads thread
    left join editorial.article_suggestions suggestion
      on suggestion.thread_id = thread.id
    left join public.user_profiles creator
      on creator.user_id = thread.created_by
    left join public.user_profiles resolver
      on resolver.user_id = thread.resolved_by
    where thread.article_id = p_article_id
  ) rows;

  return jsonb_build_object(
    'article_id',
    p_article_id,
    'resource_id',
    v_resource.id,
    'current_submitted_version_id',
    v_resource.current_submitted_version_id,
    'can_review',
    editorial.current_user_can_review_article(),
    'target_version',
    case
      when v_target.id is null then null
      else jsonb_build_object(
        'id',
        v_target.id,
        'version_number',
        v_target.version_number,
        'version_kind',
        v_target.version_kind,
        'source_draft_version',
        v_target.source_draft_version,
        'title',
        v_target.title,
        'excerpt',
        v_target.excerpt,
        'content_html',
        v_target.content_html,
        'content_fingerprint',
        v_target.content_fingerprint,
        'created_by',
        v_target.created_by,
        'created_at',
        v_target.created_at
      )
    end,
    'threads',
    v_threads
  );
end;
$function$;

revoke all on function
  public.get_article_review_workspace(uuid)
from public;

grant execute on function
  public.get_article_review_workspace(uuid)
to authenticated;

create or replace function public.create_article_suggestion(
  p_article_id uuid,
  p_target_version_id uuid,
  p_target_version_fingerprint text,
  p_anchor_from integer,
  p_anchor_to integer,
  p_anchor_quote text,
  p_anchor_prefix text,
  p_anchor_suffix text,
  p_operation_kind text,
  p_original_text text,
  p_replacement_text text,
  p_proposed_content_html text,
  p_comment text default null
)
returns table (
  created_thread_id uuid,
  created_suggestion_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_version editorial.article_versions%rowtype;
  v_thread_id uuid;
  v_suggestion_id uuid;
  v_created_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_proposed_content_html is null then
    raise exception 'Proposed Article content is required';
  end if;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = p_article_id;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id
  for update of resource;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  if not editorial.current_user_can_participate_article_review(
    v_resource.id
  ) then
    raise exception 'Permission denied';
  end if;

  if v_article.wp_status <> 'pending' then
    raise exception
      'Suggestions require an Article that is pending review';
  end if;

  if v_resource.current_submitted_version_id
     is distinct from p_target_version_id
  then
    raise exception
      'Suggestion target is not the current submitted Article version';
  end if;

  select version.*
  into v_version
  from editorial.article_versions version
  where version.id = p_target_version_id
    and version.article_id = p_article_id
    and version.resource_id = v_resource.id
    and version.version_kind = 'submitted';

  if not found then
    raise exception
      'Submitted Article version not found';
  end if;

  if v_version.content_fingerprint
     <> p_target_version_fingerprint
  then
    raise exception
      'Suggestion target fingerprint is stale';
  end if;

  insert into editorial.article_review_threads (
    resource_id,
    article_id,
    target_version_id,
    thread_kind,
    target_field,
    anchor_kind,
    anchor_from,
    anchor_to,
    anchor_quote,
    anchor_prefix,
    anchor_suffix
  )
  values (
    v_resource.id,
    p_article_id,
    p_target_version_id,
    'suggestion',
    'content_html',
    'text_range',
    p_anchor_from,
    p_anchor_to,
    coalesce(p_anchor_quote, ''),
    coalesce(p_anchor_prefix, ''),
    coalesce(p_anchor_suffix, '')
  )
  returning
    id,
    article_review_threads.created_at
  into
    v_thread_id,
    v_created_at;

  insert into editorial.article_suggestions (
    thread_id,
    operation_kind,
    original_text,
    replacement_text,
    proposed_content_html,
    target_version_fingerprint
  )
  values (
    v_thread_id,
    p_operation_kind,
    coalesce(p_original_text, ''),
    coalesce(p_replacement_text, ''),
    p_proposed_content_html,
    p_target_version_fingerprint
  )
  returning id
  into v_suggestion_id;

  if nullif(btrim(coalesce(p_comment, '')), '') is not null then
    insert into editorial.article_review_comments (
      thread_id,
      body_text
    )
    values (
      v_thread_id,
      btrim(p_comment)
    );
  end if;

  insert into editorial.article_suggestion_events (
    suggestion_id,
    action
  )
  values (
    v_suggestion_id,
    'created'
  );

  created_thread_id := v_thread_id;
  created_suggestion_id := v_suggestion_id;
  created_at := v_created_at;
  return next;
end;
$function$;

revoke all on function public.create_article_suggestion(
  uuid,
  uuid,
  text,
  integer,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
from public;

grant execute on function public.create_article_suggestion(
  uuid,
  uuid,
  text,
  integer,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
to authenticated;

create or replace function public.add_article_review_comment(
  p_thread_id uuid,
  p_body_text text
)
returns table (
  created_comment_id uuid,
  thread_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_thread editorial.article_review_threads%rowtype;
  v_comment_id uuid;
  v_created_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(btrim(coalesce(p_body_text, '')), '') is null then
    raise exception 'Comment cannot be blank';
  end if;

  select thread.*
  into v_thread
  from editorial.article_review_threads thread
  where thread.id = p_thread_id;

  if not found then
    raise exception 'Article review thread not found';
  end if;

  if not editorial.current_user_can_participate_article_review(
    v_thread.resource_id
  ) then
    raise exception 'Permission denied';
  end if;

  if v_thread.status <> 'open' then
    raise exception 'Resolved review threads cannot receive comments';
  end if;

  insert into editorial.article_review_comments (
    thread_id,
    body_text
  )
  values (
    p_thread_id,
    btrim(p_body_text)
  )
  returning
    id,
    article_review_comments.created_at
  into
    v_comment_id,
    v_created_at;

  created_comment_id := v_comment_id;
  thread_id := p_thread_id;
  created_at := v_created_at;
  return next;
end;
$function$;

revoke all on function
  public.add_article_review_comment(uuid, text)
from public;

grant execute on function
  public.add_article_review_comment(uuid, text)
to authenticated;

create or replace function public.reject_article_suggestion(
  p_suggestion_id uuid,
  p_note text default null
)
returns table (
  suggestion_id uuid,
  decision_status text,
  decided_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_suggestion editorial.article_suggestions%rowtype;
  v_thread editorial.article_review_threads%rowtype;
  v_decided_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not editorial.current_user_can_review_article() then
    raise exception 'Permission denied';
  end if;

  select suggestion.*
  into v_suggestion
  from editorial.article_suggestions suggestion
  where suggestion.id = p_suggestion_id
  for update;

  if not found then
    raise exception 'Article suggestion not found';
  end if;

  if v_suggestion.status <> 'open' then
    raise exception 'Only open suggestions can be rejected';
  end if;

  select thread.*
  into v_thread
  from editorial.article_review_threads thread
  where thread.id = v_suggestion.thread_id
  for update;

  update editorial.article_suggestions
  set
    status = 'rejected',
    decided_by = auth.uid(),
    decided_at = v_decided_at,
    decision_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_suggestion_id;

  update editorial.article_review_threads
  set
    status = 'resolved',
    resolved_by = auth.uid(),
    resolved_at = v_decided_at
  where id = v_thread.id;

  insert into editorial.article_suggestion_events (
    suggestion_id,
    action,
    note
  )
  values (
    p_suggestion_id,
    'rejected',
    nullif(btrim(coalesce(p_note, '')), '')
  );

  suggestion_id := p_suggestion_id;
  decision_status := 'rejected';
  decided_at := v_decided_at;
  return next;
end;
$function$;

revoke all on function
  public.reject_article_suggestion(uuid, text)
from public;

grant execute on function
  public.reject_article_suggestion(uuid, text)
to authenticated;

create or replace function public.withdraw_article_suggestion(
  p_suggestion_id uuid,
  p_note text default null
)
returns table (
  suggestion_id uuid,
  decision_status text,
  decided_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_suggestion editorial.article_suggestions%rowtype;
  v_thread editorial.article_review_threads%rowtype;
  v_decided_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select suggestion.*
  into v_suggestion
  from editorial.article_suggestions suggestion
  where suggestion.id = p_suggestion_id
  for update;

  if not found then
    raise exception 'Article suggestion not found';
  end if;

  select thread.*
  into v_thread
  from editorial.article_review_threads thread
  where thread.id = v_suggestion.thread_id
  for update;

  if v_thread.created_by is distinct from auth.uid() then
    raise exception
      'Only the suggestion creator can withdraw it';
  end if;

  if v_suggestion.status <> 'open' then
    raise exception 'Only open suggestions can be withdrawn';
  end if;

  update editorial.article_suggestions
  set
    status = 'withdrawn',
    decided_by = auth.uid(),
    decided_at = v_decided_at,
    decision_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_suggestion_id;

  update editorial.article_review_threads
  set
    status = 'resolved',
    resolved_by = auth.uid(),
    resolved_at = v_decided_at
  where id = v_thread.id;

  insert into editorial.article_suggestion_events (
    suggestion_id,
    action,
    note
  )
  values (
    p_suggestion_id,
    'withdrawn',
    nullif(btrim(coalesce(p_note, '')), '')
  );

  suggestion_id := p_suggestion_id;
  decision_status := 'withdrawn';
  decided_at := v_decided_at;
  return next;
end;
$function$;

revoke all on function
  public.withdraw_article_suggestion(uuid, text)
from public;

grant execute on function
  public.withdraw_article_suggestion(uuid, text)
to authenticated;

create or replace function public.mark_article_suggestion_stale(
  p_suggestion_id uuid,
  p_note text default null
)
returns table (
  suggestion_id uuid,
  decision_status text,
  decided_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_suggestion editorial.article_suggestions%rowtype;
  v_thread editorial.article_review_threads%rowtype;
  v_decided_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not editorial.current_user_can_review_article() then
    raise exception 'Permission denied';
  end if;

  select suggestion.*
  into v_suggestion
  from editorial.article_suggestions suggestion
  where suggestion.id = p_suggestion_id
  for update;

  if not found then
    raise exception 'Article suggestion not found';
  end if;

  if v_suggestion.status <> 'open' then
    raise exception 'Only open suggestions can be marked stale';
  end if;

  select thread.*
  into v_thread
  from editorial.article_review_threads thread
  where thread.id = v_suggestion.thread_id
  for update;

  update editorial.article_suggestions
  set
    status = 'stale',
    decided_by = auth.uid(),
    decided_at = v_decided_at,
    decision_note = coalesce(
      nullif(btrim(coalesce(p_note, '')), ''),
      'Suggestion no longer targets the active review state'
    )
  where id = p_suggestion_id;

  update editorial.article_review_threads
  set
    status = 'resolved',
    resolved_by = auth.uid(),
    resolved_at = v_decided_at
  where id = v_thread.id;

  insert into editorial.article_suggestion_events (
    suggestion_id,
    action,
    note
  )
  values (
    p_suggestion_id,
    'marked_stale',
    coalesce(
      nullif(btrim(coalesce(p_note, '')), ''),
      'Suggestion no longer targets the active review state'
    )
  );

  suggestion_id := p_suggestion_id;
  decision_status := 'stale';
  decided_at := v_decided_at;
  return next;
end;
$function$;

revoke all on function
  public.mark_article_suggestion_stale(uuid, text)
from public;

grant execute on function
  public.mark_article_suggestion_stale(uuid, text)
to authenticated;

create or replace function
  editorial.apply_article_review_snapshot(
    p_article_id uuid,
    p_resource_id uuid,
    p_expected_draft_version bigint,
    p_content_html text
  )
returns table (
  article_id uuid,
  article_slug text,
  draft_version bigint,
  version_id uuid,
  version_number bigint
)
language plpgsql
security invoker
set search_path = pg_catalog, public, editorial
as $function$
declare
  current_article public.wk_articles%rowtype;
  current_resource editorial.resources%rowtype;

  new_version_id uuid;
  new_version_number bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not editorial.current_user_can_review_article() then
    raise exception 'Permission denied';
  end if;

  if p_content_html is null then
    raise exception
      'Proposed Article content is required';
  end if;

  select article.*
  into current_article
  from public.wk_articles article
  where article.id = p_article_id
  for update;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into current_resource
  from editorial.resources resource
  where resource.id = p_resource_id
  for update;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  if not exists (
    select 1
    from editorial.article_resources binding
    where binding.article_id = p_article_id
      and binding.resource_id = p_resource_id
  ) then
    raise exception
      'Article and resource identity do not match';
  end if;

  if current_article.wp_status <> 'pending' then
    raise exception
      'Review acceptance requires an Article that is pending review';
  end if;

  if p_expected_draft_version is null
     or current_article.draft_version
       <> p_expected_draft_version
  then
    raise exception
      'STALE_ARTICLE_VERSION: expected %, current %',
      p_expected_draft_version,
      current_article.draft_version;
  end if;

  update public.wk_articles as article
  set
    content_html = p_content_html,
    wp_status = 'draft',
    draft_version = article.draft_version + 1,
    modified_at = now(),
    updated_at = now()
  where article.id = p_article_id
  returning article.*
  into current_article;

  new_version_number :=
    editorial.next_article_version_number(
      current_resource.id
    );

  insert into editorial.article_versions (
    resource_id,
    article_id,
    version_number,
    version_kind,
    source_draft_version,
    title,
    slug,
    excerpt,
    content_html,
    author_display,
    owner_id,
    hero_image_id,
    hero_image_url,
    seo,
    lifecycle_state,
    wp_status,
    published_at,
    category_snapshot,
    tag_snapshot,
    created_by,
    content_fingerprint
  )
  values (
    current_resource.id,
    current_article.id,
    new_version_number,
    'review_applied',
    current_article.draft_version,
    current_article.title,
    current_article.slug,
    current_article.excerpt,
    current_article.content_html,
    current_article.author,
    current_resource.owner_id,
    current_article.hero_image_id,
    current_article.hero_image_url,
    current_article.seo,
    'draft',
    current_article.wp_status,
    current_article.published_at,
    current_article.categories,
    current_article.tags,
    auth.uid(),
    editorial.article_snapshot_fingerprint(
      current_article.title,
      current_article.slug,
      current_article.excerpt,
      current_article.content_html,
      current_article.author,
      current_article.hero_image_id,
      current_article.hero_image_url,
      current_article.seo,
      current_article.wp_status,
      current_article.published_at,
      current_article.categories,
      current_article.tags
    )
  )
  returning id
  into new_version_id;

  update editorial.resources
  set
    current_working_version_id =
      new_version_id,
    lifecycle_state = 'draft',
    visibility = 'private',
    updated_at = now()
  where id = current_resource.id;

  article_id := current_article.id;
  article_slug := current_article.slug;
  draft_version :=
    current_article.draft_version;
  version_id := new_version_id;
  version_number := new_version_number;

  return next;
end;
$function$;

revoke all on function
  editorial.apply_article_review_snapshot(
    uuid,
    uuid,
    bigint,
    text
  )
from public, anon, authenticated;

comment on function
  editorial.apply_article_review_snapshot(
    uuid,
    uuid,
    bigint,
    text
  )
is
  'Private command authority for applying one accepted suggestion as a durable review-applied Article version.';

create or replace function public.accept_article_suggestion(
  p_suggestion_id uuid,
  p_expected_draft_version bigint,
  p_note text default null
)
returns table (
  suggestion_id uuid,
  decision_status text,
  article_id uuid,
  article_slug text,
  draft_version bigint,
  applied_version_id uuid,
  applied_version_number bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_suggestion editorial.article_suggestions%rowtype;
  v_thread editorial.article_review_threads%rowtype;
  v_resource editorial.resources%rowtype;
  v_article public.wk_articles%rowtype;
  v_target editorial.article_versions%rowtype;

  v_new_version_id uuid;
  v_new_version_number bigint;
  v_decided_at timestamptz := now();
  v_prior_status text;

  v_stale record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not editorial.current_user_can_review_article() then
    raise exception 'Permission denied';
  end if;

  select suggestion.*
  into v_suggestion
  from editorial.article_suggestions suggestion
  where suggestion.id = p_suggestion_id
  for update;

  if not found then
    raise exception 'Article suggestion not found';
  end if;

  if v_suggestion.status <> 'open' then
    raise exception 'Only open suggestions can be accepted';
  end if;

  select thread.*
  into v_thread
  from editorial.article_review_threads thread
  where thread.id = v_suggestion.thread_id
  for update;

  select resource.*
  into v_resource
  from editorial.resources resource
  where resource.id = v_thread.resource_id
  for update;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = v_thread.article_id
  for update;

  select version.*
  into v_target
  from editorial.article_versions version
  where version.id = v_thread.target_version_id;

  if not found then
    raise exception 'Suggestion target version not found';
  end if;

  if v_resource.current_submitted_version_id
       is distinct from v_thread.target_version_id
     or v_article.wp_status <> 'pending'
     or v_target.content_fingerprint
       <> v_suggestion.target_version_fingerprint
  then
    update editorial.article_suggestions
    set
      status = 'stale',
      decided_by = auth.uid(),
      decided_at = v_decided_at,
      decision_note =
        'Suggestion no longer targets the active submitted version'
    where id = p_suggestion_id;

    update editorial.article_review_threads
    set
      status = 'resolved',
      resolved_by = auth.uid(),
      resolved_at = v_decided_at
    where id = v_thread.id;

    insert into editorial.article_suggestion_events (
      suggestion_id,
      action,
      note
    )
    values (
      p_suggestion_id,
      'marked_stale',
      'Suggestion no longer targets the active submitted version'
    );

    suggestion_id := p_suggestion_id;
    decision_status := 'stale';
    article_id := v_article.id;
    article_slug := v_article.slug;
    draft_version := v_article.draft_version;
    applied_version_id := null;
    applied_version_number := null;
    return next;
    return;
  end if;

  v_prior_status := v_article.wp_status;

  select
    persisted.version_id,
    persisted.version_number
  into
    v_new_version_id,
    v_new_version_number
  from editorial.apply_article_review_snapshot(
    v_article.id,
    v_resource.id,
    p_expected_draft_version,
    v_suggestion.proposed_content_html
  ) persisted;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = v_thread.article_id;

  update editorial.article_suggestions
  set
    status = 'accepted',
    decided_by = auth.uid(),
    decided_at = v_decided_at,
    decision_note = nullif(btrim(coalesce(p_note, '')), ''),
    applied_version_id = v_new_version_id
  where id = p_suggestion_id;

  update editorial.article_review_threads
  set
    status = 'resolved',
    resolved_by = auth.uid(),
    resolved_at = v_decided_at
  where id = v_thread.id;

  insert into editorial.article_suggestion_events (
    suggestion_id,
    action,
    note,
    applied_version_id
  )
  values (
    p_suggestion_id,
    'accepted',
    nullif(btrim(coalesce(p_note, '')), ''),
    v_new_version_id
  );

  insert into editorial.article_lifecycle_events (
    resource_id,
    article_id,
    version_id,
    action,
    prior_status,
    resulting_status,
    note,
    metadata
  )
  values (
    v_resource.id,
    v_article.id,
    v_thread.target_version_id,
    'changes_requested',
    v_prior_status,
    'draft',
    coalesce(
      nullif(btrim(coalesce(p_note, '')), ''),
      'Accepted editorial suggestion'
    ),
    jsonb_build_object(
      'suggestion_id',
      p_suggestion_id,
      'applied_version_id',
      v_new_version_id,
      'decision',
      'accepted',
      'review_round_closed',
      true,
      'remaining_open_suggestions_marked_stale',
      true
    )
  );

  -- Quality PR 2 deliberately accepts at most one
  -- suggestion from a submitted review round. Every suggestion stores
  -- a complete proposed document snapshot. Remaining suggestions cannot
  -- be silently rebased after the Article returns to draft.
  for v_stale in
    update editorial.article_suggestions suggestion
    set
      status = 'stale',
      decided_by = auth.uid(),
      decided_at = v_decided_at,
      decision_note =
        'Review round closed after another suggestion was accepted; resubmission is required before reconsideration'
    from editorial.article_review_threads competing_thread
    where competing_thread.id = suggestion.thread_id
      and competing_thread.target_version_id =
        v_thread.target_version_id
      and suggestion.id <> p_suggestion_id
      and suggestion.status = 'open'
    returning
      suggestion.id,
      suggestion.thread_id
  loop
    update editorial.article_review_threads
    set
      status = 'resolved',
      resolved_by = auth.uid(),
      resolved_at = v_decided_at
    where id = v_stale.thread_id;

    insert into editorial.article_suggestion_events (
      suggestion_id,
      action,
      note
    )
    values (
      v_stale.id,
      'marked_stale',
      'Review round closed after another suggestion was accepted; resubmission is required before reconsideration'
    );
  end loop;

  suggestion_id := p_suggestion_id;
  decision_status := 'accepted';
  article_id := v_article.id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  applied_version_id := v_new_version_id;
  applied_version_number := v_new_version_number;
  return next;
end;
$function$;

revoke all on function
  public.accept_article_suggestion(uuid, bigint, text)
from public;

grant execute on function
  public.accept_article_suggestion(uuid, bigint, text)
to authenticated;

comment on function public.get_article_review_workspace(uuid) is
  'Returns the authenticated internal Article review workspace and immutable submitted target.';

comment on function public.create_article_suggestion(
  uuid,
  uuid,
  text,
  integer,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) is
  'Creates a bounded Article suggestion against the current immutable submitted version.';

comment on function public.accept_article_suggestion(
  uuid,
  bigint,
  text
) is
  'Applies one open suggestion as a durable review_applied Article version, closes the submitted review round, and returns the Article to draft work.';
