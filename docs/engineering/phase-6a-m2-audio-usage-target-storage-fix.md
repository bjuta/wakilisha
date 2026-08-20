# Phase 6A M2 Audio usage-target storage fix

Date: 20 August 2026

## Trigger

The first governed production acceptance call to:

`public.set_audio_publication_master(...)`

failed before any Audio master could be attached.

PostgreSQL rejected the command-owned insert with:

`media.usage_links_target_kind_check`

because `audio_publication` was absent from the Phase 4 storage target vocabulary.

The command transaction rolled back completely.

## Root cause

Phase 6A M2 correctly introduced an Audio-owned writer for exact master placement and intentionally did **not** broaden the generic Media attachment API.

However, those are two different boundaries:

1. `media.usage_links` must be able to **store** the new canonical target kind.
2. `public.attach_media_usage()` must remain unable to **authorize** generic Audio publication attachment.

M2 implemented the second boundary but missed the first.

## Fix

Add only:

`audio_publication`

to `media.usage_links_target_kind_check`.

Do not modify:

- `public.attach_media_usage()`;
- `media.validate_usage_target()`;
- `media.usage_role_matches_target()`;
- `public.set_audio_publication_master()`;
- Audio version semantics;
- Media worker behavior;
- generated derivative authority.

The generic validator therefore continues to reject Audio publication targets while the Audio-owned command can persist its governed exact-master usage.

## Acceptance

The repair is accepted only when:

1. fresh migration replay reaches accepted main cleanly;
2. this migration applies alone;
3. the permanent verifier passes;
4. generic Media target validation remains closed to `audio_publication`;
5. the original production acceptance fixture can attach its exact master through `public.set_audio_publication_master()`;
6. no direct Media usage write is required;
7. M2 processing acceptance then continues from that governed master.
