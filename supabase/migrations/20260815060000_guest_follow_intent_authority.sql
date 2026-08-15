-- Guest Following signup handoff
--
-- Product contract:
--   * Signed-out people may choose real Registry Artists before creating an account.
--   * The browser may keep an unfinished draft, but Done creates a durable server intent.
--   * The durable token can survive email verification or OAuth on another device.
--   * Claiming an intent uses the existing canonical Follow writer.
--   * Claiming completes Registry onboarding in the same transaction.
--   * No second Follow table or preference authority is created.

begin;

do $guest_follow_intent_preflight$
begin
  if to_regclass('private.phase_0a_rpc_classification') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('auth.users') is null
  then
    raise exception
      'STOP: Required guest Follow intent substrate is missing';
  end if;

  if to_regprocedure(
       'public.community_set_follow_state(text,text,text,boolean)'
     ) is null
     or to_regprocedure(
       'public.community_set_registry_onboarding_state(text)'
     ) is null
  then
    raise exception
      'STOP: Existing Follow or onboarding command authority is missing';
  end if;

  if to_regclass('private.guest_follow_intents') is not null
     or to_regprocedure(
          'public.community_create_guest_follow_intent(uuid[])'
        ) is not null
     or to_regprocedure(
          'public.community_claim_guest_follow_intent(text)'
        ) is not null
  then
    raise exception
      'STOP: Guest Follow intent authority already exists';
  end if;
end;
$guest_follow_intent_preflight$;

create table private.guest_follow_intents (
  intent_token uuid
    primary key
    default gen_random_uuid(),
  artist_ids uuid[]
    not null,
  created_at timestamp with time zone
    not null
    default now(),
  expires_at timestamp with time zone
    not null
    default (now() + interval '7 days'),
  claimed_by uuid
    references auth.users(id)
    on delete cascade,
  claimed_at timestamp with time zone,
  claimed_follow_count integer,
  constraint guest_follow_intents_artist_count
    check (
      cardinality(artist_ids) between 1 and 24
    ),
  constraint guest_follow_intents_expiry_order
    check (
      expires_at > created_at
    ),
  constraint guest_follow_intents_claim_state
    check (
      (
        claimed_by is null
        and claimed_at is null
        and claimed_follow_count is null
      )
      or
      (
        claimed_by is not null
        and claimed_at is not null
        and claimed_follow_count is not null
        and claimed_follow_count >= 0
      )
    )
);

create index guest_follow_intents_expiry_idx
  on private.guest_follow_intents (
    expires_at
  );

alter table private.guest_follow_intents
  enable row level security;

revoke all on table
  private.guest_follow_intents
from public;

create or replace function
  public.community_create_guest_follow_intent(
    p_artist_ids uuid[]
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'private'
as $function$
declare
  v_artist_ids uuid[];
  v_artist_count integer;
  v_resolved_count integer;
  v_intent private.guest_follow_intents%rowtype;
begin
  select
    array_agg(
      dedup.artist_id
      order by dedup.first_ordinality
    )
  into
    v_artist_ids
  from (
    select
      requested.artist_id,
      min(requested.ordinality) as first_ordinality
    from unnest(
      coalesce(
        p_artist_ids,
        array[]::uuid[]
      )
    ) with ordinality
      requested(
        artist_id,
        ordinality
      )
    where requested.artist_id is not null
    group by requested.artist_id
  ) dedup;

  v_artist_count :=
    cardinality(
      coalesce(
        v_artist_ids,
        array[]::uuid[]
      )
    );

  if v_artist_count < 1
     or v_artist_count > 24
  then
    raise exception
      'Choose between 1 and 24 Artists'
      using errcode = '22023';
  end if;

  select
    count(*)
  into
    v_resolved_count
  from public.registry_artists
    artist
  where artist.id = any(v_artist_ids)
    and artist.status = 'active'
    and nullif(
          btrim(
            coalesce(
              artist.slug,
              ''
            )
          ),
          ''
        ) is not null;

  if v_resolved_count <> v_artist_count
  then
    raise exception
      'Every choice must resolve to an active Registry Artist'
      using errcode = '22023';
  end if;

  delete from private.guest_follow_intents
  where expires_at <
        now() - interval '30 days';

  insert into private.guest_follow_intents (
    artist_ids
  )
  values (
    v_artist_ids
  )
  returning *
  into v_intent;

  return jsonb_build_object(
    'token',
      v_intent.intent_token::text,
    'artist_count',
      v_artist_count,
    'expires_at',
      v_intent.expires_at
  );
end;
$function$;

create or replace function
  public.community_claim_guest_follow_intent(
    p_intent_token text
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'private'
as $function$
declare
  v_user_id uuid :=
    auth.uid();
  v_token uuid;
  v_intent private.guest_follow_intents%rowtype;
  v_artist record;
  v_followed_count integer := 0;
begin
  if v_user_id is null
  then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  begin
    v_token :=
      nullif(
        btrim(
          coalesce(
            p_intent_token,
            ''
          )
        ),
        ''
      )::uuid;
  exception
    when invalid_text_representation then
      raise exception
        'Follow selection not found'
        using errcode = '22023';
  end;

  if v_token is null
  then
    raise exception
      'Follow selection not found'
      using errcode = '22023';
  end if;

  select *
  into v_intent
  from private.guest_follow_intents
  where intent_token = v_token
  for update;

  if not found
  then
    raise exception
      'Follow selection not found'
      using errcode = '22023';
  end if;

  if v_intent.claimed_by is not null
  then
    if v_intent.claimed_by <> v_user_id
    then
      raise exception
        'Follow selection not found'
        using errcode = '22023';
    end if;

    return jsonb_build_object(
      'claimed',
        true,
      'already_claimed',
        true,
      'followed_count',
        coalesce(
          v_intent.claimed_follow_count,
          0
        )
    );
  end if;

  if v_intent.expires_at <= now()
  then
    raise exception
      'This Follow selection has expired'
      using errcode = '22023';
  end if;

  for v_artist in
    select
      artist.id,
      artist.slug
    from public.registry_artists
      artist
    where artist.id = any(v_intent.artist_ids)
      and artist.status = 'active'
      and nullif(
            btrim(
              coalesce(
                artist.slug,
                ''
              )
            ),
            ''
          ) is not null
    order by
      array_position(
        v_intent.artist_ids,
        artist.id
      )
  loop
    perform public.community_set_follow_state(
      'artist',
      v_artist.id::text,
      v_artist.slug,
      true
    );

    v_followed_count :=
      v_followed_count + 1;
  end loop;

  if v_followed_count < 1
  then
    raise exception
      'None of these Artists are available to Follow now'
      using errcode = '22023';
  end if;

  perform public.community_set_registry_onboarding_state(
    'completed'
  );

  update private.guest_follow_intents
  set
    claimed_by =
      v_user_id,
    claimed_at =
      now(),
    claimed_follow_count =
      v_followed_count
  where intent_token =
        v_token;

  return jsonb_build_object(
    'claimed',
      true,
    'already_claimed',
      false,
    'followed_count',
      v_followed_count
  );
end;
$function$;

revoke all on function
  public.community_create_guest_follow_intent(
    uuid[]
  )
from public;

revoke all on function
  public.community_claim_guest_follow_intent(
    text
  )
from public;

grant execute on function
  public.community_create_guest_follow_intent(
    uuid[]
  )
to
  anon,
  authenticated;

grant execute on function
  public.community_claim_guest_follow_intent(
    text
  )
to
  authenticated;

insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale
)
values
  (
    'community_create_guest_follow_intent(uuid[])',
    'public_bounded_write',
    'Anonymous or authenticated creation of one short-lived, bounded Artist Follow selection. The private row is not publicly readable.'
  ),
  (
    'community_claim_guest_follow_intent(text)',
    'authenticated_self_service',
    'Authenticated bearer-token claim. Uses the canonical Follow command for each active Artist and completes Registry onboarding atomically.'
  )
on conflict (
  function_signature
)
do update
set
  access_class =
    excluded.access_class,
  rationale =
    excluded.rationale,
  reviewed_at =
    now();

do $guest_follow_intent_postflight$
declare
  v_create_definition text;
  v_claim_definition text;
begin
  if to_regclass(
       'private.guest_follow_intents'
     ) is null
     or to_regprocedure(
          'public.community_create_guest_follow_intent(uuid[])'
        ) is null
     or to_regprocedure(
          'public.community_claim_guest_follow_intent(text)'
        ) is null
  then
    raise exception
      'STOP: Guest Follow intent objects are incomplete';
  end if;

  if not has_function_privilege(
       'anon',
       'public.community_create_guest_follow_intent(uuid[])',
       'EXECUTE'
     )
     or has_function_privilege(
          'anon',
          'public.community_claim_guest_follow_intent(text)',
          'EXECUTE'
        )
     or not has_function_privilege(
          'authenticated',
          'public.community_claim_guest_follow_intent(text)',
          'EXECUTE'
        )
  then
    raise exception
      'STOP: Guest Follow intent grants are incorrect';
  end if;

  if has_table_privilege(
       'anon',
       'private.guest_follow_intents',
       'SELECT'
     )
     or has_table_privilege(
          'authenticated',
          'private.guest_follow_intents',
          'SELECT'
        )
  then
    raise exception
      'STOP: Guest Follow intent rows are publicly readable';
  end if;

  select pg_get_functiondef(
    'public.community_create_guest_follow_intent(uuid[])'::regprocedure
  )
  into v_create_definition;

  select pg_get_functiondef(
    'public.community_claim_guest_follow_intent(text)'::regprocedure
  )
  into v_claim_definition;

  if position(
       'community_set_follow_state'
       in v_create_definition
     ) > 0
     or position(
          'community_set_follow_state'
          in v_claim_definition
        ) = 0
     or position(
          'community_set_registry_onboarding_state'
          in v_claim_definition
        ) = 0
  then
    raise exception
      'STOP: Canonical Follow or onboarding command boundary is incorrect';
  end if;
end;
$guest_follow_intent_postflight$;

commit;
