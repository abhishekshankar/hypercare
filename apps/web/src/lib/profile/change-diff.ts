/**
 * Deep equality and per-field diffs for care profile change-log writes.
 */

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (a == null && b == null) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a !== "object") {
    return a === b;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  if (Array.isArray(a)) {
    const aa = a as unknown[];
    const bb = b as unknown[];
    if (aa.length !== bb.length) {
      return false;
    }
    return aa.every((v, i) => deepEqual(v, bb[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    if (!deepEqual(ao[k], bo[k])) {
      return false;
    }
  }
  return true;
}

export type ProfileChangePart = {
  section: "about_cr" | "stage" | "living" | "about_you" | "what_matters";
  field: string;
  oldValue: unknown;
  newValue: unknown;
};

export function diffScalarFields(
  section: ProfileChangePart["section"],
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): ProfileChangePart[] {
  const out: ProfileChangePart[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const field of keys) {
    const o = before[field];
    const n = after[field];
    if (deepEqual(o, n)) {
      continue;
    }
    out.push({ section, field, oldValue: o ?? null, newValue: n ?? null });
  }
  return out;
}

