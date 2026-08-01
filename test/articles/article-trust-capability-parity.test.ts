import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

function roleBlock(
  source: string,
  role: string,
): string {
  const match = source.match(
    new RegExp(
      `${role}: \\[(.*?)\\],\\n`,
      "s",
    ),
  );

  if (!match) {
    throw new Error(
      `Capability matrix row missing: ${role}`,
    );
  }

  return match[1];
}

const TRUST_CAPABILITIES = [
  "view_trust_records",
  "manage_sources",
  "review_sources",
  "withdraw_sources",
  "manage_citations",
  "manage_credits",
] as const;

describe("Article trust capability parity", () => {
  it("includes every trust capability in the frontend capability type", () => {
    const source = read(
      "src/services/userRoles.ts",
    );

    for (const capability of TRUST_CAPABILITIES) {
      expect(source).toContain(
        `| "${capability}"`,
      );
    }
  });

  it("reads role capabilities from the database authority and falls back only on read failure", () => {
    const source = read(
      "src/services/userRoles.ts",
    );

    expect(source).toContain(
      '.from("role_capabilities")',
    );
    expect(source).toContain(
      "await fetchRoleCapabilities(roles)",
    );
    expect(source).toContain(
      "if (error || !data)",
    );
    expect(source).toContain(
      "return uniqueCapabilities(roles)",
    );
    expect(source).toContain(
      "return capabilities;",
    );
    expect(source).not.toContain(
      "return capabilities.length",
    );
  });

  it("matches the Phase 3A seeded trust grants", () => {
    const source = read(
      "src/services/userRoles.ts",
    );

    const expected = {
      administrator: TRUST_CAPABILITIES,
      editor: [
        "view_trust_records",
        "manage_sources",
        "manage_citations",
        "manage_credits",
      ],
      reviewer: [
        "view_trust_records",
        "review_sources",
      ],
      registry_editor: [
        "view_trust_records",
        "manage_sources",
        "manage_citations",
      ],
    } as const;

    for (
      const [role, capabilities]
      of Object.entries(expected)
    ) {
      const block = roleBlock(source, role);

      for (const capability of capabilities) {
        expect(block).toContain(
          `"${capability}"`,
        );
      }
    }
  });

  it("does not grant trust capabilities to the Author fallback matrix", () => {
    const source = read(
      "src/services/userRoles.ts",
    );
    const author = roleBlock(
      source,
      "author",
    );

    for (const capability of TRUST_CAPABILITIES) {
      expect(author).not.toContain(
        `"${capability}"`,
      );
    }
  });

  it("keeps the Add Credit action gated by manage_credits", () => {
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleTrustPanel.tsx",
    );

    expect(panel).toContain(
      'adminUser.can("manage_credits")',
    );
  });
});
