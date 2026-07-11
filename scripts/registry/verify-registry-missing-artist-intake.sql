-- Verify PR14 missing artist intake workflow.

select
  count(*) as queue_rows,
  count(*) filter (where intake_state = 'needs_intake') as needs_intake,
  count(*) filter (where intake_state = 'intake_in_progress') as intake_in_progress,
  count(*) filter (where intake_state = 'review_completed') as review_completed,
  count(*) filter (where intake_state = 'needs_reassessment') as needs_reassessment
from public.registry_missing_artist_intake_queue;

select
  count(*) as total_relationships,
  count(*) filter (where relationship_status = 'archived') as archived_relationships
from public.registry_entity_relationships;

select
  p.prosecdef as security_definer,
  has_function_privilege('anon', 'public.create_registry_missing_artist_intake(text,text,text,text)', 'execute') as anon_can_execute,
  has_function_privilege('authenticated', 'public.create_registry_missing_artist_intake(text,text,text,text)', 'execute') as authenticated_can_execute,
  has_function_privilege('service_role', 'public.create_registry_missing_artist_intake(text,text,text,text)', 'execute') as service_role_can_execute,
  p.proconfig
from pg_proc p
where p.oid = 'public.create_registry_missing_artist_intake(text,text,text,text)'::regprocedure;

select count(*) as automatic_intake_submissions
from public.contributor_submissions
where source_note like 'missing_artist_slug:%'
  and created_at >= now() - interval '10 minutes';