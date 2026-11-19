-- Charts 2.0 Phase 2 / Take 2. One server-only source and Registry snapshot.
-- Filename minted with pinned Supabase CLI 2.107.0 in run 44503738547.
-- No public edition, publisher, Registry mutation, source admission or timer.
begin;

do $preflight$
begin
  if to_regclass('platform_private.charts2_capture_receipts_v1') is null
     or to_regclass('platform_private.charts2_source_methods_v1') is null
     or to_regclass('public.registry_track_provider_links') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.wk_chart_methodologies_v2') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
  then
    raise exception 'charts2_studio_foundation_missing';
  end if;
end
$preflight$;

insert into public.wk_chart_methodologies_v2
(methodology_version,label,scoring_policy_version,rule_set,changelog,effective_from)
values (
 'consumption_led_cultural_presence_v1',
 'Consumption-Led Cultural Presence v1 — private review',
 'charts2-private-ordinal-v1',
 jsonb_build_object(
   'scope','private_review_only',
   'market','KE',
   'observation_basis','five first-party ranked source positions, not aggregate stream totals',
   'weights',jsonb_build_object(
     'youtube_ke',30,'mdundo_ke',25,'apple_ke',20,
     'audiomack_ke',15,'shazam_ke',10
   ),
   'native_depths',jsonb_build_object(
     'youtube_ke',100,'mdundo_ke',100,'apple_ke',100,
     'audiomack_ke',100,'shazam_ke',200
   ),
   'ordinal_credit_formula','weight_points*(200/native_depth)*(native_depth-rank+1)',
   'unit_denominator',200,
   'ties','score_units_desc_then_canonical_track_uuid_asc',
   'incomplete_sources','no reweighting and no fabricated zeros',
   'identity','governed Registry provider binding; title and artist never automatic',
   'can_publish',false
 ),
 'Phase 2 private-only scoring configuration; not the live top100 default.',
 '2026-11-19'
);

create function public.charts2_studio_private_snapshot_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $studio$
with latest as (
  select distinct on (r.source_key) r.*
  from platform_private.charts2_capture_receipts_v1 r
  where r.source_key in ('youtube_ke','mdundo_ke','apple_ke','audiomack_ke','shazam_ke')
  order by r.source_key,r.created_at desc,r.id desc
),
observed_ids as (
  select distinct
    case l.source_key when 'youtube_ke' then 'youtube'
      when 'mdundo_ke' then 'mdundo'
      when 'apple_ke' then 'apple_music'
      when 'audiomack_ke' then 'audiomack'
      when 'shazam_ke' then 'shazam' end as provider_key,
    o.v->>'provider_track_id' as provider_track_id
  from latest l
  cross join lateral pg_catalog.jsonb_array_elements(l.observations) o(v)
  where nullif(o.v->>'provider_track_id','') is not null
)
select pg_catalog.jsonb_build_object(
  'contract','charts2-private-studio/v1',
  'read_at',pg_catalog.now(),
  'methodology',(
    select pg_catalog.jsonb_build_object(
      'version',v.methodology_version,
      'scoring_policy_version',v.scoring_policy_version,
      'rule_set',v.rule_set)
    from public.wk_chart_methodologies_v2 v
    where v.methodology_version='consumption_led_cultural_presence_v1'
  ),
  'receipts',coalesce((
    select pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(r)-'captured_by'-'created_at'
      order by r.source_key
    ) from latest r
  ),'[]'::jsonb),
  'history',coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',h.id,'source_key',h.source_key,'observed_at',h.observed_at,
      'original_sha256',h.original_sha256,
      'observed_depth',h.observed_depth,'expected_depth',h.expected_depth,
      'observed_status',h.observed_status,'native_period_authority',h.native_period_authority,
      'provider_week_ending_date',h.provider_week_ending_date
    ) order by h.observed_at desc,h.id desc)
    from (
      select id,source_key,observed_at,original_sha256,observed_depth,
        expected_depth,observed_status,native_period_authority,
        provider_week_ending_date
      from platform_private.charts2_capture_receipts_v1
      order by observed_at desc,id desc limit 35
    ) h
  ),'[]'::jsonb),
  'source_methods',coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'source_key',m.source_key,'review_state',m.review_state,
      'reviewed_method',m.reviewed_method,
      'method_revision',m.method_revision,
      'authorization_expires_at',m.authorization_expires_at)
      order by m.source_key)
    from platform_private.charts2_source_methods_v1 m
    where m.source_key in ('youtube_ke','mdundo_ke','apple_ke','audiomack_ke','shazam_ke')
  ),'[]'::jsonb),
  'registry_links',coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',l.id,'track_id',l.track_id,
      'provider_key',l.provider_key,'provider_track_id',l.provider_track_id,
      'match_method',l.match_method,'match_status',l.match_status,
      'match_confidence',l.match_confidence,
      'track_status',t.status,
      'review_evidence',pg_catalog.jsonb_build_object(
        'charts2_studio_review_v1',l.raw_payload->'charts2_studio_review_v1',
        'source_key',l.raw_payload->'source_key',
        'receipt_id',l.raw_payload->'receipt_id',
        'original_sha256',l.raw_payload->'original_sha256',
        'provider_track_id',l.raw_payload->'provider_track_id',
        'review_note',l.raw_payload->'review_note',
        'evidence_url',l.raw_payload->'evidence_url')
    ) order by l.provider_key,l.provider_track_id,l.track_id)
    from public.registry_track_provider_links l
    join public.registry_tracks t on t.id=l.track_id
    where exists (
      select 1 from observed_ids o
      where o.provider_key=l.provider_key and o.provider_track_id=l.provider_track_id
    )
  ),'[]'::jsonb)
);
$studio$;

revoke all on function public.charts2_studio_private_snapshot_v1()
  from public,anon,authenticated,service_role;
grant execute on function public.charts2_studio_private_snapshot_v1()
  to service_role;

comment on function public.charts2_studio_private_snapshot_v1()
is 'Service-only, read-only five-source immutable original receipt plus existing Registry canonical provider link snapshot. A capability-verified Edge worker owns its only invocation.';

commit;
