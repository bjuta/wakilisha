-- Phase 5B M221
-- Shared Community interaction authority.
--
-- Goals:
-- 1. Restore authenticated vote and reaction hydration.
-- 2. Make private interaction reads self-only.
-- 3. Harden vote, reaction, and follow commands.
-- 4. Add idempotent state-setting commands for Follow and Save.
-- 5. Repair derived vote counters from authoritative vote rows.
-- 6. Keep anonymous and PUBLIC execution closed.

create or replace function public.community_get_user_votes_for_comments(
  p_user_id uuid,
  p_comment_ids uuid[]
)
returns table(
  comment_id uuid,
  vote_value integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if p_user_id is distinct from v_user_id then
    raise exception
      'Cannot read another user''s vote state'
      using errcode = '42501';
  end if;

  return query
  select
    vote.comment_id,
    vote.vote_value
  from public.community_votes vote
  where vote.user_id = v_user_id
    and vote.comment_id = any(
      coalesce(
        p_comment_ids,
        array[]::uuid[]
      )
    );
end;
$$;


create or replace function public.community_get_user_reactions_for_comments(
  p_user_id uuid,
  p_target_ids uuid[]
)
returns table(
  target_id uuid,
  reaction_type text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if p_user_id is distinct from v_user_id then
    raise exception
      'Cannot read another user''s reaction state'
      using errcode = '42501';
  end if;

  return query
  select
    reaction.target_id,
    reaction.reaction_type
  from public.community_reactions reaction
  where reaction.user_id = v_user_id
    and reaction.target_type = 'comment'
    and reaction.target_id = any(
      coalesce(
        p_target_ids,
        array[]::uuid[]
      )
    );
end;
$$;


create or replace function public.community_vote_comment(
  p_comment_id uuid,
  p_vote_value integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing integer;
  v_current integer;
  v_upvote_count integer;
  v_downvote_count integer;
  v_score integer;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if p_vote_value not in (-1, 1) then
    raise exception
      'Invalid vote value'
      using errcode = '22023';
  end if;

  perform 1
  from public.community_comments comment
  where comment.id = p_comment_id
  for update;

  if not found then
    raise exception
      'Comment not found'
      using errcode = '22023';
  end if;

  select vote.vote_value
  into v_existing
  from public.community_votes vote
  where vote.user_id = v_user_id
    and vote.comment_id = p_comment_id;

  if v_existing is null then
    insert into public.community_votes (
      user_id,
      comment_id,
      vote_value
    )
    values (
      v_user_id,
      p_comment_id,
      p_vote_value
    );

    v_current := p_vote_value;

  elsif v_existing = p_vote_value then
    delete from public.community_votes
    where user_id = v_user_id
      and comment_id = p_comment_id;

    v_current := 0;

  else
    update public.community_votes
    set
      vote_value = p_vote_value,
      updated_at = now()
    where user_id = v_user_id
      and comment_id = p_comment_id;

    v_current := p_vote_value;
  end if;

  select
    count(*) filter (
      where vote.vote_value = 1
    )::integer,
    count(*) filter (
      where vote.vote_value = -1
    )::integer,
    coalesce(
      sum(vote.vote_value),
      0
    )::integer
  into
    v_upvote_count,
    v_downvote_count,
    v_score
  from public.community_votes vote
  where vote.comment_id = p_comment_id;

  update public.community_comments
  set
    upvote_count = v_upvote_count,
    downvote_count = v_downvote_count,
    score = v_score
  where id = p_comment_id;

  return jsonb_build_object(
    'vote_value',
      v_current,
    'existing',
      v_existing,
    'delta',
      v_current - coalesce(
        v_existing,
        0
      ),
    'upvote_count',
      v_upvote_count,
    'downvote_count',
      v_downvote_count,
    'score',
      v_score
  );
end;
$$;


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

  if v_reaction_type not in (
    'signal',
    'memory',
    'context',
    'fire',
    'agree'
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
    where comment.id = p_target_id
    for update;

    if not found then
      raise exception
        'Comment not found'
        using errcode = '22023';
    end if;
  end if;

  delete from public.community_reactions
  where user_id = v_user_id
    and target_type = v_target_type
    and target_id = p_target_id
    and reaction_type = v_reaction_type
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
    where reaction.target_type = 'comment'
      and reaction.target_id = p_target_id;

    update public.community_comments
    set reaction_count = v_reaction_count
    where id = p_target_id;
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


create or replace function public.community_set_follow_state(
  p_target_type text,
  p_target_id text,
  p_target_slug text,
  p_followed boolean
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
  v_target_id text :=
    nullif(
      trim(
        coalesce(
          p_target_id,
          ''
        )
      ),
      ''
    );
  v_target_slug text :=
    nullif(
      trim(
        coalesce(
          p_target_slug,
          ''
        )
      ),
      ''
    );
  v_followed boolean :=
    coalesce(
      p_followed,
      false
    );
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if v_target_type is null
     or v_target_id is null
  then
    raise exception
      'Follow target is required'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
      || '|follow|'
      || v_target_type
      || '|'
      || v_target_id,
      0
    )
  );

  if v_followed then
    insert into public.community_follows (
      user_id,
      target_type,
      target_id,
      target_slug
    )
    values (
      v_user_id,
      v_target_type,
      v_target_id,
      v_target_slug
    )
    on conflict (
      user_id,
      target_type,
      target_id
    )
    do update
    set target_slug =
      excluded.target_slug;
  else
    delete from public.community_follows
    where user_id = v_user_id
      and target_type = v_target_type
      and target_id = v_target_id;
  end if;

  return jsonb_build_object(
    'followed',
      v_followed
  );
end;
$$;


create or replace function public.community_follow_target(
  p_target_type text,
  p_target_id text,
  p_target_slug text default null
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
  v_target_id text :=
    nullif(
      trim(
        coalesce(
          p_target_id,
          ''
        )
      ),
      ''
    );
  v_current boolean;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if v_target_type is null
     or v_target_id is null
  then
    raise exception
      'Follow target is required'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
      || '|follow|'
      || v_target_type
      || '|'
      || v_target_id,
      0
    )
  );

  select exists (
    select 1
    from public.community_follows follow
    where follow.user_id = v_user_id
      and follow.target_type = v_target_type
      and follow.target_id = v_target_id
  )
  into v_current;

  return public.community_set_follow_state(
    v_target_type,
    v_target_id,
    p_target_slug,
    not v_current
  );
end;
$$;


create or replace function public.community_get_user_follows(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if p_user_id is distinct from v_user_id then
    raise exception
      'Cannot read another user''s follows'
      using errcode = '42501';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id',
        follow.id,
      'user_id',
        follow.user_id,
      'target_type',
        follow.target_type,
      'target_id',
        follow.target_id,
      'target_slug',
        follow.target_slug,
      'created_at',
        follow.created_at
    )
    order by follow.created_at desc
  )
  into v_result
  from public.community_follows follow
  where follow.user_id = v_user_id;

  return coalesce(
    v_result,
    '[]'::jsonb
  );
end;
$$;


create or replace function public.community_get_user_saves(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if p_user_id is distinct from v_user_id then
    raise exception
      'Cannot read another user''s saves'
      using errcode = '42501';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id',
        saved.id,
      'user_id',
        saved.user_id,
      'entity_type',
        saved.entity_type,
      'entity_id',
        saved.entity_id,
      'entity_slug',
        saved.entity_slug,
      'entity_url',
        saved.entity_url,
      'title',
        saved.title,
      'subtitle',
        saved.subtitle,
      'image_url',
        saved.image_url,
      'created_at',
        saved.created_at
    )
    order by saved.created_at desc
  )
  into v_result
  from public.community_saves saved
  where saved.user_id = v_user_id;

  return coalesce(
    v_result,
    '[]'::jsonb
  );
end;
$$;


create or replace function public.community_set_saved_state(
  p_entity_type text,
  p_entity_id text,
  p_entity_slug text,
  p_entity_url text,
  p_title text,
  p_subtitle text,
  p_image_url text,
  p_saved boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_entity_type text :=
    nullif(
      trim(
        coalesce(
          p_entity_type,
          ''
        )
      ),
      ''
    );
  v_entity_id text :=
    nullif(
      trim(
        coalesce(
          p_entity_id,
          ''
        )
      ),
      ''
    );
  v_entity_slug text :=
    nullif(
      trim(
        coalesce(
          p_entity_slug,
          ''
        )
      ),
      ''
    );
  v_entity_url text :=
    nullif(
      trim(
        coalesce(
          p_entity_url,
          ''
        )
      ),
      ''
    );
  v_title text :=
    nullif(
      trim(
        coalesce(
          p_title,
          ''
        )
      ),
      ''
    );
  v_subtitle text :=
    nullif(
      trim(
        coalesce(
          p_subtitle,
          ''
        )
      ),
      ''
    );
  v_image_url text :=
    nullif(
      trim(
        coalesce(
          p_image_url,
          ''
        )
      ),
      ''
    );
  v_saved boolean :=
    coalesce(
      p_saved,
      false
    );
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if v_entity_type is null
     or v_entity_id is null
  then
    raise exception
      'Stable entity identity is required'
      using errcode = '22023';
  end if;

  if v_saved
     and v_title is null
  then
    raise exception
      'Title is required when saving'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
      || '|save|'
      || v_entity_type
      || '|'
      || v_entity_id,
      0
    )
  );

  if v_saved then
    insert into public.community_saves (
      user_id,
      entity_type,
      entity_id,
      entity_slug,
      entity_url,
      title,
      subtitle,
      image_url
    )
    values (
      v_user_id,
      v_entity_type,
      v_entity_id,
      v_entity_slug,
      v_entity_url,
      v_title,
      v_subtitle,
      v_image_url
    )
    on conflict (
      user_id,
      entity_type,
      entity_id
    )
    do update
    set
      entity_slug =
        excluded.entity_slug,
      entity_url =
        excluded.entity_url,
      title =
        excluded.title,
      subtitle =
        excluded.subtitle,
      image_url =
        excluded.image_url;
  else
    delete from public.community_saves
    where user_id = v_user_id
      and entity_type = v_entity_type
      and entity_id = v_entity_id;
  end if;

  return jsonb_build_object(
    'saved',
      v_saved
  );
end;
$$;


create or replace function public.community_report_comment(
  p_comment_id uuid,
  p_reason text,
  p_details text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();

  v_reason text :=
    nullif(
      trim(
        coalesce(
          p_reason,
          ''
        )
      ),
      ''
    );

  v_details text :=
    trim(
      coalesce(
        p_details,
        ''
      )
    );

  v_report jsonb;
  v_report_count integer;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if p_comment_id is null then
    raise exception
      'Comment is required'
      using errcode = '22023';
  end if;

  if v_reason not in (
    'spam',
    'harassment',
    'hate_or_abuse',
    'misinformation',
    'privacy',
    'copyright',
    'off_topic',
    'other'
  )
  then
    raise exception
      'Unsupported report reason'
      using errcode = '22023';
  end if;

  perform 1
  from public.community_comments comment
  where comment.id = p_comment_id
  for update;

  if not found then
    raise exception
      'Comment not found'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
      || '|report|'
      || p_comment_id::text
      || '|'
      || v_reason
      || '|'
      || v_details,
      0
    )
  );

  select to_jsonb(
    report.*
  )
  into v_report
  from public.community_reports report
  where report.reporter_id =
          v_user_id
    and report.comment_id =
          p_comment_id
    and report.reason =
          v_reason
    and coalesce(
          report.details,
          ''
        ) =
          v_details
    and report.status =
          'pending'
  order by report.created_at desc
  limit 1;

  if v_report is not null then
    select count(*)::integer
    into v_report_count
    from public.community_reports report
    where report.comment_id =
      p_comment_id;

    return jsonb_build_object(
      'report',
        v_report,
      'report_count',
        v_report_count,
      'created',
        false
    );
  end if;

  insert into public.community_reports (
    reporter_id,
    comment_id,
    reason,
    details
  )
  values (
    v_user_id,
    p_comment_id,
    v_reason,
    v_details
  )
  returning to_jsonb(
    community_reports.*
  )
  into v_report;

  select count(*)::integer
  into v_report_count
  from public.community_reports report
  where report.comment_id =
    p_comment_id;

  update public.community_comments
  set report_count =
    v_report_count
  where id =
    p_comment_id;

  return jsonb_build_object(
    'report',
      v_report,
    'report_count',
      v_report_count,
    'created',
      true
  );
end;
$$;


create or replace function public.community_create_contribution(
  p_source_comment_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_entity_slug text,
  p_contribution_type text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();

  v_entity_type text :=
    nullif(
      trim(
        coalesce(
          p_entity_type,
          ''
        )
      ),
      ''
    );

  v_entity_id text :=
    nullif(
      trim(
        coalesce(
          p_entity_id,
          ''
        )
      ),
      ''
    );

  v_entity_slug text :=
    nullif(
      trim(
        coalesce(
          p_entity_slug,
          ''
        )
      ),
      ''
    );

  v_contribution_type text :=
    nullif(
      trim(
        coalesce(
          p_contribution_type,
          ''
        )
      ),
      ''
    );

  v_payload jsonb :=
    coalesce(
      p_payload,
      '{}'::jsonb
    );

  v_contribution jsonb;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if v_entity_type is null then
    raise exception
      'Entity type is required'
      using errcode = '22023';
  end if;

  if v_entity_id is null
     and v_entity_slug is null
  then
    raise exception
      'Entity identity is required'
      using errcode = '22023';
  end if;

  if v_contribution_type is null then
    raise exception
      'Contribution type is required'
      using errcode = '22023';
  end if;

  if p_source_comment_id is not null
     and not exists (
       select 1
       from public.community_comments comment
       where comment.id =
         p_source_comment_id
     )
  then
    raise exception
      'Source comment not found'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
      || '|contribution|'
      || coalesce(
        p_source_comment_id::text,
        ''
      )
      || '|'
      || v_entity_type
      || '|'
      || coalesce(
        v_entity_id,
        ''
      )
      || '|'
      || coalesce(
        v_entity_slug,
        ''
      )
      || '|'
      || v_contribution_type
      || '|'
      || v_payload::text,
      0
    )
  );

  select to_jsonb(
    contribution.*
  )
  into v_contribution
  from public.community_contributions contribution
  where contribution.user_id =
          v_user_id
    and contribution.source_comment_id
          is not distinct from
          p_source_comment_id
    and contribution.entity_type =
          v_entity_type
    and contribution.entity_id
          is not distinct from
          v_entity_id
    and contribution.entity_slug
          is not distinct from
          v_entity_slug
    and contribution.contribution_type =
          v_contribution_type
    and contribution.payload =
          v_payload
    and contribution.status =
          'pending'
  order by contribution.created_at desc
  limit 1;

  if v_contribution is not null then
    return jsonb_build_object(
      'contribution',
        v_contribution,
      'created',
        false
    );
  end if;

  insert into public.community_contributions (
    user_id,
    source_comment_id,
    entity_type,
    entity_id,
    entity_slug,
    contribution_type,
    payload
  )
  values (
    v_user_id,
    p_source_comment_id,
    v_entity_type,
    v_entity_id,
    v_entity_slug,
    v_contribution_type,
    v_payload
  )
  returning to_jsonb(
    community_contributions.*
  )
  into v_contribution;

  return jsonb_build_object(
    'contribution',
      v_contribution,
    'created',
      true
  );
end;
$$;


-- Repair derived vote counters from the authoritative vote rows.
with vote_counts as (
  select
    comment.id,
    count(vote.*) filter (
      where vote.vote_value = 1
    )::integer as upvote_count,
    count(vote.*) filter (
      where vote.vote_value = -1
    )::integer as downvote_count,
    coalesce(
      sum(vote.vote_value),
      0
    )::integer as score
  from public.community_comments comment
  left join public.community_votes vote
    on vote.comment_id = comment.id
  group by comment.id
)
update public.community_comments comment
set
  upvote_count =
    counts.upvote_count,
  downvote_count =
    counts.downvote_count,
  score =
    counts.score
from vote_counts counts
where comment.id = counts.id
  and (
    comment.upvote_count is distinct from
      counts.upvote_count
    or comment.downvote_count is distinct from
      counts.downvote_count
    or comment.score is distinct from
      counts.score
  );


revoke all on function public.community_report_comment(
  uuid,
  text,
  text
) from public;

revoke all on function public.community_create_contribution(
  uuid,
  text,
  text,
  text,
  text,
  jsonb
) from public;


revoke all on function public.community_get_user_votes_for_comments(
  uuid,
  uuid[]
) from public;

revoke all on function public.community_get_user_reactions_for_comments(
  uuid,
  uuid[]
) from public;

revoke all on function public.community_vote_comment(
  uuid,
  integer
) from public;

revoke all on function public.community_react_to_target(
  text,
  uuid,
  text
) from public;

revoke all on function public.community_set_follow_state(
  text,
  text,
  text,
  boolean
) from public;

revoke all on function public.community_follow_target(
  text,
  text,
  text
) from public;

revoke all on function public.community_get_user_follows(
  uuid
) from public;

revoke all on function public.community_get_user_saves(
  uuid
) from public;

revoke all on function public.community_set_saved_state(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
) from public;


revoke execute on function public.community_report_comment(
  uuid,
  text,
  text
) from anon;

revoke execute on function public.community_create_contribution(
  uuid,
  text,
  text,
  text,
  text,
  jsonb
) from anon;


revoke execute on function public.community_get_user_votes_for_comments(
  uuid,
  uuid[]
) from anon;

revoke execute on function public.community_get_user_reactions_for_comments(
  uuid,
  uuid[]
) from anon;

revoke execute on function public.community_vote_comment(
  uuid,
  integer
) from anon;

revoke execute on function public.community_react_to_target(
  text,
  uuid,
  text
) from anon;

revoke execute on function public.community_set_follow_state(
  text,
  text,
  text,
  boolean
) from anon;

revoke execute on function public.community_follow_target(
  text,
  text,
  text
) from anon;

revoke execute on function public.community_get_user_follows(
  uuid
) from anon;

revoke execute on function public.community_get_user_saves(
  uuid
) from anon;

revoke execute on function public.community_set_saved_state(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
) from anon;


grant execute on function public.community_report_comment(
  uuid,
  text,
  text
) to authenticated, service_role;

grant execute on function public.community_create_contribution(
  uuid,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated, service_role;


grant execute on function public.community_get_user_votes_for_comments(
  uuid,
  uuid[]
) to authenticated, service_role;

grant execute on function public.community_get_user_reactions_for_comments(
  uuid,
  uuid[]
) to authenticated, service_role;

grant execute on function public.community_vote_comment(
  uuid,
  integer
) to authenticated, service_role;

grant execute on function public.community_react_to_target(
  text,
  uuid,
  text
) to authenticated, service_role;

grant execute on function public.community_set_follow_state(
  text,
  text,
  text,
  boolean
) to authenticated, service_role;

grant execute on function public.community_follow_target(
  text,
  text,
  text
) to authenticated, service_role;

grant execute on function public.community_get_user_follows(
  uuid
) to authenticated, service_role;

grant execute on function public.community_get_user_saves(
  uuid
) to authenticated, service_role;

grant execute on function public.community_set_saved_state(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
) to authenticated, service_role;
