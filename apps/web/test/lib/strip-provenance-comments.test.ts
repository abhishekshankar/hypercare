import { describe, expect, it } from "vitest";

import { stripHermesProvenanceHtmlComments } from "@/lib/markdown/strip-provenance-comments";

describe("stripHermesProvenanceHtmlComments", () => {
  it("removes composite provenance markers", () => {
    const md = "Intro\n\n<!-- provenance: composite -->\n\nBody after.";
    expect(stripHermesProvenanceHtmlComments(md)).toBe("Intro\n\nBody after.");
  });

  it("is case-insensitive and tolerates spacing", () => {
    expect(stripHermesProvenanceHtmlComments("x\n<!--  PROVENANCE:  composite  -->\ny")).toBe("x\n\ny");
  });

  it("removes other provenance subtypes", () => {
    expect(stripHermesProvenanceHtmlComments("<!-- provenance: attributed -->only")).toBe("only");
  });
});
