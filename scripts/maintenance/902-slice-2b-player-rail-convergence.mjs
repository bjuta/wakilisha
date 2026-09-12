#!/usr/bin/env node
import fs from "node:fs";

const PLAYER_DOCK = "src/components/design-system/music/PlayerDock.tsx";
const PLAYER_FULL = "src/components/design-system/player/PlayerFullSurface.tsx";
const SEEK_RAIL = "src/components/design-system/player/SeekRail.tsx";

function fail(message) {
  throw new Error(message);
}

function replaceOnce(text, pattern, replacement, context) {
  const matches = [...text.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) {
    fail(`${context}: expected one match, found ${matches.length}`);
  }
  return text.replace(pattern, replacement);
}

function removeSliderImport(text, context) {
  const next = replaceOnce(
    text,
    /\n?import \{ WkSlider \} from "@\/components\/design-system\/primitives\/Slider";\n?/,
    "\n",
    `${context} WkSlider import`,
  );
  if (next.includes("WkSlider")) {
    fail(`${context}: residual WkSlider reference remains`);
  }
  return next;
}

function replaceFullPlayerVolumeSlider(text) {
  const pattern = /<WkSlider\s+value=\{volume\}\s+onChange=\{\(nextValue\) => setVolume\(nextValue\)\}\s+ariaLabel="Volume"\s+showValueLabel=\{false\}\s+min=\{0\}\s+max=\{1\}\s+step=\{0\.01\}\s+className="[^"]+"\s*\/>/;
  const replacement = `<div className="flex-1">
  <SeekRail
    label="Volume"
    currentTime={volume}
    duration={1}
    progress={volume}
    onSeek={setVolume}
    step={0.01}
    variant="inline"
  />
</div>`;
  return replaceOnce(text, pattern, replacement, "PlayerFullSurface volume slider");
}

let dock = fs.readFileSync(PLAYER_DOCK, "utf8");
dock = replaceOnce(
  dock,
  /\n\s*<div className="hidden items-center gap-2 sm:flex">\s*<i className="ri-volume-up-line text-\[var\(--wk-text-muted\)\]" \/>\s*<WkSlider\s+value=\{volume\}\s+onChange=\{\(nextValue\) => setVolume\(nextValue\)\}\s+ariaLabel="Volume"\s+showValueLabel=\{false\}\s+min=\{0\}\s+max=\{1\}\s+step=\{0\.01\}\s+className="w-24"\s*\/>\s*<\/div>\n/,
  "\n",
  "PlayerDock collapsed volume control",
);
dock = replaceOnce(dock, /\n\s{4}volume,\n\s{4}setVolume,/, "", "PlayerDock volume state");
dock = removeSliderImport(dock, "PlayerDock");
fs.writeFileSync(PLAYER_DOCK, dock);

let full = fs.readFileSync(PLAYER_FULL, "utf8");
if (!full.includes('import { SeekRail } from "./SeekRail";')) {
  fail("PlayerFullSurface: canonical SeekRail import missing");
}
full = replaceFullPlayerVolumeSlider(full);
full = removeSliderImport(full, "PlayerFullSurface");
fs.writeFileSync(PLAYER_FULL, full);

let rail = fs.readFileSync(SEEK_RAIL, "utf8");
rail = replaceOnce(
  rail,
  /  variant = "inline",\n}: \{/,
  '  variant = "inline",\n  step = 5,\n}: {',
  "SeekRail default step",
);
rail = replaceOnce(
  rail,
  /  variant\?: SeekRailVariant;\n}/,
  "  variant?: SeekRailVariant;\n  step?: number;\n}",
  "SeekRail step prop",
);
rail = replaceOnce(
  rail,
  /      aria-valuemax=\{Math\.max\(\n        0,\n        Math\.round\(safeDuration\),\n      \)}/,
  "      aria-valuemax={safeDuration}",
  "SeekRail aria-valuemax",
);
rail = replaceOnce(
  rail,
  /      aria-valuenow=\{Math\.max\(\n        0,\n        Math\.round\(currentTime \|\| 0\),\n      \)}/,
  "      aria-valuenow={Math.max(0, Math.min(safeDuration, currentTime || 0))}",
  "SeekRail aria-valuenow",
);
rail = replaceOnce(
  rail,
  /currentTime - 5/,
  "currentTime - step",
  "SeekRail decrement step",
);
rail = replaceOnce(
  rail,
  /currentTime \+ 5/,
  "currentTime + step",
  "SeekRail increment step",
);
fs.writeFileSync(SEEK_RAIL, rail);

console.log("SLICE_2B_PLAYER_RAIL_CONVERGENCE_PASS");
console.log("collapsed_player_volume_slider=retired");
console.log("full_player_volume_slider=canonical_seek_rail");
console.log("eager_generic_slider_imports=0");
