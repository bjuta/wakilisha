# Signed-out Settings and platform-independent iconography

## Scope (October 23, 2026)

- Signed-out listeners receive **Sign In** and the existing theme toggle in the sidebar, but **no Settings** action. Both the full desktop sidebar and the responsive drawer obey this. Signed-in listeners retain Settings under **You**, with no permission, route, or settings-state mutation.
- WAKILISHA's primary navigation glyphs use the existing locally-built `wakilisha-lucide.svg` sprite. Remixicon glyphs remain mapped to the existing locally built SVG-mask compatibility sheet, not native browser icons, webfont delivery, or a CDN.
- Replace OS-native flag emoji used as interface pictograms in the Artist country picker, claimant phone picker, and both pavilion renderers with `CountryIdentityMark`. It combines the existing WAKILISHA Globe2 SVG with an explicit ISO alpha-2 country code. Names and calling codes, lookup, validation, and stored ISO codes are unchanged.
- The eight quick reaction control symbols now render bundled WAKILISHA vector glyphs; known reactions and legacy reaction badges likewise prefer the bundled sprite. **Reaction values are not rewritten**. Arbitrary user-selected emoji in comments and the expanded emoji selection library remain expressive content and continue to round-trip through the existing Community reaction contract. This distinction keeps user data intact while removing native emoji *as UI icons*.
- Do not introduce native `select` or `details` controls, system icon fonts, remote icon CDNs, or new icon packages in these surfaces.

## Site-wide icon visual authority (owner clarification, 23 October 2026)

The requirement is not limited to Apple-style emoji. Every WAKILISHA-controlled interface icon on public, admin, desktop and phone surfaces must render from WAKILISHA-owned, locally bundled vector assets and match, or be visibly consistent with, the reference workbook.

A bundled upstream icon sprite solves platform rendering, but does not prove shape parity with the workbook. The local Lucide SVG sprite is the current primary family. The locally bundled Remixicon mask sheet remains compatibility for older controls, not permission to keep mismatched icon styles permanently. New WAKILISHA UI controls should use `WkIcon` and verified workbook-semantic artwork.

The Post action menus and expanded-reaction toggle now use that primary family, alongside the quick-reaction controls, country identity marks, and navigation in this PR. This increment does not assert a completed site-wide artwork/shape audit. Preserve user-authored emoji data and reaction codes. Arbitrary emoji content is not itself a WAKILISHA icon.

WAKILISHA can replace visible in-page controls, including picker and player interfaces. A website cannot replace the browser address bar, permission/security dialogs, or OS accessibility UI. Preserve semantic HTML for accessibility without yielding visible product chrome to the platform.

Workbook shape-level verification remains a release acceptance requirement, including both themes and mobile/desktop. Neither CI nor a locally hosted sprite establishes pixel fidelity by itself.

## Acceptance

Source contracts prove guest Settings absence on desktop/mobile, signed-in Settings availability, bundled country symbols and the new reaction controls. Real-browser acceptance checks both sidebar modes and verifies that menu icon `svg use` points to the local sprite. Existing mandatory icon-sprite, Remixicon compatibility, performance and protected Critical Core/Browser/aggregate gates remain in force.

Frontend-only; no database migration, Edge Function, theme infrastructure, auth policy, or preview runtime. Deploy after exact-head CI and merge using the canonical Production frontend script in a clean isolated clone, protecting the user's WK100 worktree.
