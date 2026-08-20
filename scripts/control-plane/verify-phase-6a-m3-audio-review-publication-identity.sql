-- Permanent read-only verifier for Phase 6A M3 Audio Review and publication identity.

do $verify_phase_6a_m3_audio_review_publication_identity$
declare
  v_fingerprint text;
  v_submit text;
  v_review text;
  v_publish text;
  v_bad_published bigint;
  v_bad_snapshots bigint;
  v_bad_generic_pointers bigint;
begin
  if to_regclass('audio.publication_review_events') is null
     or to_regclass('audio.publication_feed_identities') is null
     or to_regclass('audio.publication_snapshots') is null
  then
    raise exception
      'FAIL: one or more M3 Audio lifecycle tables are missing';
  end if;

  if to_regprocedure(
       'editorial.current_user_can_publish_audio(uuid)'
     ) is null
     or to_regprocedure(
       'editorial.current_user_can_participate_audio_review(uuid)'
     ) is null
     or to_regprocedure(
       'audio.assert_publishable_version_media(uuid)'
     ) is null
     or to_regprocedure(
       'audio.copy_publication_version_snapshot(uuid,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.submit_audio_publication_for_review(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.review_audio_publication(uuid,bigint,uuid,text,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.publish_audio_publication_version(uuid,bigint,uuid,text,text,uuid)'
     ) is null
  then
    raise exception
      'FAIL: one or more M3 Audio lifecycle functions are missing';
  end if;

  if exists (
    select 1
    from (
      values
        ('audio.publication.review.submit'),
        ('audio.publication.review.decide'),
        ('audio.publication.publish')
    ) required(command_type)
    where not exists (
      select 1
      from platform_private.command_types command_row
      where command_row.command_type = required.command_type
        and command_row.enabled
    )
  ) then
    raise exception
      'FAIL: one or more M3 Audio command types are missing or disabled';
  end if;

  v_fingerprint := pg_get_functiondef(
    'audio.publication_content_fingerprint(uuid)'::regprocedure
  );

  if position('master_media_asset_id' in v_fingerprint) = 0
     or position('master_media_revision_id' in v_fingerprint) = 0
     or position('audio_delivery_variant_id' in v_fingerprint) = 0
     or position('''status''' in v_fingerprint) > 0
  then
    raise exception
      'FAIL: Audio content fingerprint does not preserve M3 content/lifecycle separation';
  end if;

  v_submit := pg_get_functiondef(
    'public.submit_audio_publication_for_review(uuid,bigint,text,text,uuid)'::regprocedure
  );
  v_review := pg_get_functiondef(
    'public.review_audio_publication(uuid,bigint,uuid,text,text,text,uuid)'::regprocedure
  );
  v_publish := pg_get_functiondef(
    'public.publish_audio_publication_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure
  );

  if position('platform_private.begin_authenticated_resource_command' in v_submit) = 0
     or position('audio.insert_current_publication_snapshot' in v_submit) = 0
     or position('audio_publication_media_not_publishable' in v_submit) = 0
     or position('manage_review_queue' in v_review) = 0
     or position('audio_submitted_version_stale' in v_review) = 0
     or position('audio.copy_publication_version_snapshot' in v_review) = 0
     or position('editorial.current_user_can_publish_audio' in v_publish) = 0
     or position('audio.assert_publishable_version_media' in v_publish) = 0
     or position('urn:uuid:' in v_publish) = 0
     or position('https://wakilisha.africa/audio/enclosures/' in v_publish) = 0
  then
    raise exception
      'FAIL: M3 governed Review or publish command authority drifted';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'audio.publication_review_events'::regclass
      and trigger_row.tgname = 'audio_publication_review_events_integrity'
      and not trigger_row.tgisinternal
  ) or not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'audio.publication_review_events'::regclass
      and trigger_row.tgname = 'audio_publication_review_events_append_only'
      and not trigger_row.tgisinternal
  ) or not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'audio.publication_feed_identities'::regclass
      and trigger_row.tgname = 'audio_publication_feed_identity_immutable'
      and not trigger_row.tgisinternal
  ) or not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'audio.publication_snapshots'::regclass
      and trigger_row.tgname = 'audio_publication_snapshots_integrity'
      and not trigger_row.tgisinternal
  ) or not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'audio.publication_snapshots'::regclass
      and trigger_row.tgname = 'audio_publication_snapshots_immutable'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'FAIL: one or more M3 integrity/append-only guards are missing';
  end if;

  if exists (
    select 1
    from pg_class table_row
    join pg_namespace schema_row
      on schema_row.oid = table_row.relnamespace
    where schema_row.nspname = 'audio'
      and table_row.relname in (
        'publication_review_events',
        'publication_feed_identities',
        'publication_snapshots'
      )
      and not table_row.relrowsecurity
  ) then
    raise exception
      'FAIL: one or more M3 Audio tables do not have RLS enabled';
  end if;

  select count(*)
  into v_bad_published
  from audio.publications publication
  join editorial.audio_publication_resources binding
    on binding.publication_id = publication.id
  where publication.status = 'published'
    and (
      binding.current_published_version_id is null
      or not exists (
        select 1
        from audio.publication_versions version
        where version.id = binding.current_published_version_id
          and version.resource_id = binding.resource_id
          and version.publication_id = publication.id
          and version.version_kind = 'published'
          and version.master_media_asset_id is not null
          and version.master_media_revision_id is not null
          and version.audio_delivery_variant_id is not null
      )
      or not exists (
        select 1
        from audio.publication_feed_identities feed
        where feed.publication_id = publication.id
          and feed.resource_id = binding.resource_id
          and feed.guid = 'urn:uuid:' || publication.id::text
          and feed.enclosure_url =
            'https://wakilisha.africa/audio/enclosures/'
            || publication.id::text
            || '.mp3'
      )
      or not exists (
        select 1
        from audio.publication_snapshots snapshot
        where snapshot.publication_id = publication.id
          and snapshot.resource_id = binding.resource_id
          and snapshot.published_version_id = binding.current_published_version_id
      )
    );

  if v_bad_published <> 0 then
    raise exception
      'FAIL: % published Audio publication(s) lack exact version/feed/snapshot authority',
      v_bad_published;
  end if;

  select count(*)
  into v_bad_snapshots
  from audio.publication_snapshots snapshot
  join audio.publication_versions version
    on version.id = snapshot.published_version_id
  left join media.variants variant
    on variant.id = snapshot.enclosure_variant_id
  where version.version_kind <> 'published'
     or version.audio_delivery_variant_id is distinct from snapshot.enclosure_variant_id
     or variant.variant_role is distinct from 'audio_delivery'
     or snapshot.guid <> 'urn:uuid:' || snapshot.publication_id::text
     or snapshot.enclosure_url <>
          'https://wakilisha.africa/audio/enclosures/'
          || snapshot.publication_id::text
          || '.mp3';

  if v_bad_snapshots <> 0 then
    raise exception
      'FAIL: % Audio publication snapshot(s) violate stable feed/enclosure identity',
      v_bad_snapshots;
  end if;

  select count(*)
  into v_bad_generic_pointers
  from editorial.resources resource_row
  where resource_row.resource_kind in (
    'audio_show',
    'audio_season',
    'audio_episode',
    'standalone_audio'
  )
    and (
      resource_row.current_working_version_id is not null
      or resource_row.current_submitted_version_id is not null
      or resource_row.current_approved_version_id is not null
      or resource_row.current_published_version_id is not null
    );

  if v_bad_generic_pointers <> 0 then
    raise exception
      'FAIL: Audio Resources wrote into Article-only generic version pointers';
  end if;

  raise notice
    'PASS: Phase 6A M3 Audio Review, exact publication, stable GUID, and enclosure identity verified.';
end;
$verify_phase_6a_m3_audio_review_publication_identity$;
