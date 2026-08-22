import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const nginx = readFileSync(
  "ops/nginx/audio-public-delivery.conf.template",
  "utf8",
);

describe("Phase 6B M2 production Nginx transport template", () => {
  it("quotes the enclosure regex so Nginx does not parse the UUID quantifier as config syntax", () => {
    expect(nginx).toContain(
      'location ~ "^/audio/enclosures/(?<wk_audio_publication_id>[0-9a-fA-F-]{36})\\.mp3$" {',
    );
    expect(nginx).not.toContain(
      "location ~ ^/audio/enclosures/(?<wk_audio_publication_id>[0-9a-fA-F-]{36})\\.mp3$ {",
    );
  });

  it("keeps the Supabase upstream hostname static while routing dynamic public identity through args", () => {
    expect(nginx).toContain(
      'set $args "kind=enclosure&id=$wk_audio_publication_id";',
    );
    expect(nginx).toContain('set $args "kind=rss&show=$wk_show_slug";');
    expect(nginx.match(/rewrite \^ \/functions\/v1\/audio-public-delivery break;/g)).toHaveLength(2);
    expect(
      nginx.match(/proxy_pass https:\/\/__SUPABASE_PROJECT_REF__\.supabase\.co;/g),
    ).toHaveLength(2);
    expect(nginx).not.toMatch(/proxy_pass[^\n]*\$/);
    expect(nginx).not.toContain("resolver ");
  });

  it("keeps the public feed and enclosure routes bound to the Audio delivery Edge adapter", () => {
    expect(nginx).toContain("/audio/enclosures/");
    expect(nginx).toContain("^/shows/");
    expect(nginx).toContain("feed\\.xml");
    expect(nginx).toContain('kind=enclosure&id=$wk_audio_publication_id');
    expect(nginx).toContain('kind=rss&show=$wk_show_slug');
    expect(nginx).not.toContain("/audio/shows/");
  });
});
