/**
 * Ordered lookup, shared by every timeline-ish reader in the package.
 *
 * This module imports nothing, deliberately. The evaluator (frames) and the
 * viseme track (seconds) want the same search, but the track is node-safe by
 * contract and so may not import `evaluator.ts`, which pulls `Color` from
 * `@fantoche-dev/core`. What node-safety forbids is that dependency, not
 * sharing a pure helper — keeping the helper in its own leaf module lets both
 * callers have it without either inheriting the other's imports.
 */

/**
 * Index of the last entry whose time is at or before `at`, or -1 if none is.
 *
 * Binary search, so a lookup is O(log n) in the number of entries and never
 * walks the list: readers stay seekable, with no dependence on where the
 * previous lookup landed.
 *
 * @param entries - Entries ordered by increasing `time`.
 * @param at - The time to look up, in whatever unit `time` returns.
 * @param time - Reads one entry's time.
 * @returns The index of the last entry at or before `at`, or -1.
 */
export function lastAtOrBefore<T>(
  entries: readonly T[],
  at: number,
  time: (entry: T) => number,
): number {
  let low = 0;
  let high = entries.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (time(entries[mid]) <= at) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}
