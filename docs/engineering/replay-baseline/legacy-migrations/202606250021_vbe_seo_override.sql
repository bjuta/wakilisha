with archived as (
  update public.seo_content_overrides
  set
    status = 'archived',
    archived_at = now(),
    updated_at = now()
  where target_url = '/artists/v-be'
    and status = 'active'
  returning *
),
task_upsert as (
  insert into public.seo_growth_tasks (
    target_url,
    query,
    action,
    reason,
    priority,
    score,
    metrics,
    status,
    source,
    updated_at,
    completed_at
  )
  values (
    '/artists/v-be',
    'v be',
    'Rewrite title/meta',
    'Google is already showing the V-Be page, but the result is not earning enough clicks. The page now has discography signals, so the snippet should promise actual music discovery, not a thin artist record.',
    'High',
    154,
    '1,615 impressions · 4 clicks · 0.2% CTR · position 9.8',
    'done',
    'manual_seo_draft_publish_bridge',
    now(),
    now()
  )
  on conflict (target_url, query, action)
  do update set
    reason = excluded.reason,
    priority = excluded.priority,
    score = excluded.score,
    metrics = excluded.metrics,
    status = 'done',
    source = excluded.source,
    updated_at = now(),
    completed_at = now()
  returning id
),
draft_upsert as (
  insert into public.seo_growth_drafts (
    task_id,
    target_url,
    query,
    action,
    content_kind,
    title,
    summary,
    body,
    payload,
    status,
    published_at,
    updated_at
  )
  select
    task_upsert.id,
    '/artists/v-be',
    'v be',
    'Rewrite title/meta',
    'seo_meta',
    'Rewrite title/meta: /artists/v-be',
    'V-Be Search Console rewrite using enriched discography signals.',
    $draft$
Target: /artists/v-be
Search intent: v be
Recommended action: Rewrite title/meta

Search result problem:
Google is already showing the V-Be page, but the result is not earning enough clicks. The page now has discography signals, so the snippet should promise actual music discovery, not a thin artist record.

Recommended SEO title:

1. V-Be songs, albums and profile | WAKILISHA
2. V-Be: Is Kionjo, Amanda, Leave Me Alone and more | WAKILISHA
3. V-Be on WAKILISHA | songs, releases and music context

Draft meta description:
Explore V-Be on WAKILISHA, including Is Kionjo, Amanda, Leave Me Alone, Kake Kadance, Kudaragombe, Liwe Liwalo, releases and related music context.

Search snippet promise:
This result should tell searchers that WAKILISHA has a useful V-Be music page, with songs, releases and a clear path into the artist’s catalogue.

Page intro draft:
V-Be’s WAKILISHA page brings together the artist’s growing catalogue, from Is Kionjo and Amanda to Leave Me Alone, Kake Kadance, Kudaragombe and Liwe Liwalo. Start here for songs, releases, credits and the music context around V-Be, then keep moving through related tracks and artists inside WAKILISHA.

Internal link module draft:
Looking for V-Be music? Start with the available songs and releases, then follow related tracks, featured credits, artist links and chart or culture signals connected to this page.

Admin publishing notes:

* Confirm the correct artist stylization: V-Be versus V Be.
* Confirm which releases are albums, singles or EPs before making stronger claims.
* Add artwork coverage where possible.
* Add internal links to the strongest V-Be tracks and releases once their public pages are live.
* Do not publish biography, age, nationality or real-name claims unless verified.

Search Console signal: 1,615 impressions · 4 clicks · 0.2% CTR · position 9.8
$draft$,
    jsonb_build_object(
      'source', 'manual_seo_draft_publish_bridge',
      'editedBeforeApply', true,
      'searchConsoleSignal', '1,615 impressions · 4 clicks · 0.2% CTR · position 9.8'
    ),
    'published',
    now(),
    now()
  from task_upsert
  on conflict (target_url, query, action, content_kind)
  do update set
    task_id = excluded.task_id,
    title = excluded.title,
    summary = excluded.summary,
    body = excluded.body,
    payload = excluded.payload,
    status = 'published',
    published_at = coalesce(public.seo_growth_drafts.published_at, now()),
    updated_at = now()
  returning id, task_id
),
override_insert as (
  insert into public.seo_content_overrides (
    target_url,
    title,
    description,
    social_title,
    social_description,
    payload,
    status,
    source_draft_id,
    task_id,
    created_at,
    updated_at,
    applied_at
  )
  select
    '/artists/v-be',
    'V-Be songs, albums and profile | WAKILISHA',
    'Explore V-Be on WAKILISHA, including Is Kionjo, Amanda, Leave Me Alone, Kake Kadance, Kudaragombe, Liwe Liwalo, releases and related music context.',
    'V-Be songs, albums and profile | WAKILISHA',
    'Explore V-Be on WAKILISHA, including Is Kionjo, Amanda, Leave Me Alone, Kake Kadance, Kudaragombe, Liwe Liwalo, releases and related music context.',
    jsonb_build_object(
      'source', 'manual_seo_draft_publish_bridge',
      'artist', 'V-Be',
      'target', '/artists/v-be',
      'searchIntent', 'v be',
      'discographySignals', jsonb_build_array('Is Kionjo', 'Amanda', 'Leave Me Alone', 'Kake Kadance', 'Kudaragombe', 'Liwe Liwalo')
    ),
    'active',
    draft_upsert.id,
    draft_upsert.task_id,
    now(),
    now(),
    now()
  from draft_upsert
  returning *
)
insert into public.seo_draft_publish_events (
  draft_id,
  task_id,
  override_id,
  target_url,
  event_type,
  before_payload,
  after_payload,
  created_at
)
select
  override_insert.source_draft_id,
  override_insert.task_id,
  override_insert.id,
  override_insert.target_url,
  'applied',
  coalesce((select jsonb_agg(to_jsonb(archived.*)) from archived), '[]'::jsonb),
  to_jsonb(override_insert.*),
  now()
from override_insert;
