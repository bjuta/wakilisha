import fs from "node:fs";
import path from "node:path";

const MAX_RUNTIME_IMPORTANT = 81;
const MAX_ARTICLE_PROSE_IMPORTANT = 7;

const ROOTS = ["src"];
const ROOT_FILES = ["index.html"];
const EXTENSIONS = new Set([
  ".css",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".html",
]);

function collectFiles(root) {
  const output = [];

  function walk(current) {
    for (const entry of fs.readdirSync(current, {
      withFileTypes: true,
    })) {
      const full = path.join(current, entry.name);

      if (entry.isDirectory()) {
        walk(full);
        continue;
      }

      if (
        entry.isFile()
        && EXTENSIONS.has(path.extname(entry.name))
      ) {
        output.push(full);
      }
    }
  }

  walk(root);
  return output;
}

const files = [
  ...ROOT_FILES.filter((file) => fs.existsSync(file)),
  ...ROOTS.flatMap(collectFiles),
];

let totalImportant = 0;
const debtByFile = [];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const count = source.split("!important").length - 1;

  totalImportant += count;

  if (count > 0) {
    debtByFile.push({
      file,
      count,
    });
  }
}

if (totalImportant > MAX_RUNTIME_IMPORTANT) {
  console.error(
    `CSS important debt audit failed: runtime source has ${totalImportant} !important occurrences; maximum is ${MAX_RUNTIME_IMPORTANT}.`,
  );

  for (const entry of debtByFile) {
    console.error(
      `  ${entry.file}: ${entry.count}`,
    );
  }

  process.exit(1);
}

const magazinePath =
  "src/styles/wakilisha-magazine-38-44.css";

const magazine = fs.readFileSync(
  magazinePath,
  "utf8",
);

if (magazine.includes(".article-content-v2")) {
  console.error(
    "CSS ownership audit failed: Magazine stylesheet regained Article prose selectors.",
  );
  process.exit(1);
}

const prosePath =
  "src/styles/wakilisha-article-prose.css";

const prose = fs.readFileSync(
  prosePath,
  "utf8",
);

const proseImportant =
  prose.split("!important").length - 1;

if (proseImportant > MAX_ARTICLE_PROSE_IMPORTANT) {
  console.error(
    `Article prose important debt audit failed: ${proseImportant} occurrences; maximum is ${MAX_ARTICLE_PROSE_IMPORTANT}.`,
  );
  process.exit(1);
}

console.log(
  `WAKILISHA_CSS_IMPORTANT_DEBT_AUDIT_PASS runtime=${totalImportant}/${MAX_RUNTIME_IMPORTANT} article_prose=${proseImportant}/${MAX_ARTICLE_PROSE_IMPORTANT}`,
);
