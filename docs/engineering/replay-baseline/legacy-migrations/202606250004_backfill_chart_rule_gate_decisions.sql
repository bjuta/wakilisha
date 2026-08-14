-- Apply the new hard rule gate to existing candidate rows so old dry-runs cannot be committed
-- with future/out-of-window releases after this migration lands.

update public.chart_ingest_candidates c
set
  status = case
    when coalesce((public.chart_candidate_rule_decision(c.run_id, c.release_date, c.explicit)->>'eligible')::boolean, true) = false
      and c.status in ('pending', 'eligible')
      then 'excluded'
    else c.status
  end,
  eligibility_decision_json = coalesce(c.eligibility_decision_json, '{}'::jsonb)
    || jsonb_build_object(
      'ruleDecision',
      public.chart_candidate_rule_decision(c.run_id, c.release_date, c.explicit)
    ),
  updated_at = now()
where c.status in ('pending', 'eligible', 'excluded')
  and exists (
    select 1
    from public.chart_ingest_runs r
    where r.id = c.run_id
  );
