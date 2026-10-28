import { equalPowerLevels, resolveMixableAudioSource } from "./WakilishaMixEngine";

/**
 * Chapter 25 preview-only Web Audio transport.
 *
 * On iPhone WebKit, HTMLMediaElement.play() can resolve and currentTime can
 * advance while a second MediaElementAudioSourceNode outputs zero PCM.
 * Therefore this engine NEVER attaches an HTMLMediaElement to Web Audio.
 *
 * Limited to short, authorized, CORS-readable preview URLs; unsupported or
 * unavailable media stay on the existing native/provider playback path.
 */
const MAX_BYTES = 2_500_000;
const MAX_SECONDS = 65;
const MAX_CACHE = 2;
const SIGNAL_FLOOR = 0.0005;

type BufferDeck = {
  key: string;
  buffer: AudioBuffer;
  source: AudioBufferSourceNode;
  gain: GainNode;
  analyser: AnalyserNode;
  startedAt: number;
  offset: number;
  rate: number;
};

export class WakilishaPreviewBufferMixer {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private cache = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer | null>>();
  private active: BufferDeck | null = null;
  private fadingOut: BufferDeck | null = null;
  private held: { key: string; position: number; rate: number } | null = null;
  private epoch = 0;
  private volume = 0.8;

  /** Synchronous in the Play or transition-selection gesture on iOS. */
  wake(): void {
    if (typeof window === "undefined" || !window.AudioContext) return;
    try {
      if (!this.context || this.context.state === "closed") {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
      }
      if (this.context.state !== "running") {
        void this.context.resume().catch(() => {});
      }
    } catch {
      // Never interrupt a natively playing track if the audio graph is absent.
    }
  }

  get isRunning(): boolean {
    return this.context?.state === "running";
  }

  get isActive(): boolean {
    return this.active !== null;
  }

  get isPaused(): boolean {
    return this.active === null && this.held !== null;
  }

  get isFading(): boolean {
    return this.fadingOut !== null;
  }

  get key(): string | null {
    return this.active?.key ?? this.held?.key ?? null;
  }

  get duration(): number {
    return this.active?.buffer.duration ??
      (this.held ? this.cache.get(this.held.key)?.duration : undefined) ?? 0;
  }

  get position(): number {
    if (!this.active || !this.context) return this.held?.position ?? 0;
    const deck = this.active;
    const elapsed = (this.context.currentTime - deck.startedAt) * deck.rate;
    return Math.max(0, Math.min(deck.buffer.duration, deck.offset + Math.max(0, elapsed)));
  }

  get rate(): number {
    return this.active?.rate ?? this.held?.rate ?? 1;
  }

  /** The source allowlist is the existing Chapter 25 public-preview policy. */
  static keyFor(url: string): string | null {
    const source = resolveMixableAudioSource(url);
    if (!source.mixable) return null;
    return new URL(source.url, window.location.origin).href;
  }

  /** Decode capped complete previews, not albums or unbounded streaming media. */
  async prepare(url: string): Promise<boolean> {
    if (!this.context) return false;
    const key = WakilishaPreviewBufferMixer.keyFor(url);
    if (!key) return false;
    if (this.cache.has(key)) return true;
    const previous = this.pending.get(key);
    if (previous) return (await previous) !== null;
    const context = this.context;
    const request = (async (): Promise<AudioBuffer | null> => {
      try {
        const response = await fetch(key, {
          mode: "cors",
          credentials: "omit",
          cache: "force-cache",
        });
        if (!response.ok) return null;
        const declared = Number(response.headers.get("content-length") || 0);
        if (declared > MAX_BYTES) return null;
        const bytes = await response.arrayBuffer();
        if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) return null;
        const decoded = await context.decodeAudioData(bytes);
        if (!Number.isFinite(decoded.duration) || decoded.duration <= 0 ||
            decoded.duration > MAX_SECONDS || decoded.numberOfChannels < 1) return null;
        // Reject files which decode successfully but contain no real audio.
        let audible = false;
        for (let channel = 0; channel < Math.min(decoded.numberOfChannels, 2) && !audible; channel++) {
          const pcm = decoded.getChannelData(channel);
          for (let index = 0; index < pcm.length; index += 16) {
            if (Math.abs(pcm[index]) > SIGNAL_FLOOR) {
              audible = true;
              break;
            }
          }
        }
        if (!audible) return null;
        this.cache.delete(key);
        this.cache.set(key, decoded);
        while (this.cache.size > MAX_CACHE) {
          const oldest = this.cache.keys().next().value;
          if (!oldest) break;
          this.cache.delete(oldest);
        }
        return decoded;
      } catch {
        return null;
      } finally {
        this.pending.delete(key);
      }
    })();
    this.pending.set(key, request);
    return (await request) !== null;
  }

  hasPrepared(url: string): boolean {
    const key = WakilishaPreviewBufferMixer.keyFor(url);
    return key !== null && this.cache.has(key);
  }

  preparedDuration(url: string): number {
    const key = WakilishaPreviewBufferMixer.keyFor(url);
    return key ? this.cache.get(key)?.duration ?? 0 : 0;
  }

  private buildDeck(key: string, offset: number, rate: number, level: number): BufferDeck | null {
    if (!this.context || !this.master || !this.isRunning) return null;
    const buffer = this.cache.get(key);
    if (!buffer) return null;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 2048;
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.value = level;
    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(this.master);
    const safeOffset = Math.min(Math.max(0, offset), Math.max(0, buffer.duration - 0.02));
    const deck: BufferDeck = {
      key, buffer, source, gain, analyser,
      startedAt: this.context.currentTime,
      offset: safeOffset, rate,
    };
    source.onended = () => {
      source.disconnect();
      analyser.disconnect();
      gain.disconnect();
      if (this.fadingOut === deck) this.fadingOut = null;
    };
    try {
      source.start(0, safeOffset);
      return deck;
    } catch {
      source.disconnect();
      analyser.disconnect();
      gain.disconnect();
      return null;
    }
  }

  /**
   * Move to already-decoded PCM. The caller pauses the native HTMLAudioElement
   * only after this succeeds. Never fetch in the playback handoff itself.
   */
  startPrepared(url: string, offset = 0, rate = 1): boolean {
    const key = WakilishaPreviewBufferMixer.keyFor(url);
    if (!key || !this.cache.has(key) || !this.isRunning) return false;
    const safeRate = Math.min(2, Math.max(0.5, rate));
    const next = this.buildDeck(key, offset, safeRate, 1);
    if (!next) return false;
    this.stopDeck(this.active);
    this.stopDeck(this.fadingOut);
    this.active = next;
    this.fadingOut = null;
    this.held = null;
    this.epoch += 1;
    return true;
  }

  /**
   * Equal-power, sample-clock-synchronized transition. No element.volume
   * mutations or Audio MediaElementSource nodes are involved.
   */
  fadeToPrepared(url: string, seconds: number, rate = 1): boolean {
    const current = this.active;
    const context = this.context;
    const key = WakilishaPreviewBufferMixer.keyFor(url);
    if (!current || !context || !this.isRunning || !key || !this.cache.has(key) ||
        this.fadingOut || key === current.key || seconds <= 0) return false;
    const nextRate = Math.min(2, Math.max(0.5, rate));
    const incoming = this.buildDeck(key, 0, nextRate, 0);
    if (!incoming) return false;
    const span = Math.min(seconds, current.buffer.duration - this.position);
    if (span <= 0.05) {
      this.stopDeck(incoming);
      return false;
    }
    const startAt = context.currentTime;
    const outgoingCurve = new Float32Array(65);
    const incomingCurve = new Float32Array(65);
    for (let i = 0; i < outgoingCurve.length; i++) {
      const levels = equalPowerLevels(i / 64);
      outgoingCurve[i] = levels.outgoing;
      incomingCurve[i] = levels.incoming;
    }
    current.gain.gain.cancelScheduledValues(startAt);
    incoming.gain.gain.cancelScheduledValues(startAt);
    current.gain.gain.setValueCurveAtTime(outgoingCurve, startAt, span);
    incoming.gain.gain.setValueCurveAtTime(incomingCurve, startAt, span);
    // Stop the outgoing stream on the AudioContext clock, not a JS timer.
    try { current.source.stop(startAt + span + 0.01); } catch { /* already stopped */ }
    this.fadingOut = current;
    this.active = incoming;
    this.held = null;
    this.epoch += 1;
    return true;
  }

  hasLivePCM(which: "active" | "outgoing"): boolean {
    const deck = which === "active" ? this.active : this.fadingOut;
    if (!deck || !this.isRunning) return false;
    const pcm = new Float32Array(deck.analyser.fftSize);
    deck.analyser.getFloatTimeDomainData(pcm);
    return pcm.some(value => Math.abs(value) > SIGNAL_FLOOR);
  }

  setVolume(level: number): void {
    this.volume = Math.min(1, Math.max(0, level));
    if (this.master && this.context) {
      this.master.gain.setValueAtTime(this.volume, this.context.currentTime);
    }
  }

  setRate(rate: number): void {
    const next = Math.min(2, Math.max(0.5, rate));
    if (this.held) this.held.rate = next;
    if (!this.active || !this.context) return;
    const current = this.active;
    const position = this.position;
    current.offset = position;
    current.startedAt = this.context.currentTime;
    current.rate = next;
    current.source.playbackRate.setValueAtTime(next, this.context.currentTime);
  }

  pause(): void {
    if (!this.active) return;
    this.held = { key: this.active.key, position: this.position, rate: this.rate };
    this.stopDeck(this.active);
    this.stopDeck(this.fadingOut);
    this.active = null;
    this.fadingOut = null;
    this.epoch += 1;
  }

  resume(): boolean {
    if (!this.held) return false;
    // Call wake() before resume() within a trusted user Play gesture.
    return this.startPrepared(this.held.key, this.held.position, this.held.rate);
  }

  seek(seconds: number): boolean {
    if (!this.active && !this.held) return false;
    const key = this.key;
    if (!key) return false;
    const offset = Math.min(Math.max(0, seconds), Math.max(0, this.duration - 0.02));
    if (this.held) {
      this.held.position = offset;
      return true;
    }
    return this.startPrepared(key, offset, this.rate);
  }

  /** End a session. In-flight decodes cannot become audible by themselves. */
  stop(): void {
    this.stopDeck(this.active);
    this.stopDeck(this.fadingOut);
    this.active = null;
    this.fadingOut = null;
    this.held = null;
    this.epoch += 1;
  }

  private stopDeck(deck: BufferDeck | null): void {
    if (!deck) return;
    try { deck.source.stop(); } catch { /* completion already stopped */ }
  }

  async close(): Promise<void> {
    this.stop();
    this.cache.clear();
    this.pending.clear();
    const context = this.context;
    this.context = null;
    this.master = null;
    if (context && context.state !== "closed") {
      await context.close().catch(() => {});
    }
  }
}
