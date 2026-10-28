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

## Integrated WebKit failure and activation repair (28 October 2026)

The first **integrated** browser acceptance at `595803c6` FAILED. At assertion timeout the new player created **zero** `AudioBufferSourceNode` instances, zero analysers, and one master gain node. This is *not* evidence that two buffer sources cannot mix (the separate prototype already passed): the native-to-buffer activation did not complete.

The original test used two 12-second 8kHz WAV previews but did not prove native playback was still active before selecting Smart Mix. The test now uses two 24-second 16kHz WAV previews—the already proven decode format—and requires active advancing native playback immediately before enabling Smart Mix.

The player previously tested `isRunning` synchronously in a React effect; Safari's gesture-initiated `AudioContext.resume()` may settle later and the effect had no reactive retry. It now performs a bounded wait for the **already gesture-woken** audio context without pausing native playback, then checks the same session lease before any decode or handoff. Development-only activation diagnostics record whether the path was skipped for state/session reasons or blocked at fetch/decode/source start. This is a plausible race correction, **not yet a proven root cause**.

The next local gate is ONLY the integrated WebKit iPhone-profile actual-player test at exact candidate HEAD. On failure, `CH25_BUFFER_PLAYER_DIAGNOSTICS` includes `gates` and native-media state. Do not broaden changes or advance release gates until it passes.

## Integrated WebKit V2 — dual PCM passed; final selector was wrong

The owner ran exact candidate `537c0d4bb5823f01f23afb447975457c169796de`. The test failed at `test/ui-browser/music-provenance-slice3.spec.ts:752:70`, **after** the decoded-buffer overlap poll completed. No `CH25_BUFFER_PLAYER_DIAGNOSTICS` was emitted because the overlap assertion did not throw. The test proved at least two concurrently nonzero decoded buffer analysers, but its original gain condition required only two positive gains total (which could be master + one deck). Full audible dual-deck gain overlap still needed a stricter assertion.

The line-752 failure was a **test selector mismatch**, not evidence of a queue/runtime fault. The test had opened the full mobile player, which intentionally unmounts `PlayerCompactSurface` and hides the music dock. The stale final selector searched those absent/hidden surfaces rather than the visible `[data-wk-player-overlay] [data-wk-player-full]` title. Fixed the final assertion to the actual full-player `h1` title and strengthened the gain assertion to **three** simultaneous nonzero gains (master + two independent decks), alongside two live PCM analysers. These are test-only changes. No player implementation change was justified by the line-752 failure.

The strengthened integrated test **PASSED** on the owner's Mac WebKit iPhone profile at exact commit `f57ae854c98b023f5a8456ddfdefd62bd79b06eb`, 28 October 2026:
- `CH25_INTEGRATED_WEBKIT_V3=PASS`
- Playwright `webkit-mobile-audio`: **1 passed (49.0s)**, one test completed in 45.3s.
- Started with native playback, selected Smart Mix through the real mobile full-player controls.
- Require two simultaneous decoded PCM analyser signals, **three** nonzero gain nodes (master + both buffer decks), zero `MediaElementAudioSourceNode` attachments, and the visible full-player title advancing to the second recording.
- This closes only the integrated **simulated iPhone WebKit local fixture** gate. It does **not** prove real-catalogue CORS/transport, all player controls, audible physical-iPhone Safari or Production readiness.

**Next:** local scoped player tests, Chromium version of the same browser assertion and full candidate build, then real-catalogue, physical iPhone and post-deploy acceptance. GitHub Actions remain unavailable/exhausted.

## Local player-contract regression gate — inherited test drift and architecture migration

The 28 October local Mac gate at candidate `2e03d135841c40184c45836a74f1428004afc67a` recorded `CH25_DIFF_CHECK=PASS` and `CH25_PLAYER_CONTRACTS=FAIL` with **28 passed and 3 failed** over the three requested test files. Chromium and the candidate build **were not run** because the gate stopped.

Repository-side review identified two test-contract classes requiring maintenance, not a new audible-mixer runtime patch:

- `test/player/canonical-media-runtime-commit1.test.ts` still required the retired `mixEngineRef.current.prepare(activeAudio, source)`, `signalMixerDeckReady`, `standby.crossOrigin`, and `mixEngineRef.current.prepare(standby, source)` MediaElement-source path. The new engine must **not** call these WebKit-incompatible methods. The two older tests were replaced with explicit native-first playback, provider recovery, both-track decoded preflight, active-session validation, nonzero PCM before native pause, bounded buffer/source semantics, and zero MediaElement source creation.
- `test/player/media-first-player-phase-6b.test.ts` required `<Suspense fallback={null}>`, while the actual `ResponsiveAppLayout.tsx` now uses a visible `role="status"` loading placeholder inside a presentation error boundary. Both the old test and source file have **identical blob SHAs on main and the candidate**, proving this mismatch existed independently of the Chapter 25 branch. Updated the assertion to protect the current accessible loading UI instead. A second obsolete expectation in that same test required `ResizeObserver`, also absent from both identical source revisions; replaced it with the active `inert` underlay and `documentElement` scroll-lock contract.

The maintenance change affects **only those two test files and this engineering note**, not the buffer transport or player UI/runtime. Repository source-check verification found all updated literal contracts present. However, that is **not** a substitute for the Mac Vitest execution. Next: run only those three scoped test files on the exact updated branch commit. If green, continue Chromium parity and the full build without rerunning the already-green WebKit iPhone-profile test. GitHub Actions remain exhausted and must not be used.

## Acceptance status and gates

**Integrated local WebKit fixture PASS; overall release acceptance remains OPEN.** The standalone WebKit architecture and actual-player WebKit dual-PCM/dual-gain tests are accepted, but real-catalogue transport, local build/regressions, physical iPhone and Production acceptance remain unverified. Before any PR, merge or deployment:

1. Mac local WebKit iPhone-profile **actual player** test must pass with two concurrent decoded-buffer PCM streams and no MediaElementAudioSource attachments.
2. Mac Chromium and existing scoped player/queue/browser contracts must pass locally; build and diff checks must pass.
3. Real WAKILISHA catalogue through the candidate frontend and production-like `/__wk-mix` transport must exhibit dual decoded PCM and controlled gain curves. No mock media may substitute for this release gate.
4. Physical iPhone Safari must audibly confirm crossfade, Smart Mix, Pause/Resume, Seek, next/previous, volume and no silence/overlap on unsupported providers. A WebKit emulation is not this gate.
5. Only after all tests: normal reviewed PR and canonical Production frontend deployment with post-deploy acceptance. SQL and Supabase Edge Function changes are out of scope.

## Runtime and CI authority

GitHub Actions allocation is exhausted. **Do not create, dispatch or rerun GitHub Actions workflows for this work.** All acceptance is local browser/client testing and documented GitHub commits, without GitHub Actions as a release gate. The accidental isolated Actions workflow was deleted from the experiment branch in `1c55dc4c`.

The failed MediaElement repair is preserved at `fix/ch25-live-mixer-handoff-20261028`, but **must not** be merged into the decoded-buffer implementation. The buffer implementation starts from the independent successful feasibility proof, which itself branches from exact merged `main` `49bb0120`.

No PR has been opened, no migration has been applied, no Edge Function has been deployed, and Production has not been changed by this candidate.
