-- Phase 7A K5D: Video Correction Target + Provenance Convergence
-- Moves the shared Correction target boundary onto canonical Resource Version
-- identity and admits Video as the second real consumer. No Video-owned
-- correction ledger or application adapter is created.

do $preflight$
declare
  v_constraint text;
begin
  if to_regclass('editorial.correction_targets') is null
     or to_regclass('editorial.resource_versions') is null
     or to_regclass('editorial.video_publication_resources') is null
     or to_regprocedure('public.triage_correction_case(uuid,bigint,text,text,uuid,uuid,text,text,text,uuid)') is null
     or to_regprocedure('public.get_admin_video_publication_workspace(uuid)') is null
     or to_regprocedure('editorial.current_user_can_view_video(uuid)') is null
  then
    raise exception 'STOP: K5D requires accepted Correction, Resource Version, and Video authority.';
  end if;

  if to_regprocedure('public.get_admin_video_correction_provenance(uuid)') is not null
     or to_regclass('video.correction_cases') is not null
     or to_regclass('video.corrections') is not null
  then
    raise exception 'STOP: K5D Video correction provenance surface already exists.';
  end if;

  select pg_get_constraintdef(oid)
  into v_constraint
  from pg_constraint
  where conrelid='editorial.correction_targets'::regclass
    and conname='correction_targets_resource_kind_check';

  if position('standalone_video' in coalesce(v_constraint,''))>0
     or position('video_episode' in coalesce(v_constraint,''))>0
  then
    raise exception 'STOP: Correction target authority already includes Video unexpectedly.';
  end if;
end;
$preflight$;

alter table editorial.correction_targets
  drop constraint correction_targets_version_fkey,
  drop constraint correction_targets_resource_kind_check,
  drop constraint correction_targets_version_type_check;

alter table editorial.correction_targets
  add constraint correction_targets_resource_kind_check
  check (
    target_resource_kind in (
      'article',
      'standalone_video',
      'video_episode'
    )
  ),
  add constraint correction_targets_version_type_check
  check (
    target_version_type in (
      'article_version',
      'video_publication_version'
    )
  ),
  add constraint correction_targets_kind_version_pair_check
  check (
    (
      target_resource_kind='article'
      and target_version_type='article_version'
    )
    or (
      target_resource_kind in (
        'standalone_video',
        'video_episode'
      )
      and target_version_type='video_publication_version'
    )
  ),
  add constraint correction_targets_resource_version_fkey
  foreign key (
    target_resource_id,
    target_version_id
  )
  references editorial.resource_versions(
    resource_id,
    id
  )
  on delete restrict;

create or replace function editorial.assert_correction_target_integrity()
returns trigger
language plpgsql
set search_path to 'pg_catalog','editorial'
as $function$
declare
  v_case_state text;
  v_resource editorial.resources%rowtype;
  v_version editorial.resource_versions%rowtype;
begin
  select correction_case.case_state
  into v_case_state
  from editorial.correction_cases correction_case
  where correction_case.resource_id=new.case_resource_id;

  if not found then
    raise exception 'Correction target case not found';
  end if;

  if v_case_state='submitted' then
    raise exception 'Submitted correction cases cannot have governed targets';
  end if;

  select resource.*
  into v_resource
  from editorial.resources resource
  where resource.id=new.target_resource_id
    and resource.resource_kind=new.target_resource_kind;

  if not found then
    raise exception 'Correction target Resource not found';
  end if;

  select version.*
  into v_version
  from editorial.resource_versions version
  where version.id=new.target_version_id
    and version.resource_id=new.target_resource_id;

  if not found
     or v_version.resource_kind<>new.target_resource_kind
     or v_version.version_type<>new.target_version_type
  then
    raise exception 'Correction target Resource Version identity is invalid';
  end if;

  if new.target_resource_kind='article' then
    if not exists (
      select 1
      from editorial.article_resources binding
      where binding.resource_id=new.target_resource_id
        and binding.resource_kind='article'
    ) then
      raise exception 'Correction target requires a valid Article resource binding';
    end if;
  elsif new.target_resource_kind in (
    'standalone_video',
    'video_episode'
  ) then
    if not exists (
      select 1
      from editorial.video_publication_resources binding
      where binding.resource_id=new.target_resource_id
        and binding.resource_kind=new.target_resource_kind
    ) then
      raise exception 'Correction target requires a valid Video resource binding';
    end if;
  else
    raise exception 'Unsupported Correction target Resource kind: %',
      new.target_resource_kind;
  end if;

  if new.target_role='primary'
     and v_resource.current_published_version_id
       is distinct from new.target_version_id
  then
    raise exception
      'Primary correction target must identify the current published Resource version';
  end if;

  if new.observed_content_fingerprint is not null
     and new.observed_content_fingerprint
       is distinct from v_version.content_fingerprint
  then
    raise exception
      'Correction target observed fingerprint must match the exact target Resource Version';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.triage_correction_case(p_case_resource_id uuid, p_expected_case_revision bigint, p_correction_kind text, p_priority text, p_target_resource_id uuid, p_target_version_id uuid, p_target_summary text, p_reason text, p_idempotency_key text, p_correlation_id uuid)
 RETURNS TABLE(command_receipt_id uuid, receipt_status text, case_resource_id uuid, case_revision bigint, result_payload jsonb, idempotent_replay boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'
AS $function$
declare
  v_actor uuid;
  v_begin record;
  v_case editorial.correction_cases%rowtype;
  v_target_resource editorial.resources%rowtype;
  v_target_version editorial.resource_versions%rowtype;
  v_target_id uuid;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'triage_corrections'
    );

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_target_resource_id is null
     or p_target_version_id is null
     or p_correlation_id is null
     or p_priority not in (
       'low',
       'normal',
       'high',
       'urgent'
     )
     or nullif(btrim(p_reason), '') is null
  then
    raise exception
      using errcode = '22023',
      message = 'Case, revision, target, priority, reason, and correlation identity are required.';
  end if;

  if not exists (
    select 1
    from editorial.correction_kinds kind
    where kind.correction_kind = p_correction_kind
      and kind.enabled
  ) then
    raise exception
      using errcode = '22023',
      message = 'The correction kind is not enabled.';
  end if;

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.case.triage',
    p_case_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'expected_case_revision', p_expected_case_revision,
      'correction_kind', p_correction_kind,
      'priority', p_priority,
      'target_resource_id', p_target_resource_id,
      'target_version_id', p_target_version_id,
      'target_summary', nullif(btrim(p_target_summary), ''),
      'reason', btrim(p_reason),
      'correlation_id', p_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      true
    );
    return;
  end if;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_not_found',
      'The correction case does not exist.',
      jsonb_build_object(
        'case_revision', null
      )
    );

    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      false
    );
    return;
  end if;

  if v_case.current_revision <>
     p_expected_case_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_revision_changed',
      'The correction case revision changed.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );

    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      false
    );
    return;
  end if;

  if v_case.case_state <> 'submitted' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'invalid_transition',
      'Only submitted correction cases may be triaged.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );

    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      false
    );
    return;
  end if;

  select resource.*
  into v_target_resource
  from editorial.resources resource
  where resource.id = p_target_resource_id;

  select version.*
  into v_target_version
  from editorial.resource_versions version
  where version.id = p_target_version_id
    and version.resource_id = p_target_resource_id;

  if v_target_resource.id is null
     or v_target_version.id is null
     or v_target_resource.current_published_version_id
       is distinct from p_target_version_id
     or not (
       (
         v_target_resource.resource_kind = 'article'
         and v_target_version.resource_kind = 'article'
         and v_target_version.version_type = 'article_version'
         and exists (
           select 1
           from editorial.article_resources binding
           where binding.resource_id = p_target_resource_id
             and binding.resource_kind = 'article'
         )
       )
       or (
         v_target_resource.resource_kind in (
           'standalone_video',
           'video_episode'
         )
         and v_target_version.resource_kind =
           v_target_resource.resource_kind
         and v_target_version.version_type =
           'video_publication_version'
         and exists (
           select 1
           from editorial.video_publication_resources binding
           where binding.resource_id = p_target_resource_id
             and binding.resource_kind =
               v_target_resource.resource_kind
         )
       )
     )
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'target_changed',
      'The primary target must identify the current published supported Resource version.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );

    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      false
    );
    return;
  end if;

  update editorial.correction_cases
  set
    correction_kind = p_correction_kind,
    priority = p_priority,
    case_state = 'triaged',
    current_revision =
      v_case.current_revision + 1,
    triage_reason = btrim(p_reason),
    triaged_by = v_actor,
    triaged_at = now(),
    updated_by = v_actor,
    updated_at = now()
  where resource_id = p_case_resource_id;

  insert into editorial.correction_targets (
    case_resource_id,
    target_resource_id,
    target_resource_kind,
    target_version_type,
    target_version_id,
    target_role,
    target_summary,
    observed_content_fingerprint,
    created_by
  )
  values (
    p_case_resource_id,
    p_target_resource_id,
    v_target_resource.resource_kind,
    v_target_version.version_type,
    p_target_version_id,
    'primary',
    nullif(btrim(p_target_summary), ''),
    v_target_version.content_fingerprint,
    v_actor
  )
  returning id
  into v_target_id;

  perform platform_private.append_correction_event(
    p_case_resource_id,
    'case_triaged',
    v_case.current_revision,
    v_case.current_revision + 1,
    v_case.case_state,
    'triaged',
    v_actor,
    btrim(p_reason),
    null,
    v_target_id,
    null,
    null,
    v_begin.command_receipt_id,
    p_correlation_id,
    jsonb_build_object(
      'correction_kind', p_correction_kind,
      'priority', p_priority
    )
  );

  perform platform_private.append_correction_event(
    p_case_resource_id,
    'target_attached',
    v_case.current_revision,
    v_case.current_revision + 1,
    v_case.case_state,
    'triaged',
    v_actor,
    btrim(p_reason),
    null,
    v_target_id,
    null,
    null,
    v_begin.command_receipt_id,
    p_correlation_id,
    jsonb_build_object(
      'target_resource_id', p_target_resource_id,
      'target_resource_kind', v_target_resource.resource_kind,
      'target_version_type', v_target_version.version_type,
      'target_version_id', p_target_version_id,
      'target_version_kind', v_target_version.version_kind,
      'target_version_number', v_target_version.version_number,
      'target_content_fingerprint', v_target_version.content_fingerprint,
      'target_role', 'primary'
    )
  );

  v_result := jsonb_build_object(
    'case_resource_id', p_case_resource_id,
    'case_revision', v_case.current_revision + 1,
    'case_state', 'triaged',
    'target_id', v_target_id,
    'target_resource_kind', v_target_resource.resource_kind,
    'target_version_type', v_target_version.version_type,
    'target_version_id', v_target_version.id,
    'target_content_fingerprint', v_target_version.content_fingerprint
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  return query
  select *
  from platform_private.read_correction_command_result(
    v_begin.command_receipt_id,
    false
  );
end;
$function$
;

create or replace function public.get_admin_video_correction_provenance(
  p_resource_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','auth','public','editorial'
as $function$
declare
  v_can_view_corrections boolean;
begin
  if auth.uid() is null then
    raise exception using
      errcode='42501',
      message='Video correction provenance requires an authenticated editor.';
  end if;

  if not editorial.current_user_can_view_video(p_resource_id) then
    raise exception using
      errcode='42501',
      message='Video access is required.';
  end if;

  v_can_view_corrections :=
    coalesce(auth.role(),'')='service_role'
    or coalesce(public.current_user_is_administrator(),false)
    or coalesce(public.current_user_has_capability('view_corrections'),false);

  if not v_can_view_corrections then
    return jsonb_build_object(
      'can_view',
      false,
      'cases',
      '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'can_view',
    true,
    'cases',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'case_resource_id', correction_case.resource_id,
          'case_reference',
            'COR-' || lpad(correction_case.case_number::text,8,'0'),
          'case_state', correction_case.case_state,
          'correction_kind', correction_case.correction_kind,
          'priority', correction_case.priority,
          'target_id', target.id,
          'target_version_id', target.target_version_id,
          'target_version_type', target.target_version_type,
          'target_role', target.target_role,
          'target_summary', target.target_summary,
          'observed_content_fingerprint',
            target.observed_content_fingerprint,
          'version_kind', version.version_kind,
          'version_number', version.version_number,
          'current_decision_outcome', decision.outcome,
          'current_decision_public_safe_explanation',
            decision.public_safe_explanation,
          'created_at', correction_case.created_at,
          'updated_at', correction_case.updated_at
        )
        order by correction_case.updated_at desc,
                 correction_case.resource_id,
                 target.id
      )
      from editorial.correction_targets target
      join editorial.correction_cases correction_case
        on correction_case.resource_id=target.case_resource_id
      join editorial.resource_versions version
        on version.id=target.target_version_id
       and version.resource_id=target.target_resource_id
       and version.version_type=target.target_version_type
      left join editorial.correction_decisions decision
        on decision.id=correction_case.current_decision_id
      where target.target_resource_id=p_resource_id
        and target.target_resource_kind in (
          'standalone_video',
          'video_episode'
        )
    ),'[]'::jsonb)
  );
end;
$function$;

revoke all
  on function public.get_admin_video_correction_provenance(uuid)
  from public, anon, authenticated, service_role;

grant execute
  on function public.get_admin_video_correction_provenance(uuid)
  to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_admin_video_publication_workspace(p_publication_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'auth', 'public', 'editorial', 'video', 'media'
AS $function$
declare
  v_p video.publications%rowtype;
  v_b editorial.video_publication_resources%rowtype;
  v_r editorial.resources%rowtype;
  v_e editorial.show_episodes%rowtype;
  v_s editorial.shows%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Video access requires an authenticated editor.';
  end if;

  select * into v_p from video.publications p where p.id=p_publication_id;
  if not found then raise exception using errcode='P0002',message='Video publication does not exist.'; end if;
  select * into v_b from editorial.video_publication_resources b where b.publication_id=p_publication_id;
  select * into v_r from editorial.resources r where r.id=v_b.resource_id;

  if not editorial.current_user_can_view_video(v_r.id) then
    raise exception using errcode='42501',message='Video access is required.';
  end if;

  if v_p.publication_kind='episode' then
    select e.* into v_e
    from editorial.video_episode_shared_links l
    join editorial.show_episodes e on e.resource_id=l.show_episode_resource_id
    where l.video_publication_id=p_publication_id;
    if not found then raise exception 'Video Episode shared Show Episode binding is missing.'; end if;

    select * into v_s from editorial.shows s where s.resource_id=v_e.show_resource_id;
    if not found then raise exception 'Shared Show does not exist.'; end if;
  end if;

  return jsonb_build_object(
    'publication',jsonb_build_object(
      'id',v_p.id,'publication_kind',v_p.publication_kind,
      'slug',case when v_p.publication_kind='standalone' then v_p.standalone_slug else v_e.slug end,
      'title',case when v_p.publication_kind='standalone' then v_p.standalone_title else v_e.title end,
      'summary',case when v_p.publication_kind='standalone' then v_p.standalone_summary else v_e.summary end,
      'classification',v_p.classification,'authority_revision',v_p.authority_revision,
      'metadata',v_p.metadata,'created_at',v_p.created_at,'updated_at',v_p.updated_at
    ),
    'resource',jsonb_build_object(
      'id',v_r.id,'resource_kind',v_r.resource_kind,'owner_id',v_r.owner_id,
      'visibility',v_r.visibility,'lifecycle_state',v_r.lifecycle_state,
      'versions',jsonb_build_object(
        'working',v_r.current_working_version_id,'submitted',v_r.current_submitted_version_id,
        'approved',v_r.current_approved_version_id,'published',v_r.current_published_version_id
      )
    ),
    'show',case when v_s.resource_id is null then null else jsonb_build_object(
      'resource_id',v_s.resource_id,'slug',v_s.slug,'title',v_s.title,
      'description',v_s.description,'authority_revision',v_s.authority_revision
    ) end,
    'show_episode',case when v_e.resource_id is null then null else jsonb_build_object(
      'resource_id',v_e.resource_id,'show_resource_id',v_e.show_resource_id,
      'slug',v_e.slug,'title',v_e.title,'summary',v_e.summary,
      'episode_number',v_e.episode_number,'authority_revision',v_e.authority_revision
    ) end,
    'selected_source',(
      select case when s.id is null then null else jsonb_build_object(
        'id',s.id,'source_kind',s.source_kind,'provider_key',s.provider_key,
        'provider_object_id',s.provider_object_id,'canonical_url',s.canonical_url,
        'media_asset_id',s.media_asset_id,'media_asset_revision_id',s.media_asset_revision_id,
        'source_metadata',s.source_metadata,'capabilities',video.source_capabilities(s.id),
        'created_at',s.created_at
      ) end
      from (select v_p.selected_source_id id) x
      left join video.sources s on s.id=x.id
    ),
    'poster',(
      select jsonb_build_object(
        'usage_link_id',u.id,'usage_revision',u.usage_revision,
        'asset_id',u.asset_id,'asset_revision_id',u.asset_revision_id,
        'placement_data',u.placement_data
      )
      from media.usage_links u
      where u.target_authority='video' and u.target_kind='video_publication'
        and u.target_id=p_publication_id and u.target_version_id is null
        and u.usage_role='video_poster' and u.usage_state='active'
      order by u.created_at desc,u.id desc limit 1
    ),
    'transcript',(
      select jsonb_build_object(
        'usage_link_id',u.id,'usage_revision',u.usage_revision,
        'asset_id',u.asset_id,'asset_revision_id',u.asset_revision_id,
        'placement_data',u.placement_data
      )
      from media.usage_links u
      where u.target_authority='video' and u.target_kind='video_publication'
        and u.target_id=p_publication_id and u.target_version_id is null
        and u.usage_role='video_transcript' and u.usage_state='active'
      order by u.created_at desc,u.id desc limit 1
    ),
    'captions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',t.id,'media_asset_id',t.media_asset_id,'media_asset_revision_id',t.media_asset_revision_id,
        'language_tag',t.language_tag,'track_kind',t.track_kind,'label',t.label,
        'is_default',t.is_default,'display_order',t.display_order,'authority_revision',t.authority_revision
      ) order by t.display_order,t.id)
      from video.caption_tracks t where t.publication_id=p_publication_id
    ),'[]'::jsonb),
    'chapters',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'chapter_number',c.chapter_number,'start_seconds',c.start_seconds,
        'title',c.title,'description',c.description
      ) order by c.chapter_number)
      from video.publication_chapters c where c.publication_id=p_publication_id
    ),'[]'::jsonb),
    'version_history',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',v.id,'version_number',v.version_number,'version_kind',v.version_kind,
        'content_fingerprint',v.content_fingerprint,'source_id',v.source_id,
        'created_by',v.created_by,'created_at',v.created_at
      ) order by v.version_number,v.id)
      from video.publication_versions v where v.publication_id=p_publication_id
    ),'[]'::jsonb),
    'review_events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'event_number',e.event_number,'target_version_id',e.target_version_id,
        'result_version_id',e.result_version_id,'action',e.action,'prior_status',e.prior_status,
        'resulting_status',e.resulting_status,'reason',e.reason,'actor_id',e.actor_id,'created_at',e.created_at
      ) order by e.event_number,e.id)
      from editorial.resource_review_events e where e.resource_id=v_r.id
    ),'[]'::jsonb),
    'lifecycle_events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'event_number',e.event_number,'version_id',e.version_id,
        'action',e.action,'prior_status',e.prior_status,'resulting_status',e.resulting_status,
        'note',e.note,'actor_id',e.actor_id,'created_at',e.created_at
      ) order by e.event_number,e.id)
      from editorial.resource_lifecycle_events e where e.resource_id=v_r.id
    ),'[]'::jsonb),
    'trust', (
      select jsonb_build_object(
        'citation_revision', coalesce(r.citation_revision, 1),
        'credit_revision', coalesce(r.credit_revision, 1),
        'citations', coalesce((
          select jsonb_agg(jsonb_build_object(
            'attachment_id', a.id,
            'citation_id', a.citation_id,
            'citation_purpose', a.citation_purpose,
            'target_anchor_type', a.target_anchor_type,
            'target_anchor_data', a.target_anchor_data,
            'display_order', a.display_order,
            'public_safe', a.public_safe,
            'public_label', c.public_label,
            'quotation', c.quotation,
            'citation_state', c.citation_state
          ) order by a.display_order,a.id)
          from editorial.resource_citations a
          join editorial.citations c on c.id=a.citation_id
          where a.resource_id=v_r.id
            and a.target_version_type='video_publication_version'
            and a.target_version_id=v_r.current_working_version_id
        ),'[]'::jsonb),
        'credits', coalesce((
          select jsonb_agg(jsonb_build_object(
            'attachment_id', a.id,
            'credit_id', a.credit_id,
            'display_order', a.display_order,
            'is_primary', a.is_primary,
            'public_safe', a.public_safe,
            'credit_role', c.credit_role,
            'display_name', c.display_name_snapshot,
            'role_label', c.role_label_snapshot
          ) order by a.display_order,a.id)
          from editorial.resource_credits a
          join editorial.credits c on c.id=a.credit_id
          where a.resource_id=v_r.id
            and a.target_version_type='video_publication_version'
            and a.target_version_id=v_r.current_working_version_id
        ),'[]'::jsonb)
      )
      from (select 1) seed
      left join editorial.video_publication_version_trust_revisions r
        on r.publication_version_id=v_r.current_working_version_id
    ),
    'correction_provenance',
      public.get_admin_video_correction_provenance(v_r.id),
    'classifications',coalesce((
      select jsonb_agg(jsonb_build_object(
        'classification',c.classification,'label',c.label,'description',c.description
      ) order by c.sort_order,c.classification)
      from video.publication_classifications c where c.enabled
    ),'[]'::jsonb),
    'source_providers',coalesce((
      select jsonb_agg(jsonb_build_object(
        'provider_key',s.provider_key,'label',s.label,'description',s.description
      ) order by s.sort_order,s.provider_key)
      from video.source_providers s where s.enabled
    ),'[]'::jsonb),
    'caption_track_kinds',coalesce((
      select jsonb_agg(jsonb_build_object(
        'track_kind',k.track_kind,'label',k.label,'description',k.description
      ) order by k.sort_order,k.track_kind)
      from video.caption_track_kinds k where k.enabled
    ),'[]'::jsonb),
    'capabilities',jsonb_build_object(
      'can_view',editorial.current_user_can_view_video(v_r.id),
      'can_edit',editorial.current_user_can_edit_video(v_r.id),
      'can_manage_review',coalesce(public.current_user_has_capability('manage_review_queue'),false),
      'can_publish',editorial.current_user_can_publish_video(v_r.id)
    )
  );
end;
$function$
;

do $postflight$
declare
  v_constraint text;
  v_def text;
begin
  select pg_get_constraintdef(oid)
  into v_constraint
  from pg_constraint
  where conrelid='editorial.correction_targets'::regclass
    and conname='correction_targets_resource_version_fkey';

  if position('resource_versions' in coalesce(v_constraint,''))=0 then
    raise exception 'STOP: K5D Correction targets do not use canonical Resource Version identity.';
  end if;

  v_def:=pg_get_functiondef(
    'public.triage_correction_case(uuid,bigint,text,text,uuid,uuid,text,text,text,uuid)'::regprocedure
  );
  if position('editorial.resource_versions' in v_def)=0
     or position('video_publication_resources' in v_def)=0
     or position('observed_content_fingerprint' in v_def)=0
  then
    raise exception 'STOP: K5D triage does not validate canonical Video Resource Version provenance.';
  end if;

  v_def:=pg_get_functiondef(
    'public.get_admin_video_publication_workspace(uuid)'::regprocedure
  );
  if position('get_admin_video_correction_provenance' in v_def)=0 then
    raise exception 'STOP: Video admin workspace does not expose Correction provenance.';
  end if;

  if has_function_privilege(
       'anon',
       'public.get_admin_video_correction_provenance(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_admin_video_correction_provenance(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'STOP: K5D correction provenance execute boundary is wrong.';
  end if;

  if to_regclass('video.correction_cases') is not null
     or to_regclass('video.corrections') is not null
     or exists (
       select 1
       from pg_proc p
       join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public'
         and p.proname='apply_video_correction'
     )
  then
    raise exception 'STOP: K5D created competing or premature Video correction application authority.';
  end if;
end;
$postflight$;
