\set ON_ERROR_STOP on

do $$
declare
  v_signature text;
  v_oid oid;
  v_security_definer boolean;
  v_config text[];
  v_public_execute boolean;
begin
  foreach v_signature in array array[
    'public.community_report_comment(uuid,text,text)',
    'public.community_create_contribution(uuid,text,text,text,text,jsonb)',
    'public.community_get_user_votes_for_comments(uuid,uuid[])',
    'public.community_get_user_reactions_for_comments(uuid,uuid[])',
    'public.community_vote_comment(uuid,integer)',
    'public.community_react_to_target(text,uuid,text)',
    'public.community_set_follow_state(text,text,text,boolean)',
    'public.community_follow_target(text,text,text)',
    'public.community_get_user_follows(uuid)',
    'public.community_get_user_saves(uuid)',
    'public.community_set_saved_state(text,text,text,text,text,text,text,boolean)'
  ]
  loop
    v_oid :=
      v_signature::regprocedure::oid;

    select
      proc.prosecdef,
      proc.proconfig,
      exists (
        select 1
        from aclexplode(
          coalesce(
            proc.proacl,
            acldefault(
              'f',
              proc.proowner
            )
          )
        ) acl
        where acl.grantee = 0
          and acl.privilege_type = 'EXECUTE'
      )
    into
      v_security_definer,
      v_config,
      v_public_execute
    from pg_proc proc
    where proc.oid = v_oid;

    if v_security_definer is distinct from true
    then
      raise exception
        'Interaction RPC is not SECURITY DEFINER: %',
        v_signature;
    end if;

    if not (
      'search_path=pg_catalog, public' =
      any(
        coalesce(
          v_config,
          array[]::text[]
        )
      )
    )
    then
      raise exception
        'Interaction RPC has an unsafe search_path: %',
        v_signature;
    end if;

    if v_public_execute
    then
      raise exception
        'Interaction RPC still inherits PUBLIC execute: %',
        v_signature;
    end if;

    if has_function_privilege(
      'anon',
      v_signature,
      'EXECUTE'
    )
    then
      raise exception
        'Anonymous execution is still available: %',
        v_signature;
    end if;

    if not has_function_privilege(
      'authenticated',
      v_signature,
      'EXECUTE'
    )
    then
      raise exception
        'Authenticated execution is missing: %',
        v_signature;
    end if;
  end loop;
end;
$$;


do $$
declare
  v_signature text;
  v_definition text;
begin
  foreach v_signature in array array[
    'public.community_get_user_votes_for_comments(uuid,uuid[])',
    'public.community_get_user_reactions_for_comments(uuid,uuid[])',
    'public.community_get_user_follows(uuid)',
    'public.community_get_user_saves(uuid)'
  ]
  loop
    select lower(
      pg_get_functiondef(
        v_signature::regprocedure
      )
    )
    into v_definition;

    if position(
      'p_user_id is distinct from v_user_id'
      in v_definition
    ) = 0
    then
      raise exception
        'Private interaction read is not self-only: %',
        v_signature;
    end if;
  end loop;
end;
$$;


do $$
declare
  v_vote_drift bigint;
  v_reaction_drift bigint;
begin
  with vote_actual as (
    select
      comment.id,
      comment.upvote_count,
      comment.downvote_count,
      comment.score,
      count(vote.*) filter (
        where vote.vote_value = 1
      )::integer as actual_up,
      count(vote.*) filter (
        where vote.vote_value = -1
      )::integer as actual_down,
      coalesce(
        sum(vote.vote_value),
        0
      )::integer as actual_score
    from public.community_comments comment
    left join public.community_votes vote
      on vote.comment_id = comment.id
    group by comment.id
  )
  select count(*)
  into v_vote_drift
  from vote_actual
  where upvote_count is distinct from actual_up
     or downvote_count is distinct from actual_down
     or score is distinct from actual_score;

  with reaction_actual as (
    select
      comment.id,
      comment.reaction_count,
      count(reaction.*)::integer as actual_reactions
    from public.community_comments comment
    left join public.community_reactions reaction
      on reaction.target_type = 'comment'
     and reaction.target_id = comment.id
    group by comment.id
  )
  select count(*)
  into v_reaction_drift
  from reaction_actual
  where reaction_count is distinct from
        actual_reactions;

  if v_vote_drift <> 0
  then
    raise exception
      'Vote counter drift remains: % comments',
      v_vote_drift;
  end if;

  if v_reaction_drift <> 0
  then
    raise exception
      'Reaction counter drift remains: % comments',
      v_reaction_drift;
  end if;
end;
$$;


do $$
declare
  v_signature text;
  v_definition text;
begin
  foreach v_signature in array array[
    'public.community_report_comment(uuid,text,text)',
    'public.community_create_contribution(uuid,text,text,text,text,jsonb)'
  ]
  loop
    select regexp_replace(
      lower(
        pg_get_functiondef(
          v_signature::regprocedure
        )
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
    into v_definition;

    if position(
      'pg_advisory_xact_lock'
      in v_definition
    ) = 0
    then
      raise exception
        'Retry-sensitive interaction is not serialized: %',
        v_signature;
    end if;

    if position(
      'status = ''pending'''
      in v_definition
    ) = 0
    then
      raise exception
        'Retry-sensitive interaction does not reuse pending state: %',
        v_signature;
    end if;

    if position(
      '''created'', false'
      in v_definition
    ) = 0
    then
      raise exception
        'Retry-sensitive interaction does not expose reused state: %',
        v_signature;
    end if;
  end loop;
end;
$$;


select jsonb_build_object(
  'verification',
    'PASS',
  'authenticated_report',
    has_function_privilege(
      'authenticated',
      'public.community_report_comment(uuid,text,text)',
      'EXECUTE'
    ),
  'authenticated_contribution',
    has_function_privilege(
      'authenticated',
      'public.community_create_contribution(uuid,text,text,text,text,jsonb)',
      'EXECUTE'
    ),
  'authenticated_vote_read',
    has_function_privilege(
      'authenticated',
      'public.community_get_user_votes_for_comments(uuid,uuid[])',
      'EXECUTE'
    ),
  'authenticated_reaction_read',
    has_function_privilege(
      'authenticated',
      'public.community_get_user_reactions_for_comments(uuid,uuid[])',
      'EXECUTE'
    ),
  'authenticated_vote_write',
    has_function_privilege(
      'authenticated',
      'public.community_vote_comment(uuid,integer)',
      'EXECUTE'
    ),
  'authenticated_reaction_write',
    has_function_privilege(
      'authenticated',
      'public.community_react_to_target(text,uuid,text)',
      'EXECUTE'
    ),
  'authenticated_follow_state',
    has_function_privilege(
      'authenticated',
      'public.community_set_follow_state(text,text,text,boolean)',
      'EXECUTE'
    ),
  'authenticated_saved_state',
    has_function_privilege(
      'authenticated',
      'public.community_set_saved_state(text,text,text,text,text,text,text,boolean)',
      'EXECUTE'
    )
) as phase_5b_community_interaction_authority_acceptance;
