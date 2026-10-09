-- #1094 read-only acceptance probe for the historical recording-review closure debt.
-- This is NOT a data repair, review resolver, grant, or mutation authority.
-- Execute through the repository's existing linked-CLI verification transport.
-- Outputs one row per decided recording without exposing PII or secrets.
with reviewed as (
  select
    d.id decision_id,
    d.entity_id track_id,
    d.review_item_id source_review_id,
    r.status source_review_status,
    rr.id linked_review_id,
    rr.status linked_review_status,
    d.status decision_status,
    d.metadata->>'reviewResolved' decision_finalized,
    r.resolution_payload->>'finalizerAuthority' finalizer,
    (r.resolution_payload->>'decisionId'=d.id::text) exact_receipt,
    (t.slug=d.after_payload->>'canonicalSlug') canonical_slug_unchanged,
    (d.before_payload->>'trackStateFingerprint'=platform_private.registry_subject_state_fingerprint('track',d.entity_id)) state_fingerprint_unchanged,
    (rr.entity_id=d.entity_id and rr.source_id=d.entity_id::text
     and rr.source_payload->>'ruleId'='track_recording_identity_conflict'
     and rr.source_payload->>'ruleVersion'='1.3.0') correct_linked_review
  from public.registry_canonicalization_decisions d
  join public.registry_review_items r on r.id=d.review_item_id
  join public.registry_tracks t on t.id=d.entity_id
  left join public.registry_review_items rr
    on rr.id::text=d.after_payload->>'evidenceRecordingIdentityReviewId'
  where d.decision_type='public_music_identity_distinct_recording'
    and d.metadata->>'programmeKey'='public_music_identity_track_actual_zero_v1'
    and d.metadata->>'programmeIssue'='1094'
)
select
  decision_id, track_id, source_review_id, linked_review_id,
  source_review_status, linked_review_status, decision_status,
  decision_finalized, finalizer, exact_receipt, correct_linked_review,
  canonical_slug_unchanged, state_fingerprint_unchanged
from reviewed order by decision_id;

-- The final actual-zero gate, after authenticated reconciliation and verification:
-- select count(*) from public.registry_review_items r
-- where r.review_type='mizizi_data_hygiene'
-- and r.status='open'
-- and r.source_payload->>'ruleId'='track_recording_identity_conflict';
-- Do NOT assume all 91 recording reviews are included in #1094's closure scope.
