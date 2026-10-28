import { expect, test } from "@playwright/test";

/**
 * Architecture feasibility test only: NOT WAKILISHA runtime acceptance.
 * Proves that WebKit iPhone can output two independent decoded buffers through
 * a single AudioContext at the same time. No HTMLMediaElement is created for
 * either stream and no media/play permissions are mocked.
 */
function makeWav(frequency: number): Buffer {
  const sampleRate = 16000;
  const seconds = 8;
  const samples = sampleRate * seconds;
  const pcm = Buffer.alloc(44 + samples * 2);
  pcm.write("RIFF", 0, "ascii");
  pcm.writeUInt32LE(36 + samples * 2, 4);
  pcm.write("WAVEfmt ", 8, "ascii");
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20);
  pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(sampleRate, 24);
  pcm.writeUInt32LE(sampleRate * 2, 28);
  pcm.writeUInt16LE(2, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write("data", 36, "ascii");
  pcm.writeUInt32LE(samples * 2, 40);
  for (let sample = 0; sample < samples; sample++) {
    const value = Math.round(
      Math.sin((2 * Math.PI * frequency * sample) / sampleRate) * 12500,
    );
    pcm.writeInt16LE(value, 44 + sample * 2);
  }
  return pcm;
}

test("Chapter 25 buffer-mixer proof: two decoded streams on WebKit iPhone", async ({ page }) => {
  const media: Record<string, Buffer> = {
    "a.wav": makeWav(220),
    "b.wav": makeWav(330),
  };
  await page.route("**/__wk-mix/ch25-buffer-*.wav", async (route) => {
    const url = new URL(route.request().url());
    const wav = media[url.pathname.endsWith("ch25-buffer-a.wav") ? "a.wav" : "b.wav"];
    await route.fulfill({
      status: 200,
      body: wav,
      contentType: "audio/wav",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.evaluate(async () => {
    const context = new AudioContext();
    const urls = [
      "/__wk-mix/ch25-buffer-a.wav",
      "/__wk-mix/ch25-buffer-b.wav",
    ];
    const buffers = await Promise.all(urls.map(async (url) => {
      const response = await fetch(url, {
        mode: "cors",
        credentials: "omit",
      });
      if (!response.ok) throw new Error("Fixture HTTP " + response.status);
      return context.decodeAudioData(await response.arrayBuffer());
    }));
    const master = context.createGain();
    master.gain.value = 0.8;
    master.connect(context.destination);
    const analysers = [context.createAnalyser(), context.createAnalyser()];
    const gains = [context.createGain(), context.createGain()];
    analysers.forEach((analyser, index) => {
      analyser.fftSize = 2048;
      analyser.connect(gains[index]);
      gains[index].connect(master);
    });

    const proof = { context, buffers, analysers, gains, sources: [] as AudioBufferSourceNode[] };
    Object.assign(window, { __wkBufferArchitectureProof: proof });

    const button = document.createElement("button");
    button.type = "button";
    button.id = "wk-buffer-proof-start";
    button.textContent = "Start controlled buffer-mixer proof";
    button.style.cssText = [
      "position:fixed",
      "z-index:2147483647",
      "top:20px",
      "left:20px",
      "border:2px solid black",
      "background:white",
      "color:black",
      "padding:16px",
    ].join(";");
    button.addEventListener("click", () => {
      // Do both operations synchronously in a genuine browser click.
      void context.resume();
      const startsAt = context.currentTime + 0.15;
      for (let index = 0; index < 2; index++) {
        const source = context.createBufferSource();
        source.buffer = buffers[index];
        source.connect(analysers[index]);
        source.start(startsAt);
        proof.sources.push(source);
      }
      gains[0].gain.setValueAtTime(1, startsAt);
      gains[1].gain.setValueAtTime(0.1, startsAt);
      gains[0].gain.linearRampToValueAtTime(0.1, startsAt + 3);
      gains[1].gain.linearRampToValueAtTime(1, startsAt + 3);
    }, { once: true });
    document.body.append(button);
  });

  const measure = () => page.evaluate(() => {
    const proof = (window as unknown as {
      __wkBufferArchitectureProof: {
        context: AudioContext;
        buffers: AudioBuffer[];
        analysers: AnalyserNode[];
        gains: GainNode[];
        sources: AudioBufferSourceNode[];
      };
    }).__wkBufferArchitectureProof;
    const peaks = proof.analysers.map((analyser) => {
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      return samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    });
    return {
      state: proof.context.state,
      clock: proof.context.currentTime,
      buffers: proof.buffers.map((buffer) => buffer.duration),
      sourceCount: proof.sources.length,
      peaks,
      gains: proof.gains.map((gain) => gain.gain.value),
      concurrentPCM: peaks.every((peak) => peak > 0.05),
    };
  });

  await page.locator("#wk-buffer-proof-start").click();
  try {
    await expect.poll(async () => {
      const result = await measure();
      return result.state === "running" &&
        result.sourceCount === 2 &&
        result.concurrentPCM &&
        result.gains.every((level) => level > 0.05);
    }, {
      intervals: [80, 120, 160],
      timeout: 7000,
      message: "Both independently decoded AudioBufferSourceNode signals must have nonzero PCM",
    }).toBe(true);
    const early = await measure();
    await page.waitForTimeout(1300);
    const late = await measure();
    expect(late.concurrentPCM).toBe(true);
    expect(late.gains[0]).toBeLessThan(early.gains[0]);
    expect(late.gains[1]).toBeGreaterThan(early.gains[1]);
  } catch (error) {
    console.error("CH25_BUFFER_ARCHITECTURE_PROOF=" + JSON.stringify(await measure()));
    throw error;
  }
});
