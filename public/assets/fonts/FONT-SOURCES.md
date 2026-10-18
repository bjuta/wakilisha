# WAKILISHA Workbook v4 font authority

Only bundled, licensed Figtree (weights 400–800) and IBM Plex Mono (weights 400 and 500) are active runtime design fonts. All six WOFF2 subsets and OFL sidecars are in `public/assets/fonts/workbook/`, with exact SHA-256 values in `wakilisha-font-manifest.json`. `scripts/performance/audit-font-delivery.mjs` verifies assets and rejects retired design font faces. Fonts load locally under the existing `font-src 'self'` policy. The public logo is the existing Site Identity artwork, not an imitated font mark.
