import {
  readFileSync,
} from "node:fs";
import {
  join,
} from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const root = process.cwd();

const musicPage = readFileSync(
  join(
    root,
    "src/pages/music/page.tsx",
  ),
  "utf8",
);

const releaseHero = readFileSync(
  join(
    root,
    "src/pages/releases/detail/components/ReleaseDetailHero.tsx",
  ),
  "utf8",
);

describe(
  "music artwork authority",
  () => {
    it(
      "uses release artwork for the Music release hero",
      () => {
        expect(
          musicPage,
        ).toMatch(
          /<MusicArtwork[\s\S]{0,100}src=\{hero\.artworkUrl\}[\s\S]{0,100}alt=\{`\$\{hero\.title\} artwork`\}/,
        );
      },
    );

    it(
      "does not let an Artist image override the Music release hero",
      () => {
        expect(
          musicPage,
        ).not.toContain(
          "heroArtist?.imageUrl ||",
        );
      },
    );

    it(
      "keeps Fresh Arrivals on release artwork",
      () => {
        expect(
          musicPage,
        ).toMatch(
          /function CompactRelease[\s\S]{0,1400}src=\{release\.artworkUrl\}/,
        );
      },
    );

    it(
      "keeps canonical Release detail artwork authoritative",
      () => {
        expect(
          releaseHero,
        ).toContain(
          "src={release.artworkUrl}",
        );

        expect(
          releaseHero,
        ).toContain(
          'backgroundImage: `url("${release.artworkUrl}")`',
        );
      },
    );

    it(
      "allows Artist imagery on unrelated editorial surfaces",
      () => {
        expect(
          musicPage,
        ).toContain(
          "heroArtist?.imageUrl",
        );
      },
    );
  },
);
