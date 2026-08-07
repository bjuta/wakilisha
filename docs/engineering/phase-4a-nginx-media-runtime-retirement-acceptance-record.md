# Phase 4A Nginx and Media runtime retirement acceptance

Date: 7 August 2026

## Status

Accepted.

This record supplements the Phase 4A closure after the first PR 4B
infrastructure audit exposed host-managed WordPress Media compatibility that
was not represented by repository application code.

## Discovery

Production Nginx still contained:

- a Media-origin fallback from canonical `/uploads/*` into the copied local
  `/opt/wakilisha-media/wp-content/uploads` mirror
- `/__legacy-wp-media/` proxies to the former WordPress host `18.135.76.250`
- a main-site `/wp-content/uploads/*` redirect to the canonical Media origin

The first two were retirement residue.

The main-site redirect is intentional historical URL compatibility and does not
depend on WordPress.

## Traffic evidence

The read-only audit observed:

- `/__legacy-wp-media/`: 0 requests
- Media-origin `/uploads/*`: 22,834 requests
- clean canonical `/uploads` requests: 17,960
- direct local `wp-content` fallback: 3,080 requests
- resized local fallback: 98 requests

The exact promotion snapshot contained:

- live direct legacy Media paths: 1,279
- live resized legacy paths: 47
- live non-Media fallback paths: 0

## Promotion manifest

Before normalization:

- legacy mirror files: 5,717
- legacy mirror bytes: 609,783,779
- already canonical and identical: 885
- different-content canonical collisions: 3
- missing promotable Media files: 4,822
- missing promotable Media bytes: 407,479,887
- dangerous executable-like files: 0
- non-Media JSON files deliberately not promoted: 4
- zero-byte `wpcode` HTML debris deliberately not promoted: 3

The three differing canonical files remained authoritative and were not
overwritten.

## Production correction

Release:

`phase4a-nginx-media-retirement-20260807T091124Z`

The correction:

- promoted 4,822 Media files into canonical `/opt/wakilisha-media/uploads`
- promoted 407,479,887 bytes
- verified all promoted bytes by SHA-256
- used atomic target placement
- overwrote zero canonical files
- preserved all three differing canonical collisions
- removed the old WordPress-host proxy
- removed Media-origin fallback into the `wp-content` filesystem namespace
- preserved historical size-suffixed URL behavior without consulting
  `wp-content`
- preserved the main-site `/wp-content/uploads/*` redirect
- retained the complete legacy mirror for rollback

Promotion manifest:

`/opt/wakilisha-media-retirement/phase4a-nginx-media-retirement-20260807T091124Z/promoted-files.tsv`

Nginx backup:

`/etc/nginx/wakilisha-backups/phase4a-nginx-media-retirement-20260807T091124Z`

## Acceptance

After reload:

- Nginx syntax: PASS
- old WordPress host dependency: absent
- `/__legacy-wp-media/`: absent
- Media-origin `wp-content` fallback: absent
- historical main-site redirect: preserved
- historically observed direct paths canonical: 1,279 of 1,279
- historically observed resized URLs healthy: 47 of 47
- representative direct Media delivery: 50 of 50
- canonical collisions overwritten: 0
- legacy rollback mirror retained: 5,717 files and 609,783,779 bytes
- `/`: HTTP 200
- `/charts`: HTTP 200
- `/artists`: HTTP 200
- `/magazine`: HTTP 200
- Media-origin root: HTTP 404, accepted because `/` is not a delivery contract
- historical `/wp-content/uploads/*` URL: HTTP 302 to canonical Media origin

## Authority conclusion

WordPress is no longer involved in WAKILISHA Media runtime delivery.

The retained local `wp-content` mirror is rollback evidence only.

The public `/wp-content/uploads/*` shape is a redirect compatibility contract,
not a WordPress runtime contract.

Phase 4A is closed at the repository, database, Edge Function, frontend, Media
data, filesystem-delivery, and Nginx runtime layers.

PR 4B may proceed.
