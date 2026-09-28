/** Longest single gap counted, so a laptop that slept with the game open does not add hours. */
export const MAX_GAP_MS = 60_000;

/**
 * Play time from wall-clock timestamps.
 * Counts real time between samples while counting is on, so low frame rates do not undercount.
 * A gap that starts while paused or hidden is never counted.
 */
export class PlayClock {
  private last: number | null = null;

  /** Feed the current time and whether play is running. Returns the milliseconds to add. */
  sample(now: number, isCounting: boolean): number {
    if (!isCounting) {
      this.last = null;
      return 0;
    }
    const previous = this.last;
    this.last = now;
    if (previous === null) return 0;
    return Math.min(MAX_GAP_MS, Math.max(0, now - previous));
  }

  /** Forget the last sample, for example when the tab is hidden. */
  pause(): void {
    this.last = null;
  }
}
