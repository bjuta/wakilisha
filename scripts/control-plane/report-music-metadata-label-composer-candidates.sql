-- WAKILISHA Music Identity & Rights Foundation
-- Slice 3: read-only Release label and composer evidence report.
--
-- Label matching is exact after case and whitespace normalization only.
-- Composer strings remain source evidence for review. This report does not
-- split names, guess Person identity, create Works, or create Contributions.

begin transaction read only;

-- Report A: retained Release label text against existing Label/Organisation
-- authority.
with release_label_evidence as (
  select
    r.id as release_id,
    r.title as release_title,
    nullif(btrim(r.metadata->>'record_label'), '') as source_label_text
  from public.registry_releases r
),
normalized as (
  select
    release_id,
    release_title,
    source_label_text,
    lower(
      regexp_replace(btrim(source_label_text), '[[:space:]]+', ' ', 'g')
    ) as normalized_source_label
  from release_label_evidence
  where source_label_text is not null
),
label_matches as (
  select
    n.release_id,
    array_agg(l.id order by l.id) as label_ids,
    array_agg(l.name order by l.name) as label_names
  from normalized n
  join public.registry_labels l
    on lower(
         regexp_replace(btrim(l.name), '[[:space:]]+', ' ', 'g')
       ) = n.normalized_source_label
  group by n.release_id
),
organization_matches as (
  select
    n.release_id,
    array_agg(o.resource_id order by o.resource_id) as organization_resource_ids,
    array_agg(o.display_name order by o.display_name) as organization_names
  from normalized n
  join editorial.organizations o
    on lower(
         regexp_replace(btrim(o.display_name), '[[:space:]]+', ' ', 'g')
       ) = n.normalized_source_label
  group by n.release_id
)
select
  n.release_id,
  n.release_title,
  n.source_label_text,
  coalesce(cardinality(l.label_ids), 0) as exact_label_match_count,
  coalesce(l.label_ids, '{}'::uuid[]) as exact_label_ids,
  coalesce(l.label_names, '{}'::text[]) as exact_label_names,
  coalesce(cardinality(o.organization_resource_ids), 0)
    as exact_organization_match_count,
  coalesce(o.organization_resource_ids, '{}'::uuid[])
    as exact_organization_resource_ids,
  coalesce(o.organization_names, '{}'::text[])
    as exact_organization_names,
  case
    when coalesce(cardinality(l.label_ids), 0) = 1
     and coalesce(cardinality(o.organization_resource_ids), 0) = 0
      then 'exact_label_candidate'
    when coalesce(cardinality(l.label_ids), 0) = 0
     and coalesce(cardinality(o.organization_resource_ids), 0) = 0
      then 'review_only_unmatched'
    else 'review_only_ambiguous'
  end as candidate_state
from normalized n
left join label_matches l using (release_id)
left join organization_matches o using (release_id)
order by candidate_state, n.source_label_text, n.release_id;

-- Report B: retained Apple Music composer strings.
--
-- provider_field_observations intentionally preserves one raw payload alongside
-- several typed field observations for the same provider item. Deduplicate here
-- by provider item + composer string so review workload is source-level rather
-- than field-row-level while preserving raw observation coverage separately in
-- the engineering record.
with composer_evidence as (
  select
    p.provider_item_id,
    nullif(
      btrim(p.raw_payload#>>'{data,0,attributes,composerName}'),
      ''
    ) as composer_name,
    min(p.created_at) as first_observed_at,
    max(p.created_at) as last_observed_at,
    count(*) as retained_observation_rows
  from public.provider_field_observations p
  where p.provider = 'apple_music'
  group by
    p.provider_item_id,
    nullif(
      btrim(p.raw_payload#>>'{data,0,attributes,composerName}'),
      ''
    )
),
nonblank as (
  select *
  from composer_evidence
  where composer_name is not null
)
select
  provider_item_id,
  composer_name,
  retained_observation_rows,
  count(*) over (partition by composer_name) as provider_items_with_same_string,
  'review_only_raw_composer_evidence'::text as candidate_state,
  first_observed_at,
  last_observed_at
from nonblank
order by composer_name, provider_item_id;

rollback;
