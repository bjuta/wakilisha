/** WAKILISHA shared audio-deck mixer.
 *
 * Audio originates at its existing delivery provider. Only public iTunes
 * previews are routed through our tightly-scoped HTTPS media transport so
 * iOS Web Audio can process their samples. No catalogue ingestion occurs.
 */
const ITUNES_HOST = "audio-ssl.itunes.apple.com";
const ITUNES_PATH = /^\/itunes-assets\/AudioPreview[^/]*\/v\d+\/[^?#]+\.(?:m4a|mp3)$/i;
const MAX_ANALYSIS_BYTES = 2_500_000;
const MAX_ANALYSIS_SECONDS = 65;

export function resolveMixableAudioSource(input: string): { url: string; mixable: boolean } {
  try {
    const parsed = new URL(input, typeof window === "undefined" ? "https://wakilisha.africa" : window.location.origin);
    if (parsed.protocol === "data:" || parsed.protocol === "blob:") return { url: input, mixable: true };
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { url: input, mixable: false };
    if (parsed.hostname === ITUNES_HOST && parsed.protocol === "https:" &&
        !parsed.username && !parsed.password && ITUNES_PATH.test(parsed.pathname)) {
      return { url: `/__wk-mix${parsed.pathname}`, mixable: true };
    }
    const origin = typeof window === "undefined" ? "https://wakilisha.africa" : window.location.origin;
    if (parsed.origin === origin || (parsed.protocol === "https:" && parsed.hostname === "media.wakilisha.africa")) {
      return { url: parsed.href, mixable: true };
    }
    return { url: input, mixable: false };
  } catch {
    return { url: input, mixable: false };
  }
}

export function equalPowerLevels(fraction: number): { outgoing: number; incoming: number } {
  const p = Math.max(0, Math.min(1, fraction));
  return { outgoing: Math.cos(p * Math.PI / 2), incoming: Math.sin(p * Math.PI / 2) };
}

export function safeTempoMatchRate(outgoingBpm?: number | null, incomingBpm?: number | null): number {
  if (!outgoingBpm || !incomingBpm || !Number.isFinite(outgoingBpm) || !Number.isFinite(incomingBpm)) return 1;
  if (outgoingBpm < 60 || outgoingBpm > 210 || incomingBpm < 60 || incomingBpm > 210) return 1;
  const ratio = outgoingBpm / incomingBpm;
  // Keep character and pitch intact. Large tempo jumps get a natural blend.
  return ratio >= 0.94 && ratio <= 1.06 ? ratio : 1;
}

/** Estimate tempo from short, authorized-to-read PCM. Never claim an uncertain result. */
export function estimateBeatTempo(buffer: AudioBuffer): number | null {
  if (buffer.duration < 8 || buffer.duration > MAX_ANALYSIS_SECONDS) return null;
  const samples = buffer.getChannelData(0);
  const hop = Math.max(64, Math.round(buffer.sampleRate / 100));
  const count = Math.floor(samples.length / hop);
  if (count < 800) return null;
  const onset = new Float32Array(count);
  let previous = 0;
  for (let i = 0; i < count; i++) {
    let energy = 0;
    const start = i * hop;
    for (let j = 0; j < hop; j += 4) {
      energy += Math.abs(samples[start + j] || 0);
    }
    onset[i] = Math.max(0, energy - previous * 0.9);
    previous = energy;
  }
  // Pearson-style normalized autocorrelation prefers a strong periodic pulse.
  const fps = buffer.sampleRate / hop;
  let bestBpm = 0, bestScore = 0;
  for (let bpm = 76; bpm <= 165; bpm++) {
    const lag = Math.round(60 * fps / bpm);
    let cross = 0, normA = 0, normB = 0;
    for (let i = lag; i < count; i++) {
      cross += onset[i] * onset[i - lag];
      normA += onset[i] * onset[i];
      normB += onset[i - lag] * onset[i - lag];
    }
    const score = cross / Math.max(0.00001, Math.sqrt(normA * normB));
    if (score > bestScore) { bestScore = score; bestBpm = bpm; }
  }
  return bestScore >= 0.42 ? bestBpm : null;
}

type Deck = { source: MediaElementAudioSourceNode; gain: GainNode };

export class WakilishaMixEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private decks = new WeakMap<HTMLAudioElement, Deck>();
  private tempo = new Map<string, number | null>();
  private tempoPending = new Set<string>();

  wake(): void {
    if (typeof window === "undefined" || !window.AudioContext) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended") void this.context.resume().catch(() => {});
    } catch { /* Native playback remains available. */ }
  }

  isRunning(): boolean { return this.context?.state === "running"; }

  prepare(audio: HTMLAudioElement, source: { url: string; mixable: boolean }): boolean {
    if (!source.mixable || !this.isRunning()) return false;
    if (!this.context || !this.master) return false;
    if (this.decks.has(audio)) return true;
    try {
      // Must be set before src assignment. Same-origin transport stays CORS-safe.
      const node = this.context.createMediaElementSource(audio);
      const gain = this.context.createGain();
      gain.gain.value = 1;
      node.connect(gain);
      gain.connect(this.master);
      this.decks.set(audio, { source: node, gain });
      audio.volume = 1;
      return true;
    } catch {
      // Do not route unsupported audio through a silent Web Audio graph.
      return false;
    }
  }

  hasDeck(audio: HTMLAudioElement): boolean { return this.decks.has(audio); }

  setMasterVolume(volume: number): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), now);
  }

  setLevel(audio: HTMLAudioElement | null, level: number, nativeVolume: number): void {
    if (!audio) return;
    const deck = this.decks.get(audio);
    if (deck && this.context) {
      const now = this.context.currentTime;
      deck.gain.gain.cancelScheduledValues(now);
      deck.gain.gain.setValueAtTime(Math.max(0, Math.min(1, level)), now);
    } else {
      try { audio.volume = Math.max(0, Math.min(1, level * nativeVolume)); } catch {}
    }
  }

  beginFade(outgoing: HTMLAudioElement, incoming: HTMLAudioElement, seconds: number): boolean {
    const a = this.decks.get(outgoing), b = this.decks.get(incoming);
    if (!a || !b || !this.context || seconds <= 0) return false;
    const now = this.context.currentTime;
    const outCurve = new Float32Array(65), inCurve = new Float32Array(65);
    for (let i = 0; i < 65; i++) {
      const levels = equalPowerLevels(i / 64);
      outCurve[i] = levels.outgoing;
      inCurve[i] = levels.incoming;
    }
    a.gain.gain.cancelScheduledValues(now);
    b.gain.gain.cancelScheduledValues(now);
    a.gain.gain.setValueCurveAtTime(outCurve, now, seconds);
    b.gain.gain.setValueCurveAtTime(inCurve, now, seconds);
    return true;
  }

  private normalized(url: string): string {
    try { return new URL(url, typeof window === "undefined" ? "https://wakilisha.africa" : window.location.origin).href; }
    catch { return url; }
  }

  bpmFor(url: string): number | null { return this.tempo.get(this.normalized(url)) ?? null; }

  /** Analyze only small, already-playable audio previews, never entire albums. */
  analyzeShortAudio(url: string, knownDuration: number): void {
    url = this.normalized(url);
    if (!this.context || !url || !Number.isFinite(knownDuration) ||
        knownDuration < 8 || knownDuration > MAX_ANALYSIS_SECONDS ||
        this.tempo.has(url) || this.tempoPending.has(url)) return;
    this.tempoPending.add(url);
    const context = this.context;
    void (async () => {
      let bpm: number | null = null;
      try {
        const response = await fetch(url, { mode: "cors", credentials: "omit", cache: "force-cache" });
        const length = Number(response.headers.get("content-length") || 0);
        if (!response.ok || (length && length > MAX_ANALYSIS_BYTES)) return;
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength <= MAX_ANALYSIS_BYTES) {
          const pcm = await context.decodeAudioData(bytes);
          bpm = estimateBeatTempo(pcm);
        }
      } catch { /* Smart Mix falls back to an equal-power fade. */ }
      finally {
        this.tempo.set(url, bpm);
        this.tempoPending.delete(url);
        if (this.tempo.size > 24) this.tempo.delete(this.tempo.keys().next().value!);
      }
    })();
  }

  close(): void {
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.master = null;
    this.tempo.clear();
  }
}
