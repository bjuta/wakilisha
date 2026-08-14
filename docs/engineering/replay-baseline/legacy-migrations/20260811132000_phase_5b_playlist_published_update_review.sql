-- Phase 5B Migration 234: published Playlist update review continuity.
--
-- A published Playlist may have newer moving content while its last immutable
-- publication snapshot remains public. Allow a real, explicitly saved update
-- to re-enter Review without unpublishing the current public edition.

begin;

do $phase_5b_m234_preflight$
begin
  if to_regprocedure(
       'public.submit_playlist_for_review(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'editorial.playlist_current_content_fingerprint(uuid)'
     ) is null
     or to_regprocedure(
       'public.get_public_playlist(text)'
     ) is null
     or to_regprocedure(
       'public.list_public_playlists(integer,timestamp with time zone,uuid)'
     ) is null
  then
    raise exception
      'STOP: Published Playlist update review authority is incomplete';
  end if;
end;
$phase_5b_m234_preflight$;

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
    'changes_requested',
    'published'
  ) then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_not_submittable',
      'Only a draft, changes-requested, or published Playlist can be submitted.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status
      )
    );

  elsif v_playlist.status = 'published'
        and v_binding.current_published_version_id is null
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_published_version_missing',
      'The published Playlist does not have a current published version.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status
      )
    );

  elsif v_playlist.status = 'published'
        and exists (
          select 1
          from editorial.playlist_versions published
          where published.id =
                  v_binding.current_published_version_id
            and published.resource_id =
                  v_binding.resource_id
            and published.playlist_id =
                  p_playlist_id
            and published.version_kind =
                  'published'
            and published.content_fingerprint =
                  v_fingerprint
        )
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_published_update_unchanged',
      'The published Playlist has no saved content change to submit.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status,
        'current_published_version_id',
          v_binding.current_published_version_id
      )
    );

  elsif v_playlist.status = 'published'
        and (
          v_binding.current_working_version_id is null
          or not exists (
            select 1
            from editorial.playlist_versions working
            where working.id =
                    v_binding.current_working_version_id
              and working.resource_id =
                    v_binding.resource_id
              and working.playlist_id =
                    p_playlist_id
              and working.version_kind =
                    'working'
              and working.content_fingerprint =
                    v_fingerprint
          )
        )
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_published_update_not_saved',
      'Save the published Playlist update before submitting it for Review.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status,
        'current_working_version_id',
          v_binding.current_working_version_id,
        'current_published_version_id',
          v_binding.current_published_version_id
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

comment on function
  public.submit_playlist_for_review(
    uuid,
    bigint,
    text,
    text,
    uuid
  )
is
  'Submits draft, changes-requested, or genuinely changed saved published Playlist content into immutable Review while the current published snapshot remains public.';

commit;
