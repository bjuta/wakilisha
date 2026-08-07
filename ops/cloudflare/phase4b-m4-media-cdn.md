# Phase 4B M4 Media CDN Activation

## Purpose

Before M4 CDN activation, `media.wakilisha.africa` resolved directly to the
Lightsail origin.

Production acceptance completed on 8 August 2026. The hostname is now proxied
through Cloudflare and the live Media regression suite passed through that
proxied hostname.

## DNS

Set the existing `media.wakilisha.africa` record to Proxied.

Do not change the Lightsail origin address during this step.

## TLS

Use Full (strict).

The Lightsail origin already presents a valid certificate for
`media.wakilisha.africa`.

## Cache rules

Cache public immutable Media:

- URI path starts with `/derivatives/`
- URI path starts with `/uploads/`

Respect the origin immutable cache headers.

Bypass cache for:

- URI path starts with `/__admin/`
- URI path starts with `/__private/`
- URI path starts with `/masters/`
- URI path starts with `/derived-objects/`
- URI path starts with `/private-files/`

Do not create a cache rule that caches POST, PUT, DELETE, or authenticated
control-plane responses.

## Acceptance

After proxy activation:

1. DNS for `media.wakilisha.africa` must no longer resolve directly to
   `35.176.52.252`.
2. A public derivative must return HTTP 200.
3. The derivative response must contain a Cloudflare response marker such as
   `cf-ray`.
4. Direct master delivery must remain HTTP 404.
5. Direct canonical derivative-object delivery must remain HTTP 404.
6. Direct transcript/caption protected paths must remain HTTP 404.
7. A valid signed private URL must still return the protected file.
8. An expired or tampered signed URL must fail.
9. The narrow image/PDF/text upload lane must remain healthy.
10. Resumable audio/video part upload, finalize, and processing must remain
    healthy.

## Rollback

If upload or private delivery regresses:

1. switch the Media DNS record back to DNS only
2. wait for DNS propagation
3. confirm the origin route returns to `35.176.52.252`
4. rerun the direct origin Media acceptance
5. do not alter canonical Media rows or immutable files

## Production acceptance record

Phase 4B M4 live acceptance: PASS

Accepted on 8 August 2026.

Observed through the proxied production hostname:

- DNS returned Cloudflare addresses instead of `35.176.52.252`.
- Public derivative request 1 returned `HTTP 200`.
- Public derivative request 1 returned `cf-cache-status: MISS`.
- Public derivative request 1 contained a `cf-ray` response marker.
- Public derivative request 2 returned `HTTP 200`.
- Public derivative request 2 returned `cf-cache-status: HIT`.
- Public derivative request 2 returned `age: 5`.
- Cold and warm derivative responses had identical SHA-256 bytes.
- Direct protected transcript storage returned `HTTP 404`.
- Direct protected storage returned `cf-cache-status: DYNAMIC`.
- The unsigned private gateway returned `HTTP 403`.
- The unsigned private gateway returned `cache-control: private, no-store`.
- The unsigned private gateway returned `cf-cache-status: DYNAMIC`.
- Fresh signed private delivery: PASS.
- Expired signed private delivery: PASS.
- Tampered signed private delivery: PASS.
- Protected cache behavior: PASS.
- Image upload after proxy activation: PASS.
- PDF upload after proxy activation: PASS.
- Transcript upload after proxy activation: PASS.
- Fresh resumable WAV pause and resume from accepted parts: PASS.
- WAV processing, ready state, and playback: PASS.
- Fresh resumable MP4 processing, ready state, and playback: PASS.

The rollback procedure above remains the accepted emergency path if the proxied
Media hostname regresses in future.
