const H_CURRENT = /##\s*Current focus\s*([\s\S]*?)(?=^##\s|\s*$)/m;
const H_TRIED = /##\s*What's been tried\s*([\s\S]*?)(?=^##\s|\s*$)/m;
const H_OPEN = /##\s*Open threads\s*([\s\S]*?)(?=^##\s|\s*$)/m;
const H_SIG = /##\s*Signals the model should carry forward\s*([\s\S]*?)(?=\s*$)/m;

const HEADINGS: Array<{ key: string; re: RegExp }> = [
  { key: "Current focus", re: H_CURRENT },
  { key: "What's been tried", re: H_TRIED },
  { key: "Open threads", re: H_OPEN },
  { key: "Signals the model should carry forward", re: H_SIG },
];

function bulletBody(line: string): string | null {
  const m = /^\s*-\s*(.+)\s*$/.exec(line);
  return m?.[1] ?? null;
}

function isNoneNotedBullet(body: string): boolean {
  return /^—\s*\(none noted\)\.?\s*$/i.test(body.trim());
}

function bulletMatchesForgotten(body: string, forgottenTexts: readonly string[]): boolean {
  const b = body.trim();
  if (b.length === 0) return false;
  for (const f of forgottenTexts) {
    const t = f.trim();
    if (t.length === 0) continue;
    const bl = b.toLowerCase();
    const tl = t.toLowerCase();
    if (bl === tl) return true;
    if (bl.includes(tl) || tl.includes(bl)) return true;
  }
  return false;
}

function filterSectionBody(body: string, forgottenTexts: readonly string[]): string {
  const lines = body.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const bb = bulletBody(line);
    if (bb == null) {
      if (line.trim().length > 0) out.push(line);
      continue;
    }
    if (isNoneNotedBullet(bb)) {
      out.push(line);
      continue;
    }
    if (bulletMatchesForgotten(bb, forgottenTexts)) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

function sectionHasRealBullets(body: string): boolean {
  for (const line of body.split("\n")) {
    const bb = bulletBody(line);
    if (bb == null) continue;
    if (isNoneNotedBullet(bb)) continue;
    if (bb.trim().length > 0) return true;
  }
  return false;
}

/** Remove bullet lines that match the forgotten list (exact / substring). Preserves headings order. */
export function stripForgottenBulletsFromSummary(
  summaryMd: string,
  forgottenTexts: readonly string[],
): string {
  if (forgottenTexts.length === 0) return summaryMd;
  const parts: string[] = [];
  for (const { key, re } of HEADINGS) {
    const m = re.exec(summaryMd);
    if (!m?.[1]) continue;
    const filtered = filterSectionBody(m[1], forgottenTexts);
    if (!sectionHasRealBullets(filtered)) continue;
    parts.push(`## ${key}\n${filtered}`);
  }
  return parts.join("\n\n").trim();
}

export type MemoryTransparencySection = { heading: string; bullets: string[] };

/** Parses structured memory markdown into sections with bullet text (no leading "- "). Omits empty sections. */
export function parseMemoryTransparencySections(summaryMd: string): MemoryTransparencySection[] {
  const out: MemoryTransparencySection[] = [];
  for (const { key, re } of HEADINGS) {
    const m = re.exec(summaryMd);
    if (!m?.[1]) continue;
    const bullets: string[] = [];
    for (const line of m[1].split("\n")) {
      const bb = bulletBody(line);
      if (bb == null) continue;
      if (isNoneNotedBullet(bb)) continue;
      const t = bb.trim();
      if (t.length > 0) bullets.push(t);
    }
    if (bullets.length === 0) continue;
    out.push({ heading: key, bullets });
  }
  return out;
}
