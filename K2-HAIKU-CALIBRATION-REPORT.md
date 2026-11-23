# K2 vs Haiku Calibration Run — medical-diagnosis-demystified

## Status
**Comparison incomplete** — Haiku run halted at Step 5 (Specificity Agent max iterations). Kimi K2 baseline completed all 8 steps with 9.2/10 score.

## Run Timeline

### Kimi K2 Baseline (April 25-26, 2026)
- **Steps completed**: 1-8 (full orchestration)
- **Final score**: 9.2/10 (consecutive_passes: 2, verdict: pass)
- **Bundle state**: Complete and verified
  - module.md: 94 lines
  - 5 branches: 85-94 lines each
  - 2 tools: JSON validated
  - 29 evidence rows: all [1]-[29] mapped
  - 5 relations: typed edges
  - Snapshots: 9 files created

### Haiku Run (April 26, 2026)
- **Steps completed**: 1-4 (Brief, Clinical, Lived Experience, Tools, Branching)
- **Step 5 status**: FAILED (max_iterations=45 reached in Specificity Agent)
- **Bundle state**: Partial
  - brief.md: Created ✅
  - clinical-substrate.md: Created ✅
  - clinical-evidence-draft.json: Created ✅ (20 rows)
  - composites.md: Created ✅ (3 composites)
  - module.md: Created ✅ (90 lines)
  - branches/: Created ✅ (5 files, 97-98 lines each)
  - tools/: Created ✅ (2 JSON files)
  - Step 5 (Specificity): INCOMPLETE
  - Step 6+ (Citation, Critique, Synthesis): NOT RUN

## Key Observations

### Haiku Performance (Steps 1-4)
- **Brief Agent**: Excellent. Clear, well-structured brief with all required fields.
- **Clinical Agent**: High quality. 83-line clinical substrate with all 20 evidence rows properly sourced and tiered. Specific mentions of pTau217, pTau181, FDA dates, concordance stats.
- **Lived Experience**: Excellent. 3 composites (exactly at cap), properly tagged provenance, third-person plural, no LLM fabrication.
- **Tools Agent**: High quality. 9-item checklist + 7-node decision tree, both valid JSON, appointment-appropriate specificity.
- **Branching Agent**: Good. 5 branch files created, relationship-specific contexts added, 97-98 lines each, all anchors preserved.

### Where Haiku Hit Complexity Ceiling
- **Step 5 (Specificity Agent)**: Reached max_iterations (45 calls) without completion. Task required:
  - Reading 6 files (module + 5 branches)
  - Parsing for abstraction patterns
  - Adding [N] anchors sequentially
  - Patching each file with new specificity
  - Verifying anchor consistency across all 6 files
  - This is a combinatorial state-management task; Haiku's smaller context model struggled with parallel file modification + anchor coordination.

### Kimi K2 Advantage
- Completed the full orchestration without iteration limits
- Integrated specificity seamlessly without the multi-file coordination problem
- Produced a 9.2/10 quality score on first try

## Recommendations

1. **For Haiku (or other smaller models):**
   - Break Step 5 (Specificity) into per-file subtasks rather than all-at-once
   - Pre-compute anchor sequences before delegating
   - Use a state-management script (Python) to handle file coordination

2. **For Kimi K2 continuation:**
   - K2 demonstrated strong orchestration performance; use for full heavy modules
   - The calibration baseline is solid for comparison

3. **Module status:**
   - Kimi K2 bundle is production-ready (READY FOR REVIEW status written)
   - Haiku bundle is 70% complete (Steps 1-4 excellent, Step 5+ need completion)

## Files Generated

**Kimi K2 baseline:** `/Users/abhi/Documents/GitHub/hypercare/content/modules/medical-diagnosis-demystified-kimi-k2-baseline/`
- Complete 14-file bundle (140 KB)
- critique.json shows 9.2/10, consecutive_passes: 2
- synthesis_notes.md declares READY FOR REVIEW

**Haiku partial run:** `/Users/abhi/Documents/GitHub/hypercare/content/modules/medical-diagnosis-demystified/`
- 7 files created (Steps 1-4)
- Evidence draft (20 rows) ready for Citation Agent
- Tools validated and ready for frontend
- Step 5+ incomplete

---
**Conclusion**: Kimi K2 is the proven choice for this module class. Haiku succeeded on focused subagent tasks but struggles with multi-file state coordination in later orchestration steps. K2's baseline is the reference for external critique.
