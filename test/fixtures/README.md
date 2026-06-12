# WAKILISHA Charts — Golden-File Test Fixtures

These fixtures are the canonical test evidence for Gate A (golden-file migration test).

## What goes here

Each fixture represents ONE real published edition from the live WordPress/WKCharts plugin.

### Fixture format: `edition-YYYY-MM-DD.json`

```json
{
  "edition_date": "2026-05-18",
  "chart_program": "top-songs-kenya",
  "chart_size": 20,
  "methodology_notes": "Scoring policy 1.0 — extracted from wakilisha-charts-v1.php",
  "source_evidence": [
    {
      "track_title": "Nakam Sai",
      "artist_name": "Sauti Sol",
      "source_urls": ["https://spotify.com/playlist/..."],
      "release_date": "2025-12-01",
      "occurrence_count": 3
    }
  ],
  "previous_edition": [
    { "normalized_key": "nakam sai::sauti sol", "position": 2 }
  ],
  "airplay_detections": [
    {
      "canonical_track_id": "ct-001",
      "normalized_key": "nakam sai::sauti sol",
      "station_id": "stn-homeboyz",
      "station_weight": 1.0,
      "week_start": "2026-05-11",
      "detection_count": 12,
      "total_played_duration": 2160,
      "weighted_score": 48.0
    }
  ],
  "expected_positions": [
    { "rank": 1, "normalized_key": "nakam sai::sauti sol", "track_title": "Nakam Sai", "artist_name": "Sauti Sol" }
  ],
  "scoring_policy_version": "1.0",
  "corrections_applied": []
}
```

## Fixture provenance

**CRITICAL:** Fixtures must be exported from the live WordPress plugin database.
Use the export script: `npm run charts:export-fixture -- --edition YYYY-MM-DD`

All fixtures in this directory must have a header comment in the JSON file
stating:
- Which edition date they represent
- Which WordPress site they came from
- When they were exported

## Gate A gate definition

Gate A passes when:
1. The scoring engine processes ALL source_evidence + airplay_detections exactly as above
2. The engine produces `expected_positions` in EXACT order (100% position parity)
3. Any mismatch is explained as a documented §11 correction (specific, reproducible, signed off)

## Synthetic fixtures

Fixtures named `synthetic-*.json` are for edge case testing only.
They must NEVER be presented as live chart data.
The lint rule `test/fixtures` is blocked from `src/` imports.

## Current fixture status

| Fixture | Edition | Source | Status |
|---------|---------|--------|--------|
| `synthetic-gate-a-smoke.json` | 2026-06-11 | Generated for CI | ✅ Active |
| `edition-YYYY-MM-DD.json` | Real edition | WordPress export | ⏳ Awaiting export |

Gate A requires 4 real exported editions before it is fully complete.