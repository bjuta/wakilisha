-- The authenticated selected Release set is the exact mutation authority.
-- Unselected provider observations are not commands. Existing immutable plans
-- remain unchanged. No global provider identity binding is inferred from a
-- release-scoped human decision. Real conflicting bindings remain nonretryable.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
do $patch$
declare v_oid regprocedure; v_def text;
begin
  v_oid:=to_regprocedure('platform_private.registry_discography_normalize_reviewed_selections_v1(uuid,jsonb,jsonb)');
  if v_oid is null or (select md5(prosrc) from pg_proc where oid=v_oid) is distinct from '418b50c72e368fab9a63c4b993d469c8' then
    raise exception 'SQL source authority drift: platform_private.registry_discography_normalize_reviewed_selections_v1(uuid,jsonb,jsonb)';
  end if;
  v_def:=pg_get_functiondef(v_oid);
  if (length(v_def)-length(replace(v_def,$old$  if jsonb_array_length(p_reviewed_selections)<>v_observed_count then
    raise exception using errcode='22023',
      message='Every observed Release requires one explicit Discography review decision.';
  end if;$old$,'')))/length($old$  if jsonb_array_length(p_reviewed_selections)<>v_observed_count then
    raise exception using errcode='22023',
      message='Every observed Release requires one explicit Discography review decision.';
  end if;$old$)<>1 then
    raise exception 'SQL patch anchor drift: platform_private.registry_discography_normalize_reviewed_selections_v1(uuid,jsonb,jsonb)';
  end if;
  v_def:=replace(v_def,$old$  if jsonb_array_length(p_reviewed_selections)<>v_observed_count then
    raise exception using errcode='22023',
      message='Every observed Release requires one explicit Discography review decision.';
  end if;$old$,$new$  if jsonb_array_length(p_reviewed_selections)=0
     or jsonb_array_length(p_reviewed_selections)>v_observed_count then
    raise exception using errcode='22023',
      message='At least one reviewed selection is required; every selection must be observed.';
  end if;$new$);
  if (length(v_def)-length(replace(v_def,$old$  if cardinality(v_seen_album_ids)<>v_observed_count then
    raise exception using errcode='22023',
      message='Every observed Release requires one explicit Discography review decision.';
  end if;

$old$,'')))/length($old$  if cardinality(v_seen_album_ids)<>v_observed_count then
    raise exception using errcode='22023',
      message='Every observed Release requires one explicit Discography review decision.';
  end if;

$old$)<>1 then
    raise exception 'SQL patch anchor drift: platform_private.registry_discography_normalize_reviewed_selections_v1(uuid,jsonb,jsonb)';
  end if;
  v_def:=replace(v_def,$old$  if cardinality(v_seen_album_ids)<>v_observed_count then
    raise exception using errcode='22023',
      message='Every observed Release requires one explicit Discography review decision.';
  end if;

$old$,$new$$new$);
  if (length(v_def)-length(replace(v_def,$old$       or v_action not in ('merge','canonicalize','ignore')$old$,'')))/length($old$       or v_action not in ('merge','canonicalize','ignore')$old$)<>1 then
    raise exception 'SQL patch anchor drift: platform_private.registry_discography_normalize_reviewed_selections_v1(uuid,jsonb,jsonb)';
  end if;
  v_def:=replace(v_def,$old$       or v_action not in ('merge','canonicalize','ignore')$old$,$new$       or v_action is null
       or v_action not in ('merge','canonicalize','ignore')$new$);
  execute v_def;

  v_oid:=to_regprocedure('platform_private.registry_discography_release_artist_desired_v1(uuid,uuid,jsonb,jsonb)');
  if v_oid is null or (select md5(prosrc) from pg_proc where oid=v_oid) is distinct from '355d03f8dc6f628e28737ddf790b6d7f' then
    raise exception 'SQL source authority drift: platform_private.registry_discography_release_artist_desired_v1(uuid,uuid,jsonb,jsonb)';
  end if;
  v_def:=pg_get_functiondef(v_oid);
  if (length(v_def)-length(replace(v_def,$old$  v_seen_slugs text[]:=array[]::text[];$old$,'')))/length($old$  v_seen_slugs text[]:=array[]::text[];$old$)<>1 then
    raise exception 'SQL patch anchor drift: platform_private.registry_discography_release_artist_desired_v1(uuid,uuid,jsonb,jsonb)';
  end if;
  v_def:=replace(v_def,$old$  v_seen_slugs text[]:=array[]::text[];$old$,$new$  v_seen_slugs text[]:=array[]::text[];
  v_reviewed_artist_rows jsonb;
  v_reviewed_credit jsonb;
  v_reviewed_credit_count integer;$new$);
  if (length(v_def)-length(replace(v_def,$old$  for v_related in
    select value$old$,'')))/length($old$  for v_related in
    select value$old$)<>1 then
    raise exception 'SQL patch anchor drift: platform_private.registry_discography_release_artist_desired_v1(uuid,uuid,jsonb,jsonb)';
  end if;
  v_def:=replace(v_def,$old$  for v_related in
    select value$old$,$new$  v_reviewed_artist_rows:=v_result;

  for v_related in
    select value$new$);
  if (length(v_def)-length(replace(v_def,$old$    v_slug:=v_credit->>'artist_slug';$old$,'')))/length($old$    v_slug:=v_credit->>'artist_slug';$old$)<>1 then
    raise exception 'SQL patch anchor drift: platform_private.registry_discography_release_artist_desired_v1(uuid,uuid,jsonb,jsonb)';
  end if;
  v_def:=replace(v_def,$old$    v_slug:=v_credit->>'artist_slug';$old$,$new$    -- Canonical assignments already explicitly reviewed for this Release
    -- take precedence over UNBOUND related Artist metadata for that credit only.
    -- Strong contradictory provider authority remains a real review conflict.
    if v_related_provider_id is not null then
      select count(*)::integer
      into v_reviewed_credit_count
      from jsonb_array_elements(v_reviewed_artist_rows) reviewed
      where platform_private.registry_identity_normalize_text_v1(reviewed->>'artist_name_text')=
            platform_private.registry_identity_normalize_text_v1(v_related_name);

      if v_reviewed_credit_count>1 then
        raise exception using errcode='PT409',
          message='Multiple reviewed Artists share this provider credit; review is required.';
      elsif v_reviewed_credit_count=1 then
        select reviewed into v_reviewed_credit
        from jsonb_array_elements(v_reviewed_artist_rows) reviewed
        where platform_private.registry_identity_normalize_text_v1(reviewed->>'artist_name_text')=
              platform_private.registry_identity_normalize_text_v1(v_related_name);
        if nullif(v_credit->>'artist_id','') is not null
           and v_credit->>'artist_id' is distinct from v_reviewed_credit->>'artist_id' then
          raise exception using errcode='PT409',
            message=format('Album %s: provider Artist %s is linked to a different Registry Artist than your reviewed credit; review is required.',p_album->>'apple_music_id',v_related_name);
        end if;
        -- No global provider assertion, Artist metadata link or alias is written.
        continue;
      end if;
    end if;

    v_slug:=v_credit->>'artist_slug';$new$);
  execute v_def;

  v_oid:=to_regprocedure('platform_private.registry_discography_resolve_artist_provider_credit_v1(text,text,text)');
  if v_oid is null or (select md5(prosrc) from pg_proc where oid=v_oid) is distinct from '6a56ae0100a5c3e2b536e4b30a910ee2' then
    raise exception 'SQL source authority drift: platform_private.registry_discography_resolve_artist_provider_credit_v1(text,text,text)';
  end if;
  v_def:=pg_get_functiondef(v_oid);
  if (length(v_def)-length(replace(v_def,$old$errcode='40001'$old$,'')))/length($old$errcode='40001'$old$)<>4 then
    raise exception 'SQL patch anchor drift: platform_private.registry_discography_resolve_artist_provider_credit_v1(text,text,text)';
  end if;
  v_def:=replace(v_def,$old$errcode='40001'$old$,$new$errcode='PT409'$new$);
  if (length(v_def)-length(replace(v_def,$old$Resolved strong Artist identity disappeared before credit freeze.$old$,'')))/length($old$Resolved strong Artist identity disappeared before credit freeze.$old$)<>1 then
    raise exception 'SQL patch anchor drift: platform_private.registry_discography_resolve_artist_provider_credit_v1(text,text,text)';
  end if;
  v_def:=replace(v_def,$old$Resolved strong Artist identity disappeared before credit freeze.$old$,$new$Resolved strong Artist identity disappeared before credit freeze; review is required.$new$);
  execute v_def;

  v_oid:=to_regprocedure('mizizi_private.registry_reviewed_admission_sentry_v1(uuid)');
  if v_oid is null or (select md5(prosrc) from pg_proc where oid=v_oid) is distinct from '85e6ab21c5e238b643ff2355c8e0383c' then
    raise exception 'SQL source authority drift: mizizi_private.registry_reviewed_admission_sentry_v1(uuid)';
  end if;
  v_def:=pg_get_functiondef(v_oid);
  if (length(v_def)-length(replace(v_def,$old$  if v_reviewed_count<>v_observed_count
     or (
       select count(distinct selection->>'apple_music_id')
       from jsonb_array_elements(v_review.reviewed_selections) selection
     )<>v_observed_count
  then
    v_blockers:=v_blockers||
      jsonb_build_array('review_decision_set_not_exhaustive');
  end if;$old$,'')))/length($old$  if v_reviewed_count<>v_observed_count
     or (
       select count(distinct selection->>'apple_music_id')
       from jsonb_array_elements(v_review.reviewed_selections) selection
     )<>v_observed_count
  then
    v_blockers:=v_blockers||
      jsonb_build_array('review_decision_set_not_exhaustive');
  end if;$old$)<>1 then
    raise exception 'SQL patch anchor drift: mizizi_private.registry_reviewed_admission_sentry_v1(uuid)';
  end if;
  v_def:=replace(v_def,$old$  if v_reviewed_count<>v_observed_count
     or (
       select count(distinct selection->>'apple_music_id')
       from jsonb_array_elements(v_review.reviewed_selections) selection
     )<>v_observed_count
  then
    v_blockers:=v_blockers||
      jsonb_build_array('review_decision_set_not_exhaustive');
  end if;$old$,$new$  if v_reviewed_count=0 or v_reviewed_count>v_observed_count
     or (
       select count(distinct selection->>'apple_music_id')
       from jsonb_array_elements(v_review.reviewed_selections) selection
     )<>v_reviewed_count
     or exists (
       select 1 from jsonb_array_elements(v_review.reviewed_selections) selection
       where coalesce(selection->>'action','') not in ('merge','canonicalize','ignore')
          or not exists (
            select 1 from jsonb_array_elements(v_snapshot.observation->'albums') album
            where album->>'apple_music_id'=selection->>'apple_music_id'
          )
     )
  then
    v_blockers:=v_blockers||
      jsonb_build_array('review_decision_set_not_observed_subset');
  end if;$new$);
  if (length(v_def)-length(replace(v_def,$old$  if exists (
    select 1
    from jsonb_array_elements(v_review.reviewed_selections) selection
    where selection->>'action'='ignore'
      and exists (
        select 1
        from jsonb_array_elements(v_review.frozen_plan->'operations') operation
        where operation->>'operation_key'=
              'registry.release.provider_profile.admit'
          and operation#>>'{payload,apple_music_album_id}'=
              selection->>'apple_music_id'
      )
  ) then
    v_blockers:=v_blockers||
      jsonb_build_array('left_release_escaped_into_canonical_plan');
  end if;$old$,'')))/length($old$  if exists (
    select 1
    from jsonb_array_elements(v_review.reviewed_selections) selection
    where selection->>'action'='ignore'
      and exists (
        select 1
        from jsonb_array_elements(v_review.frozen_plan->'operations') operation
        where operation->>'operation_key'=
              'registry.release.provider_profile.admit'
          and operation#>>'{payload,apple_music_album_id}'=
              selection->>'apple_music_id'
      )
  ) then
    v_blockers:=v_blockers||
      jsonb_build_array('left_release_escaped_into_canonical_plan');
  end if;$old$)<>1 then
    raise exception 'SQL patch anchor drift: mizizi_private.registry_reviewed_admission_sentry_v1(uuid)';
  end if;
  v_def:=replace(v_def,$old$  if exists (
    select 1
    from jsonb_array_elements(v_review.reviewed_selections) selection
    where selection->>'action'='ignore'
      and exists (
        select 1
        from jsonb_array_elements(v_review.frozen_plan->'operations') operation
        where operation->>'operation_key'=
              'registry.release.provider_profile.admit'
          and operation#>>'{payload,apple_music_album_id}'=
              selection->>'apple_music_id'
      )
  ) then
    v_blockers:=v_blockers||
      jsonb_build_array('left_release_escaped_into_canonical_plan');
  end if;$old$,$new$  if exists (
    select 1
    from jsonb_array_elements(v_review.frozen_plan->'operations') operation
    where operation->>'operation_key'='registry.release.provider_profile.admit'
      and not exists (
        select 1 from jsonb_array_elements(v_review.reviewed_selections) selection
        where selection->>'action' in ('merge','canonicalize')
          and selection->>'apple_music_id'=operation#>>'{payload,apple_music_album_id}'
      )
  ) or exists (
    select 1 from jsonb_array_elements(v_review.reviewed_selections) selection
    where selection->>'action' in ('merge','canonicalize')
      and (
        select count(*) from jsonb_array_elements(v_review.frozen_plan->'operations') operation
        where operation->>'operation_key'='registry.release.provider_profile.admit'
          and operation#>>'{payload,apple_music_album_id}'=selection->>'apple_music_id'
      )<>1
  ) then
    v_blockers:=v_blockers||
      jsonb_build_array('release_operations_not_exact_selected_set');
  end if;$new$);
  execute v_def;

end
$patch$;
commit;
