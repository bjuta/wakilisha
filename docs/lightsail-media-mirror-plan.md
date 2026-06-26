# Lightsail Media Mirror Plan

## Goal

Move WordPress upload media dependency away from the old WordPress server without breaking existing WAKILISHA images.

## Decision

Do not block or redirect `/wp-content/uploads/*` yet.

The next move is to mirror WordPress uploads to a Lightsail-backed media origin, verify coverage, then update Cloudflare media routing.

## Target URL shape

Old URL:

```text
https://wakilisha.africa/wp-content/uploads/2024/05/example.jpg
```

New media origin:

```text
https://media.wakilisha.africa/wp-content/uploads/2024/05/example.jpg
```

The path must stay the same:

```text
/wp-content/uploads/YYYY/MM/file.ext
```

## Lightsail layout

```text
/opt/wakilisha-media/
└── wp-content/
    └── uploads/
```

Nginx should serve `/opt/wakilisha-media` for `media.wakilisha.africa`.

## Steps

1. Extract every referenced WordPress upload path.

```bash
node scripts/audit/extract-wordpress-media-urls.mjs
```

2. Copy uploads from the old WordPress server to Lightsail.

Example shape:

```bash
sudo mkdir -p /opt/wakilisha-media/wp-content/uploads
sudo chown -R bitnami:bitnami /opt/wakilisha-media
rsync -avz --progress /opt/bitnami/wordpress/wp-content/uploads/ bitnami@MEDIA_SERVER_IP:/opt/wakilisha-media/wp-content/uploads/
```

3. Verify the mirror.

```bash
WAKILISHA_MEDIA_MIRROR_BASE_URL=https://media.wakilisha.africa node scripts/audit/verify-lightsail-media-mirror.mjs
```

4. Only after verification passes, route `/wp-content/uploads/*` in Cloudflare.

Preferred first move: proxy the old path to the Lightsail media origin so old URLs remain stable.

## Rollback

If images break, disable the Cloudflare media route and send traffic back to the old WordPress upload path.

## Done criteria

- Media URL manifest exists.
- Lightsail mirror verification passes.
- Cloudflare media route is applied.
- Old upload URLs still resolve.
- Magazine, artist, release, track, newsletter, and SEO surfaces render images correctly.
