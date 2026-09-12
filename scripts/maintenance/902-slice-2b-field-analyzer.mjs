#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { scanWakilishaUiChrome } from "../control-plane/verify-wakilisha-ui-chrome.mjs";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const VERIFY = path.join(ROOT, "scripts/control-plane/verify-wakilisha-ui-chrome.mjs");
const TARGET_TYPES = new Set([
  "number",
  "date",
  "file",
  "range",
  "datetime-local",
  "password",
  "search",
  "color",
  "time",
]);
const OWNED_KINDS = new Set([
  "native-input-number",
  "native-input-date",
  "native-input-file",
  "native-input-range",
  "native-input-datetime-local",
  "native-input-password",
  "native-input-search",
  "native-input-color",
  "native-datalist",
  "native-input-time",
]);
const RESERVED_KINDS = new Set([
  "native-browser-dialog",
  "native-disclosure",
  "native-media-controls",
]);

function fail(message) {
  throw new Error(message);
}

function normalize(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(absolute));
    else if (/\.(?:tsx|jsx)$/.test(entry.name)) out.push(absolute);
  }
  return out;
}

function parse(file, text) {
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".jsx") ? ts.ScriptKind.JSX : ts.ScriptKind.TSX,
  );
}

function tagName(name) {
  return ts.isIdentifier(name) ? name.text : name.getText();
}

function getAttr(node, name) {
  for (const prop of node.attributes.properties) {
    if (ts.isJsxAttribute(prop) && prop.name.getText() === name) return prop;
  }
  return null;
}

function attrLiteral(attr) {
  if (!attr || !attr.initializer) return null;
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  if (
    ts.isJsxExpression(attr.initializer)
    && attr.initializer.expression
    && ts.isStringLiteral(attr.initializer.expression)
  ) {
    return attr.initializer.expression.text;
  }
  return null;
}

function attrExpression(attr, sf) {
  if (!attr || !attr.initializer) return null;
  if (ts.isStringLiteral(attr.initializer)) return JSON.stringify(attr.initializer.text);
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
    return attr.initializer.expression.getText(sf);
  }
  return null;
}

function attrInitializer(attr, sf) {
  return attr?.initializer ? attr.initializer.getText(sf) : null;
}

function literalType(node) {
  return attrLiteral(getAttr(node, "type"));
}

function numberProp(name, attr, sf) {
  if (!attr || !attr.initializer) return null;
  if (ts.isStringLiteral(attr.initializer)) {
    const value = Number(attr.initializer.text);
    if (!Number.isFinite(value)) fail(`Invalid numeric ${name}: ${attr.initializer.text}`);
    return `${name}={${value}}`;
  }
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
    return `${name}={${attr.initializer.expression.getText(sf)}}`;
  }
  return null;
}

function passProp(name, attr, sf) {
  if (!attr) return null;
  if (!attr.initializer) return name;
  return `${name}=${attr.initializer.getText(sf)}`;
}

function humanize(raw) {
  if (!raw) return "Field";
  if (/width/i.test(raw)) return "Width";
  if (/height/i.test(raw)) return "Height";
  const identifiers = raw.match(/[A-Za-z_$][\w$]*/g) ?? [];
  const ignored = new Set([
    "value", "current", "undefined", "null", "Math", "min", "max", "String", "Number",
  ]);
  let token = [...identifiers].reverse().find((item) => !ignored.has(item)) ?? "Field";
  token = token
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return token ? token.charAt(0).toUpperCase() + token.slice(1).toLowerCase() : "Field";
}

function controlLabel(node, sf, fallback) {
  const explicit = attrLiteral(getAttr(node, "aria-label"));
  if (explicit) return explicit;
  const placeholder = attrLiteral(getAttr(node, "placeholder"));
  if (placeholder) return placeholder;
  return humanize(fallback);
}

function arrowParts(expression, context) {
  const match = expression.match(/^\s*\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>\s*([\s\S]*)$/);
  if (!match) fail(`Unsupported handler in ${context}: ${expression}`);
  return { parameter: match[1], body: match[2] };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rewriteValueHandler(expression, mode, context) {
  const { parameter, body: rawBody } = arrowParts(expression, context);
  const p = escapeRegExp(parameter);
  let body = rawBody;

  if (mode === "number" || mode === "range") {
    body = body
      .replace(new RegExp(`Number\\(\\s*${p}\\.target\\.value\\s*\\)`, "g"), "nextValue")
      .replace(new RegExp(`parseInt\\(\\s*${p}\\.target\\.value\\s*\\)`, "g"), "nextValue")
      .replace(new RegExp(`parseFloat\\(\\s*${p}\\.target\\.value\\s*\\)`, "g"), "nextValue")
      .replace(
        new RegExp(`${p}\\.target\\.value`, "g"),
        '(Number.isNaN(nextValue) ? "" : String(nextValue))',
      );
    return `(nextValue) => ${body}`;
  }

  if (mode === "file") {
    body = body
      .replace(new RegExp(`${p}\\.target\\.files`, "g"), "files")
      .replace(new RegExp(`${p}\\.currentTarget\\.files`, "g"), "files");
    if (new RegExp(`${p}\\.target`).test(body)) {
      fail(`Unsupported residual file event target in ${context}: ${body}`);
    }
    return `(files) => ${body}`;
  }

  body = body.replace(new RegExp(`${p}\\.target\\.value`, "g"), "nextValue");
  if (new RegExp(`${p}\\.target`).test(body)) {
    fail(`Unsupported residual value event target in ${context}: ${body}`);
  }
  return `(nextValue) => ${body}`;
}

function sanitizeSliderClass(attr) {
  const value = attrLiteral(attr);
  if (!value) return null;
  const tokens = value
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^h-/.test(token))
    .filter((token) => !/^accent-/.test(token))
    .filter((token) => token !== "cursor-pointer")
    .filter((token) => token !== "rounded-full");
  return tokens.join(" ");
}

function addImport(imports, module, name) {
  if (!imports.has(module)) imports.set(module, new Set());
  imports.get(module).add(name);
}

function insertImports(file, text, imports) {
  if (!imports.size) return text;
  const sf = parse(file, text);
  const existing = new Set();
  let lastImportEnd = 0;
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    lastImportEnd = Math.max(lastImportEnd, statement.end);
    const clause = statement.importClause;
    if (!clause) continue;
    if (clause.name) existing.add(clause.name.text);
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) existing.add(element.name.text);
    }
  }
  const lines = [];
  for (const [module, names] of [...imports.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const pending = [...names].filter((name) => !existing.has(name)).sort();
    if (pending.length) lines.push(`import { ${pending.join(", ")} } from ${JSON.stringify(module)};`);
  }
  if (!lines.length) return text;
  const insertion = `\n${lines.join("\n")}\n`;
  return `${text.slice(0, lastImportEnd)}${insertion}${text.slice(lastImportEnd)}`;
}

function replaceRefType(text, name, context) {
  const regex = new RegExp(`(const\\s+${name}\\s*=\\s*(?:\\n\\s*)?useRef)<HTMLInputElement(\\s*\\|\\s*null)?>(\\s*\\()`);
  if (!regex.test(text)) fail(`Missing ${name} input ref in ${context}`);
  return text.replace(regex, (_match, prefix, nullable, suffix) => `${prefix}<HTMLButtonElement${nullable ?? ""}>${suffix}`);
}

function replaceRegexOnce(text, regex, replacement, context) {
  const matches = [...text.matchAll(new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`))];
  if (matches.length !== 1) fail(`${context}: expected one match, found ${matches.length}`);
  return text.replace(regex, replacement);
}

function preprocess(rel, original) {
  let text = original;

  if (rel === "src/components/admin/media/MediaLibraryCore.tsx") {
    text = replaceRefType(text, "fileInputRef", rel);
  }

  if (rel === "src/components/artists/ArtistImageField.tsx") {
    text = replaceRefType(text, "inputRef", rel);
    text = replaceRegexOnce(
      text,
      /async function handleFile\(\s*event: ChangeEvent<HTMLInputElement>,?\s*\)\s*\{\s*const file =\s*event\.target\.files\?\.\[0\];\s*event\.target\.value = "";/,
      "async function handleFile(files: FileList | null) {\n    const file = files?.[0];",
      `${rel} handleFile`,
    );
  }

  if (rel === "src/components/community/PostComposer.tsx") {
    text = replaceRefType(text, "inputRef", rel);
    text = replaceRegexOnce(
      text,
      /async function handlePhoto\(event: ChangeEvent<HTMLInputElement>\)\s*\{\s*const file = event\.target\.files\?\.\[0\];\s*event\.target\.value = "";/,
      "async function handlePhoto(files: FileList | null) {\n    const file = files?.[0];",
      `${rel} handlePhoto`,
    );
  }

  if (rel === "src/pages/settings/components/AccountSettingsPane.tsx") {
    text = replaceRefType(text, "fileRef", rel);
    text = replaceRefType(text, "coverFileRef", rel);
    text = replaceRegexOnce(
      text,
      /const handleFileChange = async \(e: React\.ChangeEvent<HTMLInputElement>\) => \{\s*const file = e\.target\.files\?\.\[0\];\s*e\.target\.value = "";/,
      "const handleFileChange = async (files: FileList | null) => {\n    const file = files?.[0];",
      `${rel} handleFileChange`,
    );
    text = replaceRegexOnce(
      text,
      /const handleCoverFileChange = async \(e: React\.ChangeEvent<HTMLInputElement>\) => \{\s*const file = e\.target\.files\?\.\[0\];\s*e\.target\.value = "";/,
      "const handleCoverFileChange = async (files: FileList | null) => {\n    const file = files?.[0];",
      `${rel} handleCoverFileChange`,
    );
  }

  if (rel === "src/pages/field/page.tsx") {
    text = replaceRefType(text, "cameraInputRef", rel);
    text = replaceRefType(text, "libraryInputRef", rel);
    text = replaceRefType(text, "replacementInputRef", rel);
    text = replaceRegexOnce(
      text,
      /function chooseFile\(event: ChangeEvent<HTMLInputElement>\) \{\s*const nextFile = event\.target\.files\?\.\[0\] \?\? null;/,
      "function chooseFile(files: FileList | null) {\n    const nextFile = files?.[0] ?? null;",
      `${rel} chooseFile`,
    );
  }

  if (rel === "src/pages/admin/settings/integrations/page.tsx") {
    text = replaceRegexOnce(
      text,
      /const handleFileUpload = async \(e: React\.ChangeEvent<HTMLInputElement>\) => \{\s*const file = e\.target\.files\?\.\[0\];/,
      "const handleFileUpload = async (files: FileList | null) => {\n    const file = files?.[0];",
      `${rel} handleFileUpload`,
    );
  }

  return text;
}

function buildNumber(node, sf, rel, imports) {
  addImport(imports, "@/components/design-system/primitives/NumberField", "WkNumberField");
  const value = attrExpression(getAttr(node, "value"), sf);
  if (!value) fail(`${rel}: number input missing value`);
  const handlerAttr = getAttr(node, "onChange");
  const handlerExpr = attrExpression(handlerAttr, sf);
  const label = controlLabel(node, sf, value);
  const classAttr = getAttr(node, "className");
  const classLiteral = attrLiteral(classAttr) ?? "";
  const props = [
    `value={${value}}`,
    `ariaLabel=${JSON.stringify(label)}`,
    "showSteppers={false}",
    numberProp("min", getAttr(node, "min"), sf),
    numberProp("max", getAttr(node, "max"), sf),
    numberProp("step", getAttr(node, "step"), sf),
    passProp("disabled", getAttr(node, "disabled"), sf),
    passProp("required", getAttr(node, "required"), sf),
    passProp("readOnly", getAttr(node, "readOnly"), sf),
    passProp("placeholder", getAttr(node, "placeholder"), sf),
    classAttr ? `groupClassName=${attrInitializer(classAttr, sf)}` : null,
    `inputClassName=${JSON.stringify(`${classLiteral.includes("text-center") ? "" : "text-left"}${classLiteral.includes("text-wk-text-muted") ? " text-wk-text-muted" : ""}`.trim())}`,
  ];
  if (handlerExpr) {
    props.splice(1, 0, `onChange={${rewriteValueHandler(handlerExpr, "number", `${rel} ${label}`)}}`);
  }
  return `<WkNumberField\n  ${props.filter(Boolean).join("\n  ")}\n/>`;
}

function buildTemporal(node, sf, rel, imports, type) {
  const component = type === "date" ? "WkDatePicker" : type === "time" ? "WkTimePicker" : "WkDateTimePicker";
  addImport(imports, "@/components/design-system/primitives/DateTimePicker", component);
  const value = attrExpression(getAttr(node, "value"), sf);
  const handler = attrExpression(getAttr(node, "onChange"), sf);
  if (!value || !handler) fail(`${rel}: ${type} input missing value/onChange`);
  const label = controlLabel(node, sf, value);
  const props = [
    `value={${value}}`,
    `onChange={${rewriteValueHandler(handler, "value", `${rel} ${label}`)}}`,
    `label=${JSON.stringify(label)}`,
    "showLabel={false}",
    passProp("disabled", getAttr(node, "disabled"), sf),
    passProp("required", getAttr(node, "required"), sf),
    getAttr(node, "className") ? `className=${attrInitializer(getAttr(node, "className"), sf)}` : null,
  ];
  return `<${component}\n  ${props.filter(Boolean).join("\n  ")}\n/>`;
}

function buildRange(node, sf, rel, imports) {
  addImport(imports, "@/components/design-system/primitives/Slider", "WkSlider");
  const value = attrExpression(getAttr(node, "value"), sf);
  const handler = attrExpression(getAttr(node, "onChange"), sf);
  if (!value || !handler) fail(`${rel}: range input missing value/onChange`);
  const label = controlLabel(node, sf, value);
  const className = sanitizeSliderClass(getAttr(node, "className"));
  const props = [
    `value={${value}}`,
    `onChange={${rewriteValueHandler(handler, "range", `${rel} ${label}`)}}`,
    `ariaLabel=${JSON.stringify(label)}`,
    numberProp("min", getAttr(node, "min"), sf),
    numberProp("max", getAttr(node, "max"), sf),
    numberProp("step", getAttr(node, "step"), sf),
    passProp("disabled", getAttr(node, "disabled"), sf),
    className ? `className=${JSON.stringify(className)}` : null,
  ];
  return `<WkSlider\n  ${props.filter(Boolean).join("\n  ")}\n/>`;
}

function buildPassword(node, sf, rel, imports) {
  addImport(imports, "@/components/design-system/primitives/Field", "WkPasswordField");
  const value = attrExpression(getAttr(node, "value"), sf);
  const handler = attrExpression(getAttr(node, "onChange"), sf);
  if (!value || !handler) fail(`${rel}: password input missing value/onChange`);
  const label = controlLabel(node, sf, value);
  const autoComplete = attrLiteral(getAttr(node, "autoComplete")) ?? "current-password";
  const props = [
    `value={${value}}`,
    `onChange={${rewriteValueHandler(handler, "value", `${rel} ${label}`)}}`,
    `ariaLabel=${JSON.stringify(label)}`,
    `autoComplete=${JSON.stringify(autoComplete)}`,
    "className=\"w-full\"",
    passProp("placeholder", getAttr(node, "placeholder"), sf),
    passProp("required", getAttr(node, "required"), sf),
    numberProp("minLength", getAttr(node, "minLength"), sf),
    passProp("disabled", getAttr(node, "disabled"), sf),
    getAttr(node, "className") ? `inputClassName=${attrInitializer(getAttr(node, "className"), sf)}` : null,
    getAttr(node, "style") ? `inputStyle=${attrInitializer(getAttr(node, "style"), sf)}` : null,
  ];
  return `<WkPasswordField\n  ${props.filter(Boolean).join("\n  ")}\n/>`;
}

function buildColor(node, sf, rel, imports) {
  addImport(imports, "@/components/design-system/primitives/ColorField", "WkColorField");
  const value = attrExpression(getAttr(node, "value"), sf);
  const handler = attrExpression(getAttr(node, "onChange"), sf);
  if (!value || !handler) fail(`${rel}: color input missing value/onChange`);
  const label = controlLabel(node, sf, value);
  const props = [
    "compact",
    `value={${value}}`,
    `onChange={${rewriteValueHandler(handler, "value", `${rel} ${label}`)}}`,
    `ariaLabel=${JSON.stringify(label)}`,
    passProp("disabled", getAttr(node, "disabled"), sf),
    getAttr(node, "className") ? `className=${attrInitializer(getAttr(node, "className"), sf)}` : null,
  ];
  return `<WkColorField\n  ${props.filter(Boolean).join("\n  ")}\n/>`;
}

function buildFile(node, sf, rel, imports) {
  addImport(imports, "@/components/design-system/primitives/UploadField", "WkUploadTrigger");
  const handlerExpr = attrExpression(getAttr(node, "onChange"), sf);
  if (!handlerExpr) fail(`${rel}: file input missing onChange`);
  const handler = /^[A-Za-z_$][\w$]*$/.test(handlerExpr)
    ? handlerExpr
    : rewriteValueHandler(handlerExpr, "file", `${rel} file input`);
  const capture = attrLiteral(getAttr(node, "capture"));
  const props = [
    passProp("ref", getAttr(node, "ref"), sf),
    passProp("id", getAttr(node, "id"), sf),
    passProp("accept", getAttr(node, "accept"), sf),
    getAttr(node, "multiple") ? "multiple" : null,
    capture === "environment" ? 'defaultCamera="environment"' : capture === "user" ? 'defaultCamera="user"' : null,
    `onSelect={${handler}}`,
    passProp("disabled", getAttr(node, "disabled"), sf),
    `ariaLabel=${JSON.stringify(controlLabel(node, sf, "Choose file"))}`,
    getAttr(node, "className") ? `className=${attrInitializer(getAttr(node, "className"), sf)}` : null,
  ];
  return `<WkUploadTrigger\n  ${props.filter(Boolean).join("\n  ")}\n/>`;
}

function buildSuggestion(node, sf, rel, imports) {
  addImport(imports, "@/components/design-system/primitives/SuggestionField", "WkSuggestionField");
  const value = attrExpression(getAttr(node, "value"), sf);
  const handler = attrExpression(getAttr(node, "onChange"), sf);
  if (!value || !handler) fail(`${rel}: datalist-backed input missing value/onChange`);
  const label = controlLabel(node, sf, value);
  const props = [
    `value={${value}}`,
    `onChange={${rewriteValueHandler(handler, "value", `${rel} ${label}`)}}`,
    "options={sourceFormOptions}",
    `ariaLabel=${JSON.stringify(label)}`,
    passProp("placeholder", getAttr(node, "placeholder"), sf),
    getAttr(node, "className") ? `inputClassName=${attrInitializer(getAttr(node, "className"), sf)}` : null,
  ];
  return `<WkSuggestionField\n  ${props.filter(Boolean).join("\n  ")}\n/>`;
}

function buildIntegrationUpload(node, sf, rel, imports) {
  addImport(imports, "@/components/design-system/primitives/UploadField", "WkUploadField");
  return `<WkUploadField\n  id={id}\n  accept=\".p8,.key\"\n  onSelect={handleFileUpload}\n  disabled={uploading}\n  ariaLabel=\"Upload Apple Music private key\"\n  label={uploading ? \"Uploading...\" : \"Click to upload .p8 file\"}\n  description=\"Select your Apple Music .p8 private key file. It is sent directly to a secure backend and never stored in the browser.\"\n/>`;
}

function buildFieldEmbargo(node, sf, rel, imports) {
  addImport(imports, "@/components/design-system/primitives/DateTimePicker", "WkDateTimePicker");
  const value = attrExpression(getAttr(node, "value"), sf);
  const handler = attrExpression(getAttr(node, "onChange"), sf);
  if (!value || !handler) fail(`${rel}: field embargo input missing value/onChange`);
  return `<WkDateTimePicker\n  value={${value}}\n  onChange={${rewriteValueHandler(handler, "value", `${rel} Hold until`)}}\n  label=\"Hold until\"\n  showLabel={false}\n  className=\"mt-2 w-full\"\n  triggerClassName=\"rounded-2xl border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3\"\n/>`;
}

let migrated = 0;
const changedFiles = [];

for (const file of walk(SRC)) {
  const rel = normalize(file);
  const original = fs.readFileSync(file, "utf8");
  let text = preprocess(rel, original);
  const sf = parse(file, text);
  const replacements = [];
  const imports = new Map();
  const covered = [];

  function addReplacement(start, end, value, reason, count = true) {
    if (covered.some(([a, b]) => start < b && end > a)) {
      fail(`${rel}: overlapping migration replacement for ${reason}`);
    }
    covered.push([start, end]);
    replacements.push({ start, end, value, reason });
    if (count) migrated += 1;
  }

  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const name = tagName(node.tagName);
      if (name === "input") {
        const list = attrLiteral(getAttr(node, "list"));
        if (list === "audience-source-forms") {
          addReplacement(node.getStart(sf), node.getEnd(), buildSuggestion(node, sf, rel, imports), "datalist input", false);
          return;
        }

        const type = literalType(node);
        if (type && TARGET_TYPES.has(type)) {
          if (type === "search") fail(`${rel}: native search survived the earlier migration`);

          if (rel === "src/pages/admin/settings/integrations/page.tsx" && type === "file") {
            let parent = node.parent;
            while (parent && !(ts.isJsxElement(parent) && tagName(parent.openingElement.tagName) === "label")) {
              parent = parent.parent;
            }
            if (!parent || !ts.isJsxElement(parent)) fail(`${rel}: secret file input parent label not found`);
            addReplacement(parent.getStart(sf), parent.getEnd(), buildIntegrationUpload(node, sf, rel, imports), "integration upload");
            return;
          }

          if (
            rel === "src/pages/field/page.tsx"
            && type === "datetime-local"
            && attrLiteral(getAttr(node, "aria-label")) === "Hold until"
          ) {
            let parent = node.parent;
            while (parent && !(ts.isJsxElement(parent) && tagName(parent.openingElement.tagName) === "label")) {
              parent = parent.parent;
            }
            if (!parent || !ts.isJsxElement(parent)) fail(`${rel}: embargo parent label not found`);
            addReplacement(parent.getStart(sf), parent.getEnd(), buildFieldEmbargo(node, sf, rel, imports), "field embargo");
            return;
          }

          const value =
            type === "number" ? buildNumber(node, sf, rel, imports)
              : type === "date" || type === "datetime-local" || type === "time" ? buildTemporal(node, sf, rel, imports, type)
                : type === "range" ? buildRange(node, sf, rel, imports)
                  : type === "password" ? buildPassword(node, sf, rel, imports)
                    : type === "color" ? buildColor(node, sf, rel, imports)
                      : type === "file" ? buildFile(node, sf, rel, imports)
                        : fail(`${rel}: unsupported target type ${type}`);
          addReplacement(node.getStart(sf), node.getEnd(), value, type);
          return;
        }
      }
    }

    if (ts.isJsxElement(node) && tagName(node.openingElement.tagName) === "datalist") {
      const id = attrLiteral(getAttr(node.openingElement, "id"));
      if (id !== "audience-source-forms") fail(`${rel}: unsupported datalist ${id ?? "without id"}`);
      addReplacement(node.getStart(sf), node.getEnd(), "", "datalist");
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);

  if (replacements.length || text !== original) {
    replacements.sort((a, b) => b.start - a.start);
    for (const replacement of replacements) {
      text = `${text.slice(0, replacement.start)}${replacement.value}${text.slice(replacement.end)}`;
    }
    text = insertImports(file, text, imports);
    text = text.replace(/[ \t]+$/gm, "");
    fs.writeFileSync(file, text);
    changedFiles.push(rel);
  }
}

if (migrated !== 71) {
  fail(`Expected to migrate exactly 71 remaining owned field nodes, migrated ${migrated}`);
}

const issues = scanWakilishaUiChrome();
const owned = issues.filter((issue) => OWNED_KINDS.has(issue.kind));
if (owned.length) {
  console.error(JSON.stringify(owned, null, 2));
  fail(`Owned browser-chrome debt remains after migration: ${owned.length}`);
}

const unexpected = issues.filter((issue) => !RESERVED_KINDS.has(issue.kind));
if (unexpected.length) {
  console.error(JSON.stringify(unexpected, null, 2));
  fail(`Unexpected browser-chrome debt remains after migration: ${unexpected.length}`);
}

if (issues.length > 54) {
  fail(`Reserved browser-chrome debt exceeds Slice 2B ceiling: ${issues.length}`);
}

const baseline = spawnSync(process.execPath, [VERIFY, "--write-baseline"], {
  cwd: ROOT,
  stdio: "inherit",
});
if (baseline.status !== 0) fail(`Baseline write failed with status ${baseline.status}`);

console.log("SLICE_2B_FIELD_MIGRATION_PASS");
console.log(`migrated_nodes=${migrated}`);
console.log(`remaining_reserved_debt=${issues.length}`);
console.log(`changed_files=${changedFiles.length}`);
for (const file of changedFiles.sort()) console.log(`- ${file}`);
