#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as Lucide from "lucide-react";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const iconComponentPath = path.join(
  srcRoot,
  "components/design-system/Icon.tsx",
);
const spritePath = path.join(
  srcRoot,
  "assets/icons/wakilisha-lucide.svg",
);
const licensePath = path.join(
  srcRoot,
  "assets/icons/LUCIDE-LICENSE.txt",
);
const lucideLicensePath = path.join(
  root,
  "node_modules/lucide-react/LICENSE",
);
const checkOnly = process.argv.includes("--check");

const lucideRuntimeNames = new Set(
  Object.keys(Lucide).filter(
    (name) => /^[A-Z][A-Za-z0-9]*$/.test(name),
  ),
);

const discovered = new Set();
let wkIconCallsites = 0;
let dynamicWkIconCallsites = 0;

function walk(directory) {
  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    const full = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(full);
      continue;
    }

    if (!/\.(ts|tsx)$/.test(entry.name)) {
      continue;
    }

    if (full === iconComponentPath) {
      continue;
    }

    const source = fs.readFileSync(full, "utf8");
    const sourceFile = ts.createSourceFile(
      full,
      source,
      ts.ScriptTarget.Latest,
      true,
      entry.name.endsWith(".tsx")
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS,
    );

    function visit(node) {
      if (
        (ts.isStringLiteral(node)
          || ts.isNoSubstitutionTemplateLiteral(node))
        && lucideRuntimeNames.has(node.text)
      ) {
        discovered.add(node.text);
      }

      if (
        ts.isJsxSelfClosingElement(node)
        || ts.isJsxOpeningElement(node)
      ) {
        const tagName = node.tagName.getText(sourceFile);
        if (tagName === "WkIcon") {
          wkIconCallsites += 1;

          const nameAttribute = node.attributes.properties.find(
            (attribute) =>
              ts.isJsxAttribute(attribute)
              && attribute.name.getText(sourceFile) === "name",
          );

          if (
            nameAttribute
            && ts.isJsxAttribute(nameAttribute)
            && nameAttribute.initializer
            && !ts.isStringLiteral(nameAttribute.initializer)
          ) {
            dynamicWkIconCallsites += 1;
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }
}

walk(srcRoot);

const names = [...discovered].sort((a, b) =>
  a.localeCompare(b),
);

if (names.length < 100) {
  throw new Error(
    `Only ${names.length} Lucide names were discovered; refusing an incomplete WAKILISHA sprite.`,
  );
}

if (names.length > 600) {
  throw new Error(
    `${names.length} Lucide names were discovered; refusing a suspiciously broad WAKILISHA sprite.`,
  );
}

for (const name of names) {
  const component = Lucide[name];

  if (!component) {
    throw new Error(
      `Lucide component ${name} is not available at generation time.`,
    );
  }
}

function iconId(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Za-z])([0-9])/g, "$1-$2")
    .replace(/([0-9])([A-Za-z])/g, "$1-$2")
    .toLowerCase();
}

function innerMarkup(name) {
  const component = Lucide[name];
  const markup = renderToStaticMarkup(
    React.createElement(component, {
      width: 24,
      height: 24,
      strokeWidth: 2,
    }),
  );

  const match = markup.match(/^<svg[^>]*>([\s\S]*)<\/svg>$/);

  if (!match) {
    throw new Error(
      `Could not extract SVG body for Lucide icon ${name}.`,
    );
  }

  return match[1];
}

const symbols = names.map((name) => {
  return [
    `  <symbol id="wk-lucide-${iconId(name)}" viewBox="0 0 24 24">`,
    `    ${innerMarkup(name)}`,
    "  </symbol>",
  ].join("\n");
});

const sprite = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<svg xmlns="http://www.w3.org/2000/svg">',
  "  <metadata>",
  "    Generated from lucide-react for WAKILISHA. Lucide is licensed under the ISC License.",
  "    See src/assets/icons/LUCIDE-LICENSE.txt.",
  "  </metadata>",
  ...symbols,
  "</svg>",
  "",
].join("\n");

const typeUnion = names
  .map((name) => `  | "${name}"`)
  .join("\n");

const iconComponent = `import type { SVGProps } from "react";
import spriteUrl from "../../assets/icons/wakilisha-lucide.svg?url";

export type WkIconName =
${typeUnion};

type WkIconProps = SVGProps<SVGSVGElement> & {
  name: WkIconName;
  size?: number;
  strokeWidth?: number;
};

function iconId(name: WkIconName): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Za-z])([0-9])/g, "$1-$2")
    .replace(/([0-9])([A-Za-z])/g, "$1-$2")
    .toLowerCase();
}

export function WkIcon({
  name,
  size = 18,
  strokeWidth = 2,
  ...props
}: WkIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...props}
    >
      <use
        href={\`\${spriteUrl}#wk-lucide-\${iconId(name)}\`}
      />
    </svg>
  );
}
`;

if (!fs.existsSync(lucideLicensePath)) {
  throw new Error(
    `Lucide ISC license was not found at ${lucideLicensePath}.`,
  );
}

const license = fs.readFileSync(
  lucideLicensePath,
  "utf8",
);

function assertExact(file, expected, label) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `${label} is missing: ${path.relative(root, file)}`,
    );
  }

  const actual = fs.readFileSync(file, "utf8");

  if (actual !== expected) {
    throw new Error(
      `${label} is stale. Run npm run icons:generate.`,
    );
  }
}

if (checkOnly) {
  assertExact(
    iconComponentPath,
    iconComponent,
    "WAKILISHA icon component",
  );
  assertExact(
    spritePath,
    sprite,
    "WAKILISHA Lucide sprite",
  );
  assertExact(
    licensePath,
    license,
    "Lucide license copy",
  );

  console.log(
    `WAKILISHA_ICON_SPRITE_AUDIT_PASS icons=${names.length} callsites=${wkIconCallsites} dynamic=${dynamicWkIconCallsites}`,
  );
  process.exit(0);
}

fs.writeFileSync(
  iconComponentPath,
  iconComponent,
);
fs.writeFileSync(
  spritePath,
  sprite,
);
fs.writeFileSync(
  licensePath,
  license,
);

console.log(
  `WAKILISHA_ICON_SPRITE_GENERATED icons=${names.length} callsites=${wkIconCallsites} dynamic=${dynamicWkIconCallsites}`,
);
