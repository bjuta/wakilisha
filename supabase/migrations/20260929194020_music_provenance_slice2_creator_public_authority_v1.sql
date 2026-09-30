-- WAKILISHA Music Provenance — Slice 2 / #1116
-- Creator evidence loop, invite lifecycle, public-safe provenance projections.
--
-- Creator-facing commands in this migration may append evidence, attestations,
-- invitation history, state history and attestation-use permissions. They do
-- not admit canonical Recording/Work contributions. Canonical admission
-- remains behind the Slice 1 reviewed exact-grant authority.
--
-- Public provenance reads expose verified canonical contribution authority
-- only. Pending/review-only attestations remain private.

begin;

set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'music-provenance-slice2-creator-public-authority-v1',
    0
  )
);

do $preflight$
begin
  if pg_catalog.to_regclass(
       'platform_private.registry_contribution_attestations'
     ) is null
     or pg_catalog.to_regclass(
       'platform_private.registry_contribution_attestation_state_events'
     ) is null
     or pg_catalog.to_regclass(
       'platform_private.registry_contribution_attestation_permission_versions'
     ) is null
     or pg_catalog.to_regclass(
       'platform_private.registry_evidence_assertions'
     ) is null
     or pg_catalog.to_regclass(
       'public.registry_track_contributions'
     ) is null
     or pg_catalog.to_regclass(
       'public.registry_work_contributions'
     ) is null
     or pg_catalog.to_regclass(
       'public.registry_track_work_links'
     ) is null
     or pg_catalog.to_regclass(
       'public.registry_artist_person_memberships'
     ) is null
     or pg_catalog.to_regclass(
       'editorial.person_registry_artist_links'
     ) is null
     or pg_catalog.to_regclass(
       'public.community_notifications'
     ) is null
     or pg_catalog.to_regprocedure(
       'messaging.current_human_identity()'
     ) is null
     or pg_catalog.to_regprocedure(
       'messaging.active_user_for_person(uuid)'
     ) is null
     or pg_catalog.to_regprocedure(
       'editorial.resolve_person_presentation(uuid)'
     ) is null
  then
    raise exception
      'STOP: accepted Slice 1 provenance, Person, Notifications, or Messages identity authority is incomplete';
  end if;

  if pg_catalog.to_regclass(
       'platform_private.registry_contribution_invitations'
     ) is not null
     or pg_catalog.to_regclass(
       'platform_private.registry_contribution_invitation_events'
     ) is not null
     or pg_catalog.to_regprocedure(
       'public.get_my_music_credits_v1()'
     ) is not null
     or pg_catalog.to_regprocedure(
       'public.get_public_track_provenance_v1(uuid)'
     ) is not null
  then
    raise exception
      'STOP: provenance Slice 2 creator/public authority already exists; audit before reapplying';
  end if;
end
$preflight$;

create table platform_private.registry_contribution_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  parent_attestation_id uuid not null
    references platform_private.registry_contribution_attestations(id)
    on update restrict
    on delete restrict,
  inviter_user_id uuid not null,
  inviter_person_resource_id uuid not null
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  invitee_person_resource_id uuid
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  invitee_credited_as text,
  track_id uuid
    references public.registry_tracks(id)
    on update restrict
    on delete restrict,
  work_id uuid
    references public.registry_works(id)
    on update restrict
    on delete restrict,
  role_key text not null,
  instrument_key text,
  detail_text text,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint registry_contribution_invitations_subject_check
    check (num_nonnulls(track_id,work_id)=1),

  constraint registry_contribution_invitations_invitee_check
    check (
      invitee_person_resource_id is not null
      or (
        invitee_credited_as is not null
        and btrim(invitee_credited_as)<>''
        and octet_length(invitee_credited_as)<=1000
      )
    ),

  constraint registry_contribution_invitations_role_check
    check (
      (
        track_id is not null
        and work_id is null
        and role_key = any(array[
          'primary_performer'::text,
          'featured_performer'::text,
          'performer'::text,
          'producer'::text,
          'recording_engineer'::text,
          'mixing_engineer'::text,
          'mastering_engineer'::text,
          'session_musician'::text,
          'conductor'::text,
          'vocalist'::text,
          'instrumentalist'::text,
          'other_reviewed'::text
        ])
      )
      or
      (
        work_id is not null
        and track_id is null
        and instrument_key is null
        and role_key = any(array[
          'composer'::text,
          'lyricist'::text,
          'songwriter'::text,
          'arranger'::text,
          'adaptor'::text,
          'translator'::text,
          'publisher_representative'::text,
          'other_reviewed'::text
        ])
      )
    ),

  constraint registry_contribution_invitations_instrument_check
    check (
      instrument_key is null
      or (
        track_id is not null
        and instrument_key=lower(instrument_key)
        and instrument_key ~ '^[a-z0-9][a-z0-9_.:-]{1,79}$'
      )
    ),

  constraint registry_contribution_invitations_detail_check
    check (
      detail_text is null
      or (
        btrim(detail_text)<>''
        and octet_length(detail_text)<=2000
      )
    ),

  constraint registry_contribution_invitations_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),

  constraint registry_contribution_invitations_expiry_check
    check (expires_at>created_at)
);

comment on table platform_private.registry_contribution_invitations is
  'Immutable inviter-mediated contribution confirmation context. Raw bearer tokens are never stored; WAKILISHA performs no cold automated outreach from this table.';

create index registry_contribution_invitations_parent_idx
  on platform_private.registry_contribution_invitations(
    parent_attestation_id,
    created_at desc
  );

create index registry_contribution_invitations_inviter_idx
  on platform_private.registry_contribution_invitations(
    inviter_person_resource_id,
    created_at desc
  );

create index registry_contribution_invitations_invitee_idx
  on platform_private.registry_contribution_invitations(
    invitee_person_resource_id,
    created_at desc
  )
  where invitee_person_resource_id is not null;

create table platform_private.registry_contribution_invitation_events (
  id uuid primary key default extensions.gen_random_uuid(),
  event_sequence bigint generated always as identity unique,
  invitation_id uuid not null
    references platform_private.registry_contribution_invitations(id)
    on update restrict
    on delete restrict,
  event_kind text not null,
  actor_user_id uuid,
  actor_person_resource_id uuid
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  resolved_user_id uuid,
  resolved_person_resource_id uuid
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  response_mode text,
  response_attestation_id uuid
    references platform_private.registry_contribution_attestations(id)
    on update restrict
    on delete restrict,
  reason text,
  created_at timestamptz not null default now(),

  constraint registry_contribution_invitation_events_kind_check
    check (
      event_kind in (
        'created',
        'accepted',
        'disputed',
        'declined',
        'revoked'
      )
    ),

  constraint registry_contribution_invitation_events_response_check
    check (
      (
        event_kind in ('accepted','disputed','declined')
        and response_mode is not null
        and response_mode=event_kind
        and resolved_user_id is not null
        and resolved_person_resource_id is not null
        and (
          (
            event_kind in ('accepted','disputed')
            and response_attestation_id is not null
          )
          or
          (
            event_kind='declined'
            and response_attestation_id is null
          )
        )
      )
      or
      (
        event_kind in ('created','revoked')
        and response_mode is null
        and response_attestation_id is null
      )
    ),

  constraint registry_contribution_invitation_events_reason_check
    check (
      reason is null
      or (
        btrim(reason)<>''
        and octet_length(reason)<=4000
      )
    )
);

comment on table platform_private.registry_contribution_invitation_events is
  'Append-only invitation lifecycle and authenticated response history.';

create index registry_contribution_invitation_events_invitation_idx
  on platform_private.registry_contribution_invitation_events(
    invitation_id,
    event_sequence desc
  );

create unique index registry_contribution_invitation_events_one_created
  on platform_private.registry_contribution_invitation_events(invitation_id)
  where event_kind='created';

create unique index registry_contribution_invitation_events_one_terminal
  on platform_private.registry_contribution_invitation_events(invitation_id)
  where event_kind in ('accepted','disputed','declined','revoked');

create trigger registry_contribution_invitations_append_only
before update or delete
on platform_private.registry_contribution_invitations
for each row
execute function platform_private.reject_registry_provenance_history_mutation_v1();

create trigger registry_contribution_invitation_events_append_only
before update or delete
on platform_private.registry_contribution_invitation_events
for each row
execute function platform_private.reject_registry_provenance_history_mutation_v1();

revoke all on table
  platform_private.registry_contribution_invitations,
  platform_private.registry_contribution_invitation_events
from public,anon,authenticated,service_role;

create function platform_private.registry_music_role_label_v1(
  p_role_key text
)
returns text
language sql
immutable
set search_path=pg_catalog
as $$
  select case p_role_key
    when 'primary_performer' then 'Primary performer'
    when 'featured_performer' then 'Featured performer'
    when 'performer' then 'Performer'
    when 'producer' then 'Producer'
    when 'recording_engineer' then 'Recording engineer'
    when 'mixing_engineer' then 'Mixing engineer'
    when 'mastering_engineer' then 'Mastering engineer'
    when 'session_musician' then 'Session musician'
    when 'conductor' then 'Conductor'
    when 'vocalist' then 'Vocalist'
    when 'instrumentalist' then 'Instrumentalist'
    when 'composer' then 'Composer'
    when 'lyricist' then 'Lyricist'
    when 'songwriter' then 'Songwriter'
    when 'arranger' then 'Arranger'
    when 'adaptor' then 'Adaptor'
    when 'translator' then 'Translator'
    when 'publisher_representative' then 'Publisher representative'
    when 'member' then 'Member'
    when 'founder' then 'Founder'
    when 'lead' then 'Lead'
    when 'director' then 'Director'
    else 'Contributor'
  end
$$;

create function platform_private.registry_music_current_creator_v1()
returns table (
  user_id uuid,
  person_resource_id uuid
)
language plpgsql
stable
security definer
set search_path=pg_catalog,auth,messaging
as $$
declare
  v_identity record;
begin
  select *
  into v_identity
  from messaging.current_human_identity();

  user_id:=v_identity.user_id;
  person_resource_id:=v_identity.person_resource_id;
  return next;
end
$$;

create function platform_private.registry_contribution_invitation_state_v1(
  p_invitation_id uuid
)
returns text
language sql
stable
security definer
set search_path=pg_catalog,platform_private
as $$
  select coalesce(
    (
      select event.event_kind
      from platform_private.registry_contribution_invitation_events event
      where event.invitation_id=p_invitation_id
        and event.event_kind in (
          'accepted','disputed','declined','revoked'
        )
      order by event.event_sequence desc
      limit 1
    ),
    (
      select case
        when invitation.expires_at<=now() then 'expired'
        else 'pending'
      end
      from platform_private.registry_contribution_invitations invitation
      where invitation.id=p_invitation_id
    )
  )
$$;

create function platform_private.registry_public_contributor_presentation_v1(
  p_person_resource_id uuid,
  p_organization_resource_id uuid,
  p_artist_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,editorial
as $$
declare
  v_presentation jsonb;
  v_path text;
  v_name text;
  v_slug text;
begin
  if p_person_resource_id is not null
     and exists (
       select 1
       from editorial.people person
       join editorial.resources resource
         on resource.id=person.resource_id
        and resource.resource_kind='person'
        and resource.lifecycle_state='active'
        and resource.visibility='public'
       where person.resource_id=p_person_resource_id
         and person.person_state='active'
     )
  then
    v_presentation:=
      editorial.resolve_person_presentation(p_person_resource_id);

    select alias.path
    into v_path
    from editorial.resource_aliases alias
    where alias.resource_id=p_person_resource_id
      and alias.is_canonical
      and alias.retired_at is null
    order by alias.created_at
    limit 1;

    if v_presentation is not null
       and nullif(btrim(v_presentation->>'display_name'),'') is not null
    then
      return jsonb_build_object(
        'kind','person',
        'id',p_person_resource_id,
        'name',v_presentation->>'display_name',
        'path',v_path
      );
    end if;
  end if;

  if p_artist_id is not null then
    select artist.display_name,artist.slug
    into v_name,v_slug
    from public.registry_artists artist
    where artist.id=p_artist_id
      and artist.status='active';

    if v_name is not null and v_slug is not null then
      return jsonb_build_object(
        'kind','artist',
        'id',p_artist_id,
        'name',v_name,
        'path','/artists/'||v_slug
      );
    end if;
  end if;

  if p_organization_resource_id is not null then
    select
      organization.display_name,
      alias.path
    into
      v_name,
      v_path
    from editorial.organizations organization
    join editorial.resources resource
      on resource.id=organization.resource_id
     and resource.resource_kind='organization'
     and resource.lifecycle_state='active'
     and resource.visibility='public'
    left join editorial.resource_aliases alias
      on alias.resource_id=organization.resource_id
     and alias.is_canonical
     and alias.retired_at is null
    where organization.resource_id=p_organization_resource_id
      and organization.organization_state='active'
    order by alias.created_at
    limit 1;

    if v_name is not null then
      return jsonb_build_object(
        'kind','organization',
        'id',p_organization_resource_id,
        'name',v_name,
        'path',v_path
      );
    end if;
  end if;

  return null;
end
$$;

create function platform_private.registry_music_subject_presentation_v1(
  p_track_id uuid,
  p_work_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public
as $$
declare
  v_title text;
  v_artwork_url text;
  v_track_slug text;
  v_artist_slug text;
  v_path text;
begin
  if num_nonnulls(p_track_id,p_work_id)<>1 then
    return null;
  end if;

  if p_track_id is not null then
    select track.title,track.artwork_url,track.slug
    into v_title,v_artwork_url,v_track_slug
    from public.registry_tracks track
    where track.id=p_track_id
      and track.status='active';

    if v_title is null then
      return null;
    end if;

    select credit.artist_slug
    into v_artist_slug
    from public.registry_track_artists credit
    where credit.track_id=p_track_id
      and credit.is_primary
      and credit.status='active'
      and nullif(btrim(credit.artist_slug),'') is not null
    order by credit.credit_order,credit.artist_id
    limit 1;

    if v_artist_slug is not null and v_track_slug is not null then
      v_path:='/tracks/'||v_artist_slug||'/'||v_track_slug;
    end if;

    return jsonb_build_object(
      'kind','track',
      'id',p_track_id,
      'title',v_title,
      'artworkUrl',coalesce(v_artwork_url,''),
      'path',v_path
    );
  end if;

  select work.title
  into v_title
  from public.registry_works work
  where work.id=p_work_id
    and work.status<>'archived';

  if v_title is null then
    return null;
  end if;

  select
    track.slug,
    credit.artist_slug
  into
    v_track_slug,
    v_artist_slug
  from public.registry_track_work_links link
  join public.registry_tracks track
    on track.id=link.track_id
   and track.status='active'
  join public.registry_track_artists credit
    on credit.track_id=track.id
   and credit.is_primary
   and credit.status='active'
  where link.work_id=p_work_id
    and link.status='verified'
    and link.superseded_by_link_id is null
    and (link.valid_to is null or link.valid_to>now())
  order by
    coalesce(credit.credit_order,2147483647),
    link.created_at,
    track.id
  limit 1;

  if v_artist_slug is not null and v_track_slug is not null then
    v_path:='/tracks/'||v_artist_slug||'/'||v_track_slug;
  end if;

  return jsonb_build_object(
    'kind','work',
    'id',p_work_id,
    'title',v_title,
    'path',v_path
  );
end
$$;

revoke all on function
  platform_private.registry_music_role_label_v1(text),
  platform_private.registry_music_current_creator_v1(),
  platform_private.registry_contribution_invitation_state_v1(uuid),
  platform_private.registry_public_contributor_presentation_v1(uuid,uuid,uuid),
  platform_private.registry_music_subject_presentation_v1(uuid,uuid)
from public,anon,authenticated,service_role;

create function public.search_music_credit_people_v1(
  p_query text,
  p_limit integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,editorial,platform_private
as $$
declare
  v_actor record;
  v_query text;
  v_limit integer;
  v_result jsonb;
begin
  select *
  into v_actor
  from platform_private.registry_music_current_creator_v1();

  v_query:=lower(btrim(coalesce(p_query,'')));
  v_limit:=least(greatest(coalesce(p_limit,8),1),8);

  if char_length(v_query)<2 then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(candidate.payload order by candidate.rank_key,candidate.name),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      lower(presentation.value->>'display_name') as name,
      case
        when lower(presentation.value->>'display_name')=v_query then 0
        when lower(presentation.value->>'display_name') like v_query||'%' then 1
        else 2
      end as rank_key,
      jsonb_build_object(
        'personId',person.resource_id,
        'name',presentation.value->>'display_name',
        'path',alias.path
      ) as payload
    from editorial.people person
    join editorial.resources resource
      on resource.id=person.resource_id
     and resource.resource_kind='person'
     and resource.lifecycle_state='active'
     and resource.visibility='public'
    join lateral (
      select editorial.resolve_person_presentation(person.resource_id) as value
    ) presentation
      on presentation.value is not null
    join lateral (
      select resource_alias.path
      from editorial.resource_aliases resource_alias
      where resource_alias.resource_id=person.resource_id
        and resource_alias.is_canonical
        and resource_alias.retired_at is null
      order by resource_alias.created_at
      limit 1
    ) alias on true
    where person.person_state='active'
      and lower(presentation.value->>'display_name') like '%'||v_query||'%'
    order by rank_key,name
    limit v_limit
  ) candidate;

  return v_result;
end
$$;

revoke all on function public.search_music_credit_people_v1(text,integer)
from public,anon,service_role;

grant execute on function public.search_music_credit_people_v1(text,integer)
to authenticated;

create function public.create_my_music_credit_attestation_v1(
  p_subject_kind text,
  p_subject_id uuid,
  p_role_key text,
  p_instrument_key text default null,
  p_detail_text text default null,
  p_credited_as text default null,
  p_proposed_person_resource_id uuid default null,
  p_proposed_artist_id uuid default null,
  p_elicitation_method text default 'open_response',
  p_candidate_shown_payload jsonb default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial,platform_private,extensions
as $$
declare
  v_actor record;
  v_attestation_id uuid:=extensions.gen_random_uuid();
  v_evidence_id uuid:=extensions.gen_random_uuid();
  v_subject_type text;
  v_claim_key text;
  v_track_id uuid;
  v_work_id uuid;
  v_person_id uuid;
  v_artist_id uuid:=p_proposed_artist_id;
  v_credited_as text:=nullif(btrim(coalesce(p_credited_as,'')),'');
  v_instrument text:=nullif(lower(btrim(coalesce(p_instrument_key,''))),'');
  v_detail text:=nullif(btrim(coalesce(p_detail_text,'')),'');
  v_source_ref text;
  v_claim jsonb;
  v_payload_fingerprint text;
  v_assertion_fingerprint text;
  v_existing_evidence platform_private.registry_evidence_assertions%rowtype;
  v_existing_attestation platform_private.registry_contribution_attestations%rowtype;
begin
  select *
  into v_actor
  from platform_private.registry_music_current_creator_v1();

  if p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception using errcode='22023',
      message='A valid idempotency key is required.';
  end if;

  if p_subject_id is null
     or p_subject_kind not in ('track','work')
     or p_elicitation_method not in (
       'open_response','self_claim','suggested_confirmation'
     )
  then
    raise exception using errcode='22023',
      message='Valid Track/Work subject and creator elicitation mode are required.';
  end if;

  if p_elicitation_method='suggested_confirmation' then
    if p_candidate_shown_payload is null
       or jsonb_typeof(p_candidate_shown_payload)<>'object'
       or octet_length(p_candidate_shown_payload::text)>8192
    then
      raise exception using errcode='22023',
        message='Suggested confirmation requires the exact bounded candidate shown.';
    end if;
  elsif p_candidate_shown_payload is not null then
    raise exception using errcode='22023',
      message='Open/self claims must not receive a hidden suggested candidate.';
  end if;

  if p_subject_kind='track' then
    perform 1
    from public.registry_tracks track
    where track.id=p_subject_id
      and track.status<>'archived';

    if not found then
      raise exception using errcode='P0002',
        message='Track is missing or archived.';
    end if;

    v_subject_type:='track';
    v_claim_key:='registry.track.contribution_attestation';
    v_track_id:=p_subject_id;
  else
    perform 1
    from public.registry_works work
    where work.id=p_subject_id
      and work.status<>'archived';

    if not found then
      raise exception using errcode='P0002',
        message='Work is missing or archived.';
    end if;

    v_subject_type:='work';
    v_claim_key:='registry.work.contribution_attestation';
    v_work_id:=p_subject_id;
    v_instrument:=null;
  end if;

  if p_elicitation_method='self_claim' then
    if p_proposed_person_resource_id is not null
       and p_proposed_person_resource_id<>v_actor.person_resource_id
    then
      raise exception using errcode='42501',
        message='A self-claim cannot identify another Person.';
    end if;

    v_person_id:=v_actor.person_resource_id;
  else
    v_person_id:=p_proposed_person_resource_id;
  end if;

  if v_person_id is not null then
    perform 1
    from editorial.people person
    join editorial.resources resource
      on resource.id=person.resource_id
     and resource.resource_kind='person'
    where person.resource_id=v_person_id
      and person.person_state='active'
      and (
        v_person_id=v_actor.person_resource_id
        or (
          resource.lifecycle_state='active'
          and resource.visibility='public'
        )
      );

    if not found then
      raise exception using errcode='P0002',
        message='Selected Person is unavailable for creator credit selection.';
    end if;
  end if;

  if v_artist_id is not null then
    if v_person_id is null
       or not exists (
         select 1
         from editorial.person_registry_artist_links link
         where link.person_resource_id=v_person_id
           and link.registry_artist_id=v_artist_id
           and link.link_state='active'
       )
    then
      raise exception using errcode='42501',
        message='Selected Artist persona is not an active governed persona of the selected Person.';
    end if;
  end if;

  if v_person_id is null
     and v_artist_id is null
     and v_credited_as is null
  then
    raise exception using errcode='22023',
      message='A Person, governed Artist persona, or unresolved credited-as value is required.';
  end if;

  v_claim:=jsonb_strip_nulls(
    jsonb_build_object(
      'subject_kind',p_subject_kind,
      'subject_id',p_subject_id::text,
      'proposed_person_resource_id',v_person_id::text,
      'proposed_artist_id',v_artist_id::text,
      'credited_as',v_credited_as,
      'role_key',p_role_key,
      'instrument_key',v_instrument,
      'detail_text',v_detail,
      'elicitation_method',p_elicitation_method,
      'candidate_shown_payload',p_candidate_shown_payload
    )
  );

  v_payload_fingerprint:=encode(
    extensions.digest(
      pg_catalog.convert_to(v_claim::text,'UTF8'),
      'sha256'
    ),
    'hex'
  );

  v_source_ref:=
    'creator-credit:'||
    v_actor.user_id::text||':'||
    p_idempotency_key;

  select assertion.*
  into v_existing_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.source_kind='creator_attestation'
    and assertion.source_ref=v_source_ref
    and assertion.recorded_by_principal_key=
        'user:'||v_actor.user_id::text
  order by assertion.created_at
  limit 1;

  if found then
    if v_existing_evidence.source_payload_fingerprint<>
       v_payload_fingerprint
    then
      raise exception using errcode='23505',
        message='Idempotency key is already bound to a different creator attestation.';
    end if;

    select attestation.*
    into v_existing_attestation
    from platform_private.registry_contribution_attestations attestation
    where attestation.evidence_assertion_id=v_existing_evidence.id;

    if not found then
      raise exception using errcode='55000',
        message='Creator evidence exists without its attestation.';
    end if;

    return jsonb_build_object(
      'attestationId',v_existing_attestation.id,
      'state',
        platform_private.registry_contribution_attestation_current_state_v1(
          v_existing_attestation.id
        ),
      'idempotentReplay',true
    );
  end if;

  v_assertion_fingerprint:=encode(
    extensions.digest(
      pg_catalog.convert_to(
        jsonb_build_object(
          'subject_type',v_subject_type,
          'subject_id',p_subject_id,
          'claim_key',v_claim_key,
          'source_ref',v_source_ref,
          'source_payload_fingerprint',v_payload_fingerprint
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into platform_private.registry_evidence_assertions (
    id,
    subject_type,
    subject_id,
    claim_key,
    claim_payload,
    trust_class,
    source_kind,
    source_ref,
    source_payload_fingerprint,
    observed_at,
    recorded_by_principal_key,
    assertion_fingerprint,
    originator_ref,
    lineage_key,
    verification_method,
    source_use_basis
  )
  values (
    v_evidence_id,
    v_subject_type,
    p_subject_id,
    v_claim_key,
    v_claim,
    'USER_CONTENT',
    'creator_attestation',
    v_source_ref,
    v_payload_fingerprint,
    now(),
    'user:'||v_actor.user_id::text,
    v_assertion_fingerprint,
    'user:'||v_actor.user_id::text,
    'creator-attestation:'||v_attestation_id::text,
    p_elicitation_method,
    'first_party_attestation'
  );

  insert into platform_private.registry_contribution_attestations (
    id,
    evidence_assertion_id,
    track_id,
    work_id,
    proposed_person_resource_id,
    proposed_artist_id,
    credited_as,
    role_key,
    instrument_key,
    detail_text,
    asserting_user_id,
    asserting_person_resource_id,
    asserting_artist_id,
    representation_context,
    elicitation_method,
    prompt_key,
    prompt_version,
    candidate_shown,
    candidate_shown_payload
  )
  values (
    v_attestation_id,
    v_evidence_id,
    v_track_id,
    v_work_id,
    v_person_id,
    v_artist_id,
    v_credited_as,
    p_role_key,
    v_instrument,
    v_detail,
    v_actor.user_id,
    v_actor.person_resource_id,
    case
      when exists (
        select 1
        from editorial.person_registry_artist_links link
        where link.person_resource_id=v_actor.person_resource_id
          and link.registry_artist_id=v_artist_id
          and link.link_state='active'
      )
      then v_artist_id
      else null
    end,
    jsonb_build_object(
      'creator_person_resource_id',v_actor.person_resource_id
    ),
    p_elicitation_method,
    case
      when p_elicitation_method='self_claim'
        then 'credits.self_claim'
      when p_elicitation_method='suggested_confirmation'
        then 'credits.suggested_confirmation'
      else 'credits.open_response'
    end,
    'slice2-v1',
    p_elicitation_method='suggested_confirmation',
    p_candidate_shown_payload
  );

  insert into platform_private.registry_contribution_attestation_state_events (
    attestation_id,
    state,
    actor_principal_key,
    actor_user_id,
    reason
  )
  values (
    v_attestation_id,
    'asserted',
    'user:'||v_actor.user_id::text,
    v_actor.user_id,
    'Creator attestation submitted.'
  );

  return jsonb_build_object(
    'attestationId',v_attestation_id,
    'state','asserted',
    'idempotentReplay',false
  );
end
$$;

revoke all on function public.create_my_music_credit_attestation_v1(
  text,uuid,text,text,text,text,uuid,uuid,text,jsonb,text
)
from public,anon,service_role;

grant execute on function public.create_my_music_credit_attestation_v1(
  text,uuid,text,text,text,text,uuid,uuid,text,jsonb,text
)
to authenticated;

create function public.set_my_music_credit_permission_v1(
  p_attestation_id uuid,
  p_public_display boolean,
  p_cmo_rights_contexts text[] default '{}'::text[],
  p_approved_partner_keys text[] default '{}'::text[],
  p_third_party_commercial_reuse boolean default false,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,platform_private
as $$
declare
  v_actor record;
  v_attestation platform_private.registry_contribution_attestations%rowtype;
  v_previous platform_private.registry_contribution_attestation_permission_versions%rowtype;
  v_new platform_private.registry_contribution_attestation_permission_versions%rowtype;
  v_kind text;
begin
  select *
  into v_actor
  from platform_private.registry_music_current_creator_v1();

  select attestation.*
  into v_attestation
  from platform_private.registry_contribution_attestations attestation
  where attestation.id=p_attestation_id
    and attestation.asserting_user_id=v_actor.user_id
    and attestation.asserting_person_resource_id=v_actor.person_resource_id;

  if not found then
    raise exception using errcode='42501',
      message='Only the creator who made this attestation can manage its sharing permissions.';
  end if;

  select permission.*
  into v_previous
  from platform_private.registry_contribution_attestation_permission_versions permission
  where permission.attestation_id=p_attestation_id
  order by permission.event_sequence desc
  limit 1;

  if not coalesce(p_public_display,false)
     and cardinality(coalesce(p_cmo_rights_contexts,'{}'::text[]))=0
     and cardinality(coalesce(p_approved_partner_keys,'{}'::text[]))=0
     and not coalesce(p_third_party_commercial_reuse,false)
  then
    v_kind:='withdraw';
  elsif v_previous.id is null then
    v_kind:='grant';
  else
    v_kind:='replace';
  end if;

  insert into platform_private.registry_contribution_attestation_permission_versions (
    attestation_id,
    supersedes_permission_id,
    change_kind,
    policy_key,
    policy_version,
    public_display,
    cmo_rights_contexts,
    approved_partner_keys,
    third_party_commercial_reuse,
    actor_user_id,
    actor_person_resource_id,
    reason
  )
  values (
    p_attestation_id,
    v_previous.id,
    v_kind,
    'music_provenance_creator_sharing',
    'slice2-v1',
    coalesce(p_public_display,false),
    coalesce(p_cmo_rights_contexts,'{}'::text[]),
    coalesce(p_approved_partner_keys,'{}'::text[]),
    coalesce(p_third_party_commercial_reuse,false),
    v_actor.user_id,
    v_actor.person_resource_id,
    nullif(btrim(coalesce(p_reason,'')),'')
  )
  returning * into v_new;

  return jsonb_build_object(
    'permissionId',v_new.id,
    'attestationId',p_attestation_id,
    'changeKind',v_new.change_kind,
    'publicDisplay',v_new.public_display,
    'cmoRightsContexts',v_new.cmo_rights_contexts,
    'approvedPartnerKeys',v_new.approved_partner_keys,
    'thirdPartyCommercialReuse',v_new.third_party_commercial_reuse
  );
end
$$;

revoke all on function public.set_my_music_credit_permission_v1(
  uuid,boolean,text[],text[],boolean,text
)
from public,anon,service_role;

grant execute on function public.set_my_music_credit_permission_v1(
  uuid,boolean,text[],text[],boolean,text
)
to authenticated;

create function public.transition_my_music_credit_attestation_v1(
  p_attestation_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,platform_private
as $$
declare
  v_actor record;
  v_attestation platform_private.registry_contribution_attestations%rowtype;
  v_state text;
  v_previous_permission platform_private.registry_contribution_attestation_permission_versions%rowtype;
begin
  select *
  into v_actor
  from platform_private.registry_music_current_creator_v1();

  select attestation.*
  into v_attestation
  from platform_private.registry_contribution_attestations attestation
  where attestation.id=p_attestation_id
    and attestation.asserting_user_id=v_actor.user_id
    and attestation.asserting_person_resource_id=v_actor.person_resource_id
  for update;

  if not found then
    raise exception using errcode='42501',
      message='Only the creator who made this attestation can change it.';
  end if;

  if p_action not in ('withdrawn','disputed') then
    raise exception using errcode='22023',
      message='Creator attestation action must be withdrawn or disputed.';
  end if;

  v_state:=
    platform_private.registry_contribution_attestation_current_state_v1(
      p_attestation_id
    );

  if v_state in ('withdrawn','superseded') then
    return jsonb_build_object(
      'attestationId',p_attestation_id,
      'state',v_state,
      'idempotentReplay',v_state=p_action
    );
  end if;

  if v_state=p_action then
    return jsonb_build_object(
      'attestationId',p_attestation_id,
      'state',v_state,
      'idempotentReplay',true
    );
  end if;

  insert into platform_private.registry_contribution_attestation_state_events (
    attestation_id,
    state,
    actor_principal_key,
    actor_user_id,
    reason
  )
  values (
    p_attestation_id,
    p_action,
    'user:'||v_actor.user_id::text,
    v_actor.user_id,
    nullif(btrim(coalesce(p_reason,'')),'')
  );

  if p_action='withdrawn' then
    select permission.*
    into v_previous_permission
    from platform_private.registry_contribution_attestation_permission_versions permission
    where permission.attestation_id=p_attestation_id
    order by permission.event_sequence desc
    limit 1;

    if v_previous_permission.id is not null
       and (
         v_previous_permission.public_display
         or cardinality(v_previous_permission.cmo_rights_contexts)>0
         or cardinality(v_previous_permission.approved_partner_keys)>0
         or v_previous_permission.third_party_commercial_reuse
       )
    then
      insert into platform_private.registry_contribution_attestation_permission_versions (
        attestation_id,
        supersedes_permission_id,
        change_kind,
        policy_key,
        policy_version,
        public_display,
        cmo_rights_contexts,
        approved_partner_keys,
        third_party_commercial_reuse,
        actor_user_id,
        actor_person_resource_id,
        reason
      )
      values (
        p_attestation_id,
        v_previous_permission.id,
        'withdraw',
        'music_provenance_creator_sharing',
        'slice2-v1',
        false,
        '{}'::text[],
        '{}'::text[],
        false,
        v_actor.user_id,
        v_actor.person_resource_id,
        coalesce(
          nullif(btrim(coalesce(p_reason,'')),''),
          'Attestation withdrawn by creator.'
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'attestationId',p_attestation_id,
    'state',p_action,
    'idempotentReplay',false
  );
end
$$;

revoke all on function public.transition_my_music_credit_attestation_v1(
  uuid,text,text
)
from public,anon,service_role;

grant execute on function public.transition_my_music_credit_attestation_v1(
  uuid,text,text
)
to authenticated;

create function public.create_music_credit_invitation_v1(
  p_parent_attestation_id uuid,
  p_invitee_person_resource_id uuid default null,
  p_invitee_credited_as text default null,
  p_expires_in_days integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private,extensions
as $$
declare
  v_actor record;
  v_parent platform_private.registry_contribution_attestations%rowtype;
  v_parent_state text;
  v_invitation_id uuid:=extensions.gen_random_uuid();
  v_raw_token text;
  v_token_hash text;
  v_invitee_name text:=nullif(btrim(coalesce(p_invitee_credited_as,'')),'');
  v_recipient_user_id uuid;
  v_notification_rows integer:=0;
  v_notified boolean:=false;
begin
  select *
  into v_actor
  from platform_private.registry_music_current_creator_v1();

  if p_expires_in_days<1 or p_expires_in_days>30 then
    raise exception using errcode='22023',
      message='Credit invitation expiry must be between 1 and 30 days.';
  end if;

  select attestation.*
  into v_parent
  from platform_private.registry_contribution_attestations attestation
  where attestation.id=p_parent_attestation_id
    and attestation.asserting_user_id=v_actor.user_id
    and attestation.asserting_person_resource_id=v_actor.person_resource_id;

  if not found then
    raise exception using errcode='42501',
      message='You can invite confirmation only for an attestation you made.';
  end if;

  v_parent_state:=
    platform_private.registry_contribution_attestation_current_state_v1(
      v_parent.id
    );

  if v_parent_state not in ('asserted','corroborated','confirmed') then
    raise exception using errcode='23514',
      message='Withdrawn, superseded, or disputed attestations cannot create new confirmation invites.';
  end if;

  if p_invitee_person_resource_id is null and v_invitee_name is null then
    raise exception using errcode='22023',
      message='Choose a Person or provide the unresolved credited name you intend to invite.';
  end if;

  if p_invitee_person_resource_id is not null then
    if p_invitee_person_resource_id=v_actor.person_resource_id then
      raise exception using errcode='42501',
        message='Counterparty confirmation cannot be sent to yourself.';
    end if;

    perform 1
    from editorial.people person
    join editorial.resources resource
      on resource.id=person.resource_id
     and resource.resource_kind='person'
     and resource.lifecycle_state='active'
     and resource.visibility='public'
    where person.resource_id=p_invitee_person_resource_id
      and person.person_state='active';

    if not found then
      raise exception using errcode='P0002',
        message='Invitee Person is unavailable for creator credit invitations.';
    end if;

    v_recipient_user_id:=
      messaging.active_user_for_person(p_invitee_person_resource_id);
  end if;

  v_raw_token:=
    'wkci_'||
    encode(extensions.gen_random_bytes(32),'hex');

  v_token_hash:=encode(
    extensions.digest(
      pg_catalog.convert_to(v_raw_token,'UTF8'),
      'sha256'
    ),
    'hex'
  );

  insert into platform_private.registry_contribution_invitations (
    id,
    parent_attestation_id,
    inviter_user_id,
    inviter_person_resource_id,
    invitee_person_resource_id,
    invitee_credited_as,
    track_id,
    work_id,
    role_key,
    instrument_key,
    detail_text,
    token_hash,
    expires_at
  )
  values (
    v_invitation_id,
    v_parent.id,
    v_actor.user_id,
    v_actor.person_resource_id,
    p_invitee_person_resource_id,
    v_invitee_name,
    v_parent.track_id,
    v_parent.work_id,
    v_parent.role_key,
    v_parent.instrument_key,
    v_parent.detail_text,
    v_token_hash,
    now()+(p_expires_in_days||' days')::interval
  );

  insert into platform_private.registry_contribution_invitation_events (
    invitation_id,
    event_kind,
    actor_user_id,
    actor_person_resource_id
  )
  values (
    v_invitation_id,
    'created',
    v_actor.user_id,
    v_actor.person_resource_id
  );

  if v_recipient_user_id is not null
     and v_recipient_user_id<>v_actor.user_id
  then
    insert into public.community_notifications (
      user_id,
      actor_id,
      notification_type,
      entity_type,
      entity_id,
      entity_slug,
      comment_id,
      metadata
    )
    select
      v_recipient_user_id,
      v_actor.user_id,
      'credit_confirmation_request',
      'music_credit_invite',
      v_invitation_id::text,
      null,
      null,
      jsonb_build_object(
        'canonical_path',
          '/credits/invite/'||v_invitation_id::text,
        'invitation_id',v_invitation_id,
        'subject_kind',
          case when v_parent.track_id is not null then 'track' else 'work' end,
        'role_key',v_parent.role_key
      )
    where not exists (
      select 1
      from public.community_notifications notification
      where notification.user_id=v_recipient_user_id
        and notification.notification_type='credit_confirmation_request'
        and notification.entity_type='music_credit_invite'
        and notification.entity_id=v_invitation_id::text
    );

    get diagnostics v_notification_rows = row_count;
    v_notified:=v_notification_rows=1;
  end if;

  return jsonb_build_object(
    'invitationId',v_invitation_id,
    'sharePath','/credits/invite/'||v_raw_token,
    'expiresAt',now()+(p_expires_in_days||' days')::interval,
    'notificationDelivered',v_notified,
    'deliveryMode',
      case
        when v_notified then 'existing_user_notification'
        else 'inviter_share_only'
      end
  );
end
$$;

revoke all on function public.create_music_credit_invitation_v1(
  uuid,uuid,text,integer
)
from public,anon,service_role;

grant execute on function public.create_music_credit_invitation_v1(
  uuid,uuid,text,integer
)
to authenticated;

create function public.revoke_my_music_credit_invitation_v1(
  p_invitation_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,platform_private
as $$
declare
  v_actor record;
  v_invitation platform_private.registry_contribution_invitations%rowtype;
  v_state text;
begin
  select *
  into v_actor
  from platform_private.registry_music_current_creator_v1();

  select invitation.*
  into v_invitation
  from platform_private.registry_contribution_invitations invitation
  where invitation.id=p_invitation_id
    and invitation.inviter_user_id=v_actor.user_id
    and invitation.inviter_person_resource_id=v_actor.person_resource_id
  for update;

  if not found then
    raise exception using errcode='42501',
      message='Only the inviter may revoke this credit invitation.';
  end if;

  v_state:=
    platform_private.registry_contribution_invitation_state_v1(
      p_invitation_id
    );

  if v_state='revoked' then
    return jsonb_build_object(
      'invitationId',p_invitation_id,
      'state','revoked',
      'idempotentReplay',true
    );
  end if;

  if v_state<>'pending' then
    raise exception using errcode='23514',
      message='Only a pending credit invitation can be revoked.';
  end if;

  insert into platform_private.registry_contribution_invitation_events (
    invitation_id,
    event_kind,
    actor_user_id,
    actor_person_resource_id,
    reason
  )
  values (
    p_invitation_id,
    'revoked',
    v_actor.user_id,
    v_actor.person_resource_id,
    nullif(btrim(coalesce(p_reason,'')),'')
  );

  return jsonb_build_object(
    'invitationId',p_invitation_id,
    'state','revoked',
    'idempotentReplay',false
  );
end
$$;

revoke all on function public.revoke_my_music_credit_invitation_v1(
  uuid,text
)
from public,anon,service_role;

grant execute on function public.revoke_my_music_credit_invitation_v1(
  uuid,text
)
to authenticated;

create function public.get_music_credit_invite_v1(
  p_invite_ref text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,auth,public,editorial,platform_private,extensions
as $$
declare
  v_ref text:=btrim(coalesce(p_invite_ref,''));
  v_invitation platform_private.registry_contribution_invitations%rowtype;
  v_actor record;
  v_has_actor boolean:=false;
  v_state text;
  v_subject jsonb;
  v_inviter jsonb;
  v_parent platform_private.registry_contribution_attestations%rowtype;
  v_uuid uuid;
  v_token_hash text;
  v_can_respond boolean:=false;
begin
  if v_ref='' then
    return null;
  end if;

  if v_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    if auth.uid() is null then
      return null;
    end if;

    select *
    into v_actor
    from platform_private.registry_music_current_creator_v1();

    v_has_actor:=true;
    v_uuid:=v_ref::uuid;

    select invitation.*
    into v_invitation
    from platform_private.registry_contribution_invitations invitation
    where invitation.id=v_uuid
      and invitation.invitee_person_resource_id=v_actor.person_resource_id;
  else
    v_token_hash:=encode(
      extensions.digest(
        pg_catalog.convert_to(v_ref,'UTF8'),
        'sha256'
      ),
      'hex'
    );

    select invitation.*
    into v_invitation
    from platform_private.registry_contribution_invitations invitation
    where invitation.token_hash=v_token_hash;

    if auth.uid() is not null then
      select *
      into v_actor
      from platform_private.registry_music_current_creator_v1();
      v_has_actor:=true;
    end if;
  end if;

  if v_invitation.id is null then
    return null;
  end if;

  select attestation.*
  into v_parent
  from platform_private.registry_contribution_attestations attestation
  where attestation.id=v_invitation.parent_attestation_id;

  v_state:=
    platform_private.registry_contribution_invitation_state_v1(
      v_invitation.id
    );

  v_subject:=
    platform_private.registry_music_subject_presentation_v1(
      v_invitation.track_id,
      v_invitation.work_id
    );

  v_inviter:=
    editorial.resolve_person_presentation(
      v_invitation.inviter_person_resource_id
    );

  v_can_respond:=
    v_has_actor
    and v_state='pending'
    and v_actor.user_id<>v_invitation.inviter_user_id
    and (
      v_invitation.invitee_person_resource_id is null
      or
      v_invitation.invitee_person_resource_id=v_actor.person_resource_id
    );

  return jsonb_build_object(
    'invitationId',v_invitation.id,
    'state',v_state,
    'expiresAt',v_invitation.expires_at,
    'subject',v_subject,
    'roleKey',v_invitation.role_key,
    'roleLabel',
      platform_private.registry_music_role_label_v1(
        v_invitation.role_key
      ),
    'instrument',v_invitation.instrument_key,
    'detail',v_invitation.detail_text,
    'inviteeName',
      coalesce(
        v_invitation.invitee_credited_as,
        case
          when v_invitation.invitee_person_resource_id is not null
          then (
            editorial.resolve_person_presentation(
              v_invitation.invitee_person_resource_id
            )->>'display_name'
          )
          else null
        end
      ),
    'inviter',
      jsonb_build_object(
        'name',coalesce(v_inviter->>'display_name','A WAKILISHA creator')
      ),
    'canRespond',v_can_respond,
    'requiresAuthentication',not v_has_actor,
    'responseMode','counterparty_confirmation'
  );
end
$$;

revoke all on function public.get_music_credit_invite_v1(text)
from public;

grant execute on function public.get_music_credit_invite_v1(text)
to anon,authenticated,service_role;

create function public.respond_music_credit_invitation_v1(
  p_invite_ref text,
  p_response_mode text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,platform_private,extensions
as $$
declare
  v_actor record;
  v_ref text:=btrim(coalesce(p_invite_ref,''));
  v_invitation platform_private.registry_contribution_invitations%rowtype;
  v_parent platform_private.registry_contribution_attestations%rowtype;
  v_parent_evidence platform_private.registry_evidence_assertions%rowtype;
  v_parent_state text;
  v_state text;
  v_token_hash text;
  v_uuid uuid;
  v_child_attestation_id uuid;
  v_child_evidence_id uuid;
  v_child_artist_id uuid;
  v_claim jsonb;
  v_payload_fingerprint text;
  v_assertion_fingerprint text;
begin
  select *
  into v_actor
  from platform_private.registry_music_current_creator_v1();

  if p_response_mode not in ('accepted','disputed','declined')
  then
    raise exception using errcode='22023',
      message='Invite response must be accepted, disputed, or declined.';
  end if;

  if v_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    v_uuid:=v_ref::uuid;

    select invitation.*
    into v_invitation
    from platform_private.registry_contribution_invitations invitation
    where invitation.id=v_uuid
      and invitation.invitee_person_resource_id=v_actor.person_resource_id
    for update;
  else
    v_token_hash:=encode(
      extensions.digest(
        pg_catalog.convert_to(v_ref,'UTF8'),
        'sha256'
      ),
      'hex'
    );

    select invitation.*
    into v_invitation
    from platform_private.registry_contribution_invitations invitation
    where invitation.token_hash=v_token_hash
    for update;
  end if;

  if not found then
    raise exception using errcode='P0002',
      message='Credit invitation is unavailable.';
  end if;

  if v_actor.user_id=v_invitation.inviter_user_id then
    raise exception using errcode='42501',
      message='An inviter cannot confirm their own counterparty claim.';
  end if;

  if v_invitation.invitee_person_resource_id is not null
     and v_invitation.invitee_person_resource_id<>v_actor.person_resource_id
  then
    raise exception using errcode='42501',
      message='This invitation is bound to another Person.';
  end if;

  v_state:=
    platform_private.registry_contribution_invitation_state_v1(
      v_invitation.id
    );

  if v_state<>'pending' then
    raise exception using errcode='23514',
      message='Credit invitation is no longer pending.';
  end if;

  select attestation.*
  into v_parent
  from platform_private.registry_contribution_attestations attestation
  where attestation.id=v_invitation.parent_attestation_id;

  select assertion.*
  into v_parent_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_parent.evidence_assertion_id;

  if p_response_mode='declined' then
    insert into platform_private.registry_contribution_invitation_events (
      invitation_id,
      event_kind,
      actor_user_id,
      actor_person_resource_id,
      resolved_user_id,
      resolved_person_resource_id,
      response_mode,
      reason
    )
    values (
      v_invitation.id,
      'declined',
      v_actor.user_id,
      v_actor.person_resource_id,
      v_actor.user_id,
      v_actor.person_resource_id,
      'declined',
      nullif(btrim(coalesce(p_reason,'')),'')
    );

  else
    v_child_attestation_id:=extensions.gen_random_uuid();
    v_child_evidence_id:=extensions.gen_random_uuid();

    if v_parent.proposed_artist_id is not null
       and exists (
         select 1
         from editorial.person_registry_artist_links link
         where link.person_resource_id=v_actor.person_resource_id
           and link.registry_artist_id=v_parent.proposed_artist_id
           and link.link_state='active'
       )
    then
      v_child_artist_id:=v_parent.proposed_artist_id;
    end if;

    v_claim:=jsonb_strip_nulls(
      jsonb_build_object(
        'attestation_id',v_child_attestation_id::text,
        'parent_attestation_id',v_parent.id::text,
        'invitation_id',v_invitation.id::text,
        'subject_kind',
          case when v_invitation.track_id is not null then 'track' else 'work' end,
        'subject_id',
          coalesce(v_invitation.track_id,v_invitation.work_id)::text,
        'proposed_person_resource_id',v_actor.person_resource_id::text,
        'proposed_artist_id',v_child_artist_id::text,
        'credited_as',v_invitation.invitee_credited_as,
        'role_key',v_invitation.role_key,
        'instrument_key',v_invitation.instrument_key,
        'detail_text',v_invitation.detail_text,
        'response_mode',p_response_mode
      )
    );

    v_payload_fingerprint:=encode(
      extensions.digest(
        pg_catalog.convert_to(v_claim::text,'UTF8'),
        'sha256'
      ),
      'hex'
    );

    v_assertion_fingerprint:=encode(
      extensions.digest(
        pg_catalog.convert_to(
          jsonb_build_object(
            'invitation_id',v_invitation.id,
            'responder_user_id',v_actor.user_id,
            'response_mode',p_response_mode,
            'payload_fingerprint',v_payload_fingerprint
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );

    insert into platform_private.registry_evidence_assertions (
      id,
      subject_type,
      subject_id,
      claim_key,
      claim_payload,
      trust_class,
      source_kind,
      source_ref,
      source_payload_fingerprint,
      observed_at,
      recorded_by_principal_key,
      assertion_fingerprint,
      parent_assertion_id,
      originator_ref,
      upstream_source_ref,
      lineage_key,
      verification_method,
      source_use_basis
    )
    values (
      v_child_evidence_id,
      case
        when v_invitation.track_id is not null then 'track'
        else 'work'
      end,
      coalesce(v_invitation.track_id,v_invitation.work_id),
      case
        when v_invitation.track_id is not null
          then 'registry.track.contribution_attestation'
        else 'registry.work.contribution_attestation'
      end,
      v_claim,
      'USER_CONTENT',
      'counterparty_confirmation',
      'credit-invite:'||v_invitation.id::text,
      v_payload_fingerprint,
      now(),
      'user:'||v_actor.user_id::text,
      v_assertion_fingerprint,
      v_parent_evidence.id,
      'user:'||v_actor.user_id::text,
      'credit-invite:'||v_invitation.id::text,
      'credit-invite:'||v_invitation.id::text,
      'counterparty_confirmation',
      'first_party_attestation'
    );

    insert into platform_private.registry_contribution_attestations (
      id,
      evidence_assertion_id,
      track_id,
      work_id,
      proposed_person_resource_id,
      proposed_artist_id,
      credited_as,
      role_key,
      instrument_key,
      detail_text,
      asserting_user_id,
      asserting_person_resource_id,
      asserting_artist_id,
      stated_relationship,
      inviter_user_id,
      parent_attestation_id,
      representation_context,
      elicitation_method,
      prompt_key,
      prompt_version,
      candidate_shown,
      candidate_shown_payload
    )
    values (
      v_child_attestation_id,
      v_child_evidence_id,
      v_invitation.track_id,
      v_invitation.work_id,
      v_actor.person_resource_id,
      v_child_artist_id,
      v_invitation.invitee_credited_as,
      v_invitation.role_key,
      v_invitation.instrument_key,
      v_invitation.detail_text,
      v_actor.user_id,
      v_actor.person_resource_id,
      v_child_artist_id,
      'invited_counterparty',
      v_invitation.inviter_user_id,
      v_parent.id,
      jsonb_build_object(
        'invitation_id',v_invitation.id,
        'resolved_from_invite',true
      ),
      'counterparty_confirmation',
      'credits.counterparty_confirmation',
      'slice2-v1',
      true,
      jsonb_strip_nulls(
        jsonb_build_object(
          'parent_attestation_id',v_parent.id,
          'credited_as',v_parent.credited_as,
          'role_key',v_parent.role_key,
          'instrument_key',v_parent.instrument_key,
          'detail_text',v_parent.detail_text,
          'proposed_person_resource_id',v_parent.proposed_person_resource_id,
          'proposed_artist_id',v_parent.proposed_artist_id
        )
      )
    );

    insert into platform_private.registry_contribution_attestation_state_events (
      attestation_id,
      state,
      actor_principal_key,
      actor_user_id,
      reason
    )
    values (
      v_child_attestation_id,
      'asserted',
      'user:'||v_actor.user_id::text,
      v_actor.user_id,
      'Counterparty response received.'
    );

    insert into platform_private.registry_contribution_attestation_state_events (
      attestation_id,
      state,
      supporting_evidence_assertion_id,
      actor_principal_key,
      actor_user_id,
      reason
    )
    values (
      v_child_attestation_id,
      case
        when p_response_mode='accepted' then 'confirmed'
        else 'disputed'
      end,
      v_child_evidence_id,
      'user:'||v_actor.user_id::text,
      v_actor.user_id,
      nullif(btrim(coalesce(p_reason,'')),'')
    );

    insert into platform_private.registry_contribution_invitation_events (
      invitation_id,
      event_kind,
      actor_user_id,
      actor_person_resource_id,
      resolved_user_id,
      resolved_person_resource_id,
      response_mode,
      response_attestation_id,
      reason
    )
    values (
      v_invitation.id,
      p_response_mode,
      v_actor.user_id,
      v_actor.person_resource_id,
      v_actor.user_id,
      v_actor.person_resource_id,
      p_response_mode,
      v_child_attestation_id,
      nullif(btrim(coalesce(p_reason,'')),'')
    );

    v_parent_state:=
      platform_private.registry_contribution_attestation_current_state_v1(
        v_parent.id
      );

    if p_response_mode='accepted'
       and v_parent_state in ('asserted','corroborated')
    then
      insert into platform_private.registry_contribution_attestation_state_events (
        attestation_id,
        state,
        supporting_evidence_assertion_id,
        actor_principal_key,
        actor_user_id,
        reason
      )
      values (
        v_parent.id,
        'corroborated',
        v_child_evidence_id,
        'user:'||v_actor.user_id::text,
        v_actor.user_id,
        'Invited counterparty confirmed this claim.'
      );
    elsif p_response_mode='disputed'
       and v_parent_state not in ('withdrawn','superseded')
    then
      insert into platform_private.registry_contribution_attestation_state_events (
        attestation_id,
        state,
        supporting_evidence_assertion_id,
        actor_principal_key,
        actor_user_id,
        reason
      )
      values (
        v_parent.id,
        'disputed',
        v_child_evidence_id,
        'user:'||v_actor.user_id::text,
        v_actor.user_id,
        coalesce(
          nullif(btrim(coalesce(p_reason,'')),''),
          'Invited counterparty disputed this claim.'
        )
      );
    end if;
  end if;

  insert into public.community_notifications (
    user_id,
    actor_id,
    notification_type,
    entity_type,
    entity_id,
    entity_slug,
    comment_id,
    metadata
  )
  select
    v_invitation.inviter_user_id,
    v_actor.user_id,
    'credit_confirmation_response',
    'music_credit_invite',
    v_invitation.id::text,
    null,
    null,
    jsonb_build_object(
      'canonical_path','/credits',
      'invitation_id',v_invitation.id,
      'response_mode',p_response_mode
    )
  where v_invitation.inviter_user_id<>v_actor.user_id
    and not exists (
      select 1
      from public.community_notifications notification
      where notification.user_id=v_invitation.inviter_user_id
        and notification.notification_type='credit_confirmation_response'
        and notification.entity_type='music_credit_invite'
        and notification.entity_id=v_invitation.id::text
    );

  return jsonb_build_object(
    'invitationId',v_invitation.id,
    'state',p_response_mode,
    'responseAttestationId',v_child_attestation_id
  );
end
$$;

revoke all on function public.respond_music_credit_invitation_v1(
  text,text,text
)
from public,anon,service_role;

grant execute on function public.respond_music_credit_invitation_v1(
  text,text,text
)
to authenticated;

create function public.get_my_music_credits_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,editorial,platform_private
as $$
declare
  v_actor record;
  v_needs_you jsonb;
  v_your_work jsonb;
  v_activity jsonb;
  v_permissions jsonb;
begin
  select *
  into v_actor
  from platform_private.registry_music_current_creator_v1();

  select coalesce(jsonb_agg(item.payload order by item.sort_at desc),'[]'::jsonb)
  into v_needs_you
  from (
    select
      invitation.created_at as sort_at,
      jsonb_build_object(
        'kind','invitation',
        'invitationId',invitation.id,
        'state',
          platform_private.registry_contribution_invitation_state_v1(
            invitation.id
          ),
        'roleKey',invitation.role_key,
        'roleLabel',
          platform_private.registry_music_role_label_v1(
            invitation.role_key
          ),
        'subject',
          platform_private.registry_music_subject_presentation_v1(
            invitation.track_id,
            invitation.work_id
          ),
        'inviter',
          jsonb_build_object(
            'name',
              coalesce(
                editorial.resolve_person_presentation(
                  invitation.inviter_person_resource_id
                )->>'display_name',
                'A WAKILISHA creator'
              )
          ),
        'canonicalPath','/credits/invite/'||invitation.id::text
      ) as payload
    from platform_private.registry_contribution_invitations invitation
    where invitation.invitee_person_resource_id=v_actor.person_resource_id
      and platform_private.registry_contribution_invitation_state_v1(
            invitation.id
          )='pending'

    union all

    select
      attestation.created_at,
      jsonb_build_object(
        'kind','dispute',
        'attestationId',attestation.id,
        'state','disputed',
        'roleKey',attestation.role_key,
        'roleLabel',
          platform_private.registry_music_role_label_v1(
            attestation.role_key
          ),
        'subject',
          platform_private.registry_music_subject_presentation_v1(
            attestation.track_id,
            attestation.work_id
          )
      )
    from platform_private.registry_contribution_attestations attestation
    where attestation.asserting_user_id=v_actor.user_id
      and attestation.asserting_person_resource_id=v_actor.person_resource_id
      and platform_private.registry_contribution_attestation_current_state_v1(
            attestation.id
          )='disputed'
  ) item;

  select coalesce(jsonb_agg(item.payload order by item.sort_at desc),'[]'::jsonb)
  into v_your_work
  from (
    select
      greatest(
        attestation.created_at,
        coalesce(canonical.updated_at,attestation.created_at)
      ) as sort_at,
      jsonb_build_object(
        'kind','attestation',
        'attestationId',attestation.id,
        'state',
          case
            when canonical.id is not null then 'canonical'
            when platform_private.registry_contribution_attestation_current_state_v1(
                   attestation.id
                 )='corroborated'
              then 'under_review'
            else platform_private.registry_contribution_attestation_current_state_v1(
                   attestation.id
                 )
          end,
        'canonicalContributionId',canonical.id,
        'roleKey',attestation.role_key,
        'roleLabel',
          platform_private.registry_music_role_label_v1(
            attestation.role_key
          ),
        'instrument',attestation.instrument_key,
        'detail',attestation.detail_text,
        'creditedAs',attestation.credited_as,
        'subject',
          platform_private.registry_music_subject_presentation_v1(
            attestation.track_id,
            attestation.work_id
          )
      ) as payload
    from platform_private.registry_contribution_attestations attestation
    left join lateral (
      select
        contribution.id,
        contribution.updated_at
      from (
        select
          track_contribution.id,
          track_contribution.updated_at,
          track_contribution.evidence_assertion_id
        from public.registry_track_contributions track_contribution
        where track_contribution.status='verified'
          and track_contribution.superseded_by_contribution_id is null

        union all

        select
          work_contribution.id,
          work_contribution.updated_at,
          work_contribution.evidence_assertion_id
        from public.registry_work_contributions work_contribution
        where work_contribution.status='verified'
          and work_contribution.superseded_by_contribution_id is null
      ) contribution
      where contribution.evidence_assertion_id=
            attestation.evidence_assertion_id
      limit 1
    ) canonical on true
    where attestation.asserting_user_id=v_actor.user_id
      and attestation.asserting_person_resource_id=v_actor.person_resource_id

    union all

    select
      contribution.updated_at,
      jsonb_build_object(
        'kind','canonical_contribution',
        'canonicalContributionId',contribution.id,
        'state','canonical',
        'roleKey',contribution.role_key,
        'roleLabel',
          platform_private.registry_music_role_label_v1(
            contribution.role_key
          ),
        'instrument',contribution.instrument_key,
        'detail',contribution.detail_text,
        'creditedAs',contribution.credited_as,
        'subject',
          platform_private.registry_music_subject_presentation_v1(
            contribution.track_id,
            null
          )
      )
    from public.registry_track_contributions contribution
    where contribution.person_resource_id=v_actor.person_resource_id
      and contribution.status='verified'
      and contribution.superseded_by_contribution_id is null
      and not exists (
        select 1
        from platform_private.registry_contribution_attestations attestation
        where attestation.evidence_assertion_id=
              contribution.evidence_assertion_id
          and attestation.asserting_user_id=v_actor.user_id
      )

    union all

    select
      contribution.updated_at,
      jsonb_build_object(
        'kind','canonical_contribution',
        'canonicalContributionId',contribution.id,
        'state','canonical',
        'roleKey',contribution.role_key,
        'roleLabel',
          platform_private.registry_music_role_label_v1(
            contribution.role_key
          ),
        'creditedAs',contribution.credited_as,
        'subject',
          platform_private.registry_music_subject_presentation_v1(
            null,
            contribution.work_id
          )
      )
    from public.registry_work_contributions contribution
    where contribution.person_resource_id=v_actor.person_resource_id
      and contribution.status='verified'
      and contribution.superseded_by_contribution_id is null
      and not exists (
        select 1
        from platform_private.registry_contribution_attestations attestation
        where attestation.evidence_assertion_id=
              contribution.evidence_assertion_id
          and attestation.asserting_user_id=v_actor.user_id
      )
  ) item;

  select coalesce(jsonb_agg(activity.payload order by activity.sort_at desc),'[]'::jsonb)
  into v_activity
  from (
    select
      event.created_at as sort_at,
      jsonb_build_object(
        'kind','attestation_state',
        'attestationId',attestation.id,
        'state',event.state,
        'at',event.created_at,
        'subject',
          platform_private.registry_music_subject_presentation_v1(
            attestation.track_id,
            attestation.work_id
          ),
        'roleLabel',
          platform_private.registry_music_role_label_v1(
            attestation.role_key
          )
      ) as payload
    from platform_private.registry_contribution_attestation_state_events event
    join platform_private.registry_contribution_attestations attestation
      on attestation.id=event.attestation_id
    where attestation.asserting_user_id=v_actor.user_id
       or attestation.asserting_person_resource_id=v_actor.person_resource_id

    union all

    select
      event.created_at,
      jsonb_build_object(
        'kind','invitation_'||event.event_kind,
        'invitationId',invitation.id,
        'state',event.event_kind,
        'at',event.created_at,
        'roleLabel',
          platform_private.registry_music_role_label_v1(
            invitation.role_key
          ),
        'subject',
          platform_private.registry_music_subject_presentation_v1(
            invitation.track_id,
            invitation.work_id
          )
      )
    from platform_private.registry_contribution_invitation_events event
    join platform_private.registry_contribution_invitations invitation
      on invitation.id=event.invitation_id
    where invitation.inviter_user_id=v_actor.user_id
       or invitation.invitee_person_resource_id=v_actor.person_resource_id
       or event.resolved_person_resource_id=v_actor.person_resource_id

    union all

    select
      contribution.created_at,
      jsonb_build_object(
        'kind','canonical_admission',
        'canonicalContributionId',contribution.id,
        'state','canonical',
        'at',contribution.created_at,
        'roleLabel',
          platform_private.registry_music_role_label_v1(
            contribution.role_key
          ),
        'subject',
          platform_private.registry_music_subject_presentation_v1(
            contribution.track_id,
            null
          )
      )
    from public.registry_track_contributions contribution
    where contribution.status='verified'
      and contribution.superseded_by_contribution_id is null
      and (
        contribution.person_resource_id=v_actor.person_resource_id
        or exists (
          select 1
          from platform_private.registry_contribution_attestations attestation
          where attestation.evidence_assertion_id=
                contribution.evidence_assertion_id
            and attestation.asserting_user_id=v_actor.user_id
            and attestation.asserting_person_resource_id=
                v_actor.person_resource_id
        )
      )

    union all

    select
      contribution.created_at,
      jsonb_build_object(
        'kind','canonical_admission',
        'canonicalContributionId',contribution.id,
        'state','canonical',
        'at',contribution.created_at,
        'roleLabel',
          platform_private.registry_music_role_label_v1(
            contribution.role_key
          ),
        'subject',
          platform_private.registry_music_subject_presentation_v1(
            null,
            contribution.work_id
          )
      )
    from public.registry_work_contributions contribution
    where contribution.status='verified'
      and contribution.superseded_by_contribution_id is null
      and (
        contribution.person_resource_id=v_actor.person_resource_id
        or exists (
          select 1
          from platform_private.registry_contribution_attestations attestation
          where attestation.evidence_assertion_id=
                contribution.evidence_assertion_id
            and attestation.asserting_user_id=v_actor.user_id
            and attestation.asserting_person_resource_id=
                v_actor.person_resource_id
        )
      )
  ) activity;

  select coalesce(jsonb_agg(permission.payload order by permission.sort_at desc),'[]'::jsonb)
  into v_permissions
  from (
    select
      attestation.created_at as sort_at,
      jsonb_build_object(
        'attestationId',attestation.id,
        'roleLabel',
          platform_private.registry_music_role_label_v1(
            attestation.role_key
          ),
        'subject',
          platform_private.registry_music_subject_presentation_v1(
            attestation.track_id,
            attestation.work_id
          ),
        'permission',
          case
            when latest.id is null then
              jsonb_build_object(
                'changeKind','none',
                'publicDisplay',false,
                'cmoRightsContexts','[]'::jsonb,
                'approvedPartnerKeys','[]'::jsonb,
                'thirdPartyCommercialReuse',false
              )
            else
              jsonb_build_object(
                'permissionId',latest.id,
                'changeKind',latest.change_kind,
                'publicDisplay',latest.public_display,
                'cmoRightsContexts',to_jsonb(latest.cmo_rights_contexts),
                'approvedPartnerKeys',to_jsonb(latest.approved_partner_keys),
                'thirdPartyCommercialReuse',
                  latest.third_party_commercial_reuse,
                'updatedAt',latest.created_at
              )
          end
      ) as payload
    from platform_private.registry_contribution_attestations attestation
    left join lateral (
      select permission.*
      from platform_private.registry_contribution_attestation_permission_versions permission
      where permission.attestation_id=attestation.id
      order by permission.event_sequence desc
      limit 1
    ) latest on true
    where attestation.asserting_user_id=v_actor.user_id
      and attestation.asserting_person_resource_id=v_actor.person_resource_id
  ) permission;

  return jsonb_build_object(
    'personId',v_actor.person_resource_id,
    'needsYou',v_needs_you,
    'yourWork',v_your_work,
    'activity',v_activity,
    'sharingPermissions',v_permissions
  );
end
$$;

revoke all on function public.get_my_music_credits_v1()
from public,anon,service_role;

grant execute on function public.get_my_music_credits_v1()
to authenticated;

create function public.get_public_track_provenance_v1(
  p_track_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_track_exists boolean;
  v_recording jsonb;
  v_works jsonb;
  v_last_checked timestamptz;
begin
  select exists (
    select 1
    from public.registry_tracks track
    where track.id=p_track_id
      and track.status='active'
  )
  into v_track_exists;

  if not v_track_exists then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',contribution.id,
        'creditedName',
          coalesce(
            nullif(btrim(contribution.credited_as),''),
            presentation.value->>'name',
            'Contributor'
          ),
        'roleKey',contribution.role_key,
        'roleLabel',
          platform_private.registry_music_role_label_v1(
            contribution.role_key
          ),
        'instrument',contribution.instrument_key,
        'detail',contribution.detail_text,
        'creditOrder',contribution.credit_order,
        'resolvedEntity',presentation.value
      )
      order by
        coalesce(contribution.credit_order,2147483647),
        contribution.created_at,
        contribution.id
    ),
    '[]'::jsonb
  )
  into v_recording
  from public.registry_track_contributions contribution
  left join lateral (
    select platform_private.registry_public_contributor_presentation_v1(
      contribution.person_resource_id,
      contribution.organization_resource_id,
      contribution.artist_id
    ) as value
  ) presentation on true
  where contribution.track_id=p_track_id
    and contribution.status='verified'
    and contribution.superseded_by_contribution_id is null
    and (contribution.valid_to is null or contribution.valid_to>now());

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',work.id,
        'title',work.title,
        'relationshipKind',link.relationship_kind,
        'contributions',
          coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id',contribution.id,
                  'creditedName',
                    coalesce(
                      nullif(btrim(contribution.credited_as),''),
                      presentation.value->>'name',
                      'Contributor'
                    ),
                  'roleKey',contribution.role_key,
                  'roleLabel',
                    platform_private.registry_music_role_label_v1(
                      contribution.role_key
                    ),
                  'instrument',null,
                  'detail',null,
                  'creditOrder',contribution.credit_order,
                  'resolvedEntity',presentation.value
                )
                order by
                  coalesce(contribution.credit_order,2147483647),
                  contribution.created_at,
                  contribution.id
              )
              from public.registry_work_contributions contribution
              left join lateral (
                select platform_private.registry_public_contributor_presentation_v1(
                  contribution.person_resource_id,
                  contribution.organization_resource_id,
                  contribution.artist_id
                ) as value
              ) presentation on true
              where contribution.work_id=work.id
                and contribution.status='verified'
                and contribution.superseded_by_contribution_id is null
                and (
                  contribution.valid_to is null
                  or contribution.valid_to>now()
                )
            ),
            '[]'::jsonb
          )
      )
      order by link.created_at,work.id
    ),
    '[]'::jsonb
  )
  into v_works
  from public.registry_track_work_links link
  join public.registry_works work
    on work.id=link.work_id
   and work.status<>'archived'
  where link.track_id=p_track_id
    and link.status='verified'
    and link.superseded_by_link_id is null
    and (link.valid_to is null or link.valid_to>now());

  select max(change_at)
  into v_last_checked
  from (
    select contribution.updated_at as change_at
    from public.registry_track_contributions contribution
    where contribution.track_id=p_track_id
      and contribution.status='verified'
      and contribution.superseded_by_contribution_id is null

    union all

    select link.updated_at
    from public.registry_track_work_links link
    where link.track_id=p_track_id
      and link.status='verified'
      and link.superseded_by_link_id is null

    union all

    select contribution.updated_at
    from public.registry_work_contributions contribution
    join public.registry_track_work_links link
      on link.work_id=contribution.work_id
     and link.track_id=p_track_id
     and link.status='verified'
     and link.superseded_by_link_id is null
    where contribution.status='verified'
      and contribution.superseded_by_contribution_id is null
  ) changes;

  return jsonb_build_object(
    'recordingContributions',v_recording,
    'works',v_works,
    'provenanceReceipt',
      case
        when jsonb_array_length(v_recording)>0
          or jsonb_array_length(v_works)>0
        then jsonb_build_object(
          'summary',
            'These credits come from verified WAKILISHA Registry contribution records. Pending claims are not shown.',
          'lastCheckedAt',v_last_checked
        )
        else null
      end
  );
end
$$;

revoke all on function public.get_public_track_provenance_v1(uuid)
from public;

grant execute on function public.get_public_track_provenance_v1(uuid)
to anon,authenticated,service_role;

create function public.get_public_person_music_credits_v1(
  p_person_resource_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,editorial,platform_private
as $$
declare
  v_allowed boolean;
  v_recording jsonb;
  v_work jsonb;
begin
  select exists (
    select 1
    from editorial.people person
    join editorial.resources resource
      on resource.id=person.resource_id
     and resource.resource_kind='person'
     and resource.lifecycle_state='active'
     and resource.visibility='public'
    where person.resource_id=p_person_resource_id
      and person.person_state='active'
  )
  into v_allowed;

  if not v_allowed then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',contribution.id,
        'roleKey',contribution.role_key,
        'roleLabel',
          platform_private.registry_music_role_label_v1(
            contribution.role_key
          ),
        'instrument',contribution.instrument_key,
        'detail',contribution.detail_text,
        'creditedAs',contribution.credited_as,
        'subject',
          platform_private.registry_music_subject_presentation_v1(
            contribution.track_id,
            null
          )
      )
      order by contribution.updated_at desc,contribution.id
    ),
    '[]'::jsonb
  )
  into v_recording
  from public.registry_track_contributions contribution
  where contribution.person_resource_id=p_person_resource_id
    and contribution.status='verified'
    and contribution.superseded_by_contribution_id is null
    and (contribution.valid_to is null or contribution.valid_to>now());

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',contribution.id,
        'roleKey',contribution.role_key,
        'roleLabel',
          platform_private.registry_music_role_label_v1(
            contribution.role_key
          ),
        'creditedAs',contribution.credited_as,
        'subject',
          platform_private.registry_music_subject_presentation_v1(
            null,
            contribution.work_id
          )
      )
      order by contribution.updated_at desc,contribution.id
    ),
    '[]'::jsonb
  )
  into v_work
  from public.registry_work_contributions contribution
  where contribution.person_resource_id=p_person_resource_id
    and contribution.status='verified'
    and contribution.superseded_by_contribution_id is null
    and (contribution.valid_to is null or contribution.valid_to>now());

  return jsonb_build_object(
    'personId',p_person_resource_id,
    'recordingCredits',v_recording,
    'workCredits',v_work
  );
end
$$;

revoke all on function public.get_public_person_music_credits_v1(uuid)
from public;

grant execute on function public.get_public_person_music_credits_v1(uuid)
to anon,authenticated,service_role;

create function public.get_public_artist_music_provenance_v1(
  p_artist_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,editorial,platform_private
as $$
declare
  v_artist public.registry_artists%rowtype;
  v_recording jsonb;
  v_work jsonb;
  v_members jsonb;
begin
  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=p_artist_id
    and artist.status='active';

  if not found then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',contribution.id,
        'roleKey',contribution.role_key,
        'roleLabel',
          platform_private.registry_music_role_label_v1(
            contribution.role_key
          ),
        'subject',
          platform_private.registry_music_subject_presentation_v1(
            contribution.track_id,
            null
          )
      )
      order by contribution.updated_at desc,contribution.id
    ),
    '[]'::jsonb
  )
  into v_recording
  from public.registry_track_contributions contribution
  where contribution.status='verified'
    and contribution.superseded_by_contribution_id is null
    and (contribution.valid_to is null or contribution.valid_to>now())
    and (
      contribution.artist_id=p_artist_id
      or (
        contribution.person_resource_id is not null
        and exists (
          select 1
          from editorial.person_registry_artist_links link
          where link.registry_artist_id=p_artist_id
            and link.person_resource_id=contribution.person_resource_id
            and link.link_state='active'
        )
      )
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',contribution.id,
        'roleKey',contribution.role_key,
        'roleLabel',
          platform_private.registry_music_role_label_v1(
            contribution.role_key
          ),
        'subject',
          platform_private.registry_music_subject_presentation_v1(
            null,
            contribution.work_id
          )
      )
      order by contribution.updated_at desc,contribution.id
    ),
    '[]'::jsonb
  )
  into v_work
  from public.registry_work_contributions contribution
  where contribution.status='verified'
    and contribution.superseded_by_contribution_id is null
    and (contribution.valid_to is null or contribution.valid_to>now())
    and (
      contribution.artist_id=p_artist_id
      or (
        contribution.person_resource_id is not null
        and exists (
          select 1
          from editorial.person_registry_artist_links link
          where link.registry_artist_id=p_artist_id
            and link.person_resource_id=contribution.person_resource_id
            and link.link_state='active'
        )
      )
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'membershipId',membership.id,
        'roleKey',membership.role_key,
        'roleLabel',
          platform_private.registry_music_role_label_v1(
            membership.role_key
          ),
        'roleDetail',membership.role_detail,
        'validFrom',membership.valid_from,
        'validTo',membership.valid_to,
        'person',
          platform_private.registry_public_contributor_presentation_v1(
            membership.person_resource_id,
            null,
            null
          )
      )
      order by
        coalesce(membership.valid_from,'-infinity'::date),
        membership.created_at,
        membership.id
    ) filter (
      where platform_private.registry_public_contributor_presentation_v1(
        membership.person_resource_id,
        null,
        null
      ) is not null
    ),
    '[]'::jsonb
  )
  into v_members
  from public.registry_artist_person_memberships membership
  where membership.group_artist_id=p_artist_id
    and membership.review_state='verified'
    and membership.superseded_by_membership_id is null;

  return jsonb_build_object(
    'artistId',p_artist_id,
    'recordingCredits',v_recording,
    'workCredits',v_work,
    'groupMembers',v_members
  );
end
$$;

revoke all on function public.get_public_artist_music_provenance_v1(uuid)
from public;

grant execute on function public.get_public_artist_music_provenance_v1(uuid)
to anon,authenticated,service_role;

do $postcheck$
declare
  v_table_privileges integer;
  v_direct_canonical_insert integer;
  v_creator_execute integer;
  v_public_execute integer;
begin
  select count(*)::integer
  into v_table_privileges
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema='platform_private'
    and grant_row.table_name in (
      'registry_contribution_invitations',
      'registry_contribution_invitation_events'
    )
    and grant_row.grantee in (
      'anon','authenticated','service_role'
    )
    and grant_row.privilege_type in (
      'SELECT','INSERT','UPDATE','DELETE'
    );

  if v_table_privileges<>0 then
    raise exception
      'STOP: creator invitation private tables leaked direct client authority.';
  end if;

  select count(*)::integer
  into v_direct_canonical_insert
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema='public'
    and grant_row.table_name in (
      'registry_track_contributions',
      'registry_work_contributions',
      'registry_track_work_links',
      'registry_works'
    )
    and grant_row.grantee in (
      'anon','authenticated','service_role'
    )
    and grant_row.privilege_type in (
      'INSERT','UPDATE','DELETE'
    );

  if v_direct_canonical_insert<>0 then
    raise exception
      'STOP: Slice 2 creator product changed canonical Registry mutation authority.';
  end if;

  select count(*)::integer
  into v_creator_execute
  from (
    values
      ('public.search_music_credit_people_v1(text,integer)'::regprocedure),
      ('public.create_my_music_credit_attestation_v1(text,uuid,text,text,text,text,uuid,uuid,text,jsonb,text)'::regprocedure),
      ('public.set_my_music_credit_permission_v1(uuid,boolean,text[],text[],boolean,text)'::regprocedure),
      ('public.transition_my_music_credit_attestation_v1(uuid,text,text)'::regprocedure),
      ('public.create_music_credit_invitation_v1(uuid,uuid,text,integer)'::regprocedure),
      ('public.revoke_my_music_credit_invitation_v1(uuid,text)'::regprocedure),
      ('public.respond_music_credit_invitation_v1(text,text,text)'::regprocedure),
      ('public.get_my_music_credits_v1()'::regprocedure)
  ) function_row(function_oid)
  where has_function_privilege(
    'authenticated',
    function_row.function_oid,
    'EXECUTE'
  );

  if v_creator_execute<>8 then
    raise exception
      'STOP: authenticated creator Slice 2 command/read authority is incomplete.';
  end if;

  select count(*)::integer
  into v_public_execute
  from (
    values
      ('public.get_music_credit_invite_v1(text)'::regprocedure),
      ('public.get_public_track_provenance_v1(uuid)'::regprocedure),
      ('public.get_public_person_music_credits_v1(uuid)'::regprocedure),
      ('public.get_public_artist_music_provenance_v1(uuid)'::regprocedure)
  ) function_row(function_oid)
  where has_function_privilege(
    'anon',
    function_row.function_oid,
    'EXECUTE'
  );

  if v_public_execute<>4 then
    raise exception
      'STOP: public-safe Slice 2 read authority is incomplete.';
  end if;

  if position(
       'registry_track_contributions'
       in pg_get_functiondef(
         'public.create_my_music_credit_attestation_v1(text,uuid,text,text,text,text,uuid,uuid,text,jsonb,text)'::regprocedure
       )
     )<>0
     or position(
       'registry_work_contributions'
       in pg_get_functiondef(
         'public.create_my_music_credit_attestation_v1(text,uuid,text,text,text,text,uuid,uuid,text,jsonb,text)'::regprocedure
       )
     )<>0
  then
    raise exception
      'STOP: creator attestation command may not write or depend on canonical contribution tables.';
  end if;

  if position(
       'registry_track_contributions'
       in pg_get_functiondef(
         'public.get_public_track_provenance_v1(uuid)'::regprocedure
       )
     )=0
     or position(
       '''verified'''
       in pg_get_functiondef(
         'public.get_public_track_provenance_v1(uuid)'::regprocedure
       )
     )=0
     or position(
       'registry_contribution_attestations'
       in pg_get_functiondef(
         'public.get_public_track_provenance_v1(uuid)'::regprocedure
       )
     )<>0
  then
    raise exception
      'STOP: public Track provenance is not sealed to verified canonical authority.';
  end if;
end
$postcheck$;

commit;
