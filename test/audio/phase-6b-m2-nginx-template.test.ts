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

  it("keeps the public feed and enclosure routes bound to the Audio delivery Edge adapter", () => {
    expect(nginx).toContain("/audio/enclosures/");
    expect(nginx).toContain("^/shows/");
    expect(nginx).toContain("feed\\.xml");
    expect(nginx).toContain("functions/v1/audio-public-delivery?kind=enclosure");
    expect(nginx).toContain("functions/v1/audio-public-delivery?kind=rss");
    expect(nginx).not.toContain("/audio/shows/");
  });
});
