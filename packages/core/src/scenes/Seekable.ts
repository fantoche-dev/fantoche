/**
 * Optional scene capability: direct time-addressed seeking.
 *
 * A scene implementing this can jump straight to any frame in O(1) —
 * {@link PlaybackManager.seek} then skips the reset-and-step-every-frame
 * replay loop. Follows the {@link Threadable}/{@link Inspectable} idiom.
 */
export interface Seekable {
  /**
   * Jump directly to a global frame.
   *
   * @remarks
   * Must leave the scene in the exact state it would have had after
   * `reset()` followed by `frame - firstFrame` calls to `next()`.
   * `playback.frame` is set to the target before this is invoked.
   *
   * @param frame - The global frame to seek to.
   */
  seekToFrame(frame: number): Promise<void>;
}

export function isSeekable(value: unknown): value is Seekable {
  return (
    typeof value === 'object' &&
    value !== null &&
    'seekToFrame' in value &&
    typeof (value as Seekable).seekToFrame === 'function'
  );
}
