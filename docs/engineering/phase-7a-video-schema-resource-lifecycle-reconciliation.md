# Phase 7A Video Schema / Resource Lifecycle Reconciliation

Status: K0/K1 DEPENDENCY ADDENDUM

Applies to:

`docs/engineering/phase-7a-video-authority-schema-design.md`

## Reason for this addendum

The accepted Video schema design correctly states that shared lifecycle and current-version position belong to `editorial.resources`, but its proposed `editorial.video_publication_resources` shape also lists four typed `current_*_version_id` mirror columns by analogy with Playlist and Audio.

Phase 7A K0/K1 exists because that historical duplication has now been proven to be platform debt rather than a pattern new domains should copy.

## Reconciliation

Once K1 Resource lifecycle convergence is accepted, the Video Resource binding contract is:

```text
editorial.video_publication_resources

resource_id uuid primary key
resource_kind text not null
publication_id uuid not null unique
```

Allowed Resource kinds remain:

- `standalone_video`
- `video_episode`

Video lifecycle position is stored only on the canonical Resource primitive:

- `editorial.resources.current_working_version_id`
- `editorial.resources.current_submitted_version_id`
- `editorial.resources.current_approved_version_id`
- `editorial.resources.current_published_version_id`

Those pointers reference global `editorial.resource_versions` identity after K1.

Video immutable versions remain typed in `video.publication_versions`. The Video version UUID is registered as the same global Resource Version UUID under version type `video_publication_version`.

## Compatibility rule

Playlist and Audio typed pointer columns may remain synchronized compatibility mirrors during migration because production commands already depend on them.

That compatibility exception is non-renewable.

Video is a new domain and has no legacy writer dependency, so it must not create a fresh typed lifecycle-pointer mirror.

## Effect on the accepted Video design

This addendum changes only the lifecycle-pointer portion of `editorial.video_publication_resources` and the Resource Version registration dependency.

It does not alter the accepted Video decisions for:

- `standalone_video` and `video_episode` Resource kinds
- shared Show / Show Episode authority
- immutable Video Source identity
- Video classifications
- captions/subtitles
- chapters
- Media usage roles
- Discovery reuse
- no `video_review_events` in the first Video migration
- no public Video product in the first authority slice

## Implementation sequencing

1. K0 Resource Version Foundation
2. K0 independent preview acceptance and merge
3. K1 Resource lifecycle convergence
4. K1 independent preview acceptance and merge
5. resume the first Video authority migration from the accepted schema design plus this reconciliation

Video must not begin SQL implementation between K0 and K1.
