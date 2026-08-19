do $verify_account_identity_retirement$
declare
  v_bad_count bigint;
begin
  if to_regclass('editorial.retired_account_identities') is null
     or to_regprocedure(
          'public.retire_account_identity(uuid,uuid,bigint,uuid,text,text,uuid)'
        ) is null
     or not exists (
       select 1
       from information_schema.columns
       where table_schema = 'editorial'
         and table_name = 'person_identity_links'
         and column_name = 'retired_user_id_snapshot'
     )
     or not exists (
       select 1
       from platform_private.command_types
       where command_type = 'account.identity_retire'
         and enabled
     )
  then
    raise exception
      'STOP: account identity retirement authority is incomplete';
  end if;

  select count(*)
  into v_bad_count
  from editorial.retired_account_identities tombstone
  left join platform_private.command_receipts receipt
    on receipt.id = tombstone.command_receipt_id
  where receipt.id is null
     or receipt.command_type <> 'account.identity_retire'
     or receipt.status <> 'succeeded'
     or receipt.resource_id <> tombstone.person_resource_id;

  if v_bad_count <> 0 then
    raise exception
      'STOP: retired account tombstone command receipt integrity failed for % rows',
      v_bad_count;
  end if;

  select count(*)
  into v_bad_count
  from editorial.retired_account_identities tombstone
  where exists (
          select 1
          from auth.users target_user
          where target_user.id = tombstone.user_id
        )
     or exists (
          select 1
          from public.user_profiles profile
          where profile.user_id = tombstone.user_id
        );

  if v_bad_count <> 0 then
    raise exception
      'STOP: retired account tombstones still have live Auth/profile rows for % accounts',
      v_bad_count;
  end if;

  select count(*)
  into v_bad_count
  from editorial.retired_account_identities tombstone
  left join editorial.person_identity_links link
    on link.id = tombstone.identity_link_id
   and link.person_resource_id = tombstone.person_resource_id
  where link.id is null
     or link.user_id is not null
     or link.retired_user_id_snapshot is distinct from tombstone.user_id
     or link.link_state not in ('retired', 'superseded');

  if v_bad_count <> 0 then
    raise exception
      'STOP: retired account historical Person link integrity failed for % rows',
      v_bad_count;
  end if;

  select count(*)
  into v_bad_count
  from editorial.person_identity_links link
  where link.retired_user_id_snapshot is not null
    and not exists (
      select 1
      from editorial.retired_account_identities tombstone
      where tombstone.user_id = link.retired_user_id_snapshot
        and tombstone.identity_link_id = link.id
        and tombstone.person_resource_id = link.person_resource_id
    );

  if v_bad_count <> 0 then
    raise exception
      'STOP: historical retired user snapshots lack tombstones for % links',
      v_bad_count;
  end if;

  select count(*)
  into v_bad_count
  from editorial.retired_account_identities tombstone
  join editorial.people person
    on person.resource_id = tombstone.person_resource_id
  join editorial.resources resource
    on resource.id = tombstone.person_resource_id
   and resource.resource_kind = 'person'
  where not exists (
          select 1
          from editorial.person_identity_links active_link
          where active_link.person_resource_id = tombstone.person_resource_id
            and active_link.link_state = 'active'
        )
    and (
      person.person_state <> 'archived'
      or person.preferred_identity_link_id is not null
      or resource.visibility <> 'internal'
      or resource.lifecycle_state <> 'archived'
      or exists (
        select 1
        from editorial.resource_aliases alias
        where alias.resource_id = tombstone.person_resource_id
          and alias.retired_at is null
      )
    );

  if v_bad_count <> 0 then
    raise exception
      'STOP: orphaned retired-account People are not fully archived for % rows',
      v_bad_count;
  end if;

  select count(*)
  into v_bad_count
  from editorial.retired_account_identities tombstone
  where not exists (
          select 1
          from editorial.person_identity_events event_row
          where event_row.person_resource_id = tombstone.person_resource_id
            and event_row.identity_link_id = tombstone.identity_link_id
            and event_row.event_type = 'identity_unlinked'
        )
     or (
       not exists (
         select 1
         from editorial.person_identity_links active_link
         where active_link.person_resource_id = tombstone.person_resource_id
           and active_link.link_state = 'active'
       )
       and not exists (
         select 1
         from editorial.person_identity_events event_row
         where event_row.person_resource_id = tombstone.person_resource_id
           and event_row.identity_link_id = tombstone.identity_link_id
           and event_row.event_type = 'person_archived'
       )
     );

  if v_bad_count <> 0 then
    raise exception
      'STOP: retired-account Person event history is incomplete for % rows',
      v_bad_count;
  end if;
end;
$verify_account_identity_retirement$;

select jsonb_build_object(
  'verification', 'PASS',
  'retired_accounts', (
    select count(*)
    from editorial.retired_account_identities
  ),
  'historical_links', (
    select count(*)
    from editorial.person_identity_links
    where retired_user_id_snapshot is not null
  ),
  'archived_orphan_people', (
    select count(*)
    from editorial.retired_account_identities tombstone
    join editorial.people person
      on person.resource_id = tombstone.person_resource_id
    where person.person_state = 'archived'
      and not exists (
        select 1
        from editorial.person_identity_links active_link
        where active_link.person_resource_id = tombstone.person_resource_id
          and active_link.link_state = 'active'
      )
  )
) as account_identity_retirement_verification;
