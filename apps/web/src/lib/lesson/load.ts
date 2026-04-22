/**
 * Split module markdown on `##` headings for the lesson core (TASK-024).
 * Content before the first `##` is ignored for the three swipeable cards.
 */

export type LessonSection = { title: string; body: string };

/**
 * `##` sections in document order, excluding the preamble before the first `##`.
 */
export function splitBodyIntoSections(bodyMd: string): LessonSection[] {
  const text = bodyMd.replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const sections: LessonSection[] = [];
  let currentTitle: string | null = null;
  let buf: string[] = [];

  function flush() {
    if (currentTitle == null) {
      buf = [];
      return;
    }
    const b = buf.join("\n").trim();
    sections.push({ title: currentTitle, body: b.length > 0 ? b : " " });
    buf = [];
  }

  for (const line of lines) {
    const m = /^##\s+(.+)$/.exec(line);
    if (m) {
      flush();
      currentTitle = m[1]!.trim();
      continue;
    }
    if (currentTitle != null) {
      buf.push(line);
    }
  }
  flush();

  if (sections.length === 0) {
    const whole = text.trim();
    if (whole.length === 0) {
      return [{ title: "Lesson", body: "Content is not available yet." }];
    }
    return splitIntoThirds(whole);
  }

  return sections;
}

function splitIntoThirds(text: string): LessonSection[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [{ title: "Lesson", body: text }];
  }
  const n = words.length;
  const a = Math.ceil(n / 3);
  const b = Math.ceil((2 * n) / 3);
  const p1 = words.slice(0, a).join(" ");
  const p2 = words.slice(a, b).join(" ");
  const p3 = words.slice(b).join(" ");
  return [
    { title: "Part 1", body: p1 },
    { title: "Part 2", body: p2 },
    { title: "Part 3", body: p3 },
  ];
}

/**
 * Core content uses the first three `##` sections; pads with summary if needed.
 */
export function pickCoreSections(sections: LessonSection[], summary: string): [LessonSection, LessonSection, LessonSection] {
  const take = sections.slice(0, 3);
  const out: LessonSection[] = [...take];
  while (out.length < 3) {
    if (out.length === 0) {
      out.push({ title: "Key takeaway", body: summary.trim() || "Take one idea that fits your week." });
    } else {
      out.push({ title: "Key takeaway", body: summary.trim() || "Take one idea that fits your week." });
    }
  }
  return [out[0]!, out[1]!, out[2]!];
}
