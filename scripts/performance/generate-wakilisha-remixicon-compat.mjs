#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const srcRoot = path.join(
  root,
  "src",
);
const packageRoot = path.join(
  root,
  "node_modules/remixicon",
);
const packageJsonPath = path.join(
  packageRoot,
  "package.json",
);
const packageLicensePath = path.join(
  packageRoot,
  "License",
);
const outputCssPath = path.join(
  srcRoot,
  "styles/wakilisha-remixicon-compat.css",
);
const outputSpritePath = path.join(
  srcRoot,
  "assets/icons/wakilisha-remixicon-mask.svg",
);
const outputLicensePath = path.join(
  srcRoot,
  "assets/icons/REMIXICON-LICENSE.txt",
);
const indexPath = path.join(
  root,
  "index.html",
);
const checkOnly =
  process.argv.includes(
    "--check",
  );

const expectedVersion =
  "4.5.0";
const expectedLicenseSha =
  "c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4";

function fail(message) {
  throw new Error(
    `WAKILISHA Remixicon compatibility generation failed: ${message}`,
  );
}

function sha256(buffer) {
  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}

if (
  !fs.existsSync(
    packageJsonPath,
  )
) {
  fail(
    "remixicon package is missing; install remixicon@4.5.0",
  );
}

const packageJson =
  JSON.parse(
    fs.readFileSync(
      packageJsonPath,
      "utf8",
    ),
  );

if (
  packageJson.version
  !== expectedVersion
) {
  fail(
    `expected remixicon ${expectedVersion}, found ${packageJson.version}`,
  );
}

if (
  !fs.existsSync(
    packageLicensePath,
  )
) {
  fail(
    "Remixicon Apache-2.0 license is missing",
  );
}

const licenseBuffer =
  fs.readFileSync(
    packageLicensePath,
  );

const licenseSha =
  sha256(
    licenseBuffer,
  );

if (
  licenseSha
  !== expectedLicenseSha
) {
  fail(
    `Remixicon license SHA changed: ${licenseSha}`,
  );
}

const staticPattern =
  /\bri-[a-z0-9]+(?:-[a-z0-9]+)*\b/g;

const dynamicIdentityPattern =
  /ri-\$\{/g;

const textExtensions =
  new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".css",
  ]);

const allowedDynamicFiles =
  new Set([
    "src/pages/admin/charts/ingest/detail/components/FetchStep.tsx",
    "src/pages/admin/charts/ingest/detail/components/SourcesStep.tsx",
  ]);

const discovered =
  new Set();

const dynamicFiles =
  new Map();

function walk(directory) {
  for (
    const entry
    of fs.readdirSync(
      directory,
      {
        withFileTypes:
          true,
      },
    )
  ) {
    const full =
      path.join(
        directory,
        entry.name,
      );

    if (
      entry.isDirectory()
    ) {
      walk(full);
      continue;
    }

    if (
      !textExtensions.has(
        path.extname(
          entry.name,
        ),
      )
    ) {
      continue;
    }

    const relative =
      path
        .relative(
          root,
          full,
        )
        .split(
          path.sep,
        )
        .join("/");

    if (
      full
      === outputCssPath
    ) {
      continue;
    }

    const source =
      fs.readFileSync(
        full,
        "utf8",
      );

    for (
      const match
      of source.matchAll(
        staticPattern,
      )
    ) {
      discovered.add(
        match[0],
      );
    }

    const dynamicCount =
      [
        ...source.matchAll(
          dynamicIdentityPattern,
        ),
      ].length;

    if (
      dynamicCount > 0
    ) {
      dynamicFiles.set(
        relative,
        {
          source,
          count:
            dynamicCount,
        },
      );
    }
  }
}

walk(
  srcRoot,
);

if (
  dynamicFiles.size
  !== allowedDynamicFiles.size
  || [
    ...dynamicFiles.keys(),
  ].some(
    (file) =>
      !allowedDynamicFiles.has(
        file,
      ),
  )
  || [
    ...allowedDynamicFiles,
  ].some(
    (file) =>
      !dynamicFiles.has(
        file,
      ),
  )
) {
  fail(
    `dynamic ri-\${...} ownership changed: ${JSON.stringify(
      [
        ...dynamicFiles.keys(),
      ],
    )}`,
  );
}

let dynamicIdentityCount =
  0;

for (
  const [
    file,
    {
      source,
      count,
    },
  ]
  of dynamicFiles
) {
  if (
    count !== 1
  ) {
    fail(
      `${file} has ${count} dynamic ri-\${...} expressions; expected 1`,
    );
  }

  const functionMatch =
    source.match(
      /function\s+getProviderIcon\s*\([^)]*\)\s*:\s*string\s*\{([\s\S]*?)\n\}/,
    );

  if (
    !functionMatch
  ) {
    fail(
      `${file} dynamic icon construction is not bounded by getProviderIcon()`,
    );
  }

  const body =
    functionMatch[1];

  const names =
    new Set();

  for (
    const match
    of body.matchAll(
      /:\s*"([a-z0-9]+(?:-[a-z0-9]+)*)"/g,
    )
  ) {
    names.add(
      match[1],
    );
  }

  const fallback =
    body.match(
      /\?\?\s*"([a-z0-9]+(?:-[a-z0-9]+)*)"/,
    );

  if (
    fallback
  ) {
    names.add(
      fallback[1],
    );
  }

  if (
    names.size < 8
    || names.size > 12
  ) {
    fail(
      `${file} resolved ${names.size} provider icons; expected a bounded 8-12 icon map`,
    );
  }

  for (
    const name
    of names
  ) {
    discovered.add(
      `ri-${name}`,
    );
  }

  dynamicIdentityCount +=
    names.size;
}

function walkSvg(
  directory,
  map,
) {
  for (
    const entry
    of fs.readdirSync(
      directory,
      {
        withFileTypes:
          true,
      },
    )
  ) {
    const full =
      path.join(
        directory,
        entry.name,
      );

    if (
      entry.isDirectory()
    ) {
      walkSvg(
        full,
        map,
      );
      continue;
    }

    if (
      !entry.name.endsWith(
        ".svg",
      )
    ) {
      continue;
    }

    const key =
      entry.name.toLowerCase();

    const existing =
      map.get(
        key,
      );

    if (
      existing
    ) {
      fail(
        `ambiguous Remixicon SVG basename ${key}: ${existing}, ${full}`,
      );
    }

    map.set(
      key,
      full,
    );
  }
}

const svgByName =
  new Map();

walkSvg(
  path.join(
    packageRoot,
    "icons",
  ),
  svgByName,
);

function svgBody(
  file,
  iconName,
) {
  const source =
    fs.readFileSync(
      file,
      "utf8",
    )
      .trim();

  const open =
    source.match(
      /<svg\b([^>]*)>/,
    );

  const body =
    source.match(
      /<svg\b[^>]*>([\s\S]*?)<\/svg>/,
    );

  if (
    !open
    || !body
  ) {
    fail(
      `could not parse ${iconName}`,
    );
  }

  const viewBox =
    open[1].match(
      /\bviewBox="([^"]+)"/,
    )?.[1]
    ?? "0 0 24 24";

  if (
    viewBox !== "0 0 24 24"
  ) {
    fail(
      `${iconName} has unsupported viewBox ${viewBox}`,
    );
  }

  return body[1]
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

const names =
  [
    ...discovered,
  ].sort(
    (a, b) =>
      a.localeCompare(
        b,
      ),
  );

if (
  names.length < 275
  || names.length > 320
) {
  fail(
    `resolved ${names.length} Remixicon identities; expected 275-320`,
  );
}

const columns =
  16;
const rows =
  Math.ceil(
    names.length
    / columns,
  );
const cell =
  24;
const spriteWidth =
  columns
  * cell;
const spriteHeight =
  rows
  * cell;

function positionPercent(
  index,
  count,
) {
  if (
    count <= 1
  ) {
    return "0%";
  }

  const value =
    (
      index
      / (
        count
        - 1
      )
    )
    * 100;

  return (
    value
      .toFixed(
        6,
      )
      .replace(
        /\.?0+$/,
        "",
      )
    + "%"
  );
}

const spriteGroups =
  [];
const iconRules =
  [];

for (
  const [
    index,
    icon,
  ]
  of names.entries()
) {
  const basename =
    `${icon.slice(3)}.svg`;

  const file =
    svgByName.get(
      basename,
    );

  if (
    !file
  ) {
    fail(
      `missing Remixicon 4.5.0 SVG for ${icon}`,
    );
  }

  const column =
    index
    % columns;
  const row =
    Math.floor(
      index
      / columns,
    );

  const body =
    svgBody(
      file,
      icon,
    );

  spriteGroups.push(
    `  <g id="${icon}" transform="translate(${column * cell} ${row * cell})">${body}</g>`,
  );

  iconRules.push(
    `.${icon}{--wk-ri-position:${positionPercent(
      column,
      columns,
    )} ${positionPercent(
      row,
      rows,
    )}}`,
  );
}

const sprite =
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${spriteWidth}" height="${spriteHeight}" viewBox="0 0 ${spriteWidth} ${spriteHeight}" fill="#000">`,
    "  <metadata>",
    "    Generated from Remixicon 4.5.0 for WAKILISHA compatibility delivery.",
    "    Remixicon is Apache-2.0 licensed. See REMIXICON-LICENSE.txt.",
    "  </metadata>",
    ...spriteGroups,
    "</svg>",
    "",
  ].join(
    "\n",
  );

const spriteRelativeUrl =
  "../assets/icons/wakilisha-remixicon-mask.svg";

const css =
  [
    "/*",
    " * Generated WAKILISHA compatibility layer for legacy ri-* callsites.",
    " * Remixicon 4.5.0 is Apache-2.0 licensed build-time source material only.",
    " * No Remixicon webfont or third-party runtime stylesheet is shipped.",
    " * See src/assets/icons/REMIXICON-LICENSE.txt.",
    " */",
    '[class^="ri-"],[class*=" ri-"]{display:inline-block;width:1em;height:1em;line-height:1;vertical-align:-.125em;flex:0 0 auto}',
    `[class^="ri-"]::before,[class*=" ri-"]::before{content:"";display:block;width:100%;height:100%;background-color:currentColor;-webkit-mask-image:url("${spriteRelativeUrl}");mask-image:url("${spriteRelativeUrl}");-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:${columns * 100}% ${rows * 100}%;mask-size:${columns * 100}% ${rows * 100}%;-webkit-mask-position:var(--wk-ri-position);mask-position:var(--wk-ri-position);mask-mode:alpha}`,
    ...iconRules,
    "",
  ].join(
    "\n",
  );

const license =
  licenseBuffer.toString(
    "utf8",
  );

function assertExact(
  file,
  expected,
  label,
) {
  if (
    !fs.existsSync(
      file,
    )
  ) {
    fail(
      `${label} is missing: ${path.relative(
        root,
        file,
      )}`,
    );
  }

  const actual =
    fs.readFileSync(
      file,
      "utf8",
    );

  if (
    actual
    !== expected
  ) {
    fail(
      `${label} is stale; run npm run icons:generate:remixicon`,
    );
  }
}

function walkRuntimeFiles(
  directory,
) {
  const files =
    [];

  for (
    const entry
    of fs.readdirSync(
      directory,
      {
        withFileTypes:
          true,
      },
    )
  ) {
    const full =
      path.join(
        directory,
        entry.name,
      );

    if (
      entry.isDirectory()
    ) {
      files.push(
        ...walkRuntimeFiles(
          full,
        ),
      );
      continue;
    }

    files.push(
      full,
    );
  }

  return files;
}

function assertRuntimeAuthority() {
  const index =
    fs.readFileSync(
      indexPath,
      "utf8",
    );

  if (
    index.includes(
      "cdnjs.cloudflare.com",
    )
    || index.includes(
      "remixicon.min.css",
    )
  ) {
    fail(
      "index.html still grants third-party Remixicon/CDN runtime authority",
    );
  }

  for (
    const full
    of walkRuntimeFiles(
      srcRoot,
    )
  ) {
    if (
      !textExtensions.has(
        path.extname(
          full,
        ),
      )
    ) {
      continue;
    }

    if (
      full
      === outputCssPath
    ) {
      continue;
    }

    const source =
      fs.readFileSync(
        full,
        "utf8",
      );

    if (
      /font-family\s*:\s*["']?remixicon/i.test(
        source,
      )
    ) {
      fail(
        `runtime font-family: remixicon remains in ${path.relative(
          root,
          full,
        )}`,
      );
    }

    if (
      /remixicon\.(?:woff2?|ttf|eot)/i.test(
        source,
      )
    ) {
      fail(
        `Remixicon font asset reference remains in ${path.relative(
          root,
          full,
        )}`,
      );
    }
  }
}

const cssGzipBytes =
  zlib
    .gzipSync(
      Buffer.from(
        css,
      ),
      {
        level:
          9,
      },
    )
    .byteLength;

const spriteGzipBytes =
  zlib
    .gzipSync(
      Buffer.from(
        sprite,
      ),
      {
        level:
          9,
      },
    )
    .byteLength;

const totalGzipBytes =
  cssGzipBytes
  + spriteGzipBytes;

if (
  cssGzipBytes
  >= 12000
) {
  fail(
    `generated compatibility CSS is ${cssGzipBytes} gzip bytes; migration ceiling is 12000`,
  );
}

if (
  totalGzipBytes
  >= 70000
) {
  fail(
    `generated compatibility CSS + sprite are ${totalGzipBytes} gzip bytes; migration ceiling is 70000`,
  );
}

if (
  checkOnly
) {
  assertExact(
    outputCssPath,
    css,
    "WAKILISHA Remixicon compatibility CSS",
  );

  assertExact(
    outputSpritePath,
    sprite,
    "WAKILISHA Remixicon mask sprite",
  );

  assertExact(
    outputLicensePath,
    license,
    "Remixicon license copy",
  );

  assertRuntimeAuthority();

  console.log(
    `WAKILISHA_REMIXICON_COMPAT_AUDIT_PASS icons=${names.length} dynamic_provider_identities=${dynamicIdentityCount} css_raw=${Buffer.byteLength(
      css,
    )} css_gzip=${cssGzipBytes} sprite_raw=${Buffer.byteLength(
      sprite,
    )} sprite_gzip=${spriteGzipBytes} total_gzip=${totalGzipBytes} license_sha=${licenseSha}`,
  );

  process.exit(
    0,
  );
}

fs.mkdirSync(
  path.dirname(
    outputCssPath,
  ),
  {
    recursive:
      true,
  },
);

fs.mkdirSync(
  path.dirname(
    outputLicensePath,
  ),
  {
    recursive:
      true,
  },
);

fs.writeFileSync(
  outputCssPath,
  css,
);

fs.writeFileSync(
  outputSpritePath,
  sprite,
);

fs.writeFileSync(
  outputLicensePath,
  license,
);

console.log(
  `WAKILISHA_REMIXICON_COMPAT_GENERATED icons=${names.length} dynamic_provider_identities=${dynamicIdentityCount} css_raw=${Buffer.byteLength(
    css,
  )} css_gzip=${cssGzipBytes} sprite_raw=${Buffer.byteLength(
    sprite,
  )} sprite_gzip=${spriteGzipBytes} total_gzip=${totalGzipBytes} license_sha=${licenseSha}`,
);
