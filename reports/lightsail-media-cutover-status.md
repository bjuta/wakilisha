# Lightsail Media Cutover Status

## Status

Temporary Cloudflare redirect is enabled for old WordPress upload URLs:

- Source: https://wakilisha.africa/wp-content/uploads/*
- Target: https://media.wakilisha.africa/wp-content/uploads/*
- Status code: 302 Temporary Redirect

Do not change this to 301 until the redirect has been observed safely.

## Verified media coverage

- Media origin: https://media.wakilisha.africa
- Combined media paths checked: 86
- Passed: 86
- Failed: 0

## Notes

The live-page smoke scan found more media paths than the original code/reference manifest.

One old live reference was broken on the WordPress origin:

/wp-content/uploads/2026/03/Beef-The-Rivalries-That-Shaped-Kenyan-Music_WAKILISHA-1160x648.jpg

The real image was found at:

/wp-content/uploads/2026/06/Beef_The-Rivalries-That-Shaped-Kenyan-Music_WAKILISHA.jpg

The Lightsail mirror now serves both paths successfully.

## Route note

The following paths return 404 on the old WordPress site and are not part of this media cutover:

- /magazine/
- /releases/
- /tracks/

This is expected legacy behavior.
