alter table public.review_decisions drop constraint if exists review_decisions_subject_type_check;
alter table public.review_decisions add constraint review_decisions_subject_type_check check (subject_type in ('relationship','evidence','surface_draft','ai_run','correction','claim','contributor_submission','cultural_entity'));
drop policy if exists cultural_entities_admin_insert on public.cultural_entities;
drop policy if exists cultural_entities_admin_update on public.cultural_entities;
revoke insert, update, delete on table public.cultural_entities from authenticated;
grant select on table public.cultural_entities to authenticated;;
