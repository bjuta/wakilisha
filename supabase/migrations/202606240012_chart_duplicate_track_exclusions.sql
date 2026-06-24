alter table public.chart_ingest_exclusions
drop constraint if exists chart_ingest_exclusions_reason_code_check;

alter table public.chart_ingest_exclusions
add constraint chart_ingest_exclusions_reason_code_check
check (
  reason_code in (
    'missing_release_date',
    'release_window_mismatch',
    'country_mismatch',
    'gender_mismatch',
    'artist_type_mismatch',
    'missing_artist_country',
    'filter_eliminated_all_candidates',
    'streaming_min_sources',
    'airplay_min_stations',
    'airplay_min_detections',
    'stale_carry_forward',
    'continuity_locked',
    'manual_exclude',
    'duplicate_track'
  )
);
