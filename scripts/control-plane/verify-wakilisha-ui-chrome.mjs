#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, "src");
const BASELINE_PATH = path.join(
  ROOT,
  "scripts/control-plane/wakilisha-ui-chrome-baseline.json",
);

const FORBIDDEN_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "date",
  "datetime-local",
  "file",
  "month",
  "number",
  "password",
  "radio",
  "range",
  "reset",
  "search",
  "submit",
  "time",
  "week",
]);

const FORBIDDEN_ELEMENTS = new Map([
  ["select", "native-select"],
  ["dialog", "native-dialog-element"],
  ["details", "native-disclosure"],
  ["summary", "native-disclosure"],
  ["datalist", "native-datalist"],
  ["meter", "native-meter"],
  ["progress", "native-progress"],
]);

const NATIVE_DIALOG_CALLS = new Set(["alert", "confirm", "prompt"]);

function normalize(value) {
  return value.split(path.sep).join("/");
}

function walk(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolute));
      continue;
    }
    if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

function jsxTagName(name) {
  if (ts.isIdentifier(name)) return name.text;
  return name.getText();
}

function getAttribute(attributes, name) {
  for (const property of attributes.properties) {
    if (!ts.isJsxAttribute(property)) continue;
    if (property.name.text !== name) continue;
    return property;
  }
  return null;
}

function literalAttributeValue(attribute) {
  if (!attribute) return null;
  if (!attribute.initializer) return true;
  if (ts.isStringLiteral(attribute.initializer)) {
    return attribute.initializer.text;
  }
  if (
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression
  ) {
    const expression = attribute.initializer.expression;
    if (ts.isStringLiteral(expression)) return expression.text;
    if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
  }
  return null;
}

function issueFor(sourceFile, file, node, kind, detail) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    path: normalize(path.relative(ROOT, file)),
    kind,
    detail,
    line: position.line + 1,
    column: position.character + 1,
  };
}

function scanFile(file) {
  const sourceText = fs.readFileSync(file, "utf8");
  const scriptKind = file.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : file.endsWith(".jsx")
      ? ts.ScriptKind.JSX
      : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const issues = [];

  function inspectJsx(node, tagName, attributes) {
    const lower = tagName.toLowerCase();

    if (FORBIDDEN_ELEMENTS.has(lower)) {
      issues.push(
        issueFor(
          sourceFile,
          file,
          node,
          FORBIDDEN_ELEMENTS.get(lower),
          `<${lower}>`,
        ),
      );
    }

    if (lower === "input") {
      const typeAttribute = getAttribute(attributes, "type");
      const typeValue = literalAttributeValue(typeAttribute);
      if (
        typeof typeValue === "string" &&
        FORBIDDEN_INPUT_TYPES.has(typeValue.toLowerCase())
      ) {
        issues.push(
          issueFor(
            sourceFile,
            file,
            node,
            `native-input-${typeValue.toLowerCase()}`,
            `<input type="${typeValue}">`,
          ),
        );
      }
    }

    if (lower === "audio" || lower === "video") {
      const controls = literalAttributeValue(
        getAttribute(attributes, "controls"),
      );
      if (controls !== null && controls !== false) {
        issues.push(
          issueFor(
            sourceFile,
            file,
            node,
            "native-media-controls",
            `<${lower} controls>`,
          ),
        );
      }
    }
  }

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      inspectJsx(node, jsxTagName(node.tagName), node.attributes);
    }

    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (
        ts.isIdentifier(expression) &&
        NATIVE_DIALOG_CALLS.has(expression.text)
      ) {
        issues.push(
          issueFor(
            sourceFile,
            file,
            node,
            "native-browser-dialog",
            `${expression.text}()`,
          ),
        );
      }

      if (
        ts.isPropertyAccessExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === "window" &&
        NATIVE_DIALOG_CALLS.has(expression.name.text)
      ) {
        issues.push(
          issueFor(
            sourceFile,
            file,
            node,
            "native-browser-dialog",
            `window.${expression.name.text}()`,
          ),
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return issues;
}

export function scanWakilishaUiChrome() {
  return walk(SRC_ROOT)
    .flatMap(scanFile)
    .sort((a, b) =>
      a.path.localeCompare(b.path) ||
      a.kind.localeCompare(b.kind) ||
      a.line - b.line ||
      a.column - b.column
    );
}

function summarize(issues) {
  const summary = {};
  for (const issue of issues) {
    summary[issue.path] ??= {};
    summary[issue.path][issue.kind] =
      (summary[issue.path][issue.kind] ?? 0) + 1;
  }

  const normalized = {};
  for (const file of Object.keys(summary).sort()) {
    normalized[file] = {};
    for (const kind of Object.keys(summary[file]).sort()) {
      normalized[file][kind] = summary[file][kind];
    }
  }
  return normalized;
}

function stable(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function writeBaseline(summary) {
  const payload = {
    version: 1,
    rule:
      "Visible product interactions must use WAKILISHA-owned primitives; native browser chrome is migration debt only.",
    violations: summary,
  };
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`);
}

function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    throw new Error(
      "UI chrome baseline is missing. Run with --write-baseline only when establishing or deliberately reducing the debt ledger.",
    );
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  if (baseline.version !== 1 || typeof baseline.violations !== "object") {
    throw new Error("UI chrome baseline is invalid.");
  }
  return baseline.violations;
}

function diffSummaries(expected, actual) {
  const messages = [];
  const paths = [...new Set([
    ...Object.keys(expected),
    ...Object.keys(actual),
  ])].sort();

  for (const file of paths) {
    const expectedKinds = expected[file] ?? {};
    const actualKinds = actual[file] ?? {};
    const kinds = [...new Set([
      ...Object.keys(expectedKinds),
      ...Object.keys(actualKinds),
    ])].sort();

    for (const kind of kinds) {
      const before = expectedKinds[kind] ?? 0;
      const now = actualKinds[kind] ?? 0;
      if (before !== now) {
        messages.push(`${file}: ${kind} baseline=${before} current=${now}`);
      }
    }
  }

  return messages;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const issues = scanWakilishaUiChrome();
  const summary = summarize(issues);
  const args = new Set(process.argv.slice(2));

  if (args.has("--write-baseline")) {
    writeBaseline(summary);
    console.log("WAKILISHA_UI_CHROME_BASELINE_WRITTEN");
    console.log(`violations=${issues.length}`);
    process.exit(0);
  }

  if (args.has("--report")) {
    console.log(JSON.stringify({ total: issues.length, issues }, null, 2));
  }

  if (args.has("--require-zero")) {
    if (issues.length) {
      console.error("WAKILISHA_UI_CHROME_ZERO_FAIL");
      for (const issue of issues) {
        console.error(
          `- ${issue.path}:${issue.line}:${issue.column} ${issue.kind} ${issue.detail}`,
        );
      }
      process.exit(1);
    }
    console.log("WAKILISHA_UI_CHROME_ZERO_PASS");
    process.exit(0);
  }

  let baseline;
  try {
    baseline = readBaseline();
  } catch (error) {
    console.error(`WAKILISHA_UI_CHROME_FAIL\n- ${error.message}`);
    process.exit(1);
  }

  const differences = diffSummaries(baseline, summary);
  if (differences.length) {
    console.error("WAKILISHA_UI_CHROME_FAIL");
    console.error(
      "The native-chrome debt ledger changed. Migrate to canonical WAKILISHA primitives and deliberately update the baseline; never silently add or renew browser chrome.",
    );
    for (const difference of differences) {
      console.error(`- ${difference}`);
    }
    process.exit(1);
  }

  console.log("WAKILISHA_UI_CHROME_PASS");
  console.log(`baseline_violations=${issues.length}`);
}
