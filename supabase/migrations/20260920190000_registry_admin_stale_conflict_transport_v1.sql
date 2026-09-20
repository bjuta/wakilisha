begin;

do $wk_admin_registry_stale_transport_repair$
declare
  r record;
  v_definition text;
  v_expected integer;
  v_before_40001 integer;
  v_after_40001 integer;
  v_after_marker integer;
begin
  for r in
    select *
    from (values
      ('public.admin_patch_registry_artist_profile_v1(uuid,jsonb,timestamp with time zone)', 1),
      ('public.admin_patch_registry_track_profile_v1(uuid,jsonb,timestamp with time zone)', 1),
      ('public.admin_patch_registry_release_profile_v1(uuid,jsonb,timestamp with time zone)', 1),
      ('public.admin_patch_registry_label_profile_v1(uuid,jsonb,timestamp with time zone)', 1),
      ('public.admin_patch_registry_genre_profile_v1(uuid,jsonb,timestamp with time zone)', 1),
      ('public.admin_delete_registry_draft_artist_v1(uuid,timestamp with time zone)', 1),
      ('public.admin_patch_registry_release_detail_v1(uuid,text,text,text,date,text,uuid,text,text,text,timestamp with time zone)', 1),
      ('public.admin_archive_registry_music_entity_v1(text,uuid,timestamp with time zone)', 2)
    ) as expected(signature, stale_occurrences)
  loop
    if to_regprocedure(r.signature) is null then
      raise exception 'STOP: missing Registry admin authority %', r.signature;
    end if;

    select pg_get_functiondef(to_regprocedure(r.signature))
    into v_definition;

    v_expected := r.stale_occurrences;
    v_before_40001 :=
      (length(v_definition) - length(replace(v_definition, '40001', ''))) / 5;

    if v_before_40001 <> v_expected then
      raise exception
        'STOP: Registry admin stale-signal shape drifted for %: expected % 40001 occurrence(s), found %',
        r.signature,
        v_expected,
        v_before_40001;
    end if;

    v_definition := replace(
      v_definition,
      '''40001''',
      '''P0001'''
    );
    v_definition := replace(
      v_definition,
      'changed after this editor loaded it.',
      'WK_STALE_UPDATE: changed after this editor loaded it.'
    );

    execute v_definition;

    select pg_get_functiondef(to_regprocedure(r.signature))
    into v_definition;

    v_after_40001 :=
      (length(v_definition) - length(replace(v_definition, '40001', ''))) / 5;
    v_after_marker :=
      (length(v_definition) - length(replace(v_definition, 'WK_STALE_UPDATE', ''))) / length('WK_STALE_UPDATE');

    if v_after_40001 <> 0 or v_after_marker <> v_expected then
      raise exception
        'STOP: Registry admin stale-signal repair failed for %: 40001 %, markers %, expected markers %',
        r.signature,
        v_after_40001,
        v_after_marker,
        v_expected;
    end if;
  end loop;
end
$wk_admin_registry_stale_transport_repair$;

commit;
