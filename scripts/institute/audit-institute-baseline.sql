-- WAKILISHA Institute PR0 baseline audit
-- Read-only. Run in Supabase SQL Editor before each simplification phase.
-- This script does not alter data.

-- 1. Row counts for all Institute tables.
select
  schemaname,
  relname as table_name,
  n_live_tup::bigint as estimated_rows
from pg_stat_user_tables
where schemaname = 'public'
  and relname like 'institute_%'
order by relname;

-- 2. Exact counts for the central Institute records.
select 'institute_inquiries' as object, count(*)::bigint as rows from public.institute_inquiries
union all select 'institute_question_versions', count(*) from public.institute_question_versions
union all select 'institute_inquiry_anchors', count(*) from public.institute_inquiry_anchors
union all select 'institute_anchor_context_snapshots', count(*) from public.institute_anchor_context_snapshots
union all select 'institute_workbench_setup', count(*) from public.institute_workbench_setup
union all select 'institute_evidence_items', count(*) from public.institute_evidence_items
union all select 'institute_assistant_runs', count(*) from public.institute_assistant_runs
union all select 'institute_assistant_suggestions', count(*) from public.institute_assistant_suggestions
union all select 'institute_events', count(*) from public.institute_events
union all select 'institute_relationships', count(*) from public.institute_relationships
union all select 'institute_review_packets', count(*) from public.institute_review_packets
union all select 'institute_work_product_links', count(*) from public.institute_work_product_links
order by object;

-- 3. Inquiry lifecycle distribution.
select status, maturity, visibility, count(*)::bigint as inquiries
from public.institute_inquiries
where deleted_at is null
group by status, maturity, visibility
order by status, maturity, visibility;

-- 4. Question-version integrity.
select
  count(*) filter (where version_count = 0)::bigint as inquiries_without_versions,
  count(*) filter (where version_count > 1)::bigint as inquiries_with_multiple_versions
from (
  select i.id, count(q.id) as version_count
  from public.institute_inquiries i
  left join public.institute_question_versions q on q.inquiry_id = i.id
  where i.deleted_at is null
  group by i.id
) x;

select inquiry_id, version_number, count(*)::bigint as duplicates
from public.institute_question_versions
group by inquiry_id, version_number
having count(*) > 1
order by inquiry_id, version_number;

-- 5. Workbench setup usage. This establishes which fields are actually populated
-- before the UI stops collecting them.
select
  count(*)::bigint as setup_rows,
  count(*) filter (where nullif(trim(inquiry_type), '') is not null)::bigint as with_inquiry_type,
  count(*) filter (where coalesce(array_length(output_surfaces, 1), 0) > 0)::bigint as with_output_surfaces,
  count(*) filter (where coalesce(array_length(evidence_formats, 1), 0) > 0)::bigint as with_evidence_formats,
  count(*) filter (where coalesce(array_length(tools, 1), 0) > 0)::bigint as with_tools,
  count(*) filter (where scope_edges <> '{}'::jsonb)::bigint as with_scope_edges,
  count(*) filter (where care_defaults <> '{}'::jsonb)::bigint as with_care_defaults,
  count(*) filter (where estimated_attention <> '{}'::jsonb)::bigint as with_estimated_attention
from public.institute_workbench_setup;

-- 6. Material distribution and claim-shim discovery.
select evidence_kind, review_state, count(*)::bigint as items
from public.institute_evidence_items
group by evidence_kind, review_state
order by evidence_kind, review_state;

select
  count(*)::bigint as possible_claim_shim_rows
from public.institute_evidence_items
where metadata->>'workspaceFormat' = 'Claim'
   or metadata->>'workspaceType' = 'claims'
   or metadata ? 'claimText';

-- 7. Assistant use and decision rates.
select task, status, review_status, count(*)::bigint as runs
from public.institute_assistant_runs
group by task, status, review_status
order by task, status, review_status;

select suggestion_type, status, count(*)::bigint as suggestions
from public.institute_assistant_suggestions
group by suggestion_type, status
order by suggestion_type, status;

-- 8. Relationship use.
select status, relationship_kind, count(*)::bigint as relationships
from public.institute_relationships
group by status, relationship_kind
order by status, relationship_kind;

-- 9. Work-product links and possible duplicates.
select product_type, status, count(*)::bigint as links
from public.institute_work_product_links
group by product_type, status
order by product_type, status;

select inquiry_id, product_type, product_id, count(*)::bigint as duplicate_links
from public.institute_work_product_links
group by inquiry_id, product_type, product_id
having count(*) > 1
order by inquiry_id, product_type, product_id;

-- 10. Review packet distribution.
select status, count(*)::bigint as packets
from public.institute_review_packets
group by status
order by status;

-- 11. Packet versus linked-work status mismatches.
with packet_links as (
  select
    p.id as packet_id,
    p.status as packet_status,
    p.snapshot_json->'workProduct'->>'linkId' as link_id
  from public.institute_review_packets p
), joined as (
  select
    pl.packet_id,
    pl.packet_status,
    pl.link_id,
    w.status as work_status
  from packet_links pl
  left join public.institute_work_product_links w
    on w.id::text = pl.link_id
  where pl.link_id is not null
)
select packet_status, work_status, count(*)::bigint as records
from joined
group by packet_status, work_status
order by packet_status, work_status;

-- 12. Orphan checks.
select 'question_versions_without_inquiry' as problem, count(*)::bigint as rows
from public.institute_question_versions q
left join public.institute_inquiries i on i.id = q.inquiry_id
where i.id is null
union all
select 'evidence_without_inquiry', count(*)
from public.institute_evidence_items e
left join public.institute_inquiries i on i.id = e.inquiry_id
where i.id is null
union all
select 'events_without_inquiry', count(*)
from public.institute_events e
left join public.institute_inquiries i on i.id = e.inquiry_id
where i.id is null
union all
select 'review_packets_without_inquiry', count(*)
from public.institute_review_packets p
left join public.institute_inquiries i on i.id = p.inquiry_id
where i.id is null
union all
select 'work_links_without_inquiry', count(*)
from public.institute_work_product_links w
left join public.institute_inquiries i on i.id = w.inquiry_id
where i.id is null;

-- 13. Candidate parity inquiries for manual preservation.
-- These are suggestions only. Review the rows before using them as fixtures.
select
  i.id,
  i.code,
  i.current_question,
  count(distinct q.id) as question_versions,
  count(distinct e.id) as material_items,
  count(distinct s.id) as assistant_suggestions,
  count(distinct r.id) as relationships,
  count(distinct w.id) as work_products,
  count(distinct p.id) as review_packets
from public.institute_inquiries i
left join public.institute_question_versions q on q.inquiry_id = i.id
left join public.institute_evidence_items e on e.inquiry_id = i.id
left join public.institute_assistant_suggestions s on s.inquiry_id = i.id
left join public.institute_relationships r on r.inquiry_id = i.id
left join public.institute_work_product_links w on w.inquiry_id = i.id
left join public.institute_review_packets p on p.inquiry_id = i.id
where i.deleted_at is null
group by i.id, i.code, i.current_question
order by
  count(distinct p.id) desc,
  count(distinct w.id) desc,
  count(distinct e.id) desc,
  i.updated_at desc
limit 25;
