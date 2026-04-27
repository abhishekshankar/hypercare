# Synthesis Notes: transitions-first-two-weeks

## Integration decisions

1. **Blood-biomarker paragraph kept to one paragraph** in "What this is." Clinical substrate had the right length. No trimming needed; the brief's risk #1 (over-medicalizing) was already handled by the Clinical Agent.

2. **DMTs mentioned in one sentence** in action items. No drug names (lecanemab, donanemab) in the body — this is a transitions module, not a medical primer. The brief explicitly defers DMT detail to medical-dmt module.

3. **Lived-experience passages integrated at placement hints.** All 4 composite passages used. Passage 1 (doubleness) placed in "What this is" after the emotional opening. Passage 2 (fix everything) placed in "Why it matters now." Passage 3 (telling one person) placed in "What to do this week" adjacent to the action item. Passage 4 (self-care embarrassment) placed in "How to care for yourself." Density is at the max (4 composites, 0 first-person quotes). No further lived-experience should be added.

4. **Tools referenced by name in body** ("Things That Can Wait checklist," "First Two Weeks Action Items checklist") per the rule that body references tools without duplicating them. The "what does not need to be decided" section is now a summary pointer to the tool rather than a full prose list.

5. **Seed module voice preserved.** The seed's closing lines ("The ground will steady, slowly...") and "Eat something. Sleep, if you can" retained verbatim — they are the voice anchor for this module.

6. **Trimming.** Clinical substrate's "clinical notes for review" section removed from module.md (it's a working note, not reader-facing). The substrate was already well-trimmed; no paragraphs cut.

## Structural decisions surfaced

- **No tool schema validation possible.** The directory `packages/content/src/tools/` does not exist yet. Tool JSON follows the schema from the Tools Agent prompt (05-tools.md) but cannot be validated against Zod schemas. Flagged for Cursor to create schemas.

## Conflicts resolved

- None. Clinical, Lived Experience, and Tools outputs were complementary with no contradictions.

## Things that went well

- Clinical Agent kept the biomarker paragraph to exactly one paragraph as briefed.
- Lived Experience Agent produced 4 composites with correct provenance tagging and no first-person quotes.
- Tools Agent produced both requested checklists with correct structure and phone-friendly item counts (9 and 5).

## Rewrite cycle 1

Critique pass 1 returned `rewrite` (overall 8.5, branches=7, operational_metadata=6, evidence_table=8). Three structural fixes applied:
1. Added YAML frontmatter to 3 branches (early-spouse-with_caregiver, early-spouse-alone, any-any-any).
2. Added 5 SRS/operational metadata fields to module.md frontmatter.
3. Captured DOL FMLA snapshot to corpus/snapshots/dol-fmla-overview.html, updated evidence.json [8].

Critique pass 2: `pass` (overall 9.1, all axes 9, consecutive_passes=1).
Critique pass 3 (anti-flicker): `pass` (overall 9.1, all axes 9, consecutive_passes=2).

## READY FOR REVIEW

Module bundle `transitions-first-two-weeks` has achieved 2 consecutive passes on the hermes_internal_critique rubric (v1.0). All 11 axes scored >= 8. Ready for external critique (Claude in Cowork) and then human reviewer.
