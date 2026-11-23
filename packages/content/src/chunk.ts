export type TextChunk = {
  /** 0-based index within the module, assigned after all chunks are produced */
  chunkIndex: number;
  content: string;
  tokenCount: number;
  sectionHeading: string;
};

const CHARS_PER_TOKEN = 4;
const MAX_SECTION_TOKENS = 700;
const OVERLAP_TOKENS = 60;
const maxSectionChars = MAX_SECTION_TOKENS * CHARS_PER_TOKEN;
const stepChars = maxSectionChars - OVERLAP_TOKENS * CHARS_PER_TOKEN;

function approxTokens(s: string): number {
  return Math.max(0, Math.ceil(s.length / CHARS_PER_TOKEN));
}

/**
 * Slides a char window of ~`maxSectionChars` with `overlapChars` between consecutive chunks.
 */
function splitByCharacterWindows(text: string, sectionHeading: string, out: Omit<TextChunk, "chunkIndex">[]) {
  const t = text.trim();
  if (t.length === 0) return;
  let i = 0;
  while (i < t.length) {
    const end = Math.min(t.length, i + maxSectionChars);
    const slice = t.slice(i, end);
    out.push({ content: slice.trim(), tokenCount: approxTokens(slice), sectionHeading });
    if (end >= t.length) break;
    i += stepChars;
  }
}

function splitOversizeSection(part: string, sectionHeading: string, out: Omit<TextChunk, "chunkIndex">[]) {
  const p = part.trim();
  if (p.length === 0) return;
  if (approxTokens(p) <= MAX_SECTION_TOKENS) {
    out.push({
      content: p,
      tokenCount: approxTokens(p),
      sectionHeading,
    });
    return;
  }
  const paras = p.split(/\n\n+/u);
  let buf = "";
  for (const rawPara of paras) {
    const para = rawPara.trim();
    if (para.length === 0) continue;
    if (approxTokens(para) > MAX_SECTION_TOKENS) {
      if (buf) {
        out.push({
          content: buf,
          tokenCount: approxTokens(buf),
          sectionHeading,
        });
        buf = "";
      }
      splitByCharacterWindows(para, sectionHeading, out);
      continue;
    }
    const candidate = buf ? `${buf}\n\n${para}` : para;
    if (buf && approxTokens(candidate) > MAX_SECTION_TOKENS) {
      out.push({
        content: buf,
        tokenCount: approxTokens(buf),
        sectionHeading,
      });
      buf = para;
    } else {
      buf = candidate;
    }
  }
  if (buf) {
    if (approxTokens(buf) > MAX_SECTION_TOKENS) {
      splitByCharacterWindows(buf, sectionHeading, out);
    } else {
      out.push({ content: buf, tokenCount: approxTokens(buf), sectionHeading });
    }
  }
}

/**
 * Split the Markdown body by `##` sections, then split oversize parts on paragraph / window heuristics.
 * Title is not included in `content` (it is only prepended for embedding in the embedder).
 */
export function chunkModuleBody(body: string): TextChunk[] {
  const bodyTrim = body.replace(/^\s*\n/u, "").trimEnd();
  const lines = bodyTrim.split(/\r?\n/);
  const sections: { heading: string; body: string }[] = [];
  let currentHeading = "Introduction";
  let acc: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (acc.length) {
        sections.push({ heading: currentHeading, body: acc.join("\n") });
        acc = [];
      }
      currentHeading = line.slice(3).trim() || "Untitled";
    } else {
      acc.push(line);
    }
  }
  if (acc.length) {
    sections.push({ heading: currentHeading, body: acc.join("\n") });
  }
  if (sections.length === 0) {
    sections.push({ heading: "Introduction", body: "" });
  }

  const out: Omit<TextChunk, "chunkIndex">[] = [];
  for (const { heading, body: sbody } of sections) {
    const joined = sbody.replace(/\n{3,}/gu, "\n\n").trim();
    splitOversizeSection(joined, heading, out);
  }

  return out.map((c, i) => ({ ...c, chunkIndex: i }));
}
