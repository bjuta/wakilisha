# Chapter 25 — WebKit decoded-buffer mixer candidate (28 October 2026)

## Decision and evidence

Chapter 25's merged dual-`HTMLAudioElement` design is **not functionally accepted** on iPhone. Production candidate `49bb01208b3bc55a5e0f9484685360847c0ae0b2` played real previews on Chromium, but only native element volume values and media clocks overlapped; no dual decoded PCM graph was proven. Later isolated WebKit runs showed both media-element `play()` promises resolving with advancing media positions, but the second `MediaElementAudioSourceNode` analyser remained zero, even with an untouched standby deck. Repeating that design was explicitly stopped.

A local physical-Mac Playwright **WebKit iPhone-profile** test on 28 October 2026 passed:

- `test/ui-browser/ch25-webkit-buffer-mixer-proof.spec.ts`
- `CH25_WEBKIT_BUFFER_ARCHITECTURE=PASS` (one test, two fetched/decoded `AudioBufferSourceNode` streams in one `AudioContext`, nonzero PCM and separately changing gains)
- This proved the proposed browser *primitive*, not WAKILISHA's catalogue integration or physical iPhone sound.

## Candidate boundaries

`src/services/player/WakilishaPreviewBufferMixer.ts` is a short-preview-only decoded-buffer transport. It uses the existing `resolveMixableAudioSource` allowlist and `/__wk-mix` same-origin iTunes preview transport, never fetches arbitrary external streams, omits credentials, caps the transferred preview bytes at 2,500,000 and decoded duration at 65 seconds, rejects silent decodes, holds at most two decoded buffers, and uses the Web Audio sample clock and equal-power gain ramps.

`PlayerContext` continues immediate native playback. When Crossfade/Smart Mix is enabled it wakes the buffer context **inside the gesture**, decodes the current **and next** playable preview, and silently starts a buffer source. Only actual nonzero analyser PCM permits moving auditory ownership from native playback. The previous native element is not attached to a MediaElementAudioSourceNode. The buffer transport owns position, volume, pause/resume, seek and eligible automatic queue crossfade while active. Unsupported providers and unavailable/invalid media retain the existing native/player path.

`test/ui-browser/music-provenance-slice3.spec.ts` now checks real **in-player** Smart Mix selection after native playback begins, same-origin HTTP WAV delivery with byte ranges, and simultaneous nonzero PCM through two genuine `AudioBufferSourceNode` streams, rather than merely counting `HTMLAudioElement.currentTime`.

## Acceptance status and gates

**Candidate runtime implementation is UNVERIFIED.** A standalone WebKit prototype passing does not certify this integration. Before any PR, merge or deployment:

1. Mac local WebKit iPhone-profile **actual player** test must pass with two concurrent decoded-buffer PCM streams and no MediaElementAudioSource attachments.
2. Mac Chromium and existing scoped player/queue/browser contracts must pass locally; build and diff checks must pass.
3. Real WAKILISHA catalogue through the candidate frontend and production-like `/__wk-mix` transport must exhibit dual decoded PCM and controlled gain curves. No mock media may substitute for this release gate.
4. Physical iPhone Safari must audibly confirm crossfade, Smart Mix, Pause/Resume, Seek, next/previous, volume and no silence/overlap on unsupported providers. A WebKit emulation is not this gate.
5. Only after all tests: normal reviewed PR and canonical Production frontend deployment with post-deploy acceptance. SQL and Supabase Edge Function changes are out of scope.

## Runtime and CI authority

GitHub Actions allocation is exhausted. **Do not create, dispatch or rerun GitHub Actions workflows for this work.** All acceptance is local browser/client testing and documented GitHub commits, without GitHub Actions as a release gate. The accidental isolated Actions workflow was deleted from the experiment branch in `1c55dc4c`.

The failed MediaElement repair is preserved at `fix/ch25-live-mixer-handoff-20261028`, but **must not** be merged into the decoded-buffer implementation. The buffer implementation starts from the independent successful feasibility proof, which itself branches from exact merged `main` `49bb0120`.

No PR has been opened, no migration has been applied, no Edge Function has been deployed, and Production has not been changed by this candidate.
