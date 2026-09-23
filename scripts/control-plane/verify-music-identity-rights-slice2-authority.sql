-- Permanent structural verifier for Music Identity & Rights Slice 2 schema authority.

do $verify$
declare
  v_definition text;
  v_table text;
  v_index text;
  v_operation_count integer;
begin
  foreach v_table in array array[
    'registry_works',
    'registry_track_work_links',
    'registry_track_contributions',
    'registry_work_contributions',
    'registry_rights_claims',
    'registry_external_identifier_assertions'
  ]
  loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Music ontology Slice 2 table missing: %', v_table;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public'
        and c.relname=v_table
        and c.relrowsecurity
    ) then
      raise exception 'Music ontology Slice 2 RLS missing: %', v_table;
    end if;

    if has_table_privilege('anon','public.' || v_table,'SELECT')
       or has_table_privilege('anon','public.' || v_table,'INSERT')
       or has_table_privilege('anon','public.' || v_table,'UPDATE')
       or has_table_privilege('anon','public.' || v_table,'DELETE')
       or has_table_privilege('authenticated','public.' || v_table,'SELECT')
       or has_table_privilege('authenticated','public.' || v_table,'INSERT')
       or has_table_privilege('authenticated','public.' || v_table,'UPDATE')
       or has_table_privilege('authenticated','public.' || v_table,'DELETE')
    then
      raise exception 'Music ontology Slice 2 browser ACL is not closed: %', v_table;
    end if;

    if not has_table_privilege('service_role','public.' || v_table,'SELECT')
       or has_table_privilege('service_role','public.' || v_table,'INSERT')
       or has_table_privilege('service_role','public.' || v_table,'UPDATE')
       or has_table_privilege('service_role','public.' || v_table,'DELETE')
    then
      raise exception 'Music ontology Slice 2 service-role ACL is not read-only: %', v_table;
    end if;
  end loop;

  foreach v_index in array array[
    'registry_track_work_links_evidence_idx',
    'registry_track_work_links_superseded_idx',
    'registry_track_contributions_evidence_idx',
    'registry_track_contributions_superseded_idx',
    'registry_work_contributions_evidence_idx',
    'registry_work_contributions_superseded_idx',
    'registry_rights_claims_evidence_idx',
    'registry_rights_claims_superseded_idx',
    'registry_external_identifier_assertions_evidence_idx',
    'registry_external_identifier_assertions_superseded_idx'
  ]
  loop
    if to_regclass('public.' || v_index) is null then
      raise exception 'Music ontology Slice 2 covering index missing: %', v_index;
    end if;
  end loop;

  if to_regclass('public.registry_parties') is not null then
    raise exception 'Generic Registry Party authority was introduced';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.registry_works'::regclass
      and conname='registry_works_pkey'
      and contype='p'
  ) then
    raise exception 'Registry Work UUID primary key is missing';
  end if;

  if exists (
    select 1
    from pg_constraint con
    join unnest(con.conkey) with ordinality as key(attnum,ord) on true
    join pg_attribute a
      on a.attrelid=con.conrelid
     and a.attnum=key.attnum
    where con.conrelid='public.registry_works'::regclass
      and con.contype='u'
      and a.attname in ('title','normalized_title')
  ) then
    raise exception 'Registry Work title was incorrectly made unique identity';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.registry_track_work_links'::regclass
      and conname='registry_track_work_links_track_id_fkey'
      and confrelid='public.registry_tracks'::regclass
  )
  or not exists (
    select 1
    from pg_constraint
    where conrelid='public.registry_track_work_links'::regclass
      and conname='registry_track_work_links_work_id_fkey'
      and confrelid='public.registry_works'::regclass
  ) then
    raise exception 'Recording-to-Work typed foreign keys are incomplete';
  end if;

  if exists (
    select 1
    from pg_constraint con
    join unnest(con.conkey) as key(attnum) on true
    join pg_attribute a
      on a.attrelid=con.conrelid
     and a.attnum=key.attnum
    where con.conrelid='public.registry_track_work_links'::regclass
      and con.contype='u'
      and a.attname in ('track_id','work_id')
  ) then
    raise exception 'Recording-to-Work was incorrectly constrained to one-to-one identity';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.registry_track_contributions'::regclass
      and conname='registry_track_contributions_track_id_fkey'
      and confrelid='public.registry_tracks'::regclass
  )
  or not exists (
    select 1
    from pg_constraint
    where conrelid='public.registry_track_contributions'::regclass
      and conname='registry_track_contributions_person_resource_id_fkey'
      and confrelid='editorial.people'::regclass
  )
  or not exists (
    select 1
    from pg_constraint
    where conrelid='public.registry_track_contributions'::regclass
      and conname='registry_track_contributions_organization_resource_id_fkey'
      and confrelid='editorial.organizations'::regclass
  )
  or not exists (
    select 1
    from pg_constraint
    where conrelid='public.registry_work_contributions'::regclass
      and conname='registry_work_contributions_work_id_fkey'
      and confrelid='public.registry_works'::regclass
  )
  or not exists (
    select 1
    from pg_constraint
    where conrelid='public.registry_work_contributions'::regclass
      and conname='registry_work_contributions_person_resource_id_fkey'
      and confrelid='editorial.people'::regclass
  )
  or not exists (
    select 1
    from pg_constraint
    where conrelid='public.registry_work_contributions'::regclass
      and conname='registry_work_contributions_organization_resource_id_fkey'
      and confrelid='editorial.organizations'::regclass
  ) then
    raise exception 'Music contribution typed identity foreign keys are incomplete';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.registry_rights_claims'::regclass
      and conname='registry_rights_claims_subject_exactly_one_check'
  )
  or not exists (
    select 1
    from pg_constraint
    where conrelid='public.registry_rights_claims'::regclass
      and conname='registry_rights_claims_claimant_exactly_one_check'
  )
  or not exists (
    select 1
    from pg_constraint
    where conrelid='public.registry_rights_claims'::regclass
      and conname='registry_rights_claims_share_value_check'
  ) then
    raise exception 'Rights Claim truth constraints are incomplete';
  end if;

  select pg_get_constraintdef(oid)
  into v_definition
  from pg_constraint
  where conrelid='public.registry_rights_claims'::regclass
    and conname='registry_rights_claims_share_value_check';

  if position('share_state' in lower(v_definition))=0
     or position('share_percentage' in lower(v_definition))=0
     or position('100' in v_definition)=0
  then
    raise exception 'Rights Claim share-state/percentage contract drifted';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid='public.registry_rights_claims'::regclass
      and lower(pg_get_constraintdef(oid)) like '%sum(%'
  ) then
    raise exception 'Rights Claims incorrectly enforce a cross-row percentage total';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.registry_external_identifier_assertions'::regclass
      and conname='registry_external_identifier_assertions_subject_exactly_one_check'
  ) then
    raise exception 'External identifier typed-subject constraint is missing';
  end if;

  if exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and tablename='registry_external_identifier_assertions'
      and lower(indexdef) like 'create unique index%'
      and lower(indexdef) like '%(scheme_key, comparison_value%'
  ) then
    raise exception 'External identifiers were incorrectly made globally unique identity';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.registry_track_provider_links'::regclass
      and conname='registry_track_provider_links_provider_identity_key'
      and contype='u'
  ) then
    raise exception 'Existing provider operational identity authority was disturbed';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='registry_tracks'
      and column_name='isrc'
  )
  or not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='registry_releases'
      and column_name='upc'
  ) then
    raise exception 'Existing Track/Release hot-path identifier projections were disturbed';
  end if;

  foreach v_table in array array[
    'registry_evidence_assertions',
    'registry_execution_grant_targets',
    'registry_review_cases'
  ]
  loop
    select pg_get_constraintdef(con.oid)
    into v_definition
    from pg_constraint con
    join pg_class c on c.oid=con.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='platform_private'
      and c.relname=v_table
      and con.conname=v_table || '_subject_type_check';

    if v_definition is null
       or position('work' in v_definition)=0
       or position('track_work_link' in v_definition)=0
       or position('track_contribution' in v_definition)=0
       or position('work_contribution' in v_definition)=0
       or position('rights_claim' in v_definition)=0
       or position('external_identifier_assertion' in v_definition)=0
    then
      raise exception 'Registry subject vocabulary extension is incomplete: %', v_table;
    end if;
  end loop;

  select pg_get_constraintdef(oid)
  into v_definition
  from pg_constraint
  where conrelid='platform_private.registry_operation_types'::regclass
    and conname='registry_operation_types_subjects_check';

  if v_definition is null
     or position('work' in v_definition)=0
     or position('track_work_link' in v_definition)=0
     or position('track_contribution' in v_definition)=0
     or position('work_contribution' in v_definition)=0
     or position('rights_claim' in v_definition)=0
     or position('external_identifier_assertion' in v_definition)=0
  then
    raise exception 'Registry operation subject vocabulary extension is incomplete';
  end if;

  if (
    select count(*)
    from public.capability_definitions
    where capability_key = any (
      array[
        'create_registry_work',
        'admit_registry_track_work_link',
        'admit_registry_track_contribution',
        'admit_registry_work_contribution',
        'admit_registry_rights_claim',
        'reconcile_registry_rights_claim',
        'admit_registry_external_identifier_assertion',
        'reconcile_registry_external_identifier_assertion'
      ]::text[]
    )
      and domain='registry'
  ) <> 8 then
    raise exception 'Slice 2 Registry capability declarations are incomplete';
  end if;

  select count(*)
  into v_operation_count
  from (
    values
      ('registry.work.create',1,'create_registry_work','medium','work',false,false),
      ('registry.track_work_link.admit',1,'admit_registry_track_work_link','medium','track_work_link',false,false),
      ('registry.track_contribution.admit',1,'admit_registry_track_contribution','medium','track_contribution',false,false),
      ('registry.work_contribution.admit',1,'admit_registry_work_contribution','medium','work_contribution',false,false),
      ('registry.rights_claim.admit',1,'admit_registry_rights_claim','high','rights_claim',false,false),
      ('registry.rights_claim.reviewed_reconcile',1,'reconcile_registry_rights_claim','high','rights_claim',true,false),
      ('registry.external_identifier_assertion.admit',1,'admit_registry_external_identifier_assertion','medium','external_identifier_assertion',false,true),
      ('registry.external_identifier_assertion.reviewed_reconcile',1,'reconcile_registry_external_identifier_assertion','high','external_identifier_assertion',true,false)
  ) expected(
    operation_key,
    operation_version,
    capability_key,
    risk_class,
    subject_type,
    requires_existing_target,
    enabled
  )
  join platform_private.registry_operation_types actual
    on actual.operation_key=expected.operation_key
   and actual.operation_version=expected.operation_version
   and actual.capability_key=expected.capability_key
   and actual.risk_class=expected.risk_class
   and actual.allowed_subject_types=array[expected.subject_type]::text[]
   and actual.requires_existing_target=expected.requires_existing_target
   and actual.max_targets=1
   and actual.max_rows_ceiling=1
   and actual.max_grant_ttl_seconds=300
   and actual.requires_human_approval
   and actual.requires_verifier
   and actual.enabled=expected.enabled;

  if v_operation_count <> 8 then
    raise exception 'Slice 2 Registry operation declarations or enablement state drifted';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key in (
      'registry.work.create',
      'registry.track_work_link.admit',
      'registry.track_contribution.admit',
      'registry.work_contribution.admit',
      'registry.rights_claim.admit',
      'registry.rights_claim.reviewed_reconcile',
      'registry.external_identifier_assertion.reviewed_reconcile'
    )
      and enabled
  ) then
    raise exception 'Deferred Slice 2 ontology mutation authority enabled prematurely';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key='registry.external_identifier_assertion.admit'
      and operation_version=1
      and enabled
  ) then
    raise exception 'Slice 3 external identifier admission authority is not enabled';
  end if;

  if to_regclass('public.registry_track_artists') is null
     or to_regclass('editorial.credits') is null
     or to_regclass('editorial.resource_credits') is null
  then
    raise exception 'Existing public Artist billing or editorial credit authority was disturbed';
  end if;

  raise notice 'MUSIC_IDENTITY_RIGHTS_SLICE2_AUTHORITY_V1_PASS';
end
$verify$;
