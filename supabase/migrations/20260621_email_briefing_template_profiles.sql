-- Email briefing template profiles
-- Adds catalog-level visual/editorial configuration for the 13 branded WAKILISHA briefings.
-- Existing renderer paths already pass briefing_catalog.visual_config into email generation.

update briefing_catalog as bc
set visual_config = coalesce(bc.visual_config, '{}'::jsonb) || v.config
from (values
  ('culture_dispatch', '{"template_variant":"culture_dispatch","accent_color":"#5C8E25","template_family":"culture","editorial_intent":"card-led magazine routes, chart pulse, artist motion, archive doors"}'::jsonb),
  ('charts_digest', '{"template_variant":"charts_digest","accent_color":"#5C8E25","template_family":"charts","editorial_intent":"album-art chart leader, compact ranked artwork tiles, movement board"}'::jsonb),
  ('weekly_editorial', '{"template_variant":"weekly_editorial","accent_color":"#946B33","template_family":"editorial","editorial_intent":"lead essay card, story grid, pull-thread module"}'::jsonb),
  ('field_guides', '{"template_variant":"field_guides","accent_color":"#6452C7","template_family":"guides","editorial_intent":"field-guide hero, numbered steps, route cards"}'::jsonb),
  ('artist_signals', '{"template_variant":"artist_signals","accent_color":"#5C8E25","template_family":"artists","editorial_intent":"image-first artist wall, signal labels, minimal metadata"}'::jsonb),
  ('release_radar', '{"template_variant":"release_radar","accent_color":"#A06800","template_family":"releases","editorial_intent":"cover-led release cards, new project grid, listen routes"}'::jsonb),
  ('new_voices', '{"template_variant":"new_voices","accent_color":"#9E3879","template_family":"artists","editorial_intent":"emerging artist wall, discovery framing, first signals"}'::jsonb),
  ('registry_notes', '{"template_variant":"registry_notes","accent_color":"#6452C7","template_family":"registry","editorial_intent":"entity-change cards, stats, audit routes"}'::jsonb),
  ('label_industry_notes', '{"template_variant":"label_industry_notes","accent_color":"#946B33","template_family":"industry","editorial_intent":"label cards, roster cues, release activity"}'::jsonb),
  ('language_memory', '{"template_variant":"language_memory","accent_color":"#2D6BB5","template_family":"language","editorial_intent":"memory cards, language threads, archive pull routes"}'::jsonb),
  ('east_africa_weekly', '{"template_variant":"east_africa_weekly","accent_color":"#1C8A75","template_family":"regional","editorial_intent":"city board, regional story cards, cross-border artist context"}'::jsonb),
  ('weekend_agenda', '{"template_variant":"weekend_agenda","accent_color":"#A06800","template_family":"agenda","editorial_intent":"Friday/Saturday/Sunday planner cards, live-culture routes"}'::jsonb),
  ('diaspora_signals', '{"template_variant":"diaspora_signals","accent_color":"#6452C7","template_family":"diaspora","editorial_intent":"home-distance-memory cards, diaspora artist routes"}'::jsonb)
) as v(slug, config)
where bc.slug = v.slug;
