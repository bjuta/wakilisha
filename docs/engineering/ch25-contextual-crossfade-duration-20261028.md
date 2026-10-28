# Chapter 25 — contextual Crossfade duration control

Date: 28 October 2026
Status: **implemented in isolated candidate; local browser and build acceptance pending**

## Physical-iPhone observation

Following the Production deployment of the decoded-buffer Smart Mix mixer (`a522abd05cea6be09db73d70795098e0d0908112`), the listener reported that crossfade is working while listening on an iPhone. They also observed that the duration slider in the **More → Playback → Transitions** sheet was placed *after Smart Mix*, below the fold, despite Crossfade being selected. That placement obscured the setting's relationship to Crossfade.

## UX contract

- The order of transition choices remains **Off → Crossfade → Smart Mix**.
- Selecting **Crossfade** reveals the **Crossfade duration** slider **directly inside/below the Crossfade choice**, before Smart Mix; the selected option and slider share a subtle background surface.
- Selecting **Off** or **Smart Mix** removes the slider from the DOM entirely; no empty slider space remains.
- Switching back to Crossfade restores the saved value; it never silently resets the listener's choice.
- Range and label remain **3–12 seconds**, clamped to the existing policy; keyboard/pointer support and descriptive aria labels remain on the shared WAKILISHA slider.
- The change is limited to the shared `TransitionOptions` surface so More and Listening settings share one behavior. No native browser controls are introduced.
- No changes to audio playback, buffer transport, media delivery, preview rights, user settings persistence, SQL, Edge Functions, or deployment infrastructure.

## Regression ownership

The existing `test/ui-browser/music-provenance-slice3.spec.ts` now includes a mobile interaction test that verifies conditional visibility, position of the slider **between Crossfade and Smart Mix**, keyboard duration edit and value preservation across Off/Smart Mix mode changes. `webkit-mobile-audio` includes this test through its existing project; Chromium uses the same spec. No new browser test file or GitHub Actions workflow.

## Release exit

Run exact-head, isolated local Chromium and WebKit mobile UI tests and the full build. Review/merge the small frontend PR and deploy **the exact merged main** through `scripts/deploy/production-frontend.sh` with Nginx and artifact-parity receipts. Physical iPhone visual acceptance is the post-deployment UX confirmation.

User approval to adjust the slider does **not** authorize skipping the release runner or claiming a deployment before it occurs.
