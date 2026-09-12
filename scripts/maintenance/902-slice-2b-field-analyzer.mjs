#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const TYPES = new Set(["number", "date", "file", "range", "datetime-local", "password", "search", "color", "time"]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else if (/\.(?:tsx|jsx)$/.test(entry.name)) out.push(abs);
  }
  return out;
}

function tagName(name) {
  return ts.isIdentifier(name) ? name.text : name.getText();
}

function attrName(prop) {
  return ts.isJsxAttribute(prop) ? prop.name.getText() : "{...spread}";
}

function literalType(node) {
  for (const prop of node.attributes.properties) {
    if (!ts.isJsxAttribute(prop) || prop.name.getText() !== "type") continue;
    if (!prop.initializer) return null;
    if (ts.isStringLiteral(prop.initializer)) return prop.initializer.text;
    if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression && ts.isStringLiteral(prop.initializer.expression)) return prop.initializer.expression.text;
  }
  return null;
}

let total = 0;
for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && tagName(node.tagName) === "input") {
      const type = literalType(node);
      if (type && TYPES.has(type)) {
        total += 1;
        const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        console.log(`\n=== FIELD ${total} ===`);
        console.log(`PATH=${path.relative(ROOT, file).split(path.sep).join("/")}`);
        console.log(`LINE=${pos.line + 1}`);
        console.log(`TYPE=${type}`);
        console.log(`ATTRS=${node.attributes.properties.map(attrName).join(",")}`);
        console.log("RAW_START");
        console.log(node.getText(sf));
        console.log("RAW_END");
      }
    }
    if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && tagName(ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName) === "datalist") {
      total += 1;
      const startNode = ts.isJsxElement(node) ? node.openingElement : node;
      const pos = sf.getLineAndCharacterOfPosition(startNode.getStart(sf));
      console.log(`\n=== FIELD ${total} ===`);
      console.log(`PATH=${path.relative(ROOT, file).split(path.sep).join("/")}`);
      console.log(`LINE=${pos.line + 1}`);
      console.log("TYPE=datalist");
      console.log("RAW_START");
      console.log(node.getText(sf));
      console.log("RAW_END");
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}
console.log(`\nTOTAL_OWNED_FIELD_NODES=${total}`);
