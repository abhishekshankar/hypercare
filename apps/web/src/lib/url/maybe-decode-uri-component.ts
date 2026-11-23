/**
 * Some navigations (e.g. `?q=${encodeURIComponent(text)}`) leave values still
 * percent-encoded by the time they reach a server component or persisted text.
 * Decode a single URI layer when `%HH` appears; otherwise return the input.
 */
export function maybeDecodePercentEncoding(input: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(input)) {
    return input;
  }
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}
