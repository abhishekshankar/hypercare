/**
 * Parse expert escalation scripts (YAML frontmatter + markdown body).
 * TASK-025; format recorded in ADR 0015.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import type { SafetyClassifierCategory } from "../types.js";

const _here = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(_here, ".");

export type EscalationResource = { label: string; href: string; primary?: boolean };

export type ParsedEscalationScript = {
  version: number;
  reviewedBy: string;
  reviewedOn: string;
  nextReviewDue: string;
  category: string;
  directAnswer: string;
  bodyMd: string;
  primaryResources: EscalationResource[];
  disclosure?: string;
  /** Hours to suppress home focus cards; 0 = none. */
  suppressionDurationHours: number;
};

type Frontmatter = {
  category?: string;
  version?: number;
  reviewed_by?: string;
  reviewed_on?: string;
  next_review_due?: string;
  primary_resources?: EscalationResource[];
  [key: string]: unknown;
};

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseFrontmatter(raw: string): { data: Frontmatter; body: string } {
  const m = raw.match(FRONTMATTER);
  if (!m) {
    return { data: {}, body: raw };
  }
  const data = (loadYaml(m[1] ?? "", {}) as Frontmatter) ?? {};
  return { data, body: m[2] ?? "" };
}

/**
 * Extract the first two sentences for "direct answer" display, or a named ## Direct answer section.
 */
function extractDirectAnswerSection(body: string, sectionHint: string | null): string {
  if (sectionHint) {
    const re = new RegExp(
      `^##\\s*Direct answer\\s*\\(${sectionHint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*\\n([\\s\\S]*?)(?=^##\\s|\\Z)`,
      "m",
    );
    const block = body.match(re);
    if (block?.[1]) {
      return block[1].trim();
    }
  }
  const defaultBlock = body.match(/^##\s*Direct answer\s*\n([\s\S]*?)(?=^##\s|\Z)/m);
  if (defaultBlock?.[1]) {
    return defaultBlock[1].trim();
  }
  return body.trim();
}

function firstTwoSentences(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  const sent = t.split(/(?<=[.!?])\s+/);
  if (sent.length <= 2) return t;
  return `${sent[0] ?? ""} ${sent[1] ?? ""}`.trim();
}

function stripDirectAnswerBlocks(body: string): string {
  return body
    .replace(/^##\s*Direct answer[^\n]*\n[\s\S]*?(?=^##\s)/gm, "")
    .replace(/^#\s+[^\n]+\n?/m, "")
    .trim();
}

function interpolate(text: string, crName: string, caregiverName?: string): string {
  return text
    .replace(/\{\{CR_NAME\}\}/g, crName)
    .replace(/\{\{CAREGIVER_NAME\}\}/g, caregiverName ?? "you");
}

export function resolveScriptFilename(
  category: SafetyClassifierCategory,
  messageText: string,
): string {
  if (category === "acute_medical") {
    if (/\b(wander|wandering|walked\s+off|safe\s*return|missing|got\s+lost|left\s+the\s+house|can'?t\s+find)\b/i.test(messageText)) {
      return "care-recipient-in-danger.md";
    }
    return "medical-emergency-disguised-as-question.md";
  }
  const map: Record<SafetyClassifierCategory, string> = {
    self_harm_user: "caregiver-self-harm.md",
    self_harm_cr: "care-recipient-in-danger.md",
    acute_medical: "medical-emergency-disguised-as-question.md",
    abuse_caregiver_to_cr: "elder-abuse-or-caregiver-breaking-point.md",
    abuse_cr_to_caregiver: "financial-or-legal-exploitation.md",
    neglect: "dangerous-request.md",
  };
  return map[category];
}

const DIRECT_SECTION_HINT: Partial<Record<SafetyClassifierCategory, string>> = {
  self_harm_cr: "self_harm_cr",
};

export function parseEscalationFile(
  filename: string,
  category: SafetyClassifierCategory,
  messageText: string,
  names: { crName: string; caregiverName?: string },
): ParsedEscalationScript {
  const fullPath = join(SCRIPTS_DIR, filename);
  const raw = readFileSync(fullPath, "utf8");
  return parseEscalationMarkdown(raw, category, messageText, names);
}

export function parseEscalationMarkdown(
  raw: string,
  category: SafetyClassifierCategory,
  _messageText: string,
  names: { crName: string; caregiverName?: string },
): ParsedEscalationScript {
  const { data, body } = parseFrontmatter(raw);
  const version = typeof data.version === "number" ? data.version : 1;
  const sectionHint = DIRECT_SECTION_HINT[category] ?? null;
  const directBlock = extractDirectAnswerSection(body, sectionHint);
  const directAnswer = firstTwoSentences(
    interpolate(directBlock.length > 0 ? directBlock : extractDirectAnswerSection(body, null), names.crName, names.caregiverName),
  );
  const bodyMd = interpolate(stripDirectAnswerBlocks(body), names.crName, names.caregiverName);

  const resources = Array.isArray(data.primary_resources) ? (data.primary_resources as EscalationResource[]) : [];
  const disclosureMatch = body.match(/^##\s*Mandatory disclosure\s*\n([\s\S]*?)(?=^##\s|\Z)/m);
  const disclosure = disclosureMatch?.[1]?.trim();

  const sup =
    typeof data.follow_up_suppression_hours === "number"
      ? data.follow_up_suppression_hours
      : 0;

  const base = {
    version,
    reviewedBy: String(data.reviewed_by ?? ""),
    reviewedOn: String(data.reviewed_on ?? ""),
    nextReviewDue: String(data.next_review_due ?? ""),
    category: String(data.category ?? category),
    directAnswer,
    bodyMd,
    primaryResources: resources,
    suppressionDurationHours: sup,
  };
  return disclosure ? { ...base, disclosure } : base;
}

export function getScriptPathForCategory(
  category: SafetyClassifierCategory,
  messageText: string,
): string {
  return join(SCRIPTS_DIR, resolveScriptFilename(category, messageText));
}

export function readScriptVersionOnly(category: SafetyClassifierCategory, messageText: string): number {
  const p = getScriptPathForCategory(category, messageText);
  const raw = readFileSync(p, "utf8");
  const { data } = parseFrontmatter(raw);
  return typeof data.version === "number" ? data.version : 1;
}
