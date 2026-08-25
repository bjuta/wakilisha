do $verify$
declare
  v_structured jsonb;
  v_legacy jsonb;
  v_invalid_rejected boolean := false;
begin
  v_structured := editorial.normalize_track_lyrics_payload(
    'plain',
    jsonb_build_array(
      jsonb_build_object(
        'text', 'Intro one',
        'stanza_index', 0,
        'line_index', 0
      ),
      jsonb_build_object(
        'text', 'Intro two',
        'stanza_index', 0,
        'line_index', 1
      ),
      jsonb_build_object(
        'text', 'Verse one',
        'stanza_index', 1,
        'line_index', 0
      ),
      jsonb_build_object(
        'text', 'Verse two',
        'stanza_index', 1,
        'line_index', 1
      )
    )
  );

  if v_structured ->> 'plain_text'
     <> E'Intro one\nIntro two\n\nVerse one\nVerse two'
  then
    raise exception 'Structured Lyrics plain_text did not preserve stanza separation';
  end if;

  if (v_structured #>> '{lines,2,stanza_index}')::bigint <> 1
     or (v_structured #>> '{lines,2,line_index}')::bigint <> 0
  then
    raise exception 'Structured Lyrics canonical stanza metadata is incorrect';
  end if;

  v_legacy := editorial.normalize_track_lyrics_payload(
    'plain',
    jsonb_build_array(
      jsonb_build_object('text', 'Legacy one'),
      jsonb_build_object('text', 'Legacy two')
    )
  );

  if v_legacy ->> 'plain_text' <> E'Legacy one\nLegacy two'
     or (v_legacy #>> '{lines,0,stanza_index}')::bigint <> 0
     or (v_legacy #>> '{lines,1,stanza_index}')::bigint <> 0
  then
    raise exception 'Legacy Lyrics payload compatibility failed';
  end if;

  begin
    perform editorial.normalize_track_lyrics_payload(
      'plain',
      jsonb_build_array(
        jsonb_build_object(
          'text', 'First stanza',
          'stanza_index', 0,
          'line_index', 0
        ),
        jsonb_build_object(
          'text', 'Skipped stanza',
          'stanza_index', 2,
          'line_index', 0
        )
      )
    );
  exception when others then
    v_invalid_rejected :=
      position(
        'advance exactly one stanza'
        in sqlerrm
      ) > 0;
  end;

  if not v_invalid_rejected then
    raise exception 'Invalid Lyrics stanza sequence was not rejected';
  end if;

  raise notice 'TRACK_LYRICS_STRUCTURED_STANZA_AUTHORITY_PASS';
end;
$verify$;
