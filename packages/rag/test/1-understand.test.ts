import { describe, expect, it } from "vitest";
import { understandQuestion } from "../src/layers/1-understand.js";

describe("layer 1 — understand", () => {
  it("trims whitespace and lower-cases the retrieval-only string", () => {
    const r = understandQuestion({ question: "  Why does Mom Get Agitated?  " });
    expect(r.original).toBe("Why does Mom Get Agitated?");
    expect(r.scrubbed).toBe("Why does Mom Get Agitated?");
    expect(r.retrievalNormalized).toBe("why does mom get agitated?");
    expect(r.redactionsApplied).toBe(0);
  });

  it("scrubs emails", () => {
    const r = understandQuestion({
      question: "email me at mom@example.com about her meds",
    });
    expect(r.scrubbed).toContain("<redacted>");
    expect(r.scrubbed).not.toContain("mom@example.com");
    expect(r.original).toContain("mom@example.com");
    expect(r.redactionsApplied).toBeGreaterThanOrEqual(1);
  });

  it("scrubs phone-number-like runs", () => {
    const r = understandQuestion({
      question: "call the nurse at +1 (416) 555-1234 today",
    });
    expect(r.scrubbed).toContain("<redacted>");
    expect(r.scrubbed).not.toMatch(/\d{4,}/);
  });

  it("scrubs 4+ digit runs (birth years, SIN-like)", () => {
    const r = understandQuestion({ question: "born in 1942 with SIN 123456789" });
    expect(r.scrubbed).not.toContain("1942");
    expect(r.scrubbed).not.toContain("123456789");
    expect(r.redactionsApplied).toBe(2);
  });

  it("preserves the original on the result for logging", () => {
    const r = understandQuestion({ question: "his email is dad@x.io" });
    expect(r.original).toBe("his email is dad@x.io");
  });
});
