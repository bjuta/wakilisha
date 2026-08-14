begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $repair$
declare
  v_article_id constant uuid :=
    '30027d46-113e-475b-818e-ce4383c5865a';

  v_resource_id constant uuid :=
    '221d781c-c3d9-4caf-acf5-6a5a2e712d44';

  v_accepted_version_id constant uuid :=
    'a90abef1-749d-4726-a682-f8dc819f6055';

  v_stale_working_version_id constant uuid :=
    '470b4aff-c662-472e-9767-020057b0b418';

  v_stale_submitted_version_id constant uuid :=
    '5ce57fab-062b-4b0b-b600-0bd6838e4aaa';

  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_accepted_version editorial.article_versions%rowtype;

  v_actor_id uuid;
  v_new_version_id uuid;
  v_new_version_number bigint;
  v_new_draft_version bigint;
begin
  select article.*
  into v_article
  from public.wk_articles article
  where article.id = v_article_id
  for update;

  if not found then
    raise exception
      'Recovery stopped: Article not found';
  end if;

  select resource.*
  into v_resource
  from editorial.resources resource
  where resource.id = v_resource_id
  for update;

  if not found then
    raise exception
      'Recovery stopped: Article resource not found';
  end if;

  select version.*
  into v_accepted_version
  from editorial.article_versions version
  where version.id = v_accepted_version_id;

  if not found then
    raise exception
      'Recovery stopped: accepted version 27 not found';
  end if;

  select suggestion.decided_by
  into v_actor_id
  from editorial.article_suggestions suggestion
  where suggestion.applied_version_id =
    v_accepted_version_id
    and suggestion.status = 'accepted'
  order by suggestion.decided_at desc
  limit 1;

  if v_actor_id is null then
    raise exception
      'Recovery stopped: accepted suggestion actor not found';
  end if;

  if v_article.slug <>
    'institute-inq-0001-how-has-american-culture-influenced-music-cultur'
  then
    raise exception
      'Recovery stopped: unexpected Article slug';
  end if;

  if v_article.wp_status <> 'pending' then
    raise exception
      'Recovery stopped: expected pending status, found %',
      v_article.wp_status;
  end if;

  if v_article.draft_version <> 25 then
    raise exception
      'Recovery stopped: expected draft version 25, found %',
      v_article.draft_version;
  end if;

  if v_resource.current_working_version_id
     is distinct from v_stale_working_version_id
  then
    raise exception
      'Recovery stopped: working-version pointer changed';
  end if;

  if v_resource.current_submitted_version_id
     is distinct from v_stale_submitted_version_id
  then
    raise exception
      'Recovery stopped: submitted-version pointer changed';
  end if;

  if v_accepted_version.article_id <> v_article_id
     or v_accepted_version.resource_id <> v_resource_id
     or v_accepted_version.version_number <> 27
     or v_accepted_version.version_kind <> 'review_applied'
     or v_accepted_version.wp_status <> 'draft'
  then
    raise exception
      'Recovery stopped: version 27 authority does not match';
  end if;

  if strpos(
    v_accepted_version.content_html,
    'Do not reduce it to a'
  ) = 0 then
    raise exception
      'Recovery stopped: accepted replacement is missing';
  end if;

  if strpos(
    v_accepted_version.content_html,
    'Do not turn it into a'
  ) > 0 then
    raise exception
      'Recovery stopped: accepted version still has original wording';
  end if;

  if strpos(
    v_article.content_html,
    'Do not turn it into a'
  ) = 0 then
    raise exception
      'Recovery stopped: stale Article wording no longer matches';
  end if;

  if v_article.title
       is distinct from v_accepted_version.title
     or v_article.slug
       is distinct from v_accepted_version.slug
     or v_article.excerpt
       is distinct from v_accepted_version.excerpt
     or v_article.author
       is distinct from v_accepted_version.author_display
     or v_article.hero_image_id
       is distinct from v_accepted_version.hero_image_id
     or v_article.hero_image_url
       is distinct from v_accepted_version.hero_image_url
     or v_article.seo
       is distinct from v_accepted_version.seo
     or v_article.published_at
       is distinct from v_accepted_version.published_at
     or v_article.categories
       is distinct from v_accepted_version.category_snapshot
     or v_article.tags
       is distinct from v_accepted_version.tag_snapshot
  then
    raise exception
      'Recovery stopped: fields other than content and lifecycle changed';
  end if;

  v_new_draft_version :=
    v_article.draft_version + 1;

  update public.wk_articles as article
  set
    content_html =
      v_accepted_version.content_html,
    wp_status = 'draft',
    draft_version =
      v_new_draft_version,
    modified_at = now(),
    updated_at = now()
  where article.id = v_article_id;

  v_new_version_number :=
    editorial.next_article_version_number(
      v_resource_id
    );

  insert into editorial.article_versions (
    resource_id,
    article_id,
    version_number,
    version_kind,
    source_draft_version,
    title,
    slug,
    excerpt,
    content_html,
    author_display,
    owner_id,
    hero_image_id,
    hero_image_url,
    seo,
    lifecycle_state,
    wp_status,
    published_at,
    category_snapshot,
    tag_snapshot,
    created_by,
    content_fingerprint
  )
  values (
    v_resource_id,
    v_article_id,
    v_new_version_number,
    'manual_save',
    v_new_draft_version,
    v_accepted_version.title,
    v_accepted_version.slug,
    v_accepted_version.excerpt,
    v_accepted_version.content_html,
    v_accepted_version.author_display,
    v_accepted_version.owner_id,
    v_accepted_version.hero_image_id,
    v_accepted_version.hero_image_url,
    v_accepted_version.seo,
    'draft',
    'draft',
    v_accepted_version.published_at,
    v_accepted_version.category_snapshot,
    v_accepted_version.tag_snapshot,
    v_actor_id,
    editorial.article_snapshot_fingerprint(
      v_accepted_version.title,
      v_accepted_version.slug,
      v_accepted_version.excerpt,
      v_accepted_version.content_html,
      v_accepted_version.author_display,
      v_accepted_version.hero_image_id,
      v_accepted_version.hero_image_url,
      v_accepted_version.seo,
      'draft',
      v_accepted_version.published_at,
      v_accepted_version.category_snapshot,
      v_accepted_version.tag_snapshot
    )
  )
  returning id
  into v_new_version_id;

  update editorial.resources
  set
    current_working_version_id =
      v_new_version_id,
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
    v_stale_submitted_version_id,
    'changes_requested',
    'pending',
    'draft',
    'Restored the accepted review-applied snapshot after a stale client resubmission.',
    jsonb_build_object(
      'repair_kind',
      'restore_review_applied_snapshot',
      'accepted_version_id',
      v_accepted_version_id,
      'replaced_working_version_id',
      v_stale_working_version_id,
      'closed_submitted_version_id',
      v_stale_submitted_version_id,
      'new_working_version_id',
      v_new_version_id
    ),
    v_actor_id
  );

  if not exists (
    select 1
    from public.wk_articles article
    where article.id = v_article_id
      and article.wp_status = 'draft'
      and article.draft_version =
        v_new_draft_version
      and strpos(
        article.content_html,
        'Do not reduce it to a'
      ) > 0
      and strpos(
        article.content_html,
        'Do not turn it into a'
      ) = 0
  ) then
    raise exception
      'Recovery stopped: final Article assertion failed';
  end if;

  if not exists (
    select 1
    from editorial.resources resource
    where resource.id = v_resource_id
      and resource.current_working_version_id =
        v_new_version_id
      and resource.current_submitted_version_id
        is null
      and resource.lifecycle_state = 'draft'
  ) then
    raise exception
      'Recovery stopped: final resource assertion failed';
  end if;

  raise notice
    'Recovered Article % from accepted version 27 into working version %',
    v_article_id,
    v_new_version_number;
end;
$repair$;

commit;
