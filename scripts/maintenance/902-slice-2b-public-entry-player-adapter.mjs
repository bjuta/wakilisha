#!/usr/bin/env node
import fs from "node:fs";

const FILE = "src/components/design-system/player/PlayerFullSurface.tsx";

function fail(message) {
  throw new Error(message);
}

let text = fs.readFileSync(FILE, "utf8");

const sliderPattern = /<WkSlider\s+value=\{volume\}\s+onChange=\{\(nextValue\) => setVolume\(nextValue\)\}\s+ariaLabel="Volume"\s+showValueLabel=\{false\}\s+min=\{0\}\s+max=\{1\}\s+step=\{0\.01\}\s+className="flex-1"\s*\/>/g;
const matches = [...text.matchAll(sliderPattern)];
if (matches.length !== 1) {
  fail(`PlayerFullSurface volume slider: expected one migrated WkSlider, found ${matches.length}`);
}

text = text.replace(
  sliderPattern,
  `<div className="flex-1">
  <SeekRail
    label="Volume"
    currentTime={volume}
    duration={1}
    progress={volume}
    onSeek={setVolume}
    step={0.01}
  />
</div>`,
);

const importPattern = /\n?import \{ WkSlider \} from "@\/components\/design-system\/primitives\/Slider";\n?/g;
const importMatches = [...text.matchAll(importPattern)];
if (importMatches.length !== 1) {
  fail(`PlayerFullSurface WkSlider import: expected one import, found ${importMatches.length}`);
}
text = text.replace(importPattern, "\n");

if (text.includes("WkSlider")) {
  fail("PlayerFullSurface still references WkSlider after volume rail convergence");
}

fs.writeFileSync(FILE, text);
console.log("SLICE_2B_PUBLIC_ENTRY_PLAYER_ADAPTER_PASS");
console.log("expanded_player_volume=existing_seek_rail");
console.log("public_entry_generic_slider_import=retired");
