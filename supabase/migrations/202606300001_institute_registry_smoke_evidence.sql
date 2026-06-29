create extension if not exists pgcrypto;

insert into public.inquiries (
  inquiry_number,
  title,
  slug,
  primary_question,
  short_question,
  why_it_matters,
  status,
  visibility,
  summary,
  current_understanding
)
values (
  'SMOKE-REGISTRY-WORKFLOW-001',
  'Smoke test: why Mejja matters through Siaka',
  'smoke-registry-workflow-mejja-siaka',
  'What relationships help explain why Mejja matters?',
  'Why Mejja matters through Siaka',
  'This internal inquiry proves the Institute review workflow using real WAKILISHA registry context without mutating the registry tables.',
  'active',
  'internal',
  'A controlled Institute smoke inquiry using Mejja, Siaka, Fik Fameica, and Mtoto wa Khadija as real registry-context material.',
  'Siaka connects Mejja to a cross-border collaboration context with Fik Fameica and to the Mtoto wa Khadija release era.'
)
on conflict (inquiry_number) do update
set
  title = excluded.title,
  slug = excluded.slug,
  primary_question = excluded.primary_question,
  short_question = excluded.short_question,
  why_it_matters = excluded.why_it_matters,
  status = excluded.status,
  visibility = excluded.visibility,
  summary = excluded.summary,
  current_understanding = excluded.current_understanding,
  updated_at = now();

insert into public.evidence_items (
  title,
  evidence_type,
  source_file,
  source_note,
  summary,
  main_claim,
  why_it_matters,
  reliability,
  confidence,
  review_status,
  retrieval_status
)
select
  'Smoke evidence: Siaka chart context',
  'chart_record',
  'src/services/cultureContext/testFixtures.ts',
  'Internal smoke seed based on real WAKILISHA registry-context fixture data.',
  'Siaka is represented as a Mejja and Fik Fameica track with a peak chart rank of #8 and six weeks on chart.',
  'Siaka gives the Institute a concrete chart-backed reason to connect Mejja to cross-border collaboration and release performance.',
  'This item proves that chart-context evidence can enter the human review queue before becoming retrieval-ready.',
  'medium',
  'high',
  'unreviewed',
  'review_only'
where not exists (
  select 1
  from public.evidence_items
  where title = 'Smoke evidence: Siaka chart context'
    and source_file = 'src/services/cultureContext/testFixtures.ts'
);

insert into public.evidence_items (
  title,
  evidence_type,
  source_file,
  source_note,
  summary,
  main_claim,
  why_it_matters,
  reliability,
  confidence,
  review_status,
  retrieval_status
)
select
  'Smoke evidence: Mejja and Fik Fameica collaboration context',
  'track_metadata',
  'src/services/cultureContext/testFixtures.ts',
  'Internal smoke seed based on real WAKILISHA registry-context fixture data.',
  'Siaka lists Mejja and Fik Fameica as primary artists, creating a direct collaboration context for the Institute review workflow.',
  'The Mejja and Fik Fameica pairing is a useful relationship candidate because the track itself names both artists as primary collaborators.',
  'This item proves that a reviewer can approve evidence first, then enable retrieval only after review.',
  'medium',
  'high',
  'reviewed',
  'review_only'
where not exists (
  select 1
  from public.evidence_items
  where title = 'Smoke evidence: Mejja and Fik Fameica collaboration context'
    and source_file = 'src/services/cultureContext/testFixtures.ts'
);

insert into public.evidence_items (
  title,
  evidence_type,
  source_file,
  source_note,
  summary,
  main_claim,
  why_it_matters,
  reliability,
  confidence,
  review_status,
  retrieval_status
)
select
  'Smoke evidence: Mtoto wa Khadija release context',
  'release_metadata',
  'src/services/cultureContext/testFixtures.ts',
  'Internal smoke seed based on real WAKILISHA registry-context fixture data.',
  'Siaka appears in the Mtoto wa Khadija album context, with Mejja as the album artist in the registry-context fixture.',
  'Mtoto wa Khadija provides release-level context for explaining why Siaka matters inside Mejja’s wider catalogue.',
  'This item proves that release metadata can support inquiry evidence without writing to the registry release table.',
  'medium',
  'medium',
  'disputed',
  'review_only'
where not exists (
  select 1
  from public.evidence_items
  where title = 'Smoke evidence: Mtoto wa Khadija release context'
    and source_file = 'src/services/cultureContext/testFixtures.ts'
);

insert into public.inquiry_evidence (
  inquiry_id,
  evidence_id,
  use_note
)
select
  i.id,
  e.id,
  'Smoke workflow evidence for testing human review, evidence logging, and retrieval readiness.'
from public.inquiries i
join public.evidence_items e
  on e.source_file = 'src/services/cultureContext/testFixtures.ts'
where i.inquiry_number = 'SMOKE-REGISTRY-WORKFLOW-001'
  and e.title in (
    'Smoke evidence: Siaka chart context',
    'Smoke evidence: Mejja and Fik Fameica collaboration context',
    'Smoke evidence: Mtoto wa Khadija release context'
  )
on conflict do nothing;

insert into public.cultural_entities (
  entity_type,
  source_table,
  source_id,
  name,
  slug,
  description,
  status
)
select
  entity_type,
  'institute_smoke_seed',
  source_id,
  name,
  slug,
  description,
  'active'
from (
  values
    ('artist', 'artist:mejja', 'Mejja', 'mejja', 'Smoke Institute entity for Mejja using real registry-context evidence.'),
    ('artist', 'artist:fik-fameica', 'Fik Fameica', 'fik-fameica', 'Smoke Institute entity for Fik Fameica using real registry-context evidence.'),
    ('track', 'track:siaka', 'Siaka', 'siaka', 'Smoke Institute entity for Siaka using real registry-context evidence.'),
    ('release', 'release:mtoto-wa-khadija', 'Mtoto wa Khadija', 'mtoto-wa-khadija', 'Smoke Institute entity for Mtoto wa Khadija using real registry-context evidence.')
) as seed(entity_type, source_id, name, slug, description)
where not exists (
  select 1
  from public.cultural_entities existing
  where existing.entity_type = seed.entity_type
    and existing.source_table = 'institute_smoke_seed'
    and existing.source_id = seed.source_id
);

update public.cultural_entities entity
set
  name = seed.name,
  slug = seed.slug,
  description = seed.description,
  status = 'active',
  updated_at = now()
from (
  values
    ('artist', 'artist:mejja', 'Mejja', 'mejja', 'Smoke Institute entity for Mejja using real registry-context evidence.'),
    ('artist', 'artist:fik-fameica', 'Fik Fameica', 'fik-fameica', 'Smoke Institute entity for Fik Fameica using real registry-context evidence.'),
    ('track', 'track:siaka', 'Siaka', 'siaka', 'Smoke Institute entity for Siaka using real registry-context evidence.'),
    ('release', 'release:mtoto-wa-khadija', 'Mtoto wa Khadija', 'mtoto-wa-khadija', 'Smoke Institute entity for Mtoto wa Khadija using real registry-context evidence.')
) as seed(entity_type, source_id, name, slug, description)
where entity.entity_type = seed.entity_type
  and entity.source_table = 'institute_smoke_seed'
  and entity.source_id = seed.source_id;

insert into public.entity_relationships (
  source_entity_id,
  target_entity_id,
  relationship_type,
  reason,
  confidence,
  review_status,
  public_safe,
  review_note
)
select
  mejja.id,
  fik.id,
  'collaborated_with',
  'Smoke relationship: Mejja and Fik Fameica are both primary artists on Siaka.',
  'medium',
  'pending_review',
  false,
  'Internal smoke relationship seeded for Institute workflow testing.'
from public.cultural_entities mejja
join public.cultural_entities fik
  on fik.source_table = 'institute_smoke_seed'
 and fik.source_id = 'artist:fik-fameica'
where mejja.source_table = 'institute_smoke_seed'
  and mejja.source_id = 'artist:mejja'
  and not exists (
    select 1
    from public.entity_relationships existing
    where existing.source_entity_id = mejja.id
      and existing.target_entity_id = fik.id
      and existing.relationship_type = 'collaborated_with'
      and existing.reason = 'Smoke relationship: Mejja and Fik Fameica are both primary artists on Siaka.'
  );

insert into public.entity_relationships (
  source_entity_id,
  target_entity_id,
  relationship_type,
  reason,
  confidence,
  review_status,
  public_safe,
  review_note
)
select
  siaka.id,
  release.id,
  'appeared_on',
  'Smoke relationship: Siaka appears in the Mtoto wa Khadija release context.',
  'medium',
  'pending_review',
  false,
  'Internal smoke relationship seeded for Institute workflow testing.'
from public.cultural_entities siaka
join public.cultural_entities release
  on release.source_table = 'institute_smoke_seed'
 and release.source_id = 'release:mtoto-wa-khadija'
where siaka.source_table = 'institute_smoke_seed'
  and siaka.source_id = 'track:siaka'
  and not exists (
    select 1
    from public.entity_relationships existing
    where existing.source_entity_id = siaka.id
      and existing.target_entity_id = release.id
      and existing.relationship_type = 'appeared_on'
      and existing.reason = 'Smoke relationship: Siaka appears in the Mtoto wa Khadija release context.'
  );

insert into public.relationship_evidence (
  relationship_id,
  evidence_id,
  support_type,
  note
)
select
  relationship.id,
  evidence.id,
  'supports',
  'Smoke evidence attached to prove the relationship review path.'
from (
  values
    (
      'Smoke relationship: Mejja and Fik Fameica are both primary artists on Siaka.',
      'Smoke evidence: Mejja and Fik Fameica collaboration context'
    ),
    (
      'Smoke relationship: Siaka appears in the Mtoto wa Khadija release context.',
      'Smoke evidence: Mtoto wa Khadija release context'
    )
) as pairs(relationship_reason, evidence_title)
join public.entity_relationships relationship
  on relationship.reason = pairs.relationship_reason
join public.evidence_items evidence
  on evidence.source_file = 'src/services/cultureContext/testFixtures.ts'
 and evidence.title = pairs.evidence_title
on conflict do nothing;
