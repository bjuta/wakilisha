-- WAKILISHA M2: Artist claims and representation authority.
--
-- Constitution:
-- - auth.users / user_profiles identify the WAKILISHA account.
-- - registry_artists remains the canonical cultural identity authority.
-- - a claim asks for authority to represent an Artist; it never transfers ownership.
-- - an active representation grants bounded, Artist-scoped capabilities only.
-- - Registry facts remain governed by Registry/editorial authority.
-- - no function in this migration writes canonical registry_artists rows.
-- - raw identity documents are deliberately outside this sprint.

begin;

do $m2_preflight$
begin
  if to_regclass('public.registry_artists') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('public.role_definitions') is null
     or to_regclass('public.capability_definitions') is null
     or to_regclass('public.user_role_assignments') is null
     or to_regclass('public.admin_audit_events') is null
  then
    raise exception
      'STOP: Required Registry, account, role, capability, or audit authority is missing';
  end if;

  if to_regprocedure('public.current_user_has_capability(text)') is null then
    raise exception
      'STOP: current_user_has_capability(text) is missing';
  end if;

  if not exists (
       select 1
       from public.role_definitions
       where role_key = 'artist_claimant'
     )
     or not exists (
       select 1
       from public.role_definitions
       where role_key = 'artist_manager'
     )
  then
    raise exception
      'STOP: Existing Artist Claimant / Artist Manager roles are missing';
  end if;

  if not exists (
       select 1
       from public.capability_definitions
       where capability_key = 'submit_artist_claim'
     )
     or not exists (
       select 1
       from public.capability_definitions
       where capability_key = 'manage_claimed_artist_profile'
     )
     or not exists (
       select 1
       from public.capability_definitions
       where capability_key = 'submit_artist_media'
     )
     or not exists (
       select 1
       from public.capability_definitions
       where capability_key = 'manage_review_queue'
     )
     or not exists (
       select 1
       from public.capability_definitions
       where capability_key = 'manage_registry'
     )
     or not exists (
       select 1
       from public.capability_definitions
       where capability_key = 'manage_users'
     )
  then
    raise exception
      'STOP: Required existing Artist/admin capabilities are missing';
  end if;

  if to_regclass('public.artist_claim_requests') is not null
     or to_regclass('public.artist_claim_evidence') is not null
     or to_regclass('public.artist_representations') is not null
     or to_regclass('public.artist_representation_events') is not null
  then
    raise exception
      'STOP: M2 Artist claim / representation table authority already exists';
  end if;
end;
$m2_preflight$;


create table public.artist_claim_requests (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null
    references public.registry_artists(id)
    on delete restrict,
  claimant_user_id uuid
    references auth.users(id)
    on delete set null,
  claimant_role text not null
    check (
      claimant_role in (
        'artist',
        'manager',
        'label',
        'publicist',
        'team_member',
        'other'
      )
    ),
  statement text not null
    check (
      char_length(statement) between 10 and 4000
    ),
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'verified',
        'rejected',
        'withdrawn',
        'revoked'
      )
    ),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
    references auth.users(id)
    on delete set null,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artist_claim_decision_consistency
    check (
      (
        status = 'pending'
        and decided_at is null
        and decided_by is null
      )
      or (
        status in (
          'verified',
          'rejected',
          'revoked'
        )
        and decided_at is not null
        and decision_reason is not null
      )
      or status = 'withdrawn'
    )
);

create unique index artist_claim_requests_one_pending_per_account_artist
on public.artist_claim_requests (
  artist_id,
  claimant_user_id
)
where status = 'pending'
  and claimant_user_id is not null;

create index artist_claim_requests_status_submitted_idx
on public.artist_claim_requests (
  status,
  submitted_at desc
);

create index artist_claim_requests_artist_submitted_idx
on public.artist_claim_requests (
  artist_id,
  submitted_at desc
);

create index artist_claim_requests_claimant_submitted_idx
on public.artist_claim_requests (
  claimant_user_id,
  submitted_at desc
);


create table public.artist_claim_evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null
    references public.artist_claim_requests(id)
    on delete cascade,
  evidence_type text not null
    check (
      evidence_type in (
        'official_website',
        'official_social',
        'business_email',
        'label_or_distributor',
        'public_announcement',
        'other'
      )
    ),
  reference text,
  note text,
  created_at timestamptz not null default now(),
  constraint artist_claim_evidence_has_content
    check (
      nullif(trim(coalesce(reference, '')), '') is not null
      or nullif(trim(coalesce(note, '')), '') is not null
    ),
  constraint artist_claim_evidence_reference_length
    check (
      reference is null
      or char_length(reference) <= 2048
    ),
  constraint artist_claim_evidence_note_length
    check (
      note is null
      or char_length(note) <= 2000
    )
);

create index artist_claim_evidence_claim_idx
on public.artist_claim_evidence (
  claim_id,
  created_at
);


create table public.artist_representations (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null
    references public.registry_artists(id)
    on delete restrict,
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  representation_role text not null
    check (
      representation_role in (
        'artist',
        'manager',
        'label',
        'publicist',
        'team_member',
        'other'
      )
    ),
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'active',
        'revoked'
      )
    ),
  source_claim_id uuid
    references public.artist_claim_requests(id)
    on delete set null,
  can_manage_profile boolean not null default false,
  can_submit_releases boolean not null default false,
  can_post_updates boolean not null default false,
  can_manage_team boolean not null default false,
  invited_by uuid
    references auth.users(id)
    on delete set null,
  invited_at timestamptz,
  accepted_at timestamptz,
  verified_by uuid
    references auth.users(id)
    on delete set null,
  verified_at timestamptz,
  revoked_by uuid
    references auth.users(id)
    on delete set null,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artist_representation_activation_consistency
    check (
      (
        status = 'pending'
        and accepted_at is null
        and revoked_at is null
      )
      or (
        status = 'active'
        and revoked_at is null
      )
      or (
        status = 'revoked'
        and revoked_at is not null
        and revocation_reason is not null
      )
    )
);

create unique index artist_representations_one_current_per_account_artist
on public.artist_representations (
  artist_id,
  user_id
)
where status in (
  'pending',
  'active'
);

create index artist_representations_artist_status_idx
on public.artist_representations (
  artist_id,
  status,
  created_at
);

create index artist_representations_user_status_idx
on public.artist_representations (
  user_id,
  status,
  created_at
);


create table public.artist_representation_events (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null
    references public.registry_artists(id)
    on delete restrict,
  claim_id uuid
    references public.artist_claim_requests(id)
    on delete set null,
  representation_id uuid
    references public.artist_representations(id)
    on delete set null,
  event_type text not null
    check (
      event_type in (
        'claim_submitted',
        'claim_withdrawn',
        'claim_verified',
        'claim_rejected',
        'representation_invited',
        'representation_accepted',
        'representation_updated',
        'representation_revoked'
      )
    ),
  actor_user_id uuid
    references auth.users(id)
    on delete set null,
  subject_user_id uuid
    references auth.users(id)
    on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index artist_representation_events_artist_created_idx
on public.artist_representation_events (
  artist_id,
  created_at desc
);

create index artist_representation_events_claim_created_idx
on public.artist_representation_events (
  claim_id,
  created_at desc
);

create index artist_representation_events_representation_created_idx
on public.artist_representation_events (
  representation_id,
  created_at desc
);


alter table public.artist_claim_requests
  enable row level security;

alter table public.artist_claim_evidence
  enable row level security;

alter table public.artist_representations
  enable row level security;

alter table public.artist_representation_events
  enable row level security;

revoke all on table public.artist_claim_requests
from public, anon, authenticated;

revoke all on table public.artist_claim_evidence
from public, anon, authenticated;

revoke all on table public.artist_representations
from public, anon, authenticated;

revoke all on table public.artist_representation_events
from public, anon, authenticated;

grant select on table public.artist_claim_requests
to service_role;

grant select on table public.artist_claim_evidence
to service_role;

grant select on table public.artist_representations
to service_role;

grant select on table public.artist_representation_events
to service_role;


create or replace function editorial.current_user_can_review_artist_claims()
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
    coalesce(
      public.current_user_has_capability(
        'manage_users'
      ),
      false
    )
    or (
      coalesce(
        public.current_user_has_capability(
          'manage_review_queue'
        ),
        false
      )
      and coalesce(
        public.current_user_has_capability(
          'manage_registry'
        ),
        false
      )
    );
$function$;

revoke all on function
  editorial.current_user_can_review_artist_claims()
from public, anon, authenticated, service_role;


create or replace function editorial.artist_representation_defaults(
  p_role text
)
returns table (
  can_manage_profile boolean,
  can_submit_releases boolean,
  can_post_updates boolean,
  can_manage_team boolean
)
language sql
immutable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
  select
    case
      when p_role in (
        'artist',
        'manager'
      ) then true
      when p_role = 'publicist' then true
      else false
    end,
    case
      when p_role in (
        'artist',
        'manager',
        'label'
      ) then true
      else false
    end,
    case
      when p_role in (
        'artist',
        'manager',
        'label',
        'publicist',
        'team_member'
      ) then true
      else false
    end,
    case
      when p_role in (
        'artist',
        'manager'
      ) then true
      else false
    end;
$function$;

revoke all on function
  editorial.artist_representation_defaults(text)
from public, anon, authenticated, service_role;


create or replace function editorial.record_artist_representation_event(
  p_artist_id uuid,
  p_event_type text,
  p_claim_id uuid default null,
  p_representation_id uuid default null,
  p_subject_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_event_id uuid;
begin
  insert into public.artist_representation_events (
    artist_id,
    claim_id,
    representation_id,
    event_type,
    actor_user_id,
    subject_user_id,
    metadata
  )
  values (
    p_artist_id,
    p_claim_id,
    p_representation_id,
    p_event_type,
    auth.uid(),
    p_subject_user_id,
    coalesce(
      p_metadata,
      '{}'::jsonb
    )
  )
  returning id
  into v_event_id;

  return v_event_id;
end;
$function$;

revoke all on function
  editorial.record_artist_representation_event(
    uuid,
    text,
    uuid,
    uuid,
    uuid,
    jsonb
  )
from public, anon, authenticated, service_role;


create or replace function editorial.sync_artist_portal_roles(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_has_pending_claim boolean;
  v_has_active_representation boolean;
  v_note constant text :=
    'Managed by Artist representation authority';
begin
  if p_user_id is null then
    return;
  end if;

  select exists (
    select 1
    from public.artist_claim_requests claim
    where claim.claimant_user_id = p_user_id
      and claim.status = 'pending'
  )
  into v_has_pending_claim;

  select exists (
    select 1
    from public.artist_representations representation
    where representation.user_id = p_user_id
      and representation.status = 'active'
  )
  into v_has_active_representation;

  if v_has_pending_claim then
    insert into public.user_role_assignments (
      user_id,
      role_key,
      status,
      assigned_by,
      assigned_at,
      notes
    )
    values (
      p_user_id,
      'artist_claimant',
      'active',
      auth.uid(),
      now(),
      v_note
    )
    on conflict (
      user_id,
      role_key
    )
    do update
      set
        status = 'active',
        assigned_by = excluded.assigned_by,
        assigned_at = now(),
        notes = excluded.notes,
        updated_at = now()
      where public.user_role_assignments.notes =
            v_note;
  else
    update public.user_role_assignments
    set
      status = 'revoked',
      updated_at = now()
    where user_id = p_user_id
      and role_key = 'artist_claimant'
      and notes = v_note
      and status is distinct from 'revoked';
  end if;

  if v_has_active_representation then
    insert into public.user_role_assignments (
      user_id,
      role_key,
      status,
      assigned_by,
      assigned_at,
      notes
    )
    values (
      p_user_id,
      'artist_manager',
      'active',
      auth.uid(),
      now(),
      v_note
    )
    on conflict (
      user_id,
      role_key
    )
    do update
      set
        status = 'active',
        assigned_by = excluded.assigned_by,
        assigned_at = now(),
        notes = excluded.notes,
        updated_at = now()
      where public.user_role_assignments.notes =
            v_note;
  else
    update public.user_role_assignments
    set
      status = 'revoked',
      updated_at = now()
    where user_id = p_user_id
      and role_key = 'artist_manager'
      and notes = v_note
      and status is distinct from 'revoked';
  end if;
end;
$function$;

revoke all on function
  editorial.sync_artist_portal_roles(uuid)
from public, anon, authenticated, service_role;


create or replace function public.community_submit_artist_claim(
  p_artist_id uuid,
  p_claimant_role text,
  p_statement text,
  p_evidence jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
  v_role text :=
    lower(
      trim(
        coalesce(
          p_claimant_role,
          ''
        )
      )
    );
  v_statement text :=
    trim(
      coalesce(
        p_statement,
        ''
      )
    );
  v_claim_id uuid;
  v_evidence jsonb;
  v_type text;
  v_reference text;
  v_note text;
begin
  if v_actor is null then
    raise exception
      'authentication_required';
  end if;

  if not exists (
    select 1
    from public.registry_artists artist
    where artist.id = p_artist_id
      and artist.status = 'active'
  ) then
    raise exception
      'artist_not_claimable';
  end if;

  if v_role not in (
    'artist',
    'manager',
    'label',
    'publicist',
    'team_member',
    'other'
  ) then
    raise exception
      'invalid_claimant_role';
  end if;

  if char_length(v_statement) < 10
     or char_length(v_statement) > 4000
  then
    raise exception
      'invalid_claim_statement';
  end if;

  if coalesce(
       jsonb_typeof(
         p_evidence
       ),
       'null'
     ) <> 'array'
  then
    raise exception
      'claim_evidence_must_be_array';
  end if;

  if jsonb_array_length(
       p_evidence
     ) > 10
  then
    raise exception
      'too_many_claim_evidence_items';
  end if;

  if exists (
    select 1
    from public.artist_representations representation
    where representation.artist_id = p_artist_id
      and representation.user_id = v_actor
      and representation.status in (
        'pending',
        'active'
      )
  ) then
    raise exception
      'representation_already_exists';
  end if;

  if exists (
    select 1
    from public.artist_claim_requests claim
    where claim.artist_id = p_artist_id
      and claim.claimant_user_id = v_actor
      and claim.status = 'pending'
  ) then
    raise exception
      'claim_already_pending';
  end if;

  insert into public.artist_claim_requests (
    artist_id,
    claimant_user_id,
    claimant_role,
    statement
  )
  values (
    p_artist_id,
    v_actor,
    v_role,
    v_statement
  )
  returning id
  into v_claim_id;

  for v_evidence
  in
    select value
    from jsonb_array_elements(
      p_evidence
    )
  loop
    v_type :=
      lower(
        trim(
          coalesce(
            v_evidence->>'type',
            ''
          )
        )
      );

    v_reference :=
      nullif(
        trim(
          coalesce(
            v_evidence->>'reference',
            ''
          )
        ),
        ''
      );

    v_note :=
      nullif(
        trim(
          coalesce(
            v_evidence->>'note',
            ''
          )
        ),
        ''
      );

    if v_type not in (
      'official_website',
      'official_social',
      'business_email',
      'label_or_distributor',
      'public_announcement',
      'other'
    ) then
      raise exception
        'invalid_claim_evidence_type';
    end if;

    if v_reference is null
       and v_note is null
    then
      raise exception
        'claim_evidence_requires_content';
    end if;

    if v_reference is not null
       and char_length(
         v_reference
       ) > 2048
    then
      raise exception
        'claim_evidence_reference_too_long';
    end if;

    if v_note is not null
       and char_length(
         v_note
       ) > 2000
    then
      raise exception
        'claim_evidence_note_too_long';
    end if;

    insert into public.artist_claim_evidence (
      claim_id,
      evidence_type,
      reference,
      note
    )
    values (
      v_claim_id,
      v_type,
      v_reference,
      v_note
    );
  end loop;

  perform editorial.record_artist_representation_event(
    p_artist_id,
    'claim_submitted',
    v_claim_id,
    null,
    v_actor,
    jsonb_build_object(
      'claimant_role',
      v_role
    )
  );

  perform editorial.sync_artist_portal_roles(
    v_actor
  );

  return jsonb_build_object(
    'claim_id',
      v_claim_id,
    'artist_id',
      p_artist_id,
    'status',
      'pending',
    'claimant_role',
      v_role
  );
end;
$function$;

revoke all on function public.community_submit_artist_claim(
  uuid,
  text,
  text,
  jsonb
)
from public, anon;

grant execute on function public.community_submit_artist_claim(
  uuid,
  text,
  text,
  jsonb
)
to authenticated;


create or replace function public.community_withdraw_artist_claim(
  p_claim_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
  v_claim public.artist_claim_requests%rowtype;
  v_reason text :=
    nullif(
      trim(
        coalesce(
          p_reason,
          ''
        )
      ),
      ''
    );
begin
  if v_actor is null then
    raise exception
      'authentication_required';
  end if;

  select *
  into v_claim
  from public.artist_claim_requests
  where id = p_claim_id
  for update;

  if not found
     or v_claim.claimant_user_id
        is distinct from v_actor
  then
    raise exception
      'claim_not_found';
  end if;

  if v_claim.status <> 'pending' then
    raise exception
      'claim_not_pending';
  end if;

  update public.artist_claim_requests
  set
    status = 'withdrawn',
    decision_reason =
      coalesce(
        v_reason,
        'Withdrawn by claimant'
      ),
    updated_at = now()
  where id = p_claim_id;

  perform editorial.record_artist_representation_event(
    v_claim.artist_id,
    'claim_withdrawn',
    v_claim.id,
    null,
    v_actor,
    jsonb_build_object(
      'reason',
      coalesce(
        v_reason,
        'Withdrawn by claimant'
      )
    )
  );

  perform editorial.sync_artist_portal_roles(
    v_actor
  );

  return jsonb_build_object(
    'claim_id',
      p_claim_id,
    'status',
      'withdrawn'
  );
end;
$function$;

revoke all on function public.community_withdraw_artist_claim(
  uuid,
  text
)
from public, anon;

grant execute on function public.community_withdraw_artist_claim(
  uuid,
  text
)
to authenticated;


create or replace function public.community_get_artist_representation_state(
  p_artist_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
stable
as $function$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception
      'authentication_required';
  end if;

  select jsonb_build_object(
    'artist',
      jsonb_build_object(
        'id',
          artist.id,
        'slug',
          artist.slug,
        'display_name',
          artist.display_name,
        'status',
          artist.status
      ),
    'latest_claim',
      (
        select jsonb_build_object(
          'id',
            claim.id,
          'claimant_role',
            claim.claimant_role,
          'status',
            claim.status,
          'statement',
            claim.statement,
          'submitted_at',
            claim.submitted_at,
          'decided_at',
            claim.decided_at,
          'decision_reason',
            claim.decision_reason,
          'evidence',
            (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'id',
                      evidence.id,
                    'type',
                      evidence.evidence_type,
                    'reference',
                      evidence.reference,
                    'note',
                      evidence.note
                  )
                  order by evidence.created_at
                ),
                '[]'::jsonb
              )
              from public.artist_claim_evidence evidence
              where evidence.claim_id =
                    claim.id
            )
        )
        from public.artist_claim_requests claim
        where claim.artist_id =
              artist.id
          and claim.claimant_user_id =
              v_actor
        order by claim.submitted_at desc
        limit 1
      ),
    'representation',
      (
        select jsonb_build_object(
          'id',
            representation.id,
          'role',
            representation.representation_role,
          'status',
            representation.status,
          'permissions',
            jsonb_build_object(
              'profile',
                representation.can_manage_profile,
              'releases',
                representation.can_submit_releases,
              'updates',
                representation.can_post_updates,
              'team',
                representation.can_manage_team
            ),
          'invited_at',
            representation.invited_at,
          'accepted_at',
            representation.accepted_at,
          'verified_at',
            representation.verified_at
        )
        from public.artist_representations representation
        where representation.artist_id =
              artist.id
          and representation.user_id =
              v_actor
          and representation.status in (
            'pending',
            'active'
          )
        order by representation.created_at desc
        limit 1
      ),
    'can_claim',
      (
        artist.status = 'active'
        and not exists (
          select 1
          from public.artist_representations representation
          where representation.artist_id =
                artist.id
            and representation.user_id =
                v_actor
            and representation.status in (
              'pending',
              'active'
            )
        )
        and not exists (
          select 1
          from public.artist_claim_requests claim
          where claim.artist_id =
                artist.id
            and claim.claimant_user_id =
                v_actor
            and claim.status =
                'pending'
        )
      )
  )
  into v_result
  from public.registry_artists artist
  where artist.id = p_artist_id;

  if v_result is null then
    raise exception
      'artist_not_found';
  end if;

  return v_result;
end;
$function$;

revoke all on function public.community_get_artist_representation_state(
  uuid
)
from public, anon;

grant execute on function public.community_get_artist_representation_state(
  uuid
)
to authenticated;


create or replace function public.community_admin_get_artist_claims(
  p_status text default 'pending',
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
stable
as $function$
declare
  v_status text :=
    nullif(
      lower(
        trim(
          coalesce(
            p_status,
            ''
          )
        )
      ),
      ''
    );
  v_limit integer :=
    least(
      greatest(
        coalesce(
          p_limit,
          100
        ),
        1
      ),
      200
    );
  v_result jsonb;
begin
  if not editorial.current_user_can_review_artist_claims() then
    raise exception
      'insufficient_privilege';
  end if;

  if v_status is not null
     and v_status not in (
       'pending',
       'verified',
       'rejected',
       'withdrawn',
       'revoked'
     )
  then
    raise exception
      'invalid_claim_status';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
          claim.id,
        'status',
          claim.status,
        'claimant_role',
          claim.claimant_role,
        'statement',
          claim.statement,
        'submitted_at',
          claim.submitted_at,
        'decided_at',
          claim.decided_at,
        'decision_reason',
          claim.decision_reason,
        'artist',
          jsonb_build_object(
            'id',
              artist.id,
            'slug',
              artist.slug,
            'display_name',
              artist.display_name
          ),
        'claimant',
          jsonb_build_object(
            'user_id',
              claim.claimant_user_id,
            'username',
              profile.username,
            'display_name',
              profile.display_name
          ),
        'evidence',
          (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'id',
                    evidence.id,
                  'type',
                    evidence.evidence_type,
                  'reference',
                    evidence.reference,
                  'note',
                    evidence.note
                )
                order by evidence.created_at
              ),
              '[]'::jsonb
            )
            from public.artist_claim_evidence evidence
            where evidence.claim_id =
                  claim.id
          )
      )
      order by
        claim.submitted_at asc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select *
    from public.artist_claim_requests claim
    where v_status is null
       or claim.status = v_status
    order by claim.submitted_at asc
    limit v_limit
  ) claim
  join public.registry_artists artist
    on artist.id = claim.artist_id
  left join public.user_profiles profile
    on profile.user_id =
       claim.claimant_user_id;

  return v_result;
end;
$function$;

revoke all on function public.community_admin_get_artist_claims(
  text,
  integer
)
from public, anon;

grant execute on function public.community_admin_get_artist_claims(
  text,
  integer
)
to authenticated;


create or replace function public.community_admin_decide_artist_claim(
  p_claim_id uuid,
  p_decision text,
  p_reason text,
  p_can_manage_profile boolean default null,
  p_can_submit_releases boolean default null,
  p_can_post_updates boolean default null,
  p_can_manage_team boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
  v_decision text :=
    lower(
      trim(
        coalesce(
          p_decision,
          ''
        )
      )
    );
  v_reason text :=
    trim(
      coalesce(
        p_reason,
        ''
      )
    );
  v_claim public.artist_claim_requests%rowtype;
  v_defaults record;
  v_representation_id uuid;
  v_profile boolean;
  v_releases boolean;
  v_updates boolean;
  v_team boolean;
begin
  if v_actor is null then
    raise exception
      'authentication_required';
  end if;

  if not editorial.current_user_can_review_artist_claims() then
    raise exception
      'insufficient_privilege';
  end if;

  if v_decision not in (
    'verified',
    'rejected'
  ) then
    raise exception
      'invalid_claim_decision';
  end if;

  if char_length(v_reason) < 3
     or char_length(v_reason) > 4000
  then
    raise exception
      'invalid_claim_decision_reason';
  end if;

  select *
  into v_claim
  from public.artist_claim_requests
  where id = p_claim_id
  for update;

  if not found then
    raise exception
      'claim_not_found';
  end if;

  if v_claim.status <> 'pending' then
    raise exception
      'claim_not_pending';
  end if;

  if v_claim.claimant_user_id is null then
    raise exception
      'claimant_account_missing';
  end if;

  if v_decision = 'rejected' then
    update public.artist_claim_requests
    set
      status = 'rejected',
      decided_at = now(),
      decided_by = v_actor,
      decision_reason = v_reason,
      updated_at = now()
    where id = v_claim.id;

    perform editorial.record_artist_representation_event(
      v_claim.artist_id,
      'claim_rejected',
      v_claim.id,
      null,
      v_claim.claimant_user_id,
      jsonb_build_object(
        'reason',
          v_reason
      )
    );

    insert into public.admin_audit_events (
      actor_user_id,
      target_user_id,
      event_type,
      target_table,
      target_record_id,
      message,
      metadata
    )
    values (
      v_actor,
      v_claim.claimant_user_id,
      'artist_claim_rejected',
      'artist_claim_requests',
      v_claim.id::text,
      v_reason,
      jsonb_build_object(
        'artist_id',
          v_claim.artist_id
      )
    );

    perform editorial.sync_artist_portal_roles(
      v_claim.claimant_user_id
    );

    return jsonb_build_object(
      'claim_id',
        v_claim.id,
      'status',
        'rejected'
    );
  end if;

  select *
  into v_defaults
  from editorial.artist_representation_defaults(
    v_claim.claimant_role
  );

  v_profile :=
    coalesce(
      p_can_manage_profile,
      v_defaults.can_manage_profile
    );

  v_releases :=
    coalesce(
      p_can_submit_releases,
      v_defaults.can_submit_releases
    );

  v_updates :=
    coalesce(
      p_can_post_updates,
      v_defaults.can_post_updates
    );

  v_team :=
    coalesce(
      p_can_manage_team,
      v_defaults.can_manage_team
    );

  select representation.id
  into v_representation_id
  from public.artist_representations representation
  where representation.artist_id =
        v_claim.artist_id
    and representation.user_id =
        v_claim.claimant_user_id
    and representation.status in (
      'pending',
      'active'
    )
  order by representation.created_at desc
  limit 1
  for update;

  if v_representation_id is null then
    insert into public.artist_representations (
      artist_id,
      user_id,
      representation_role,
      status,
      source_claim_id,
      can_manage_profile,
      can_submit_releases,
      can_post_updates,
      can_manage_team,
      accepted_at,
      verified_by,
      verified_at
    )
    values (
      v_claim.artist_id,
      v_claim.claimant_user_id,
      v_claim.claimant_role,
      'active',
      v_claim.id,
      v_profile,
      v_releases,
      v_updates,
      v_team,
      now(),
      v_actor,
      now()
    )
    returning id
    into v_representation_id;
  else
    update public.artist_representations
    set
      representation_role =
        v_claim.claimant_role,
      status = 'active',
      source_claim_id =
        v_claim.id,
      can_manage_profile =
        v_profile,
      can_submit_releases =
        v_releases,
      can_post_updates =
        v_updates,
      can_manage_team =
        v_team,
      accepted_at =
        coalesce(
          accepted_at,
          now()
        ),
      verified_by =
        v_actor,
      verified_at =
        now(),
      revoked_by =
        null,
      revoked_at =
        null,
      revocation_reason =
        null,
      updated_at =
        now()
    where id =
          v_representation_id;
  end if;

  update public.artist_claim_requests
  set
    status = 'verified',
    decided_at = now(),
    decided_by = v_actor,
    decision_reason = v_reason,
    updated_at = now()
  where id = v_claim.id;

  perform editorial.record_artist_representation_event(
    v_claim.artist_id,
    'claim_verified',
    v_claim.id,
    v_representation_id,
    v_claim.claimant_user_id,
    jsonb_build_object(
      'reason',
        v_reason,
      'role',
        v_claim.claimant_role,
      'permissions',
        jsonb_build_object(
          'profile',
            v_profile,
          'releases',
            v_releases,
          'updates',
            v_updates,
          'team',
            v_team
        )
    )
  );

  insert into public.admin_audit_events (
    actor_user_id,
    target_user_id,
    event_type,
    target_table,
    target_record_id,
    message,
    metadata
  )
  values (
    v_actor,
    v_claim.claimant_user_id,
    'artist_claim_verified',
    'artist_claim_requests',
    v_claim.id::text,
    v_reason,
    jsonb_build_object(
      'artist_id',
        v_claim.artist_id,
      'representation_id',
        v_representation_id,
      'role',
        v_claim.claimant_role,
      'permissions',
        jsonb_build_object(
          'profile',
            v_profile,
          'releases',
            v_releases,
          'updates',
            v_updates,
          'team',
            v_team
        )
    )
  );

  perform editorial.sync_artist_portal_roles(
    v_claim.claimant_user_id
  );

  return jsonb_build_object(
    'claim_id',
      v_claim.id,
    'status',
      'verified',
    'representation_id',
      v_representation_id,
    'permissions',
      jsonb_build_object(
        'profile',
          v_profile,
        'releases',
          v_releases,
        'updates',
          v_updates,
        'team',
          v_team
      )
  );
end;
$function$;

revoke all on function public.community_admin_decide_artist_claim(
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  boolean
)
from public, anon;

grant execute on function public.community_admin_decide_artist_claim(
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  boolean
)
to authenticated;


create or replace function public.community_artist_get_team(
  p_artist_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
stable
as $function$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception
      'authentication_required';
  end if;

  if not exists (
    select 1
    from public.artist_representations representation
    where representation.artist_id = p_artist_id
      and representation.user_id = v_actor
      and representation.status = 'active'
  )
     and not editorial.current_user_can_review_artist_claims()
  then
    raise exception
      'insufficient_privilege';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
          representation.id,
        'user_id',
          representation.user_id,
        'username',
          profile.username,
        'display_name',
          profile.display_name,
        'role',
          representation.representation_role,
        'status',
          representation.status,
        'permissions',
          jsonb_build_object(
            'profile',
              representation.can_manage_profile,
            'releases',
              representation.can_submit_releases,
            'updates',
              representation.can_post_updates,
            'team',
              representation.can_manage_team
          ),
        'invited_at',
          representation.invited_at,
        'accepted_at',
          representation.accepted_at,
        'verified_at',
          representation.verified_at
      )
      order by
        case representation.status
          when 'active' then 0
          else 1
        end,
        representation.created_at
    ),
    '[]'::jsonb
  )
  into v_result
  from public.artist_representations representation
  left join public.user_profiles profile
    on profile.user_id =
       representation.user_id
  where representation.artist_id =
        p_artist_id
    and representation.status in (
      'pending',
      'active'
    );

  return v_result;
end;
$function$;

revoke all on function public.community_artist_get_team(
  uuid
)
from public, anon;

grant execute on function public.community_artist_get_team(
  uuid
)
to authenticated;


create or replace function public.community_artist_invite_representative(
  p_artist_id uuid,
  p_username text,
  p_representation_role text,
  p_can_manage_profile boolean default null,
  p_can_submit_releases boolean default null,
  p_can_post_updates boolean default null,
  p_can_manage_team boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
  v_actor_rep public.artist_representations%rowtype;
  v_target_user uuid;
  v_role text :=
    lower(
      trim(
        coalesce(
          p_representation_role,
          ''
        )
      )
    );
  v_defaults record;
  v_profile boolean;
  v_releases boolean;
  v_updates boolean;
  v_team boolean;
  v_representation_id uuid;
begin
  if v_actor is null then
    raise exception
      'authentication_required';
  end if;

  if v_role not in (
    'manager',
    'label',
    'publicist',
    'team_member',
    'other'
  ) then
    raise exception
      'invalid_team_representation_role';
  end if;

  select *
  into v_actor_rep
  from public.artist_representations representation
  where representation.artist_id = p_artist_id
    and representation.user_id = v_actor
    and representation.status = 'active'
    and representation.can_manage_team = true
  order by representation.created_at desc
  limit 1;

  if not found then
    raise exception
      'insufficient_artist_team_privilege';
  end if;

  select profile.user_id
  into v_target_user
  from public.user_profiles profile
  where profile.username_normalized =
        public.community_normalize_username(
          p_username
        )
  limit 1;

  if v_target_user is null then
    raise exception
      'team_account_not_found';
  end if;

  if v_target_user = v_actor then
    raise exception
      'cannot_invite_self';
  end if;

  if exists (
    select 1
    from public.artist_representations representation
    where representation.artist_id = p_artist_id
      and representation.user_id =
          v_target_user
      and representation.status in (
        'pending',
        'active'
      )
  ) then
    raise exception
      'representation_already_exists';
  end if;

  select *
  into v_defaults
  from editorial.artist_representation_defaults(
    v_role
  );

  v_profile :=
    coalesce(
      p_can_manage_profile,
      v_defaults.can_manage_profile
    );

  v_releases :=
    coalesce(
      p_can_submit_releases,
      v_defaults.can_submit_releases
    );

  v_updates :=
    coalesce(
      p_can_post_updates,
      v_defaults.can_post_updates
    );

  v_team :=
    coalesce(
      p_can_manage_team,
      v_defaults.can_manage_team
    );

  if v_profile
     and not v_actor_rep.can_manage_profile
  then
    raise exception
      'cannot_delegate_profile_permission';
  end if;

  if v_releases
     and not v_actor_rep.can_submit_releases
  then
    raise exception
      'cannot_delegate_release_permission';
  end if;

  if v_updates
     and not v_actor_rep.can_post_updates
  then
    raise exception
      'cannot_delegate_update_permission';
  end if;

  if v_team
     and not v_actor_rep.can_manage_team
  then
    raise exception
      'cannot_delegate_team_permission';
  end if;

  insert into public.artist_representations (
    artist_id,
    user_id,
    representation_role,
    status,
    can_manage_profile,
    can_submit_releases,
    can_post_updates,
    can_manage_team,
    invited_by,
    invited_at
  )
  values (
    p_artist_id,
    v_target_user,
    v_role,
    'pending',
    v_profile,
    v_releases,
    v_updates,
    v_team,
    v_actor,
    now()
  )
  returning id
  into v_representation_id;

  perform editorial.record_artist_representation_event(
    p_artist_id,
    'representation_invited',
    null,
    v_representation_id,
    v_target_user,
    jsonb_build_object(
      'role',
        v_role,
      'permissions',
        jsonb_build_object(
          'profile',
            v_profile,
          'releases',
            v_releases,
          'updates',
            v_updates,
          'team',
            v_team
        )
    )
  );

  return jsonb_build_object(
    'representation_id',
      v_representation_id,
    'status',
      'pending',
    'user_id',
      v_target_user
  );
end;
$function$;

revoke all on function public.community_artist_invite_representative(
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  boolean
)
from public, anon;

grant execute on function public.community_artist_invite_representative(
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  boolean
)
to authenticated;


create or replace function public.community_artist_accept_representation(
  p_representation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
  v_rep public.artist_representations%rowtype;
begin
  if v_actor is null then
    raise exception
      'authentication_required';
  end if;

  select *
  into v_rep
  from public.artist_representations
  where id = p_representation_id
  for update;

  if not found
     or v_rep.user_id
        is distinct from v_actor
  then
    raise exception
      'representation_not_found';
  end if;

  if v_rep.status <> 'pending' then
    raise exception
      'representation_not_pending';
  end if;

  update public.artist_representations
  set
    status = 'active',
    accepted_at = now(),
    updated_at = now()
  where id = v_rep.id;

  perform editorial.record_artist_representation_event(
    v_rep.artist_id,
    'representation_accepted',
    v_rep.source_claim_id,
    v_rep.id,
    v_actor,
    '{}'::jsonb
  );

  perform editorial.sync_artist_portal_roles(
    v_actor
  );

  return jsonb_build_object(
    'representation_id',
      v_rep.id,
    'status',
      'active'
  );
end;
$function$;

revoke all on function public.community_artist_accept_representation(
  uuid
)
from public, anon;

grant execute on function public.community_artist_accept_representation(
  uuid
)
to authenticated;


create or replace function public.community_artist_update_representative(
  p_representation_id uuid,
  p_representation_role text,
  p_can_manage_profile boolean,
  p_can_submit_releases boolean,
  p_can_post_updates boolean,
  p_can_manage_team boolean
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
  v_target public.artist_representations%rowtype;
  v_actor_rep public.artist_representations%rowtype;
  v_role text :=
    lower(
      trim(
        coalesce(
          p_representation_role,
          ''
        )
      )
    );
begin
  if v_actor is null then
    raise exception
      'authentication_required';
  end if;

  select *
  into v_target
  from public.artist_representations
  where id = p_representation_id
  for update;

  if not found
     or v_target.status not in (
       'pending',
       'active'
     )
  then
    raise exception
      'representation_not_found';
  end if;

  if v_target.representation_role = 'artist' then
    raise exception
      'artist_role_requires_admin_review';
  end if;

  if v_role not in (
    'manager',
    'label',
    'publicist',
    'team_member',
    'other'
  ) then
    raise exception
      'invalid_team_representation_role';
  end if;

  select *
  into v_actor_rep
  from public.artist_representations representation
  where representation.artist_id =
        v_target.artist_id
    and representation.user_id =
        v_actor
    and representation.status =
        'active'
    and representation.can_manage_team =
        true
  order by representation.created_at desc
  limit 1;

  if not found then
    raise exception
      'insufficient_artist_team_privilege';
  end if;

  if p_can_manage_profile
     and not v_actor_rep.can_manage_profile
  then
    raise exception
      'cannot_delegate_profile_permission';
  end if;

  if p_can_submit_releases
     and not v_actor_rep.can_submit_releases
  then
    raise exception
      'cannot_delegate_release_permission';
  end if;

  if p_can_post_updates
     and not v_actor_rep.can_post_updates
  then
    raise exception
      'cannot_delegate_update_permission';
  end if;

  if p_can_manage_team
     and not v_actor_rep.can_manage_team
  then
    raise exception
      'cannot_delegate_team_permission';
  end if;

  update public.artist_representations
  set
    representation_role =
      v_role,
    can_manage_profile =
      p_can_manage_profile,
    can_submit_releases =
      p_can_submit_releases,
    can_post_updates =
      p_can_post_updates,
    can_manage_team =
      p_can_manage_team,
    updated_at =
      now()
  where id =
        v_target.id;

  perform editorial.record_artist_representation_event(
    v_target.artist_id,
    'representation_updated',
    v_target.source_claim_id,
    v_target.id,
    v_target.user_id,
    jsonb_build_object(
      'role',
        v_role,
      'permissions',
        jsonb_build_object(
          'profile',
            p_can_manage_profile,
          'releases',
            p_can_submit_releases,
          'updates',
            p_can_post_updates,
          'team',
            p_can_manage_team
        )
    )
  );

  return jsonb_build_object(
    'representation_id',
      v_target.id,
    'status',
      v_target.status,
    'role',
      v_role
  );
end;
$function$;

revoke all on function public.community_artist_update_representative(
  uuid,
  text,
  boolean,
  boolean,
  boolean,
  boolean
)
from public, anon;

grant execute on function public.community_artist_update_representative(
  uuid,
  text,
  boolean,
  boolean,
  boolean,
  boolean
)
to authenticated;


create or replace function public.community_artist_revoke_representation(
  p_representation_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
  v_target public.artist_representations%rowtype;
  v_reason text :=
    trim(
      coalesce(
        p_reason,
        ''
      )
    );
  v_actor_can_manage boolean;
begin
  if v_actor is null then
    raise exception
      'authentication_required';
  end if;

  if char_length(v_reason) < 3
     or char_length(v_reason) > 4000
  then
    raise exception
      'invalid_revocation_reason';
  end if;

  select *
  into v_target
  from public.artist_representations
  where id = p_representation_id
  for update;

  if not found
     or v_target.status not in (
       'pending',
       'active'
     )
  then
    raise exception
      'representation_not_found';
  end if;

  if v_target.user_id = v_actor then
    v_actor_can_manage := true;
  else
    select exists (
      select 1
      from public.artist_representations representation
      where representation.artist_id =
            v_target.artist_id
        and representation.user_id =
            v_actor
        and representation.status =
            'active'
        and representation.can_manage_team =
            true
    )
    into v_actor_can_manage;
  end if;

  if not v_actor_can_manage then
    raise exception
      'insufficient_artist_team_privilege';
  end if;

  if v_target.representation_role = 'artist'
     and v_target.user_id <> v_actor
  then
    raise exception
      'artist_role_requires_admin_review';
  end if;

  update public.artist_representations
  set
    status = 'revoked',
    revoked_by = v_actor,
    revoked_at = now(),
    revocation_reason = v_reason,
    updated_at = now()
  where id = v_target.id;

  if v_target.source_claim_id is not null then
    update public.artist_claim_requests
    set
      status = 'revoked',
      decided_at =
        coalesce(
          decided_at,
          now()
        ),
      decision_reason =
        v_reason,
      updated_at =
        now()
    where id =
          v_target.source_claim_id
      and status = 'verified';
  end if;

  perform editorial.record_artist_representation_event(
    v_target.artist_id,
    'representation_revoked',
    v_target.source_claim_id,
    v_target.id,
    v_target.user_id,
    jsonb_build_object(
      'reason',
        v_reason
    )
  );

  perform editorial.sync_artist_portal_roles(
    v_target.user_id
  );

  return jsonb_build_object(
    'representation_id',
      v_target.id,
    'status',
      'revoked'
  );
end;
$function$;

revoke all on function public.community_artist_revoke_representation(
  uuid,
  text
)
from public, anon;

grant execute on function public.community_artist_revoke_representation(
  uuid,
  text
)
to authenticated;


create or replace function public.community_admin_revoke_artist_representation(
  p_representation_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
  v_target public.artist_representations%rowtype;
  v_reason text :=
    trim(
      coalesce(
        p_reason,
        ''
      )
    );
begin
  if v_actor is null then
    raise exception
      'authentication_required';
  end if;

  if not editorial.current_user_can_review_artist_claims() then
    raise exception
      'insufficient_privilege';
  end if;

  if char_length(v_reason) < 3
     or char_length(v_reason) > 4000
  then
    raise exception
      'invalid_revocation_reason';
  end if;

  select *
  into v_target
  from public.artist_representations
  where id = p_representation_id
  for update;

  if not found
     or v_target.status not in (
       'pending',
       'active'
     )
  then
    raise exception
      'representation_not_found';
  end if;

  update public.artist_representations
  set
    status = 'revoked',
    revoked_by = v_actor,
    revoked_at = now(),
    revocation_reason = v_reason,
    updated_at = now()
  where id = v_target.id;

  if v_target.source_claim_id is not null then
    update public.artist_claim_requests
    set
      status = 'revoked',
      decided_at =
        coalesce(
          decided_at,
          now()
        ),
      decided_by =
        coalesce(
          decided_by,
          v_actor
        ),
      decision_reason =
        v_reason,
      updated_at =
        now()
    where id =
          v_target.source_claim_id
      and status = 'verified';
  end if;

  perform editorial.record_artist_representation_event(
    v_target.artist_id,
    'representation_revoked',
    v_target.source_claim_id,
    v_target.id,
    v_target.user_id,
    jsonb_build_object(
      'reason',
        v_reason,
      'admin',
        true
    )
  );

  insert into public.admin_audit_events (
    actor_user_id,
    target_user_id,
    event_type,
    target_table,
    target_record_id,
    message,
    metadata
  )
  values (
    v_actor,
    v_target.user_id,
    'artist_representation_revoked',
    'artist_representations',
    v_target.id::text,
    v_reason,
    jsonb_build_object(
      'artist_id',
        v_target.artist_id,
      'representation_role',
        v_target.representation_role
    )
  );

  perform editorial.sync_artist_portal_roles(
    v_target.user_id
  );

  return jsonb_build_object(
    'representation_id',
      v_target.id,
    'status',
      'revoked'
  );
end;
$function$;

revoke all on function public.community_admin_revoke_artist_representation(
  uuid,
  text
)
from public, anon;

grant execute on function public.community_admin_revoke_artist_representation(
  uuid,
  text
)
to authenticated;


do $m2_postflight$
declare
  v_table_count integer;
  v_public_function_count integer;
begin
  select count(*)::integer
  into v_table_count
  from pg_class class
  join pg_namespace namespace
    on namespace.oid =
       class.relnamespace
  where namespace.nspname =
        'public'
    and class.relname in (
      'artist_claim_requests',
      'artist_claim_evidence',
      'artist_representations',
      'artist_representation_events'
    )
    and class.relkind = 'r';

  if v_table_count <> 4 then
    raise exception
      'STOP: Expected four M2 authority tables, found %',
      v_table_count;
  end if;

  select count(*)::integer
  into v_public_function_count
  from pg_proc proc
  join pg_namespace namespace
    on namespace.oid =
       proc.pronamespace
  where namespace.nspname =
        'public'
    and proc.proname in (
      'community_submit_artist_claim',
      'community_withdraw_artist_claim',
      'community_get_artist_representation_state',
      'community_admin_get_artist_claims',
      'community_admin_decide_artist_claim',
      'community_artist_get_team',
      'community_artist_invite_representative',
      'community_artist_accept_representation',
      'community_artist_update_representative',
      'community_artist_revoke_representation',
      'community_admin_revoke_artist_representation'
    );

  if v_public_function_count <> 11 then
    raise exception
      'STOP: Expected eleven M2 public RPCs, found %',
      v_public_function_count;
  end if;
end;
$m2_postflight$;

commit;
