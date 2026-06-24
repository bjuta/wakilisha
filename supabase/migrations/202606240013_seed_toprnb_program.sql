insert into public.wk_chart_programs_v2 (
  id,
  series_slug,
  market_slug,
  public_slug,
  public_label,
  short_label,
  source_family_slug,
  default_period_type,
  default_methodology_version,
  default_eligibility_rules_version,
  created_at,
  updated_at
)
values (
  'toprnb',
  'toprnb',
  'KE',
  'top-rnb-songs-kenya',
  'Top 100 R&B Songs: Kenya',
  'Top R&B Songs',
  'toprnb',
  'weekly',
  '1.0.0',
  'wakilisha-rnb-charts-v1',
  now(),
  now()
)
on conflict (id) do update
set
  series_slug = excluded.series_slug,
  market_slug = excluded.market_slug,
  public_slug = excluded.public_slug,
  public_label = excluded.public_label,
  short_label = excluded.short_label,
  source_family_slug = excluded.source_family_slug,
  default_period_type = excluded.default_period_type,
  default_methodology_version = excluded.default_methodology_version,
  default_eligibility_rules_version = excluded.default_eligibility_rules_version,
  updated_at = now();
