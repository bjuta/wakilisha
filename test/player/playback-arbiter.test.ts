import {
  describe,
  expect,
  it,
} from "vitest";
import fs from "node:fs";
import {
  PlaybackArbiter,
} from "../../src/services/player/playbackArbiter";

function deferred() {
  let resolve!: () => void;

  const promise = new Promise<void>((done) => {
    resolve = done;
  });

  return {
    promise,
    resolve,
  };
}

const player = fs.readFileSync(
  "src/context/PlayerContext.tsx",
  "utf8",
);

const apple = fs.readFileSync(
  "src/services/appleMusicPlayback.ts",
  "utf8",
);

describe(
  "Player M1 playback arbitration",
  () => {
    it(
      "lets only the newest delayed playback session commit",
      async () => {
        const arbiter = new PlaybackArbiter();
        const audible = new Set<string>();
        const events: string[] = [];
        const appleReady = deferred();

        const appleSession = arbiter.begin();

        const lateApple =
          appleReady.promise.then(() => {
            arbiter.runIfCurrent(
              appleSession,
              () => {
                audible.add("apple:A");
                events.push("apple:A");
              },
            );
          });

        const htmlSession = arbiter.begin();

        arbiter.runIfCurrent(
          htmlSession,
          () => {
            audible.clear();
            audible.add("audio:B");
            events.push("audio:B");
          },
        );

        appleReady.resolve();
        await lateApple;

        expect([...audible]).toEqual([
          "audio:B",
        ]);
        expect(events).toEqual([
          "audio:B",
        ]);
      },
    );

    it(
      "keeps only C current across a rapid A to B to C switch",
      () => {
        const arbiter = new PlaybackArbiter();
        const audible = new Set<string>();

        const a = arbiter.begin();
        const b = arbiter.begin();
        const c = arbiter.begin();

        arbiter.runIfCurrent(
          a,
          () => audible.add("A"),
        );
        arbiter.runIfCurrent(
          b,
          () => audible.add("B"),
        );
        arbiter.runIfCurrent(
          c,
          () => audible.add("C"),
        );

        expect([...audible]).toEqual([
          "C",
        ]);
      },
    );

    it(
      "invalidates a pending startup before a late provider can play",
      async () => {
        const arbiter = new PlaybackArbiter();
        const audible = new Set<string>();
        const ready = deferred();

        const session = arbiter.begin();

        const pending =
          ready.promise.then(() => {
            arbiter.runIfCurrent(
              session,
              () => {
                audible.add(
                  "late-provider",
                );
              },
            );
          });

        arbiter.invalidate();

        ready.resolve();
        await pending;

        expect([...audible]).toEqual([]);
      },
    );

    it(
      "binds source switching to one arbiter and silences every engine first",
      () => {
        expect(player).toContain(
          "playbackArbiterRef.current.begin()",
        );
        expect(player).toContain(
          "await silenceAllPlayback(audio)",
        );
        expect(player).toContain(
          "await stopAppleMusic()",
        );
        expect(player).toContain(
          "stopYouTube();",
        );
        expect(player).toContain(
          "stopSoundCloud();",
        );
        expect(player).toContain(
          "isCurrentSession()",
        );
        expect(player).toContain(
          "playbackStartingRef.current",
        );
        expect(player).toContain(
          "restartInterruptedPlaybackRef.current",
        );
        expect(player).toContain(
          "isActiveHtmlAudio",
        );
      },
    );

    it(
      "makes Apple startup cancellable and drains queue mutations before stop",
      () => {
        expect(apple).toContain(
          "let playbackRequestSerial = 0;",
        );
        expect(apple).toContain(
          "let playbackMutation: Promise<void> = Promise.resolve();",
        );
        expect(apple).toContain(
          "requestId !== playbackRequestSerial",
        );
        expect(apple).toContain(
          "export async function stopAppleMusic()",
        );
        expect(apple).toContain(
          "const pendingMutation = playbackMutation;",
        );
        expect(apple).toContain(
          "const mutation = playbackMutation.then(run, run);",
        );
        expect(apple).toContain(
          "await music.pause();",
        );
      },
    );
  },
);
