import { describe, expect, it } from "vitest";
import fs from "node:fs";

const cors = fs.readFileSync(
  "ops/nginx/wakilisha-media-cors-headers.conf",
  "utf8",
);

const readme = fs.readFileSync(
  "ops/nginx/README-responsive-images.md",
  "utf8",
);

describe("Phase 4A public Media CORS contract", () => {
  it("allows only the production application origin", () => {
    expect(cors).toContain(
      'add_header Access-Control-Allow-Origin "https://wakilisha.africa" always;',
    );
    expect(cors).not.toContain(
      'Access-Control-Allow-Origin "*"',
    );
    expect(cors).not.toContain(
      "Access-Control-Allow-Credentials",
    );
  });

  it("limits the contract to public GET and HEAD Media locations", () => {
    expect(cors).toContain(
      "inside public Media",
    );
    expect(readme).toContain(
      "Original",
    );
    expect(readme).toContain(
      "uploads and every fixed-width derivative location",
    );
    expect(readme).toContain(
      "/etc/nginx/snippets/wakilisha-media-cors-headers.conf",
    );
  });

  it("records the safe deployment and verification requirements", () => {
    expect(readme).toContain("timestamped backup");
    expect(readme).toContain("nginx -t");
    expect(readme).toContain(
      "both an original upload and a responsive derivative",
    );
  });
});
