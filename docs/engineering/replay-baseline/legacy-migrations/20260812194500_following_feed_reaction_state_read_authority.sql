begin;

create or replace function public.community_get_reaction_state_for_public_targets(
  p_targets jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_targets jsonb :=
    coalesce(
      p_targets,
      '[]'::jsonb
    );

  v_target_count integer;
  v_target jsonb;
  v_target_type text;
  v_target_id_text text;
  v_target_id uuid;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if jsonb_typeof(
       v_targets
     ) <> 'array'
  then
    raise exception
      'Reaction targets must be a JSON array'
      using errcode = '22023';
  end if;

  v_target_count :=
    jsonb_array_length(
      v_targets
    );

  if v_target_count > 100 then
    raise exception
      'Too many reaction targets'
      using errcode = '22023';
  end if;

  for v_target in
    select value
    from jsonb_array_elements(
      v_targets
    )
  loop
    if jsonb_typeof(
         v_target
       ) <> 'object'
    then
      raise exception
        'Each reaction target must be an object'
        using errcode = '22023';
    end if;

    v_target_type :=
      lower(
        btrim(
          coalesce(
            v_target ->> 'target_type',
            ''
          )
        )
      );

    v_target_id_text :=
      btrim(
        coalesce(
          v_target ->> 'target_id',
          ''
        )
      );

    if v_target_type not in (
      'article',
      'playlist',
      'release'
    ) then
      raise exception
        'Unsupported public reaction target type'
        using errcode = '22023';
    end if;

    if v_target_id_text = '' then
      raise exception
        'Reaction target id is required'
        using errcode = '22023';
    end if;

    begin
      v_target_id :=
        v_target_id_text::uuid;
    exception
      when invalid_text_representation then
        raise exception
          'Reaction target id must be a UUID'
          using errcode = '22023';
    end;

    if v_target_type = 'article' then
      perform 1
      from editorial.resources resource
      where resource.id =
          v_target_id
        and resource.resource_kind =
          'article'
        and resource.visibility =
          'public'
        and resource.lifecycle_state =
          'published'
        and resource.current_published_version_id
          is not null;

    elsif v_target_type = 'playlist' then
      perform 1
      from editorial.resources resource
      join editorial.playlist_resources playlist_resource
        on playlist_resource.resource_id =
          resource.id
      where resource.id =
          v_target_id
        and resource.resource_kind =
          'playlist'
        and resource.visibility =
          'public'
        and resource.lifecycle_state =
          'published'
        and playlist_resource.current_published_version_id
          is not null;

    elsif v_target_type = 'release' then
      perform 1
      from public.registry_releases release
      where release.id =
          v_target_id
        and release.status =
          'active'
        and release.release_date
          is not null
        and release.release_date <=
          current_date
        and nullif(
          btrim(
            coalesce(
              release.slug,
              ''
            )
          ),
          ''
        ) is not null;
    end if;

    if not found then
      raise exception
        'Reaction target is not currently public'
        using errcode = '22023';
    end if;
  end loop;

  return (
    with requested_raw as (
      select
        lower(
          btrim(
            target.value ->>
              'target_type'
          )
        ) as target_type,
        (
          btrim(
            target.value ->>
              'target_id'
          )
        )::uuid as target_id,
        target.ordinality
      from jsonb_array_elements(
        v_targets
      ) with ordinality
        as target(
          value,
          ordinality
        )
    ),

    requested as (
      select
        requested_raw.target_type,
        requested_raw.target_id,
        min(
          requested_raw.ordinality
        ) as ordinality
      from requested_raw
      group by
        requested_raw.target_type,
        requested_raw.target_id
    ),

    reaction_rows as (
      select
        requested.target_type,
        requested.target_id,
        reaction.reaction_type,
        count(
          reaction.id
        )::integer
          as reaction_count,
        bool_or(
          reaction.user_id =
            v_user_id
        ) as viewer_reacted
      from requested
      join public.community_reactions reaction
        on reaction.target_type =
            requested.target_type
       and reaction.target_id =
            requested.target_id
      group by
        requested.target_type,
        requested.target_id,
        reaction.reaction_type
    ),

    target_state as (
      select
        requested.target_type,
        requested.target_id,
        requested.ordinality,
        coalesce(
          sum(
            reaction_rows.reaction_count
          ),
          0
        )::integer
          as reaction_count,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'reaction_type',
                reaction_rows.reaction_type,
              'count',
                reaction_rows.reaction_count,
              'viewer_reacted',
                reaction_rows.viewer_reacted
            )
            order by
              reaction_rows.reaction_count
                desc,
              reaction_rows.reaction_type
          ) filter (
            where reaction_rows.reaction_type
              is not null
          ),
          '[]'::jsonb
        ) as reactions
      from requested
      left join reaction_rows
        on reaction_rows.target_type =
            requested.target_type
       and reaction_rows.target_id =
            requested.target_id
      group by
        requested.target_type,
        requested.target_id,
        requested.ordinality
    )

    select
      jsonb_build_object(
        'targets',
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'target_type',
                target_state.target_type,
              'target_id',
                target_state.target_id,
              'reaction_count',
                target_state.reaction_count,
              'reactions',
                target_state.reactions
            )
            order by
              target_state.ordinality
          ),
          '[]'::jsonb
        )
      )
    from target_state
  );
end;
$function$;

revoke all
on function public.community_get_reaction_state_for_public_targets(
  jsonb
)
from public;

revoke execute
on function public.community_get_reaction_state_for_public_targets(
  jsonb
)
from anon;

grant execute
on function public.community_get_reaction_state_for_public_targets(
  jsonb
)
to authenticated;

grant execute
on function public.community_get_reaction_state_for_public_targets(
  jsonb
)
to service_role;

insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale,
  reviewed_at
)
values (
  'community_get_reaction_state_for_public_targets(jsonb)',
  'authenticated_read',
  'Self-only viewer reaction state plus identity-free aggregate counts for current public Article, Playlist, and Release targets. No reacting user identities are returned.',
  now()
)
on conflict (
  function_signature
)
do update
set
  access_class =
    excluded.access_class,
  rationale =
    excluded.rationale,
  reviewed_at =
    excluded.reviewed_at;

do $postflight$
declare
  v_oid oid;
  v_definition text;
  v_search_path text;
  v_access_class text;
begin
  v_oid :=
    to_regprocedure(
      'public.community_get_reaction_state_for_public_targets(jsonb)'
    );

  if v_oid is null then
    raise exception
      'STOP: M5 reaction-state RPC is missing.';
  end if;

  select
    pg_get_functiondef(
      v_oid
    ),
    coalesce(
      (
        select config
        from unnest(
          procedure.proconfig
        ) as config
        where config like
          'search_path=%'
        limit 1
      ),
      ''
    )
  into
    v_definition,
    v_search_path
  from pg_proc procedure
  where procedure.oid =
    v_oid
    and procedure.prosecdef
    and procedure.provolatile =
      's';

  if not found then
    raise exception
      'STOP: M5 reaction-state RPC must be stable SECURITY DEFINER.';
  end if;

  if v_search_path <>
    'search_path=pg_catalog, public, editorial'
  then
    raise exception
      'STOP: M5 reaction-state RPC search_path is not exact: %',
      v_search_path;
  end if;

  if position(
       'auth.uid()'
       in v_definition
     ) = 0
     or position(
       'editorial.resources'
       in v_definition
     ) = 0
     or position(
       'editorial.playlist_resources'
       in v_definition
     ) = 0
     or position(
       'public.registry_releases'
       in v_definition
     ) = 0
     or position(
       'public.community_reactions'
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: M5 reaction-state authority sources are incomplete.';
  end if;

  if position(
       'p_user_id'
       in v_definition
     ) > 0
  then
    raise exception
      'STOP: M5 reaction-state RPC must derive the viewer from auth.uid().';
  end if;

  if has_function_privilege(
       'anon',
       v_oid,
       'EXECUTE'
     )
  then
    raise exception
      'STOP: anon can execute M5 reaction-state RPC.';
  end if;

  if not has_function_privilege(
       'authenticated',
       v_oid,
       'EXECUTE'
     )
  then
    raise exception
      'STOP: authenticated cannot execute M5 reaction-state RPC.';
  end if;

  if has_table_privilege(
       'authenticated',
       'public.community_reactions',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'public.community_reactions',
       'SELECT'
     )
  then
    raise exception
      'STOP: Browser roles gained direct SELECT on community_reactions.';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.community_get_user_reactions(uuid,uuid[])',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Legacy service-role reaction reader became browser executable.';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.community_react_to_target(text,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Existing authenticated reaction writer is no longer executable.';
  end if;

  select classification.access_class
  into v_access_class
  from private.phase_0a_rpc_classification classification
  where classification.function_signature =
    'community_get_reaction_state_for_public_targets(jsonb)';

  if v_access_class is distinct from
    'authenticated_read'
  then
    raise exception
      'STOP: M5 reaction-state RPC classification is not authenticated_read.';
  end if;
end;
$postflight$;

commit;
