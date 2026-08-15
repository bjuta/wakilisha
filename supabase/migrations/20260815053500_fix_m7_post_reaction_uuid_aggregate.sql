-- WAKILISHA M7 corrective migration:
-- Fix Post reaction-state aggregation for UUID primary keys.
--
-- M7 used an unnecessary aggregate over row.id only as a deterministic field.
-- community_reactions.id is uuid, and PostgreSQL has no min(uuid) aggregate.
-- Remove that unused expression and preserve all reaction semantics.

begin;

do $m7_reaction_fix_preflight$
begin
  if to_regprocedure(
    'public.community_get_reaction_state_for_public_targets(jsonb)'
  ) is null then
    raise exception
      'M7 reaction-state RPC is missing before corrective migration';
  end if;

  if to_regclass('public.community_reactions') is null then
    raise exception
      'community_reactions is missing before corrective migration';
  end if;

  if not exists (
    select 1
    from pg_attribute
    where attrelid='public.community_reactions'::regclass
      and attname='id'
      and atttypid='uuid'::regtype
      and attnum>0
      and not attisdropped
  ) then
    raise exception
      'community_reactions.id is not uuid as expected';
  end if;
end;
$m7_reaction_fix_preflight$;

create or replace function public.community_get_reaction_state_for_public_targets(
  p_targets jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private'
as $function$
declare
  v_user uuid:=auth.uid();
  v_targets jsonb:=coalesce(p_targets,'[]'::jsonb);
  v_legacy jsonb;
  v_posts jsonb;
  v_post_target jsonb;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode='42501';
  end if;

  if jsonb_typeof(v_targets)<>'array' then
    raise exception
      'Reaction targets must be a JSON array'
      using errcode='22023';
  end if;

  if jsonb_array_length(v_targets)>100 then
    raise exception
      'Too many reaction targets'
      using errcode='22023';
  end if;

  v_legacy:=(
    select coalesce(jsonb_agg(value),'[]'::jsonb)
    from jsonb_array_elements(v_targets)
    where lower(
      btrim(coalesce(value->>'target_type',''))
    )<>'post'
  );

  v_posts:=(
    select coalesce(jsonb_agg(value),'[]'::jsonb)
    from jsonb_array_elements(v_targets)
    where lower(
      btrim(coalesce(value->>'target_type',''))
    )='post'
  );

  for v_post_target
    in select value from jsonb_array_elements(v_posts)
  loop
    begin
      v_id:=(v_post_target->>'target_id')::uuid;
    exception
      when invalid_text_representation then
        raise exception
          'Reaction target id must be a UUID'
          using errcode='22023';
    end;

    perform 1
    from public.community_posts post
    where post.id=v_id
      and post.actor_type='person'
      and public.community_get_post(post.id) is not null;

    if not found then
      raise exception
        'Reaction target is not currently public'
        using errcode='22023';
    end if;
  end loop;

  v_legacy:=
    private.community_get_reaction_state_for_public_targets_legacy_m7(
      v_legacy
    );

  return jsonb_build_object(
    'targets',
    coalesce(v_legacy->'targets','[]'::jsonb)
    ||
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'target_type','post',
            'target_id',requested.target_id,
            'reaction_count',
              coalesce(summary.reaction_count,0),
            'reactions',
              coalesce(summary.reactions,'[]'::jsonb)
          )
          order by requested.ordinality
        )
        from (
          select
            (value->>'target_id')::uuid as target_id,
            ordinality
          from jsonb_array_elements(v_posts)
          with ordinality
        ) requested
        left join lateral (
          select
            coalesce(
              sum(reaction.count_for_type),
              0
            )::integer as reaction_count,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'reaction_type',
                    reaction.reaction_type,
                  'count',
                    reaction.count_for_type,
                  'viewer_reacted',
                    reaction.viewer_reacted
                )
                order by
                  reaction.count_for_type desc,
                  reaction.reaction_type
              ),
              '[]'::jsonb
            ) as reactions
          from (
            select
              row.reaction_type,
              count(*)::integer as count_for_type,
              bool_or(
                row.user_id=v_user
              ) as viewer_reacted
            from public.community_reactions row
            where row.target_type='post'
              and row.target_id=requested.target_id
            group by row.reaction_type
          ) reaction
        ) summary on true
      ),
      '[]'::jsonb
    )
  );
end;
$function$;

revoke all
on function public.community_get_reaction_state_for_public_targets(jsonb)
from public,anon;

grant execute
on function public.community_get_reaction_state_for_public_targets(jsonb)
to authenticated,service_role;

commit;
