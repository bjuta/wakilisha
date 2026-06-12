# WAKILISHA — WordPress Chart Import Guide

## Overview

This tool imports all 87 chart editions from the old WordPress website into the new Supabase v2 chart schema.

The old WordPress URL format (`/charts/2026/ke/2026-05-18/`) does not carry over to the new site. The importer normalizes all edition slugs and creates slug aliases for redirects.

---

## What Gets Imported

From WordPress MySQL (`bitnami_wordpress`), the importer reads:

| WordPress Table | Maps To | Contents |
|---|---|---|
| `wp_wkcharts_charts` | `wk_chart_programs_v2` + `wk_chart_series_v2` + `wk_chart_markets_v2` | Chart programs — one per chart type |
| `wp_wkcharts_editions` | `wk_chart_editions_v2` | All 87 editions with dates, metadata |
| `wp_wkcharts_edition_items` | `wk_chart_entries_v2` | All ranked track entries per edition |
| `wp_wkcharts_tracks` | `wk_chart_entries_v2.source_payload` | Track metadata (ISRC, Spotify ID, Apple Music ID, etc.) |
| `wp_wkcharts_artists` | `wk_chart_entries_v2.artist_name/slug` | Artist names and slugs |
| `wp_wkcharts_track_artists` | `wk_chart_entries_v2.artist_slug` | Primary artist per track |
| `wp_wkcharts_track_sources` | `wk_chart_entries_v2.source_urls_seen` | Source provider URLs (Spotify, Apple Music, etc.) |
| `wp_wkcharts_ingest_runs` | `wk_chart_editions_v2.rule_set_snapshot` | Old ingest settings preserved in snapshot |

---

## URL Normalization

Old URLs like `/charts/2026/ke/2026-05-18/` are normalized to:

```
/charts/top-songs/kenya/weekly-2026-05-18
```

The importer creates slug aliases in `wk_chart_slug_aliases_v2` so old links continue to work.

---

## How to Run

### Option 1: From the WordPress Lightsail Server (Recommended)

SSH into the server first, then run:

```bash
# On the WordPress Lightsail server (ip-172-26-5-134)

# Install Node.js if not present
curl -sS https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm use 20

# Copy the script (or git clone the repo)
mkdir -p /tmp/wakilisha-import
cd /tmp/wakilisha-import

# Run dry run first
DATABASE_URL="postgresql://..." \
WP_DB_HOST=127.0.0.1 WP_DB_USER=bn_wordpress \
WP_DB_PASSWORD='236407f4e9404d1cd2215f9759d1ddc198d04fa6aaffc7d61fb98f1422c4eb0b' \
WP_DB_NAME=bitnami_wordpress WP_DB_PREFIX=wp_ \
npx tsx scripts/charts/import-wordpress-charts-to-v2.ts --dry-run

# Review reports/chart-v2-wordpress-import.json
# Then commit for real:
WAKILISHA_CHART_IMPORT_COMMIT=1 \
DATABASE_URL="postgresql://..." \
WP_DB_HOST=127.0.0.1 WP_DB_USER=bn_wordpress \
WP_DB_PASSWORD='...' \
WP_DB_NAME=bitnami_wordpress WP_DB_PREFIX=wp_ \
npx tsx scripts/charts/import-wordpress-charts-to-v2.ts
```

### Option 2: Via SSH from your local machine

```bash
# Set your SSH key path
export WP_SSH_KEY=~/.ssh/your-lightsail-key.pem
export DATABASE_URL="postgresql://..."

# Dry run
bash scripts/charts/import-charts-via-ssh.sh --dry-run

# Commit for real
WAKILISHA_CHART_IMPORT_COMMIT=1 bash scripts/charts/import-charts-via-ssh.sh
```

---

## WordPress Database Credentials

From the PDF (already in scope):

| Field | Value |
|---|---|
| Host | `ip-172-26-5-134` (Lightsail internal IP) |
| Port | `3306` |
| User | `bn_wordpress` |
| Password | `236407f4e9404d1cd2215f9759d1ddc198d04fa6aaffc7d61fb98f1422c4eb0b` |
| Database | `bitnami_wordpress` |
| Table prefix | `wp_` |
| SSH user | `bitnami` |

---

## What Happens After Import

Once the import runs, the chart admin in the new website will show:

1. **Programs** — All chart programs discovered in WordPress (Kenya Top 100, R&B, Gengetone, etc.)
2. **Editions** — All 87 editions with their edition dates
3. **Entries** — All ranked positions per edition with full source metadata

The old WordPress settings (source URLs, scoring policies, methodology) are preserved in `rule_set_snapshot` on each edition, so you can see exactly what settings were used historically.

### Continuing with new editions

After the legacy import, new editions can be created using the Chart Ingestion Studio just as normal. The new editions will have the benefit of the improved scoring framework.

---

## Slug Alias Table

The importer creates entries in `wk_chart_slug_aliases_v2` for every old edition slug so that old URLs redirect to the new canonical slug format.

---

## Reports

After running, check:

- `reports/chart-v2-wordpress-import.json` — Full import report
- `reports/chart-v2-wordpress-import.sql` — The SQL that was (or would be) executed