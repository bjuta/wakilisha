-- Phase 8B.6 Field -> Source promotion closure verifier.
-- Permanent rollback-only current-head authority proof.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

do $verify$
declare
  v_def text;
  v_asset_guard text;
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 114
     or (select max(version) from supabase_migrations.schema_migrations) <> '20260911143000' then
    raise exception 'PHASE_8B6_FIELD_PROMOTION_FAIL: expected exact 114 / 20260911143000 migration authority';
  end if;

  if to_regclass('editorial.field_submission_source_promotions') is null
     or to_regprocedure('public.get_field_submission_promotion_state_v1(uuid)') is null
     or to_regprocedure('public.promote_field_submission_to_source_v1(uuid,bigint,uuid,text,uuid)') is null then
    raise exception 'PHASE_8B6_FIELD_PROMOTION_FAIL: promotion authority is incomplete';
  end if;

  if not exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='editorial' and c.relname='field_submission_source_promotions' and c.relrowsecurity
  ) then
    raise exception 'PHASE_8B6_FIELD_PROMOTION_FAIL: promotion provenance RLS is disabled';
  end if;

  if has_table_privilege('anon','editorial.field_submission_source_promotions','SELECT')
     or has_table_privilege('authenticated','editorial.field_submission_source_promotions','SELECT')
     or has_table_privilege('authenticated','editorial.field_submission_source_promotions','INSERT')
     or has_table_privilege('authenticated','editorial.field_submission_source_promotions','UPDATE')
     or has_table_privilege('authenticated','editorial.field_submission_source_promotions','DELETE') then
    raise exception 'PHASE_8B6_FIELD_PROMOTION_FAIL: browser role has direct provenance-table authority';
  end if;

  if not has_function_privilege('authenticated','public.get_field_submission_promotion_state_v1(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.promote_field_submission_to_source_v1(uuid,bigint,uuid,text,uuid)','EXECUTE')
     or has_function_privilege('anon','public.get_field_submission_promotion_state_v1(uuid)','EXECUTE')
     or has_function_privilege('anon','public.promote_field_submission_to_source_v1(uuid,bigint,uuid,text,uuid)','EXECUTE') then
    raise exception 'PHASE_8B6_FIELD_PROMOTION_FAIL: RPC browser privilege boundary is wrong';
  end if;

  if not exists(
    select 1 from platform_private.command_types
    where command_type='field.submission.promote.source'
      and job_type='field.submission.promote.source.sync'
      and enabled
  ) then
    raise exception 'PHASE_8B6_FIELD_PROMOTION_FAIL: promotion command registration is missing';
  end if;

  v_asset_guard:=pg_get_functiondef('media.protect_field_original_asset_v1()'::regprocedure);
  if position('new.current_revision_id is not distinct from old.current_revision_id' in v_asset_guard)=0
     or position('new.authority_revision = old.authority_revision + 1' in v_asset_guard)=0
     or position('next_governance.version_number = prior_governance.version_number + 1' in v_asset_guard)=0
     or position('next_governance.asset_id = old.id' in v_asset_guard)=0
     or position('new.current_revision_id is distinct from old.current_revision_id' in v_asset_guard)=0
     or position('not v_initial_activation' in v_asset_guard)=0 then
    raise exception 'PHASE_8B6_FIELD_PROMOTION_FAIL: Field-original guard lost exact-revision immutability or next-governance-only advance';
  end if;

  if md5(pg_get_functiondef('media.protect_field_original_governance_v1()'::regprocedure)) <> 'fa980a36c7f78dfb8deb7dd336c04ebf' then
    raise exception 'PHASE_8B6_FIELD_PROMOTION_FAIL: protected Field-original governance-row guard drifted';
  end if;

  v_def:=pg_get_functiondef('public.promote_field_submission_to_source_v1(uuid,bigint,uuid,text,uuid)'::regprocedure);
  if position('begin_authenticated_resource_command' in v_def)=0
     or position('field.submission.promote.source' in v_def)=0
     or position('v_field.current_revision<>p_expected_submission_revision' in v_def)=0
     or position('v_field.submission_state<>''submitted''' in v_def)=0
     or position('i.intake_state=''adopted''' in v_def)=0
     or position('u.usage_role=''field_original''' in v_def)=0
     or position('g.version_number>1' in v_def)=0
     or position('g.public_safety_state=''internal''' in v_def)=0
     or position('governance_version_created' in v_def)=0
     or position('public.create_source' in v_def)=0
     or position('public.submit_source_version_for_review' in v_def)=0
     or position('field_submission_source_promotions' in v_def)=0
     or position('media_asset_id' in v_def)=0
     or position('media_asset_revision_id' in v_def)=0
     or position('media_governance_version_id' in v_def)=0 then
    raise exception 'PHASE_8B6_FIELD_PROMOTION_FAIL: promotion function lost a required authority invariant';
  end if;

  if position('registry_media_assets' in v_def)>0
     or position('attach_media_usage' in v_def)>0
     or position('contact_point_id' in v_def)>0
     or position('preferred_contact_channel' in v_def)>0
     or position('owner_user_id' in v_def)>0 then
    raise exception 'PHASE_8B6_FIELD_PROMOTION_FAIL: promotion leaks legacy Media or contact identity into Source authority';
  end if;

  if not exists(
    select 1 from pg_constraint
    where conrelid='editorial.field_submission_source_promotions'::regclass
      and contype='u'
      and pg_get_constraintdef(oid) like '%submission_resource_id%media_intake_id%'
  ) then
    raise exception 'PHASE_8B6_FIELD_PROMOTION_FAIL: exact Field original cannot be proven one-promotion-only';
  end if;

  if not exists(
    select 1 from pg_trigger
    where tgrelid='editorial.field_submission_source_promotions'::regclass
      and tgname='field_submission_source_promotions_immutable'
      and not tgisinternal
  ) then
    raise exception 'PHASE_8B6_FIELD_PROMOTION_FAIL: append-only provenance trigger is missing';
  end if;
end
$verify$;

rollback;