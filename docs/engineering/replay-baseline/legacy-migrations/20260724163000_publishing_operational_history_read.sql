begin;

do $preflight$
begin
  if to_regclass(
    'editorial.publishing_items'
  ) is null then
    raise exception
      'STOP: editorial.publishing_items does not exist';
  end if;

  if to_regclass(
    'editorial.publishing_item_events'
  ) is null then
    raise exception
      'STOP: editorial.publishing_item_events does not exist';
  end if;

  if to_regclass(
    'editorial.publishing_channels'
  ) is null then
    raise exception
      'STOP: editorial.publishing_channels does not exist';
  end if;

  if to_regclass(
    'public.user_profiles'
  ) is null then
    raise exception
      'STOP: public.user_profiles does not exist';
  end if;

  if to_regprocedure(
    'editorial.current_user_can_view_publishing_item(uuid)'
  ) is null then
    raise exception
      'STOP: Publishing item read-authority helper does not exist';
  end if;
end;
$preflight$;

create index if not exists
  publishing_item_events_cursor_idx
on editorial.publishing_item_events (
  item_id,
  created_at desc,
  id desc
);

create or replace function
  public.list_publishing_item_events(
    p_item_id uuid,
    p_before_created_at timestamptz default null,
    p_before_event_id uuid default null,
    p_limit integer default 50
  )
returns table (
  event_id uuid,
  item_id uuid,
  action text,
  prior_record_version bigint,
  resulting_record_version bigint,
  note text,
  actor_id uuid,
  actor_label text,
  created_at timestamptz,
  prior_production_stage text,
  resulting_production_stage text,
  prior_planning_state text,
  resulting_planning_state text,
  subject_user_id uuid,
  subject_user_label text,
  assignment_role text,
  channel_key text,
  channel_label text,
  channel_is_primary boolean,
  previous_primary_channel_key text,
  previous_primary_channel_label text,
  resource_id uuid,
  changed_fields text[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
begin
  if auth.uid() is null
     or not editorial.current_user_can_view_publishing_item(
       p_item_id
     )
  then
    raise exception
      using
        errcode = '42501',
        message = 'Permission denied';
  end if;

  if (
    p_before_created_at is null
  ) <> (
    p_before_event_id is null
  ) then
    raise exception
      'Publishing event cursor requires both created_at and event_id';
  end if;

  return query
  with event_page as (
    select
      history.id as event_id,
      history.item_id,
      history.action,
      history.prior_record_version,
      history.resulting_record_version,
      history.note,
      history.actor_id,
      history.created_at,

      nullif(
        history.prior_values
          ->> 'productionStage',
        ''
      ) as prior_production_stage,

      nullif(
        history.resulting_values
          ->> 'productionStage',
        ''
      ) as resulting_production_stage,

      nullif(
        history.prior_values
          ->> 'planningState',
        ''
      ) as prior_planning_state,

      nullif(
        history.resulting_values
          ->> 'planningState',
        ''
      ) as resulting_planning_state,

      case
        when history.action in (
          'assignee_added',
          'assignee_removed'
        )
        then nullif(
          history.metadata ->> 'userId',
          ''
        )::uuid
        else null
      end as subject_user_id,

      case
        when history.action in (
          'assignee_added',
          'assignee_removed'
        )
        then nullif(
          history.metadata
            ->> 'assignmentRole',
          ''
        )
        else null
      end as assignment_role,

      case
        when history.action in (
          'channel_added',
          'channel_removed',
          'channel_primary_changed'
        )
        then nullif(
          history.metadata ->> 'channelKey',
          ''
        )
        else null
      end as channel_key,

      case
        when history.action =
          'channel_added'
          and history.metadata ? 'isPrimary'
        then (
          history.metadata
            ->> 'isPrimary'
        )::boolean
        else null
      end as channel_is_primary,

      case
        when history.action =
          'channel_primary_changed'
        then nullif(
          history.metadata
            ->> 'previousPrimaryChannelKey',
          ''
        )
        else null
      end as previous_primary_channel_key,

      case
        when history.action =
          'resource_linked'
        then nullif(
          history.resulting_values
            ->> 'resourceId',
          ''
        )::uuid
        else null
      end as resource_id,

      case
        when history.action =
          'details_updated'
        then array_remove(
          array[
            case
              when history.prior_values
                     -> 'title'
                   is distinct from
                   history.resulting_values
                     -> 'title'
              then 'title'
            end,
            case
              when history.prior_values
                     -> 'contentKind'
                   is distinct from
                   history.resulting_values
                     -> 'contentKind'
              then 'contentKind'
            end,
            case
              when history.prior_values
                     -> 'brief'
                   is distinct from
                   history.resulting_values
                     -> 'brief'
              then 'brief'
            end,
            case
              when history.prior_values
                     -> 'productionStage'
                   is distinct from
                   history.resulting_values
                     -> 'productionStage'
              then 'productionStage'
            end,
            case
              when history.prior_values
                     -> 'planningState'
                   is distinct from
                   history.resulting_values
                     -> 'planningState'
              then 'planningState'
            end,
            case
              when history.prior_values
                     -> 'priority'
                   is distinct from
                   history.resulting_values
                     -> 'priority'
              then 'priority'
            end,
            case
              when history.prior_values
                     -> 'ownerId'
                   is distinct from
                   history.resulting_values
                     -> 'ownerId'
              then 'ownerId'
            end,
            case
              when history.prior_values
                     -> 'productionDeadline'
                   is distinct from
                   history.resulting_values
                     -> 'productionDeadline'
              then 'productionDeadline'
            end,
            case
              when history.prior_values
                     -> 'plannedPublishAt'
                   is distinct from
                   history.resulting_values
                     -> 'plannedPublishAt'
              then 'plannedPublishAt'
            end,
            case
              when history.prior_values
                     -> 'resourceId'
                   is distinct from
                   history.resulting_values
                     -> 'resourceId'
              then 'resourceId'
            end
          ]::text[],
          null
        )
        else array[]::text[]
      end as changed_fields

    from editorial.publishing_item_events
      history
    where history.item_id = p_item_id
      and (
        p_before_created_at is null
        or (
          history.created_at,
          history.id
        ) < (
          p_before_created_at,
          p_before_event_id
        )
      )
    order by
      history.created_at desc,
      history.id desc
    limit least(
      greatest(
        coalesce(p_limit, 50),
        1
      ),
      100
    )
  )

  select
    event_page.event_id,
    event_page.item_id,
    event_page.action,
    event_page.prior_record_version,
    event_page.resulting_record_version,
    event_page.note,
    event_page.actor_id,

    coalesce(
      nullif(
        btrim(actor_profile.display_name),
        ''
      ),
      nullif(
        btrim(actor_profile.email),
        ''
      ),
      nullif(
        btrim(actor_profile.username),
        ''
      ),
      event_page.actor_id::text,
      'System'
    ) as actor_label,

    event_page.created_at,
    event_page.prior_production_stage,
    event_page.resulting_production_stage,
    event_page.prior_planning_state,
    event_page.resulting_planning_state,
    event_page.subject_user_id,

    coalesce(
      nullif(
        btrim(subject_profile.display_name),
        ''
      ),
      nullif(
        btrim(subject_profile.email),
        ''
      ),
      nullif(
        btrim(subject_profile.username),
        ''
      ),
      event_page.subject_user_id::text
    ) as subject_user_label,

    event_page.assignment_role,
    event_page.channel_key,
    current_channel.label as channel_label,
    event_page.channel_is_primary,
    event_page.previous_primary_channel_key,

    previous_channel.label
      as previous_primary_channel_label,

    event_page.resource_id,
    event_page.changed_fields

  from event_page

  left join public.user_profiles
    actor_profile
    on actor_profile.user_id =
      event_page.actor_id

  left join public.user_profiles
    subject_profile
    on subject_profile.user_id =
      event_page.subject_user_id

  left join editorial.publishing_channels
    current_channel
    on current_channel.channel_key =
      event_page.channel_key

  left join editorial.publishing_channels
    previous_channel
    on previous_channel.channel_key =
      event_page.previous_primary_channel_key

  order by
    event_page.created_at desc,
    event_page.event_id desc;
end;
$function$;

comment on function
  public.list_publishing_item_events(
    uuid,
    timestamptz,
    uuid,
    integer
  )
is
  'Returns a bounded, readable, read-only operational history for one authorized Publishing item without exposing raw event snapshots or metadata.';

revoke all on function
  public.list_publishing_item_events(
    uuid,
    timestamptz,
    uuid,
    integer
  )
from public, anon;

grant execute on function
  public.list_publishing_item_events(
    uuid,
    timestamptz,
    uuid,
    integer
  )
to authenticated, service_role;

commit;
