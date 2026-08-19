-- Governed account identity retirement authority.
--
-- This migration adds reusable authority for permanently retiring an Auth account
-- while preserving append-only Person identity history.
--
-- It intentionally does not retire any account by itself.
-- Approved account retirement remains a separate governed command execution.

begin;

do $account_identity_retirement_preflight$
begin
  if to_regclass('editorial.people') is null
     or to_regclass('editorial.person_identity_links') is null
     or to_regclass('editorial.person_identity_events') is null
     or to_regclass('editorial.resources') is null
     or to_regclass('editorial.resource_aliases') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('platform_private.command_types') is null
     or to_regclass('platform_private.command_receipts') is null
  then
    raise exception
      'STOP: required Person, account, Resource, or command authority is missing';
  end if;

  if to_regprocedure(
       'public.unlink_person_identity(uuid,bigint,uuid,text,text,uuid)'
     ) is null
     or to_regprocedure(
          'public.current_user_has_capability(text)'
        ) is null
     or to_regprocedure(
          'platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)'
        ) is null
     or to_regprocedure(
          'platform_private.complete_resource_command(uuid,jsonb)'
        ) is null
     or to_regprocedure(
          'platform_private.reject_resource_command(uuid,text,text,jsonb)'
        ) is null
     or to_regprocedure(
          'platform_private.read_authenticated_resource_command_result(uuid,boolean)'
        ) is null
  then
    raise exception
      'STOP: required governed command helpers are missing';
  end if;

  if not exists (
    select 1
    from public.capability_definitions
    where capability_key = 'manage_people_identity'
  )
     or not exists (
       select 1
       from public.capability_definitions
       where capability_key = 'manage_users'
     )
  then
    raise exception
      'STOP: account retirement requires manage_people_identity and manage_users';
  end if;

  if to_regclass(
       'editorial.retired_account_identities'
     ) is not null
     or exists (
       select 1
       from information_schema.columns
       where table_schema = 'editorial'
         and table_name = 'person_identity_links'
         and column_name = 'retired_user_id_snapshot'
     )
     or to_regprocedure(
          'public.retire_account_identity(uuid,uuid,bigint,uuid,text,text,uuid)'
        ) is not null
     or exists (
       select 1
       from platform_private.command_types
       where command_type = 'account.identity_retire'
     )
  then
    raise exception
      'STOP: account identity retirement authority already exists';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid =
          'editorial.person_identity_links'::regclass
      and conname =
          'person_identity_links_exactly_one_source_check'
  ) then
    raise exception
      'STOP: reviewed Person identity source constraint moved';
  end if;
end;
$account_identity_retirement_preflight$;

create table editorial.retired_account_identities (
  user_id uuid primary key,
  person_resource_id uuid not null,
  identity_link_id uuid not null,
  username_snapshot text,
  retired_by uuid,
  retired_at timestamptz not null default now(),
  reason text not null,
  correlation_id uuid,
  command_receipt_id uuid not null,
  created_at timestamptz not null default now(),

  constraint retired_account_identities_person_fkey
    foreign key (person_resource_id)
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,

  constraint retired_account_identities_link_fkey
    foreign key (identity_link_id)
    references editorial.person_identity_links(id)
    on update restrict
    on delete restrict,

  constraint retired_account_identities_actor_fkey
    foreign key (retired_by)
    references auth.users(id)
    on delete set null,

  constraint retired_account_identities_receipt_fkey
    foreign key (command_receipt_id)
    references platform_private.command_receipts(id)
    on update restrict
    on delete restrict,

  constraint retired_account_identities_reason_check
    check (
      nullif(
        btrim(reason),
        ''
      ) is not null
    ),

  constraint retired_account_identities_link_unique
    unique (identity_link_id)
);

comment on table editorial.retired_account_identities is
  'Durable account identity tombstones. Preserves the retired Auth user UUID and public username snapshot after live Auth/profile rows are deleted.';

alter table editorial.person_identity_links
  add column retired_user_id_snapshot uuid;

alter table editorial.person_identity_links
  add constraint person_identity_links_retired_user_snapshot_fkey
  foreign key (retired_user_id_snapshot)
  references editorial.retired_account_identities(user_id)
  on update restrict
  on delete restrict;

alter table editorial.person_identity_links
  drop constraint person_identity_links_exactly_one_source_check;

alter table editorial.person_identity_links
  add constraint person_identity_links_exactly_one_source_check
  check (
    num_nonnulls(
      user_id,
      retired_user_id_snapshot,
      registry_author_id,
      external_contributor_id
    ) = 1
  );

alter table editorial.person_identity_links
  add constraint person_identity_links_retired_user_snapshot_state_check
  check (
    retired_user_id_snapshot is null
    or (
      user_id is null
      and registry_author_id is null
      and external_contributor_id is null
      and link_state in (
        'retired',
        'superseded'
      )
    )
  );

create index person_identity_links_retired_user_snapshot_idx
on editorial.person_identity_links(
  retired_user_id_snapshot,
  person_resource_id,
  created_at
)
where retired_user_id_snapshot is not null;

comment on column editorial.person_identity_links.retired_user_id_snapshot is
  'Historical Auth user UUID retained only after a user-backed identity link is no longer live and the corresponding account tombstone exists.';

create or replace function
  editorial.protect_person_identity_link_target()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  if new.person_resource_id
       is distinct from old.person_resource_id
     or new.person_resource_kind
       is distinct from old.person_resource_kind
     or new.user_id
       is distinct from old.user_id
     or new.retired_user_id_snapshot
       is distinct from old.retired_user_id_snapshot
     or new.registry_author_id
       is distinct from old.registry_author_id
     or new.external_contributor_id
       is distinct from old.external_contributor_id
  then
    if old.user_id is not null
       and new.user_id is null
       and old.retired_user_id_snapshot is null
       and new.retired_user_id_snapshot = old.user_id
       and new.person_resource_id = old.person_resource_id
       and new.person_resource_kind = old.person_resource_kind
       and new.registry_author_id is not distinct from old.registry_author_id
       and new.external_contributor_id is not distinct from old.external_contributor_id
       and old.link_state in (
         'retired',
         'superseded'
       )
       and new.link_state = old.link_state
    then
      return new;
    end if;

    raise exception
      'Person identity links cannot be retargeted.';
  end if;

  return new;
end;
$function$;

drop trigger person_identity_links_protect_target
on editorial.person_identity_links;

create trigger person_identity_links_protect_target
before update of
  person_resource_id,
  person_resource_kind,
  user_id,
  retired_user_id_snapshot,
  registry_author_id,
  external_contributor_id
on editorial.person_identity_links
for each row
execute function editorial.protect_person_identity_link_target();

insert into platform_private.command_types (
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type,
  enabled
)
values (
  'account.identity_retire',
  'account.identity_retire.sync',
  'account.identity_retire.accepted',
  'account.identity_retire.succeeded',
  'account.identity_retire.failed',
  'account.identity_retire.retry_scheduled',
  true
);

create or replace function
public.retire_account_identity(
  p_user_id uuid,
  p_person_resource_id uuid,
  p_expected_identity_revision bigint,
  p_identity_link_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  user_id uuid,
  person_resource_id uuid,
  identity_revision bigint,
  identity_link_id uuid,
  account_deleted boolean,
  person_archived boolean,
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
  v_actor_id uuid;
  v_person editorial.people%rowtype;
  v_link editorial.person_identity_links%rowtype;
  v_begin record;
  v_read record;
  v_unlink record;
  v_request jsonb;
  v_result jsonb;
  v_correlation_id uuid;
  v_username text;
  v_blockers jsonb := '[]'::jsonb;
  v_constraint record;
  v_blocker_count bigint;
  v_dynamic_sql text;
  v_remaining_active_links bigint;
  v_archived boolean := false;
  v_snapshot_count bigint;
  v_prior_revision bigint;
begin
  if p_user_id is null
     or p_person_resource_id is null
     or p_expected_identity_revision is null
     or p_expected_identity_revision < 1
     or p_identity_link_id is null
     or nullif(
          btrim(
            coalesce(
              p_reason,
              ''
            )
          ),
          ''
        ) is null
  then
    raise exception
      using
        errcode = '22023',
        message =
          'Target user, Person, expected revision, identity link, and reason are required.';
  end if;

  if coalesce(
       auth.role(),
       ''
     ) <> 'authenticated'
     or auth.uid() is null
     or not public.current_user_has_capability(
       'manage_people_identity'
     )
     or not public.current_user_has_capability(
       'manage_users'
     )
  then
    raise exception
      using
        errcode = '42501',
        message =
          'People identity and user management permissions are required.';
  end if;

  v_actor_id := auth.uid();

  if p_user_id = v_actor_id then
    raise exception
      using
        errcode = '22023',
        message =
          'The current administrator cannot retire their own account through this command.';
  end if;

  v_request := jsonb_build_object(
    'user_id',
      p_user_id,
    'person_resource_id',
      p_person_resource_id,
    'expected_identity_revision',
      p_expected_identity_revision,
    'identity_link_id',
      p_identity_link_id,
    'reason',
      p_reason,
    'correlation_id',
      p_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'account.identity_retire',
    p_person_resource_id,
    p_idempotency_key,
    v_request
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
    user_id := p_user_id;
    person_resource_id := p_person_resource_id;
    identity_revision := nullif(
      v_read.result_payload ->> 'identity_revision',
      ''
    )::bigint;
    identity_link_id := p_identity_link_id;
    account_deleted := coalesce(
      (v_read.result_payload ->> 'account_deleted')::boolean,
      false
    );
    person_archived := coalesce(
      (v_read.result_payload ->> 'person_archived')::boolean,
      false
    );
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  v_correlation_id := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );

  select person.*
  into v_person
  from editorial.people person
  where person.resource_id = p_person_resource_id
  for update;

  if v_person.resource_id is null then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'account_retirement_person_not_found',
      'The target Person does not exist.',
      jsonb_build_object(
        'user_id', p_user_id,
        'person_resource_id', p_person_resource_id,
        'identity_revision', null,
        'identity_link_id', p_identity_link_id
      )
    );
  elsif v_person.person_state <> 'active' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'account_retirement_person_not_active',
      'Only an active Person may retire an account identity.',
      jsonb_build_object(
        'user_id', p_user_id,
        'person_resource_id', p_person_resource_id,
        'identity_revision', v_person.identity_revision,
        'identity_link_id', p_identity_link_id,
        'person_state', v_person.person_state
      )
    );
  elsif v_person.identity_revision <> p_expected_identity_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'account_retirement_person_revision_changed',
      'The Person identity changed before account retirement could be applied.',
      jsonb_build_object(
        'user_id', p_user_id,
        'person_resource_id', p_person_resource_id,
        'identity_revision', v_person.identity_revision,
        'identity_link_id', p_identity_link_id
      )
    );
  else
    select link.*
    into v_link
    from editorial.person_identity_links link
    where link.id = p_identity_link_id
      and link.person_resource_id = p_person_resource_id
    for update;

    if v_link.id is null then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'account_retirement_link_not_found',
        'The target account identity link does not exist.',
        jsonb_build_object(
          'user_id', p_user_id,
          'person_resource_id', p_person_resource_id,
          'identity_revision', v_person.identity_revision,
          'identity_link_id', p_identity_link_id
        )
      );
    elsif v_link.link_state <> 'active'
          or v_link.user_id is distinct from p_user_id
    then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'account_retirement_link_not_active_user',
        'The target identity link is not the active link for this account.',
        jsonb_build_object(
          'user_id', p_user_id,
          'person_resource_id', p_person_resource_id,
          'identity_revision', v_person.identity_revision,
          'identity_link_id', p_identity_link_id,
          'link_state', v_link.link_state
        )
      );
    elsif not exists (
      select 1
      from auth.users target_user
      where target_user.id = p_user_id
    )
       or not exists (
         select 1
         from public.user_profiles profile
         where profile.user_id = p_user_id
       )
    then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'account_retirement_live_account_missing',
        'The target Auth user or public profile is already missing.',
        jsonb_build_object(
          'user_id', p_user_id,
          'person_resource_id', p_person_resource_id,
          'identity_revision', v_person.identity_revision,
          'identity_link_id', p_identity_link_id
        )
      );
    elsif exists (
      select 1
      from public.user_role_assignments assignment
      join public.role_capabilities capability
        on capability.role_key = assignment.role_key
      where assignment.user_id = p_user_id
        and assignment.status = 'active'
        and (
          assignment.expires_at is null
          or assignment.expires_at > now()
        )
        and capability.capability_key in (
          'manage_users',
          'manage_people_identity',
          'merge_people_identity'
        )
    )
    then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'account_retirement_privileged_target',
        'Privileged operator accounts require a separate access-retirement workflow.',
        jsonb_build_object(
          'user_id', p_user_id,
          'person_resource_id', p_person_resource_id,
          'identity_revision', v_person.identity_revision,
          'identity_link_id', p_identity_link_id
        )
      );
    else
      for v_constraint in
        select
          source_namespace.nspname as schema_name,
          source_table.relname as table_name,
          source_column.attname as column_name,
          target_namespace.nspname || '.' ||
            target_table.relname as referenced_table,
          constraint_row.conname as constraint_name,
          case constraint_row.confdeltype
            when 'a' then 'NO ACTION'
            when 'r' then 'RESTRICT'
            else constraint_row.confdeltype::text
          end as delete_action
        from pg_constraint constraint_row
        join pg_class source_table
          on source_table.oid = constraint_row.conrelid
        join pg_namespace source_namespace
          on source_namespace.oid = source_table.relnamespace
        join pg_class target_table
          on target_table.oid = constraint_row.confrelid
        join pg_namespace target_namespace
          on target_namespace.oid = target_table.relnamespace
        join lateral unnest(
          constraint_row.conkey
        ) with ordinality as source_key(attnum, ord)
          on true
        join lateral unnest(
          constraint_row.confkey
        ) with ordinality as target_key(attnum, ord)
          on target_key.ord = source_key.ord
        join pg_attribute source_column
          on source_column.attrelid = constraint_row.conrelid
         and source_column.attnum = source_key.attnum
        join pg_attribute target_column
          on target_column.attrelid = constraint_row.confrelid
         and target_column.attnum = target_key.attnum
        where constraint_row.contype = 'f'
          and constraint_row.confdeltype in (
            'a',
            'r'
          )
          and constraint_row.confrelid in (
            'auth.users'::regclass,
            'public.user_profiles'::regclass
          )
          and target_column.attname in (
            'id',
            'user_id'
          )
          and not (
            source_namespace.nspname = 'editorial'
            and source_table.relname = 'person_identity_links'
            and source_column.attname = 'user_id'
          )
      loop
        v_dynamic_sql := format(
          'select count(*) from %I.%I where %I = $1',
          v_constraint.schema_name,
          v_constraint.table_name,
          v_constraint.column_name
        );

        execute v_dynamic_sql
        into v_blocker_count
        using p_user_id;

        if v_blocker_count > 0 then
          v_blockers := v_blockers || jsonb_build_array(
            jsonb_build_object(
              'schema', v_constraint.schema_name,
              'table', v_constraint.table_name,
              'column', v_constraint.column_name,
              'constraint', v_constraint.constraint_name,
              'delete_action', v_constraint.delete_action,
              'row_count', v_blocker_count
            )
          );
        end if;
      end loop;

      if jsonb_array_length(v_blockers) > 0 then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'account_retirement_blocked',
          'The target account still owns durable rows that cannot be deleted safely.',
          jsonb_build_object(
            'user_id', p_user_id,
            'person_resource_id', p_person_resource_id,
            'identity_revision', v_person.identity_revision,
            'identity_link_id', p_identity_link_id,
            'blockers', v_blockers
          )
        );
      else
        select profile.username
        into v_username
        from public.user_profiles profile
        where profile.user_id = p_user_id;

        select *
        into v_unlink
        from public.unlink_person_identity(
          p_person_resource_id,
          p_expected_identity_revision,
          p_identity_link_id,
          p_reason,
          'account-retire-unlink:' ||
            v_begin.command_receipt_id::text,
          v_correlation_id
        );

        if v_unlink.receipt_status <> 'succeeded' then
          perform platform_private.reject_resource_command(
            v_begin.command_receipt_id,
            'account_retirement_unlink_failed',
            'The governed Person identity unlink did not succeed.',
            jsonb_build_object(
              'user_id', p_user_id,
              'person_resource_id', p_person_resource_id,
              'identity_revision', v_unlink.identity_revision,
              'identity_link_id', p_identity_link_id,
              'unlink_receipt_id', v_unlink.command_receipt_id,
              'unlink_status', v_unlink.receipt_status
            )
          );
        else
          insert into editorial.retired_account_identities (
            user_id,
            person_resource_id,
            identity_link_id,
            username_snapshot,
            retired_by,
            retired_at,
            reason,
            correlation_id,
            command_receipt_id
          )
          values (
            p_user_id,
            p_person_resource_id,
            p_identity_link_id,
            v_username,
            v_actor_id,
            now(),
            p_reason,
            v_correlation_id,
            v_begin.command_receipt_id
          );

          update editorial.person_identity_links link
          set
            retired_user_id_snapshot = link.user_id,
            user_id = null
          where link.user_id = p_user_id
            and link.link_state in (
              'retired',
              'superseded'
            );

          get diagnostics v_snapshot_count = row_count;

          if v_snapshot_count < 1
             or exists (
               select 1
               from editorial.person_identity_links link
               where link.user_id = p_user_id
             )
          then
            raise exception
              'Account identity history was not fully converted to retired snapshots.';
          end if;

          select count(*)
          into v_remaining_active_links
          from editorial.person_identity_links link
          where link.person_resource_id = p_person_resource_id
            and link.link_state = 'active';

          select person.*
          into v_person
          from editorial.people person
          where person.resource_id = p_person_resource_id
          for update;

          if v_remaining_active_links = 0 then
            v_prior_revision := v_person.identity_revision;

            update editorial.people person
            set
              person_state = 'archived',
              preferred_identity_link_id = null,
              identity_revision = person.identity_revision + 1,
              updated_by = v_actor_id,
              updated_at = now()
            where person.resource_id = p_person_resource_id
            returning person.*
            into v_person;

            insert into editorial.person_identity_events (
              person_resource_id,
              actor_id,
              event_type,
              identity_link_id,
              prior_identity_revision,
              resulting_identity_revision,
              reason,
              correlation_id
            )
            values (
              p_person_resource_id,
              v_actor_id,
              'person_archived',
              p_identity_link_id,
              v_prior_revision,
              v_person.identity_revision,
              p_reason,
              v_correlation_id
            );

            update editorial.resource_aliases alias
            set
              is_canonical = false,
              retired_at = now()
            where alias.resource_id = p_person_resource_id
              and alias.retired_at is null;

            v_archived := true;
          end if;

          perform editorial.refresh_person_visibility(
            p_person_resource_id
          );

          delete from auth.users target_user
          where target_user.id = p_user_id;

          if not found
             or exists (
               select 1
               from auth.users target_user
               where target_user.id = p_user_id
             )
             or exists (
               select 1
               from public.user_profiles profile
               where profile.user_id = p_user_id
             )
          then
            raise exception
              'The target account was not deleted cleanly.';
          end if;

          v_result := jsonb_build_object(
            'user_id', p_user_id,
            'person_resource_id', p_person_resource_id,
            'identity_revision', v_person.identity_revision,
            'identity_link_id', p_identity_link_id,
            'identity_unlink_receipt_id', v_unlink.command_receipt_id,
            'retired_link_snapshot_count', v_snapshot_count,
            'account_deleted', true,
            'person_archived', v_archived,
            'correlation_id', v_correlation_id,
            'changed', true
          );

          perform platform_private.complete_resource_command(
            v_begin.command_receipt_id,
            v_result
          );
        end if;
      end if;
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
  user_id := p_user_id;
  person_resource_id := p_person_resource_id;
  identity_revision := nullif(
    v_read.result_payload ->> 'identity_revision',
    ''
  )::bigint;
  identity_link_id := p_identity_link_id;
  account_deleted := coalesce(
    (v_read.result_payload ->> 'account_deleted')::boolean,
    false
  );
  person_archived := coalesce(
    (v_read.result_payload ->> 'person_archived')::boolean,
    false
  );
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all
on function
public.retire_account_identity(
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
)
from public;

grant execute
on function
public.retire_account_identity(
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
)
to authenticated;

commit;
