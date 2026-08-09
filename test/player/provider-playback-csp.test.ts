import {
  describe,
  expect,
  it,
} from "vitest";
import {
  readFileSync,
} from "node:fs";

const html =
  readFileSync(
    "index.html",
    "utf8",
  );

const match =
  html.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/,
  );

if (!match) {
  throw new Error(
    "Content-Security-Policy meta tag is missing.",
  );
}

const policy =
  match[1];

function tokens(
  name: string,
): string[] {
  const directive =
    policy
      .split(";")
      .map(
        (part) =>
          part.trim(),
      )
      .find(
        (part) =>
          part.startsWith(
            `${name} `,
          ),
      );

  if (!directive) {
    throw new Error(
      `Missing CSP directive: ${name}`,
    );
  }

  return directive
    .split(/\s+/)
    .slice(1);
}

describe(
  "Phase 5B provider playback CSP",
  () => {
    it(
      "permits YouTube runtime playback",
      () => {
        expect(
          tokens(
            "script-src",
          ),
        ).toContain(
          "https://www.youtube.com",
        );

        expect(
          tokens(
            "frame-src",
          ),
        ).toContain(
          "https://www.youtube.com",
        );
      },
    );

    it(
      "permits SoundCloud Widget playback",
      () => {
        expect(
          tokens(
            "script-src",
          ),
        ).toContain(
          "https://w.soundcloud.com",
        );

        expect(
          tokens(
            "frame-src",
          ),
        ).toContain(
          "https://w.soundcloud.com",
        );

        expect(
          tokens(
            "child-src",
          ),
        ).toContain(
          "https://w.soundcloud.com",
        );
      },
    );
  },
);
