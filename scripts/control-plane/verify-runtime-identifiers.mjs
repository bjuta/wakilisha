#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = process.cwd();
const configPath = ts.findConfigFile(
  root,
  ts.sys.fileExists,
  "tsconfig.json",
);

if (!configPath) {
  console.error("RUNTIME_IDENTIFIER_GATE=FAIL_NO_TSCONFIG");
  process.exit(1);
}

const configFile = ts.readConfigFile(
  configPath,
  ts.sys.readFile,
);

if (configFile.error) {
  console.error(
    ts.flattenDiagnosticMessageText(
      configFile.error.messageText,
      "\n",
    ),
  );
  console.error("RUNTIME_IDENTIFIER_GATE=FAIL_TSCONFIG_READ");
  process.exit(1);
}

const parsed = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  path.dirname(configPath),
  {
    noEmit: true,
    skipLibCheck: true,
    jsx: ts.JsxEmit.ReactJSX,
  },
  configPath,
);

const program = ts.createProgram({
  rootNames: parsed.fileNames,
  options: parsed.options,
});

const undeclaredCodes = new Set([
  2304, // Cannot find name
  2552, // Cannot find name; did you mean ...
  18004, // No value exists in scope for shorthand property
]);

const diagnostics = ts
  .getPreEmitDiagnostics(program)
  .filter((diagnostic) => {
    if (!undeclaredCodes.has(diagnostic.code)) {
      return false;
    }

    if (!diagnostic.file) {
      return false;
    }

    const relative = path
      .relative(root, diagnostic.file.fileName)
      .replaceAll(path.sep, "/");

    return (
      relative.startsWith("src/")
      || relative.startsWith("packages/")
    );
  });

if (diagnostics.length > 0) {
  console.error(
    `RUNTIME_IDENTIFIER_GATE=FAIL count=${diagnostics.length}`,
  );

  for (const diagnostic of diagnostics) {
    const file = diagnostic.file;
    const relative = path
      .relative(root, file.fileName)
      .replaceAll(path.sep, "/");
    const position = file.getLineAndCharacterOfPosition(
      diagnostic.start ?? 0,
    );
    const message = ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      "\n",
    );

    console.error(
      `${relative}:${position.line + 1}:${position.character + 1} TS${diagnostic.code} ${message}`,
    );
  }

  process.exit(1);
}

console.log("RUNTIME_IDENTIFIER_GATE=PASS");
