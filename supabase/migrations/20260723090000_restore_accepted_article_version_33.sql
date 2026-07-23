begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $restore$
declare
  v_article_id constant uuid :=
    '30027d46-113e-475b-818e-ce4383c5865a';

  v_resource_id constant uuid :=
    '221d781c-c3d9-4caf-acf5-6a5a2e712d44';

  v_accepted_version_id constant uuid :=
    'bd55c762-1409-4324-a40f-b774c4c89528';

  v_stale_working_version_id constant uuid :=
    '5266ec05-45dc-43a3-9fd8-e25306d38c6e';

  v_stale_submitted_version_id constant uuid :=
    '52687a72-bc9a-448c-8e58-31f35ab3243d';

  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_accepted editorial.article_versions%rowtype;
  v_actor_id uuid;
begin
  select article.*
  into v_article
  from public.wk_articles article
  where article.id = v_article_id
  for update;

  if not found then
    raise exception 'Restore stopped: Article not found';
  end if;

  select resource.*
  into v_resource
  from editorial.resources resource
  where resource.id = v_resource_id
  for update;

  if not found then
    raise exception 'Restore stopped: resource not found';
  end if;

  select version.*
  into v_accepted
  from editorial.article_versions version
  where version.id = v_accepted_version_id;

  if not found then
    raise exception 'Restore stopped: accepted version 33 not found';
  end if;

  select suggestion.decided_by
  into v_actor_id
  from editorial.article_suggestions suggestion
  where suggestion.applied_version_id =
    v_accepted_version_id
    and suggestion.status = 'accepted'
  order by suggestion.decided_at desc
  limit 1;

  if v_article.wp_status <> 'draft'
     or v_article.draft_version <> 32
  then
    raise exception
      'Restore stopped: Article state changed';
  end if;

  if v_resource.current_working_version_id
       is distinct from v_stale_working_version_id
     or v_resource.current_submitted_version_id
       is distinct from v_stale_submitted_version_id
  then
    raise exception
      'Restore stopped: version pointers changed';
  end if;

  if v_accepted.version_number <> 33
     or v_accepted.version_kind <> 'review_applied'
     or v_accepted.wp_status <> 'draft'
     or v_accepted.article_id <> v_article_id
     or v_accepted.resource_id <> v_resource_id
  then
    raise exception
      'Restore stopped: version 33 is not authoritative';
  end if;

  if strpos(
    v_accepted.content_html,
    'No simulated cassette noise.'
  ) = 0 then
    raise exception
      'Restore stopped: accepted wording is missing';
  end if;

  if strpos(
    v_accepted.content_html,
    'No fake cassette noise.'
  ) > 0 then
    raise exception
      'Restore stopped: version 33 contains stale wording';
  end if;

  if strpos(
    v_article.content_html,
    'No fake cassette noise.'
  ) = 0 then
    raise exception
      'Restore stopped: current Article no longer matches stale state';
  end if;

  update public.wk_articles
  set
    content_html = v_accepted.content_html,
    wp_status = 'draft',
    draft_version = draft_version + 1,
    modified_at = now(),
    updated_at = now()
  where id = v_article_id;

  update editorial.resources
  set
    current_working_version_id =
      v_accepted_version_id,
    current_submitted_version_id =
      null,
    lifecycle_state = 'draft',
    visibility = 'private',
    updated_at = now()
  where id = v_resource_id;

  insert into editorial.article_lifecycle_events (
    resource_id,
    article_id,
    version_id,
    action,
    prior_status,
    resulting_status,
    note,
    metadata,
    actor_id
  )
  values (
    v_resource_id,
    v_article_id,
    v_accepted_version_id,
    'restored',
    'draft',
    'draft',
    'Restored accepted review-applied version 33 after editor hydration verification.',
    jsonb_build_object(
      'repair_kind',
      'restore_existing_review_applied_version',
      'accepted_version_id',
      v_accepted_version_id,
      'replaced_working_version_id',
      v_stale_working_version_id,
      'cleared_submitted_version_id',
      v_stale_submitted_version_id
    ),
    v_actor_id
  );

  if not exists (
    select 1
    from public.wk_articles article
    where article.id = v_article_id
      and article.wp_status = 'draft'
      and article.draft_version = 33
      and strpos(
        article.content_html,
        'No simulated cassette noise.'
      ) > 0
      and strpos(
        article.content_html,
        'No fake cassette noise.'
      ) = 0
  ) then
    raise exception
      'Restore stopped: Article assertion failed';
  end if;

  if not exists (
    select 1
    from editorial.resources resource
    where resource.id = v_resource_id
      and resource.current_working_version_id =
        v_accepted_version_id
      and resource.current_submitted_version_id
        is null
      and resource.lifecycle_state = 'draft'
  ) then
    raise exception
      'Restore stopped: resource assertion failed';
  end if;

  raise notice
    'Restored accepted review-applied version 33 as the working draft';
end;
$restore$;

commit;
