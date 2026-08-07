import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("index.html", "utf8");

const cspMatch = html.match(
  /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/,
);

if (!cspMatch) {
  throw new Error("Content-Security-Policy meta tag is missing.");
}

const policy = cspMatch[1];

const directiveTokens = (name: string) => {
  const directive = policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));

  if (!directive) {
    throw new Error(`Missing CSP directive: ${name}`);
  }

  return directive.split(/\s+/).slice(1);
};

describe("Phase 4B M3 browser CSP contract", () => {
  it("permits WebAssembly hashing without enabling general JavaScript eval", () => {
    const scriptSrc = directiveTokens("script-src");

    expect(scriptSrc).toContain("'wasm-unsafe-eval'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("permits governed Media derivative fetches", () => {
    const connectSrc = directiveTokens("connect-src");

    expect(connectSrc).toContain("https://media.wakilisha.africa");
  });
});
