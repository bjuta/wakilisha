export type PlaybackSessionId = number;

export class PlaybackArbiter {
  private serial = 0;

  begin(): PlaybackSessionId {
    return ++this.serial;
  }

  invalidate(): void {
    this.serial += 1;
  }

  isCurrent(
    sessionId: PlaybackSessionId,
  ): boolean {
    return sessionId === this.serial;
  }

  runIfCurrent<T>(
    sessionId: PlaybackSessionId,
    effect: () => T,
  ): T | undefined {
    if (!this.isCurrent(sessionId)) {
      return undefined;
    }

    return effect();
  }
}
