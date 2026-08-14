-- WAKILISHA Charts: hard DB guardrails for eligibility rules.
-- Prevents impossible chart rows, especially future release dates in historical editions.

create extension if not exists pgcrypto;

alter table public.chart_ingest_raw_rows
  add column if not exists explicit boolean;

alter table public.chart_ingest_normalized_rows
  add column if not exists explicit boolean;

alter table public.chart_ingest_candidates
  add column if not exists explicit boolean,
  add column if not exists eligibility_decision_json jsonb not null default '{}'::jsonb;

create index if not exists idx_cicd_run_status_release_date
  on public.chart_ingest_candidates (run_id, status, release_date);

create index if not exists idx_cicd_run_status_explicit
  on public.chart_ingest_candidates (run_id, status, explicit)
  where explicit is true;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'chart_ingest_exclusions_reason_code_check'
      and conrelid = 'public.chart_ingest_exclusions'::regclass
  ) then
    alter table public.chart_ingest_exclusions
      drop constraint chart_ingest_exclusions_reason_code_check;
  end if;
end;
$$;

alter table public.chart_ingest_exclusions
  add constraint chart_ingest_exclusions_reason_code_check
  check (reason_code in (
    'missing_release_date',
    'release_window_mismatch',
    'future_release_date',
    'explicit_track_not_allowed',
    'missing_isrc',
    'missing_preview',
    'release_type_not_allowed',
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
    'duplicate_track',
    'manual_exclude',
    'invalid_normalized_key',
    'missing_title',
    'missing_artist',
    'missing_artist_credits',
    'no_streaming_sources'
  ));

create or replace function public.chart_rule_snapshot_text(
  p_snapshot jsonb,
  p_key text
)
returns text
language sql
immutable
as $$
  select nullif(coalesce(
    p_snapshot ->> p_key,
    p_snapshot #>> array['backfill', p_key],
    case p_key
      when 'releaseWindowStart' then p_snapshot #>> '{eligibilityProfileSnapshot,releaseEligibility,releaseWindowFrom}'
      when 'releaseWindowEnd' then p_snapshot #>> '{eligibilityProfileSnapshot,releaseEligibility,releaseWindowTo}'
      else null
    end,
    case p_key
      when 'releaseWindowStart' then p_snapshot #>> '{eligibilityProfile,releaseEligibility,releaseWindowFrom}'
      when 'releaseWindowEnd' then p_snapshot #>> '{eligibilityProfile,releaseEligibility,releaseWindowTo}'
      else null
    end
  ), '');
$$;

create or replace function public.chart_rule_explicit_allowed(
  p_snapshot jsonb
)
returns boolean
language sql
immutable
as $$
  select coalesce(
    (p_snapshot #>> '{eligibilityProfileSnapshot,trackEligibility,explicitAllowed}')::boolean,
    (p_snapshot #>> '{eligibilityProfile,trackEligibility,explicitAllowed}')::boolean,
    (p_snapshot #>> '{trackEligibility,explicitAllowed}')::boolean,
    true
  );
$$;

create or replace function public.chart_candidate_rule_decision(
  p_run_id text,
  p_release_date date,
  p_explicit boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_run record;
  v_snapshot jsonb;
  v_start date;
  v_end date;
  v_start_text text;
  v_end_text text;
  v_window_active boolean := false;
  v_explicit_allowed boolean := true;
begin
  select id, edition_date, rule_snapshot_json
  into v_run
  from public.chart_ingest_runs
  where id = p_run_id
  limit 1;

  if v_run.id is null then
    return jsonb_build_object('eligible', true, 'reasonCodes', '[]'::jsonb, 'reasonMessages', '[]'::jsonb);
  end if;

  v_snapshot := coalesce(v_run.rule_snapshot_json, '{}'::jsonb);
  v_start_text := public.chart_rule_snapshot_text(v_snapshot, 'releaseWindowStart');
  v_end_text := public.chart_rule_snapshot_text(v_snapshot, 'releaseWindowEnd');

  if v_start_text is not null then v_start := v_start_text::date; end if;
  if v_end_text is not null then v_end := v_end_text::date; end if;

  v_window_active := v_start is not null or v_end is not null;
  v_end := coalesce(v_end, v_run.edition_date);
  v_explicit_allowed := public.chart_rule_explicit_allowed(v_snapshot);

  if v_window_active and p_release_date is null then
    return jsonb_build_object(
      'eligible', false,
      'reasonCodes', jsonb_build_array('missing_release_date'),
      'reasonMessages', jsonb_build_array('Release date is required because this chart has a release-window rule.'),
      'severity', 'hard',
      'ruleSnapshot', jsonb_build_object('releaseWindowStart', v_start, 'releaseWindowEnd', v_end, 'editionDate', v_run.edition_date)
    );
  end if;

  if p_release_date is not null and p_release_date > v_run.edition_date then
    return jsonb_build_object(
      'eligible', false,
      'reasonCodes', jsonb_build_array('future_release_date'),
      'reasonMessages', jsonb_build_array(format('Release date %s is after chart edition date %s.', p_release_date, v_run.edition_date)),
      'severity', 'hard',
      'ruleSnapshot', jsonb_build_object('releaseWindowStart', v_start, 'releaseWindowEnd', v_end, 'editionDate', v_run.edition_date)
    );
  end if;

  if p_release_date is not null and v_start is not null and p_release_date < v_start then
    return jsonb_build_object(
      'eligible', false,
      'reasonCodes', jsonb_build_array('release_window_mismatch'),
      'reasonMessages', jsonb_build_array(format('Release date %s is before release window start %s.', p_release_date, v_start)),
      'severity', 'hard',
      'ruleSnapshot', jsonb_build_object('releaseWindowStart', v_start, 'releaseWindowEnd', v_end, 'editionDate', v_run.edition_date)
    );
  end if;

  if p_release_date is not null and v_end is not null and p_release_date > v_end then
    return jsonb_build_object(
      'eligible', false,
      'reasonCodes', jsonb_build_array('release_window_mismatch'),
      'reasonMessages', jsonb_build_array(format('Release date %s is after release window end %s.', p_release_date, v_end)),
      'severity', 'hard',
      'ruleSnapshot', jsonb_build_object('releaseWindowStart', v_start, 'releaseWindowEnd', v_end, 'editionDate', v_run.edition_date)
    );
  end if;

  if v_explicit_allowed = false and p_explicit is true then
    return jsonb_build_object(
      'eligible', false,
      'reasonCodes', jsonb_build_array('explicit_track_not_allowed'),
      'reasonMessages', jsonb_build_array('Explicit tracks are not allowed by this eligibility profile.'),
      'severity', 'hard',
      'ruleSnapshot', jsonb_build_object('explicitAllowed', false)
    );
  end if;

  return jsonb_build_object(
    'eligible', true,
    'reasonCodes', '[]'::jsonb,
    'reasonMessages', '[]'::jsonb,
    'severity', 'none',
    'ruleSnapshot', jsonb_build_object('releaseWindowStart', v_start, 'releaseWindowEnd', v_end, 'editionDate', v_run.edition_date, 'explicitAllowed', v_explicit_allowed)
  );
end;
$$;

create or replace function public.chart_apply_candidate_rule_gate_biu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decision jsonb;
begin
  v_decision := public.chart_candidate_rule_decision(new.run_id, new.release_date, new.explicit);

  new.eligibility_decision_json := coalesce(new.eligibility_decision_json, '{}'::jsonb)
    || jsonb_build_object('ruleDecision', v_decision);

  if coalesce((v_decision->>'eligible')::boolean, true) = false
     and coalesce(new.status, 'pending') in ('pending', 'eligible') then
    new.status := 'excluded';
  end if;

  return new;
end;
$$;

drop trigger if exists chart_apply_candidate_rule_gate_biu on public.chart_ingest_candidates;

create trigger chart_apply_candidate_rule_gate_biu
before insert or update of status, release_date, explicit, eligibility_decision_json
on public.chart_ingest_candidates
for each row
execute function public.chart_apply_candidate_rule_gate_biu();

create or replace function public.chart_write_candidate_rule_exclusion_aiu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decision jsonb;
  v_code text;
  v_label text;
begin
  v_decision := coalesce(new.eligibility_decision_json->'ruleDecision', '{}'::jsonb);
  v_code := v_decision #>> '{reasonCodes,0}';
  v_label := v_decision #>> '{reasonMessages,0}';

  delete from public.chart_ingest_exclusions
  where run_id = new.run_id
    and candidate_id = new.id
    and source_stage = 'eligibility_rules';

  if new.status = 'excluded' and v_code is not null then
    insert into public.chart_ingest_exclusions (
      id,
      run_id,
      candidate_id,
      reason_code,
      reason_label,
      severity,
      source_stage,
      details_json,
      created_at
    ) values (
      gen_random_uuid()::text,
      new.run_id,
      new.id,
      v_code,
      coalesce(v_label, v_code),
      coalesce(v_decision->>'severity', 'hard'),
      'eligibility_rules',
      jsonb_build_object(
        'title', new.title,
        'artistDisplay', new.artist_display,
        'releaseDate', new.release_date,
        'explicit', new.explicit,
        'decision', v_decision
      ),
      now()
    );
  end if;

  return null;
end;
$$;

drop trigger if exists chart_write_candidate_rule_exclusion_aiu on public.chart_ingest_candidates;

create trigger chart_write_candidate_rule_exclusion_aiu
after insert or update of status, release_date, explicit, eligibility_decision_json
on public.chart_ingest_candidates
for each row
execute function public.chart_write_candidate_rule_exclusion_aiu();

create or replace function public.chart_assert_rule_clean_run(p_run_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bad record;
begin
  select c.id, c.title, c.artist_display, c.release_date, c.explicit,
         public.chart_candidate_rule_decision(c.run_id, c.release_date, c.explicit) as decision
  into v_bad
  from public.chart_ingest_candidates c
  where c.run_id = p_run_id
    and c.status = 'eligible'
    and coalesce((public.chart_candidate_rule_decision(c.run_id, c.release_date, c.explicit)->>'eligible')::boolean, true) = false
  limit 1;

  if v_bad.id is not null then
    raise exception 'chart_run_has_rule_ineligible_candidate: % by % (%; release_date=%; explicit=%)',
      coalesce(v_bad.title, 'Untitled'),
      coalesce(v_bad.artist_display, 'Unknown artist'),
      v_bad.decision #>> '{reasonCodes,0}',
      v_bad.release_date,
      v_bad.explicit
      using errcode = '23514';
  end if;
end;
$$;

grant execute on function public.chart_candidate_rule_decision(text, date, boolean) to authenticated;
grant execute on function public.chart_assert_rule_clean_run(text) to authenticated;
