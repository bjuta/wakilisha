begin;

create or replace function editorial.normalize_track_lyrics_payload(
  p_timing_mode text,
  p_lines jsonb
)
returns jsonb
language plpgsql
set search_path to 'pg_catalog'
as $function$
declare
  v_line jsonb;
  v_text text;
  v_start numeric;
  v_plain_text text := '';
  v_normalized_lines jsonb := '[]'::jsonb;
  v_requested_stanza bigint;
  v_current_stanza bigint := 0;
  v_requested_line_index bigint;
  v_line_index bigint := 0;
  v_seen_line boolean := false;
  v_stanza_changed boolean := false;
  v_normalized_line jsonb;
begin
  if p_timing_mode not in ('plain', 'line') then
    raise exception 'Lyrics timing mode must be plain or line';
  end if;

  if jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) = 0
  then
    raise exception 'Add at least one Lyrics line';
  end if;

  for v_line in
    select value
    from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(v_line) <> 'object' then
      raise exception 'Every Lyrics line requires an object payload';
    end if;

    v_text := btrim(coalesce(v_line ->> 'text', ''));

    if v_text = '' then
      raise exception 'Every Lyrics line requires text';
    end if;

    if v_line ? 'stanza_index' then
      begin
        v_requested_stanza := (v_line ->> 'stanza_index')::bigint;
      exception when others then
        raise exception 'Lyrics stanza_index must be a non-negative integer';
      end;
    else
      v_requested_stanza := case
        when v_seen_line then v_current_stanza
        else 0
      end;
    end if;

    if v_requested_stanza < 0 then
      raise exception 'Lyrics stanza_index must be a non-negative integer';
    end if;

    if not v_seen_line and v_requested_stanza <> 0 then
      raise exception 'Lyrics stanza_index must start at 0';
    end if;

    if v_seen_line
       and v_requested_stanza not in (
         v_current_stanza,
         v_current_stanza + 1
       )
    then
      raise exception
        'Lyrics stanza_index must stay in the current stanza or advance exactly one stanza';
    end if;

    v_stanza_changed :=
      v_seen_line and v_requested_stanza = v_current_stanza + 1;

    if not v_seen_line or v_stanza_changed then
      v_current_stanza := v_requested_stanza;
      v_line_index := 0;
    else
      v_line_index := v_line_index + 1;
    end if;

    if v_line ? 'line_index' then
      begin
        v_requested_line_index := (v_line ->> 'line_index')::bigint;
      exception when others then
        raise exception 'Lyrics line_index must be a non-negative integer';
      end;

      if v_requested_line_index < 0
         or v_requested_line_index <> v_line_index
      then
        raise exception
          'Lyrics line_index must be contiguous and restart at 0 for each stanza';
      end if;
    end if;

    v_normalized_line := jsonb_build_object(
      'text', v_text,
      'stanza_index', v_current_stanza,
      'line_index', v_line_index
    );

    if p_timing_mode = 'line' then
      begin
        v_start := (v_line ->> 'start_seconds')::numeric;
      exception when others then
        raise exception 'Timed Lyrics lines require numeric start_seconds';
      end;

      if v_start < 0 then
        raise exception 'Lyrics start_seconds cannot be negative';
      end if;

      v_normalized_line :=
        v_normalized_line ||
        jsonb_build_object('start_seconds', v_start);
    end if;

    v_normalized_lines :=
      v_normalized_lines ||
      jsonb_build_array(v_normalized_line);

    if not v_seen_line then
      v_plain_text := v_text;
    elsif v_stanza_changed then
      v_plain_text := v_plain_text || E'\n\n' || v_text;
    else
      v_plain_text := v_plain_text || E'\n' || v_text;
    end if;

    v_seen_line := true;
  end loop;

  return jsonb_build_object(
    'lines', v_normalized_lines,
    'plain_text', v_plain_text
  );
end;
$function$;

comment on function editorial.normalize_track_lyrics_payload(text, jsonb) is
  'Canonical Track Lyrics payload normalizer. Preserves line timing and canonical zero-based stanza/line structure inside lines JSONB while deriving plain_text with one blank line between stanzas. Legacy line arrays without stanza metadata remain valid as one stanza.';

commit;
