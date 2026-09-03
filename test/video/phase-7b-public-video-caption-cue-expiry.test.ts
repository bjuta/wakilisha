import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const canvas = readFileSync(
  "src/components/video/VideoPlaybackCanvas.tsx",
  "utf8",
);

describe(
  "Phase 7B public Video caption cue expiry",
  () => {
    it(
      "derives visible captions from cue start and end times",
      () => {
        expect(canvas).toContain(
          "const syncActiveCueLines = useCallback",
        );
        expect(canvas).toContain(
          "const cues = selectedTrack?.cues",
        );
        expect(canvas).toContain(
          "time < vttCue.startTime",
        );
        expect(canvas).toContain(
          "time >= vttCue.endTime",
        );
      },
    );

    it(
      "resynchronizes caption visibility on every video time update",
      () => {
        expect(canvas).toContain(
          "const nextTime = event.currentTarget.currentTime",
        );
        expect(canvas).toContain(
          "syncActiveCueLines(nextTime)",
        );
      },
    );

    it(
      "retains cuechange as an immediate synchronization signal",
      () => {
        expect(canvas).toContain(
          "readActiveCues",
        );
        expect(canvas).toContain(
          "\"cuechange\"",
        );
        expect(canvas).toContain(
          "syncActiveCueLines();",
        );
      },
    );

    it(
      "does not rely on browser activeCues as the only expiry authority",
      () => {
        expect(canvas).not.toContain(
          "selectedTrack?.activeCues",
        );
      },
    );
  },
);
