-- Charts 2.0 Phase 1: one governed GET review for four retained first-party
-- Kenyan charts, on the EXISTING private probe/decision tables and Edge worker.
-- CLI 2.107.0 minted this exact name in GitHub Actions run 44490723953.
-- No YouTube method rewrite, scheduler, weight, scoring, or publication.
begin;

alter table platform_private.charts2_source_method_probes_v1
  drop constraint charts2_source_method_probes_v1_source_key_check,
  drop constraint charts2_source_method_probes_v1_exact_endpoint_check,
  drop constraint charts2_source_method_probes_v1_reviewed_method_check,
  drop constraint charts2_source_method_probes_v1_target_period_key_check,
  drop constraint charts2_source_method_probes_v1_observed_depth_check,
  alter column target_period_key drop not null,
  alter column provider_week_ending_date drop not null;

alter table platform_private.charts2_source_method_probes_v1
  add constraint charts2_probe_first_party_method_v2 check (
    (source_key='youtube_ke' and
     exact_endpoint='https://charts.youtube.com/youtubei/v1/browse?alt=json' and
     reviewed_method='POST' and
     target_period_key is not null and
     target_period_key ~ '^weekly:[0-9]{8}:[0-9]{8}:ke
     provider_week_ending_date is not null and
     observed_depth between 1 and 100)
    or
        (source_key='apple_ke' and exact_endpoint='https://music.apple.com/ke/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172' and reviewed_method='GET'
         and target_period_key is null and provider_week_ending_date is null
         and observed_depth between 1 and 100)
        or
        (source_key='mdundo_ke' and exact_endpoint='https://play.mdundo.com/top-charts/ke' and reviewed_method='GET'
         and target_period_key is null and provider_week_ending_date is null
         and observed_depth between 1 and 100)
        or
        (source_key='audiomack_ke' and exact_endpoint='https://audiomack.com/geo-charts/playlist/kenya' and reviewed_method='GET'
         and target_period_key is null and provider_week_ending_date is null
         and observed_depth between 1 and 100)
        or
        (source_key='shazam_ke' and exact_endpoint='https://www.shazam.com/services/charts/csv/top-200/kenya' and reviewed_method='GET'
         and target_period_key is null and provider_week_ending_date is null
         and observed_depth between 1 and 200)
  );

alter table platform_private.charts2_source_method_decisions_v1
  drop constraint charts2_source_method_decisions_v1_source_key_check;
alter table platform_private.charts2_source_method_decisions_v1
  add constraint charts2_decisions_source_scope_v2 check
  (source_key in ('youtube_ke','apple_ke','mdundo_ke','audiomack_ke','shazam_ke'));

-- The only writer of non-YouTube original probes is the already-authenticated
-- Edge collector. Fixed endpoints/format, SHA path and independently stored
-- original are checked again inside this service-role-only function.
create function public.charts2_record_get_method_probe_v1(
  p_source_key text,p_actor uuid,p_sha text,p_object_key text,
  p_size integer,p_depth integer
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  fixed_endpoint text;
  extension text;
  max_depth integer;
  expected_key text;
  revision integer;
  probe_id uuid;
begin
  fixed_endpoint := case p_source_key
    when 'apple_ke' then 'https://music.apple.com/ke/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172'
    when 'mdundo_ke' then 'https://play.mdundo.com/top-charts/ke'
    when 'audiomack_ke' then 'https://audiomack.com/geo-charts/playlist/kenya'
    when 'shazam_ke' then 'https://www.shazam.com/services/charts/csv/top-200/kenya'
    else null end;
  extension := case when p_source_key='shazam_ke' then '.csv' else '.html' end;
  max_depth := case when p_source_key='shazam_ke' then 200 else 100 end;
  if fixed_endpoint is null or p_actor is null or
     p_sha is null or p_sha !~ '^[a-f0-9]{64}$' or
     p_size is null or p_size not between 1 and 4000000 or
     p_depth is null or p_depth not between 1 and max_depth
  then
    raise exception 'charts2_get_probe_arguments_invalid';
  end if;
  expected_key := p_source_key || '/' || substring(p_sha from 1 for 2)
    || '/' || p_sha || extension;
  if p_object_key is distinct from expected_key or not exists (
    select 1 from storage.objects o
    where o.bucket_id='charts2-evidence-private-v1'
      and o.name=expected_key
      and (o.metadata->>'size')::integer=p_size
  ) then raise exception 'charts2_get_probe_original_unverified'; end if;
  select m.method_revision into revision
  from platform_private.charts2_source_methods_v1 m
  where m.source_key=p_source_key;
  if revision is null then raise exception 'charts2_get_probe_method_missing'; end if;
  insert into platform_private.charts2_source_method_probes_v1
    (source_key,exact_endpoint,reviewed_method,
     target_period_key,provider_week_ending_date,actor_id,
     expected_method_revision,original_sha256,original_object_key,
     original_byte_length,observed_depth)
  values
    (p_source_key,fixed_endpoint,'GET',null,null,p_actor,
     revision,p_sha,expected_key,p_size,p_depth)
  returning id into probe_id;
  return pg_catalog.jsonb_build_object(
    'probe_id',probe_id,'expected_revision',revision,'source_key',p_source_key
  );
end;
$$;
revoke all on function public.charts2_record_get_method_probe_v1(
  text,uuid,text,text,integer,integer
) from public,anon,authenticated,service_role;
grant execute on function public.charts2_record_get_method_probe_v1(
  text,uuid,text,text,integer,integer
) to service_role;

-- The decision cannot use a service-role caller or a client-claimed actor.
-- Each real auth.uid() must have CURRENT manage_charts capability and a
-- same-actor SHA-backed probe made in the preceding twenty minutes.
create function public.charts2_decide_get_method_v1(
  p_source_key text,p_action text,p_probe_id uuid,
  p_expected_revision integer,p_ack text
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  fixed_endpoint text;
  source_title text;
  method_row platform_private.charts2_source_methods_v1%rowtype;
  proof platform_private.charts2_source_method_probes_v1%rowtype;
  next_revision integer;
  expiration timestamptz;
begin
  if actor is null or
     not coalesce(public.current_user_has_capability('manage_charts'),false) then
    raise exception 'charts2_method_review_not_authorized' using errcode='42501';
  end if;
  fixed_endpoint := case p_source_key
    when 'apple_ke' then 'https://music.apple.com/ke/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172'
    when 'mdundo_ke' then 'https://play.mdundo.com/top-charts/ke'
    when 'audiomack_ke' then 'https://audiomack.com/geo-charts/playlist/kenya'
    when 'shazam_ke' then 'https://www.shazam.com/services/charts/csv/top-200/kenya'
    else null end;
  source_title := case p_source_key
    when 'apple_ke' then 'Apple Music Kenya Top 100'
    when 'mdundo_ke' then 'Mdundo Kenya Top Songs'
    when 'audiomack_ke' then 'Audiomack Kenya Weekly 100'
    when 'shazam_ke' then 'Shazam Kenya Top 200'
    else null end;
  if fixed_endpoint is null or
     p_action is null or p_action not in ('admit','hold') or
     p_expected_revision is null or p_expected_revision < 0 or
     p_ack is null or length(trim(p_ack)) not between 24 and 600 then
    raise exception 'charts2_get_review_arguments_invalid';
  end if;
  select * into method_row
  from platform_private.charts2_source_methods_v1 m
  where m.source_key=p_source_key
  for update;
  if not found or method_row.method_revision <> p_expected_revision
     or method_row.method_revision >= 2147483646 then
    raise exception 'charts2_method_review_revision_conflict';
  end if;
  next_revision := method_row.method_revision+1;
  if p_action='admit' then
    if p_probe_id is null or p_ack <>
      'I approve first-party ' || source_title ||
      ' GET for evidence-only manual collection.' then
      raise exception 'charts2_get_review_attestation_required';
    end if;
    select * into proof
    from platform_private.charts2_source_method_probes_v1 e
    where e.id=p_probe_id
      and e.source_key=p_source_key and e.exact_endpoint=fixed_endpoint
      and e.reviewed_method='GET'
      and e.actor_id=actor and e.expected_method_revision=p_expected_revision
      and e.checked_at > now()-interval '20 minutes'
      and e.checked_at <= now()
      and e.target_period_key is null and e.provider_week_ending_date is null;
    if not found or not exists (
      select 1 from storage.objects o
      where o.bucket_id='charts2-evidence-private-v1'
        and o.name=proof.original_object_key
        and (o.metadata->>'size')::integer=proof.original_byte_length
    ) then raise exception 'charts2_method_review_evidence_unqualified'; end if;
    expiration := now()+interval '24 hours';
    update platform_private.charts2_source_methods_v1
    set exact_endpoint=fixed_endpoint,reviewed_method='GET',
        review_state='collector_admitted',reviewed_by=actor,
        reviewed_at=now(),authorization_expires_at=expiration,
        access_evidence_sha256=proof.original_sha256,
        method_revision=next_revision,updated_at=now()
    where source_key=p_source_key;
  else
    if p_probe_id is not null then
      raise exception 'charts2_get_review_hold_probe_forbidden';
    end if;
    update platform_private.charts2_source_methods_v1
    set exact_endpoint=null,reviewed_method=null,review_state='held',
        reviewed_by=null,reviewed_at=null,authorization_expires_at=null,
        access_evidence_sha256=null,method_revision=next_revision,updated_at=now()
    where source_key=p_source_key;
  end if;
  insert into platform_private.charts2_source_method_decisions_v1
    (source_key,action,actor_id,method_revision,probe_id,evidence_sha256,
     acknowledged_scope,authorization_expires_at)
  values
    (p_source_key,p_action,actor,next_revision,
     case when p_action='admit' then p_probe_id else null end,
     case when p_action='admit' then proof.original_sha256 else null end,
     p_ack,expiration);
  return pg_catalog.jsonb_build_object(
    'source_key',p_source_key,
    'review_state',case when p_action='admit' then 'collector_admitted' else 'held' end,
    'method_revision',next_revision,
    'authorization_expires_at',expiration,
    'can_score',false,'can_publish',false
  );
end;
$$;
revoke all on function public.charts2_decide_get_method_v1(
  text,text,uuid,integer,text
) from public,anon,authenticated,service_role;
grant execute on function public.charts2_decide_get_method_v1(
  text,text,uuid,integer,text
) to authenticated;

comment on function public.charts2_decide_get_method_v1(text,text,uuid,integer,text)
is 'Actor-JWT, recent SHA-proven private originals and revision-gated manual review of four exact first-party Kenya GET methods; 24-hour admission, immutable audit; never scores or publishes.';

commit;
