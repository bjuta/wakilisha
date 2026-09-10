-- Messages Operations UX Gate C: narrow Legal picker read authority.
--
-- Adds exactly two case-bound, read-only Legal discovery RPCs.
-- Candidate C Legal command, preservation, disclosure, Media, and runtime
-- orchestration authority remain unchanged.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'messages-operations-ux-gate-c-legal-picker-reads',
    0
  )
);

do $preflight$
declare
  v_count bigint;
  v_head text;
begin
  select count(*), max(version)
  into v_count, v_head
  from supabase_migrations.schema_migrations;

  if v_count <> 112
     or v_head <> '20260909080000'
  then
    raise exception
      'STOP: Gate C Legal picker reads require exact 112 / 20260909080000 Candidate C predecessor authority.';
  end if;

  if to_regclass('messaging.legal_request_cases') is null
     or to_regclass('messaging.messages') is null
     or to_regclass('messaging.conversations') is null
     or to_regclass('messaging.conversation_participants') is null
     or to_regclass('media.file_objects') is null
     or to_regclass('editorial.resource_versions') is null
     or to_regclass('editorial.person_identity_links') is null
     or to_regclass('editorial.people') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('public.user_role_assignments') is null
     or to_regclass('public.role_capabilities') is null
     or to_regprocedure('messaging.current_human_identity()') is null
     or to_regprocedure('messaging.current_messages_super_admin()') is null
     or to_regprocedure('messaging.require_messages_legal_capability(text)') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
  then
    raise exception
      'STOP: Gate C Legal picker reads require accepted Candidate C, identity, Message, Media, Resource Version, and role authority.';
  end if;

  if to_regprocedure(
       'public.search_messages_legal_scope_targets_v1(uuid,text,text,integer)'
     ) is not null
     or to_regprocedure(
       'public.search_messages_legal_reviewers_v1(uuid,text,integer)'
     ) is not null
  then
    raise exception
      'STOP: Gate C Legal picker read authority already exists.';
  end if;
end
$preflight$;

create function public.search_messages_legal_scope_targets_v1(
  p_case_id uuid,
  p_target_kind text,
  p_query text,
  p_limit integer default 20
)
returns table(
  target_kind text,
  target_id uuid,
  label text,
  context text,
  occurred_at timestamptz,
  related_id uuid
)
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public',
  'editorial',
  'messaging',
  'media'
as $function$
declare
  v_admin record;
  v_query text := btrim(coalesce(p_query, ''));
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
begin
  select *
  into v_admin
  from messaging.require_messages_legal_capability(
    'manage_messages_legal_cases'
  );

  perform 1
  from messaging.legal_request_cases legal_case
  where legal_case.id = p_case_id;

  if not found then
    raise exception
      'Legal Request Case does not exist.'
      using errcode = 'P0002';
  end if;

  if p_target_kind not in (
    'message',
    'conversation',
    'media_file',
    'resource_version'
  ) then
    raise exception
      'Invalid Legal scope target kind.'
      using errcode = '22023';
  end if;

  if octet_length(v_query) < 3
     or octet_length(v_query) > 200
  then
    raise exception
      'Legal scope target search requires between 3 and 200 bytes.'
      using errcode = '22023';
  end if;

  if p_target_kind = 'message' then
    return query
    select
      'message'::text,
      message_row.id,
      concat(
        'Message from ',
        coalesce(
          nullif(profile.display_name, ''),
          nullif(profile.username, ''),
          case
            when sender.actor_kind = 'human' then 'Human participant'
            else initcap(replace(sender.actor_kind, '_', ' '))
          end
        )
      )::text,
      concat_ws(
        ' • ',
        initcap(replace(message_row.message_kind, '_', ' ')),
        'Conversation ' || message_row.conversation_id::text
      )::text,
      message_row.accepted_at,
      message_row.conversation_id
    from messaging.messages message_row
    join messaging.conversation_participants sender
      on sender.id = message_row.sender_participant_id
    left join public.user_profiles profile
      on profile.user_id = sender.user_id
     and profile.status = 'active'
    where message_row.id::text ilike '%' || v_query || '%'
       or message_row.conversation_id::text ilike '%' || v_query || '%'
       or coalesce(profile.display_name, '') ilike '%' || v_query || '%'
       or coalesce(profile.username, '') ilike '%' || v_query || '%'
       or message_row.message_kind ilike '%' || v_query || '%'
       or message_row.accepted_at::text ilike '%' || v_query || '%'
    order by message_row.accepted_at desc, message_row.id
    limit v_limit;
    return;
  end if;

  if p_target_kind = 'conversation' then
    return query
    select
      'conversation'::text,
      conversation_row.id,
      concat(
        'Conversation with ',
        coalesce(
          participant_names.participant_labels,
          'participants'
        )
      )::text,
      concat_ws(
        ' • ',
        initcap(replace(conversation_row.conversation_kind, '_', ' ')),
        initcap(replace(conversation_row.security_classification, '_', ' ')),
        initcap(replace(conversation_row.status, '_', ' ')),
        conversation_row.id::text
      )::text,
      conversation_row.last_activity_at,
      null::uuid
    from messaging.conversations conversation_row
    left join lateral (
      select string_agg(
        participant_name.display_label,
        ', '
        order by participant_name.display_label
      ) as participant_labels
      from (
        select distinct
          coalesce(
            nullif(participant_profile.display_name, ''),
            nullif(participant_profile.username, ''),
            case
              when participant.actor_kind = 'human' then 'Human participant'
              else initcap(replace(participant.actor_kind, '_', ' '))
            end
          ) as display_label
        from messaging.conversation_participants participant
        left join public.user_profiles participant_profile
          on participant_profile.user_id = participant.user_id
         and participant_profile.status = 'active'
        where participant.conversation_id = conversation_row.id
        order by 1
        limit 6
      ) participant_name
    ) participant_names on true
    where conversation_row.id::text ilike '%' || v_query || '%'
       or conversation_row.conversation_kind ilike '%' || v_query || '%'
       or conversation_row.security_classification ilike '%' || v_query || '%'
       or conversation_row.status ilike '%' || v_query || '%'
       or conversation_row.last_activity_at::text ilike '%' || v_query || '%'
       or exists (
         select 1
         from messaging.conversation_participants participant_match
         left join public.user_profiles participant_match_profile
           on participant_match_profile.user_id = participant_match.user_id
          and participant_match_profile.status = 'active'
         where participant_match.conversation_id = conversation_row.id
           and (
             coalesce(
               participant_match_profile.display_name,
               ''
             ) ilike '%' || v_query || '%'
             or coalesce(
               participant_match_profile.username,
               ''
             ) ilike '%' || v_query || '%'
           )
       )
    order by conversation_row.last_activity_at desc, conversation_row.id
    limit v_limit;
    return;
  end if;

  if p_target_kind = 'media_file' then
    return query
    select
      'media_file'::text,
      file_row.id,
      coalesce(
        nullif(file_row.original_filename, ''),
        'Media file ' || left(file_row.id::text, 8)
      )::text,
      concat_ws(
        ' • ',
        coalesce(nullif(file_row.mime_type, ''), 'Unknown type'),
        initcap(replace(file_row.verification_state, '_', ' ')),
        case
          when file_row.byte_size is null then null
          else file_row.byte_size::text || ' bytes'
        end
      )::text,
      file_row.created_at,
      null::uuid
    from media.file_objects file_row
    where file_row.id::text ilike '%' || v_query || '%'
       or coalesce(file_row.original_filename, '') ilike '%' || v_query || '%'
       or coalesce(file_row.mime_type, '') ilike '%' || v_query || '%'
       or coalesce(file_row.file_extension, '') ilike '%' || v_query || '%'
       or file_row.verification_state ilike '%' || v_query || '%'
       or file_row.created_at::text ilike '%' || v_query || '%'
    order by file_row.created_at desc, file_row.id
    limit v_limit;
    return;
  end if;

  return query
  select
    'resource_version'::text,
    version_row.id,
    concat(
      initcap(replace(version_row.resource_kind, '_', ' ')),
      ' version ',
      version_row.version_number::text
    )::text,
    concat_ws(
      ' • ',
      initcap(replace(version_row.version_type, '_', ' ')),
      initcap(replace(version_row.version_kind, '_', ' ')),
      'Resource ' || version_row.resource_id::text
    )::text,
    version_row.created_at,
    null::uuid
  from editorial.resource_versions version_row
  where version_row.id::text ilike '%' || v_query || '%'
     or version_row.resource_id::text ilike '%' || v_query || '%'
     or version_row.resource_kind ilike '%' || v_query || '%'
     or version_row.version_type ilike '%' || v_query || '%'
     or version_row.version_kind ilike '%' || v_query || '%'
     or version_row.version_number::text ilike '%' || v_query || '%'
     or version_row.created_at::text ilike '%' || v_query || '%'
  order by version_row.created_at desc, version_row.id
  limit v_limit;
end
$function$;

comment on function public.search_messages_legal_scope_targets_v1(
  uuid,
  text,
  text,
  integer
) is
  'Case-bound safe metadata search for Gate C Legal scope target pickers.';

revoke all
on function public.search_messages_legal_scope_targets_v1(
  uuid,
  text,
  text,
  integer
)
from public, anon, authenticated, service_role;

grant execute
on function public.search_messages_legal_scope_targets_v1(
  uuid,
  text,
  text,
  integer
)
to authenticated;

create function public.search_messages_legal_reviewers_v1(
  p_case_id uuid,
  p_query text,
  p_limit integer default 20
)
returns table(
  user_id uuid,
  display_name text,
  secondary_label text
)
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public',
  'editorial',
  'messaging'
as $function$
declare
  v_admin record;
  v_query text := btrim(coalesce(p_query, ''));
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
begin
  select *
  into v_admin
  from messaging.require_messages_legal_capability(
    'manage_messages_legal_cases'
  );

  perform 1
  from messaging.legal_request_cases legal_case
  where legal_case.id = p_case_id;

  if not found then
    raise exception
      'Legal Request Case does not exist.'
      using errcode = 'P0002';
  end if;

  if octet_length(v_query) < 2
     or octet_length(v_query) > 120
  then
    raise exception
      'Legal reviewer search requires between 2 and 120 bytes.'
      using errcode = '22023';
  end if;

  return query
  select
    profile.user_id,
    coalesce(
      nullif(profile.display_name, ''),
      nullif(profile.username, ''),
      'Super Admin ' || left(profile.user_id::text, 8)
    )::text,
    case
      when nullif(profile.username, '') is not null
        then '@' || profile.username
      else 'Legal Super Admin'
    end::text
  from public.user_profiles profile
  join public.user_role_assignments assignment
    on assignment.user_id = profile.user_id
   and assignment.role_key = 'super_admin'
   and assignment.status = 'active'
   and (
     assignment.expires_at is null
     or assignment.expires_at > now()
   )
  where profile.status = 'active'
    and exists (
      select 1
      from public.role_capabilities role_capability
      where role_capability.role_key = assignment.role_key
        and role_capability.capability_key = 'manage_messages_legal_cases'
    )
    and exists (
      select 1
      from editorial.person_identity_links identity_link
      join editorial.people person
        on person.resource_id = identity_link.person_resource_id
       and person.person_state = 'active'
      where identity_link.user_id = profile.user_id
        and identity_link.link_state = 'active'
    )
    and (
      profile.user_id::text ilike '%' || v_query || '%'
      or coalesce(profile.display_name, '') ilike '%' || v_query || '%'
      or coalesce(profile.username, '') ilike '%' || v_query || '%'
    )
  order by
    coalesce(
      nullif(profile.display_name, ''),
      nullif(profile.username, ''),
      profile.user_id::text
    ),
    profile.user_id
  limit v_limit;
end
$function$;

comment on function public.search_messages_legal_reviewers_v1(
  uuid,
  text,
  integer
) is
  'Case-bound safe identity search for currently eligible Gate C Legal reviewers.';

revoke all
on function public.search_messages_legal_reviewers_v1(
  uuid,
  text,
  integer
)
from public, anon, authenticated, service_role;

grant execute
on function public.search_messages_legal_reviewers_v1(
  uuid,
  text,
  integer
)
to authenticated;

commit;
