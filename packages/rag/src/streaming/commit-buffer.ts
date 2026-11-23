/**
 * Progressive commit points for verified streaming (TASK-031).
 */

export type CommitBufferConfig = {
  minChars: number;
  tailReserve: number;
};

/**
 * Returns exclusive end index into `full` such that `full.slice(committedUpto, end)` is safe
 * to run through the fast-path verifier and emit, or `null` if we should wait for more text.
 */
export function findNextCommitEnd(
  full: string,
  committedUpto: number,
  cfg: CommitBufferConfig,
): number | null {
  const { minChars, tailReserve } = cfg;
  const reserveStart = full.length - tailReserve;
  if (reserveStart <= committedUpto) {
    return null;
  }
  const windowEnd = reserveStart;
  const window = full.slice(committedUpto, windowEnd);
  if (window.length < minChars) {
    return null;
  }

  /** First sentence end in `window` at or after `minChars`, so we flush oldest safe bytes. */
  let firstSentenceEnd = -1;
  for (let i = 0; i < window.length; i++) {
    const c = window[i];
    if (c !== "." && c !== "!" && c !== "?") continue;
    const relNext = i + 1;
    const atLeastMin = relNext >= minChars;
    if (!atLeastMin) continue;
    if (relNext >= window.length) {
      firstSentenceEnd = relNext;
      break;
    }
    const nextChar = window[relNext];
    if (nextChar !== undefined && /\s/.test(nextChar)) {
      let j = relNext;
      while (j < window.length && /\s/.test(window[j]!)) {
        j += 1;
      }
      firstSentenceEnd = j;
      break;
    }
  }

  if (firstSentenceEnd === -1) {
    return null;
  }

  return committedUpto + firstSentenceEnd;
}
