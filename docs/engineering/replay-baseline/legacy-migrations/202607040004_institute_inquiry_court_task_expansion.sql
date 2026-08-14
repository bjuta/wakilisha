-- Inquiry Court PR 2: extend the assistant task enum with the ten job types.
-- Additive only. The original seven task names stay valid so existing rows
-- and historical logs remain consistent. No data change, no RLS change.
--
-- Verification queries (run after applying):
--
--   -- 1. No existing rows violate the new constraint (expect 0)
--   select count(*) from public.institute_assistant_runs
--   where task not in (
--     'anchor_context_lift','question_clinic_help','workbench_setup_suggestions',
--     'evidence_search_plan','relationship_suggestions','risk_and_doubt_check',
--     'next_inquiry_suggestions',
--     'question_clinic','evidence_reader','relationship_mapper','claim_docket_builder',
--     'inquiry_summary_builder','how_this_learned_builder','learning_board_curator',
--     'lineage_fork_analyzer','correction_impact_analyst','next_step_recommender');
--
--   -- 2. Constraint enforced (expect a check violation)
--   -- insert into public.institute_assistant_runs (task) values ('bogus_task');
--
--   -- 3. Row count unchanged before vs after applying this migration
--   select count(*) from public.institute_assistant_runs;

alter table public.institute_assistant_runs
  drop constraint if exists institute_assistant_runs_task_check;

alter table public.institute_assistant_runs
  add constraint institute_assistant_runs_task_check check (task in (
    'anchor_context_lift',
    'question_clinic_help',
    'workbench_setup_suggestions',
    'evidence_search_plan',
    'relationship_suggestions',
    'risk_and_doubt_check',
    'next_inquiry_suggestions',
    'question_clinic',
    'evidence_reader',
    'relationship_mapper',
    'claim_docket_builder',
    'inquiry_summary_builder',
    'how_this_learned_builder',
    'learning_board_curator',
    'lineage_fork_analyzer',
    'correction_impact_analyst',
    'next_step_recommender'
  ));
