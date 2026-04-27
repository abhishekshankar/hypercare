import type { Citation } from "@alongside/rag";

/**
 * Parses an assistant `text` (from `AnswerResult`) into a sequence of
 * paragraphs. Each paragraph is a list of segments — either plain text or
 * a citation chip that points at one entry in `citations`.
 *
 * Renumbering rationale: layer-6 verify dedupes the citation list in
 * "first-cited order" and stores it as a flat array. The `[n]` numbers
 * the model wrote are source-index based (1..len(sources)), NOT positions
 * into the dedup'd citations array. We renumber on render so the user
 * sees a clean `[1] [2]` sequence corresponding 1:1 to the citation chips
 * below the paragraph. The mapping rule mirrors `verify.ts` exactly:
 * the i-th unique source index (in first-appearance order) becomes chip i.
 *
 * Markers that do not correspond to a known citation slot are dropped from
 * the chip list and rendered as plain bracket text — verify already
 * guarantees this never happens for `answered` results, but it keeps the
 * helper safe to use on possibly-unverified text.
 */

export type Segment =
  | { kind: "text"; text: string }
  | {
      kind: "chip";
      /** 0-based index into the `citations` array. */
      citationIndex: number;
      /** 1-based number to render (`[1]`, `[2]`, ...). */
      displayNumber: number;
    };

export type Paragraph = {
  segments: Segment[];
};

const CITATION_RE = /\[(\d+)\]/g;

export function parseAssistantText(
  text: string,
  citations: readonly Citation[],
): Paragraph[] {
  const sourceIndexToChip = new Map<number, number>();
  // Pre-walk to lock in the citation ordering. Mirrors layer-6's first-cited
  // dedup so display numbers match the chip slot.
  for (const m of text.matchAll(CITATION_RE)) {
    const n = Number(m[1]);
    if (!Number.isInteger(n) || n < 1) continue;
    if (sourceIndexToChip.has(n)) continue;
    if (sourceIndexToChip.size >= citations.length) continue;
    sourceIndexToChip.set(n, sourceIndexToChip.size);
  }

  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);
  return paragraphs.map((p) => ({ segments: tokenize(p, sourceIndexToChip) }));
}

function tokenize(
  paragraph: string,
  sourceIndexToChip: ReadonlyMap<number, number>,
): Segment[] {
  const segs: Segment[] = [];
  let cursor = 0;
  for (const m of paragraph.matchAll(CITATION_RE)) {
    const start = m.index ?? 0;
    if (start > cursor) {
      segs.push({ kind: "text", text: paragraph.slice(cursor, start) });
    }
    const n = Number(m[1]);
    const chipIdx = sourceIndexToChip.get(n);
    if (chipIdx === undefined) {
      // Unknown marker — render as literal text.
      segs.push({ kind: "text", text: m[0] });
    } else {
      segs.push({
        kind: "chip",
        citationIndex: chipIdx,
        displayNumber: chipIdx + 1,
      });
    }
    cursor = start + m[0].length;
  }
  if (cursor < paragraph.length) {
    segs.push({ kind: "text", text: paragraph.slice(cursor) });
  }
  return segs;
}
