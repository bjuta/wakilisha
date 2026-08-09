create or replace function public.community_react_to_target(
  p_target_type text,
  p_target_id uuid,
  p_reaction_type text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();

  v_target_type text :=
    nullif(
      trim(
        coalesce(
          p_target_type,
          ''
        )
      ),
      ''
    );

  v_reaction_type text :=
    nullif(
      trim(
        coalesce(
          p_reaction_type,
          ''
        )
      ),
      ''
    );

  v_existing uuid;
  v_created boolean;
  v_reaction_count integer;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if v_target_type is null
     or p_target_id is null
  then
    raise exception
      'Reaction target is required'
      using errcode = '22023';
  end if;

  if v_reaction_type is null
     or char_length(
          v_reaction_type
        ) > 32
     or v_reaction_type
          ~ '[[:cntrl:]]'
     or v_reaction_type
          ~ '[[:space:]]'
     or (
       octet_length(
         v_reaction_type
       ) =
       char_length(
         v_reaction_type
       )
       and v_reaction_type
         not in (
           'signal',
           'memory',
           'context',
           'fire',
           'agree'
         )
     )
  then
    raise exception
      'Unsupported reaction type'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
      || '|'
      || v_target_type
      || '|'
      || p_target_id::text
      || '|'
      || v_reaction_type,
      0
    )
  );

  if v_target_type = 'comment' then
    perform 1
    from public.community_comments comment
    where comment.id =
      p_target_id
    for update;

    if not found then
      raise exception
        'Comment not found'
        using errcode = '22023';
    end if;
  end if;

  delete from public.community_reactions
  where user_id =
      v_user_id
    and target_type =
      v_target_type
    and target_id =
      p_target_id
    and reaction_type =
      v_reaction_type
  returning id
  into v_existing;

  if found then
    v_created := false;
  else
    insert into public.community_reactions (
      user_id,
      target_type,
      target_id,
      reaction_type
    )
    values (
      v_user_id,
      v_target_type,
      p_target_id,
      v_reaction_type
    );

    v_created := true;
  end if;

  if v_target_type = 'comment' then
    select count(*)::integer
    into v_reaction_count
    from public.community_reactions reaction
    where reaction.target_type =
        'comment'
      and reaction.target_id =
        p_target_id;

    update public.community_comments
    set reaction_count =
      v_reaction_count
    where id =
      p_target_id;
  else
    v_reaction_count := null;
  end if;

  return jsonb_build_object(
    'created',
      v_created,
    'reaction_type',
      v_reaction_type,
    'reaction_count',
      v_reaction_count
  );
end;
$$;

revoke all
on function public.community_react_to_target(
  text,
  uuid,
  text
)
from public;

revoke all
on function public.community_react_to_target(
  text,
  uuid,
  text
)
from anon;

grant execute
on function public.community_react_to_target(
  text,
  uuid,
  text
)
to authenticated, service_role;
