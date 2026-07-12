# WAKILISHA responsive media delivery

Original media remains available at:

`https://media.wakilisha.africa/uploads/...`

Responsive derivatives use fixed-width paths:

`https://media.wakilisha.africa/__image/w640/uploads/...`

Supported widths:

- 320
- 480
- 640
- 768
- 960
- 1280
- 1600

Production requirements:

- `libnginx-mod-http-image-filter`
- `ngx_http_image_filter_module.so` loaded
- HTTP/2 enabled on the media TLS listeners
- `wakilisha-media-responsive-images.conf` included in the media server block

The derivative endpoint does not alter original media files or stored URLs.

Initial production backup:

`/etc/nginx/wakilisha-backups/media-responsive-20260712-184225`

Verified sample:

`/uploads/1783081637295-4db749fb-aerial-view-of-nairobi-city-on-a-cloudy-day_.png`

Verified 640-pixel derivative:

- HTTP 200
- HTTP/2
- image/png
- 640 × 360
- 156,486 bytes
- `X-Wakilisha-Image-Width: 640`
