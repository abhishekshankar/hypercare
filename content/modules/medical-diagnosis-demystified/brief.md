# Brief — Medical Diagnosis Demystified

## Module Identity

**title:** "Medical Diagnosis Demystified: Understanding Your Alzheimer's Diagnosis"

**category:** medical

**tier:** 1

**stage_relevance:** [early]

**summary:**
Getting a diagnosis of Alzheimer's disease or another dementia can feel overwhelming. This module breaks down how the diagnosis is made, what blood biomarkers and imaging tests mean, what your neurologist is looking for, and what a positive diagnosis actually tells you about what comes next. You'll learn the difference between cognitive testing, biomarkers, and clinical judgment — and what to ask your doctor to understand your specific situation.

## Navigation & Structure

**attribution_line:**
Evidence sourced from the Alzheimer's Association clinical-practice guideline on blood-based biomarkers (2025), FDA-cleared blood tests (Lumipulse pTau217, Elecsys pTau181), Mayo Clinic dementia diagnosis overview, NIA caregiving guidance, and the 2024 Lancet dementia commission report.

**topics:** [new-diagnosis, diagnosis-types, working-with-clinicians, early-stage, blood-biomarkers]

**try_this_today:**
Write down three questions about your diagnosis that you want answered — what test was used, what the results mean, and what happens next — and bring them to your next appointment with your doctor or neurologist.

## Branching & Tools

**branches_required:**
- early-parent-with_caregiver
- early-parent-alone
- early-spouse-with_caregiver
- early-spouse-alone
- any-any-any (fallback: diagnosis demystified applies equally to all care profiles in early stage)

**tools_required:**
- questions-for-the-follow-up-visit (script: five key questions about diagnosis specifics)
- understanding-your-diagnosis (decision tree: walk through your own diagnosis pathway — cognitive test? biomarker? imaging? clinical judgment?)

## Evidence Tiers

**Tier 1 (Clinical Depth & Modern Framing):**
- aaic-2025-blood-biomarker-guideline: Clinical-practice guideline on blood-based biomarkers for Alzheimer's diagnosis. First-of-kind guideline. Concordance with PET: 91.7% (positive), 97.3% (negative). MUST cite for blood-biomarker section.
- fda-fujirebio-lumipulse-ptau217: FDA clearance May 2025. Fujirebio Lumipulse pTau217/Aβ ratio — first blood test cleared for use in diagnosing Alzheimer's disease.
- fda-roche-elecsys-ptau181: Elecsys pTau181 — first FDA-cleared blood test for primary care use in Alzheimer's diagnosis (October 2025).

**Tier 2 (Core References):**
- mayo-clinic-dementia: Overview of dementia symptoms, causes, and diagnosis pathway. Foundational clinical reference.
- nia-caregiving: NIA guidance on caregiving and initial diagnosis context. Bridges diagnosis to care planning.

**Tier 3 (Context & Commission Framing):**
- lancet-dementia-commission-2024: 2024 Lancet standing commission report on dementia prevention, intervention, and care. Provides collaborative care framing in the DMT (disease-modifying therapy) era.

## Developmental Notes

**Priority areas for revision from pilot draft:**
1. **Blood-biomarker pathway:** Expand to cover the three FDA-cleared blood tests (pTau217, pTau181, and earlier Aβ/tau combinations). Explain what each test tells you and how results guide clinical decision-making.
2. **Diagnostic criteria evolution:** Frame modern diagnosis as a *combination* of cognitive testing, biomarkers, and clinical judgment — not a single test. Cite the 2025 AAIC guideline for current standards.
3. **Patient-centric framing:** Translate "amyloid-beta," "phosphorylated tau," and "neurodegeneration" into plain language. What do results mean for *your* caregiving journey?
4. **Lived-experience integration:** Include composite or real caregiver voices reflecting the emotional weight of diagnosis day, the relief of clarity, and the uncertainty of what comes next.

**Branching logic:**
- Early stage + parent relationship: Emphasize diagnosis clarity and what this means for adult children navigating role changes.
- Early stage + spouse relationship: Center on shared next steps, treatment options, and how diagnosis affects the marriage.
- With caregiver vs. alone: Tailor depth of detail on family involvement in diagnosis discussion and follow-up care planning.
- any-any-any fallback: Core diagnosis pathway applies universally; personalization happens at conversation time.

**Tools expectations:**
- **questions-for-the-follow-up-visit:** Five scripted questions to ask the neurologist (e.g., "What specific test was used? What do these results mean? What happens at the next visit?"). JSON format: script tool with openings, if-they responses, and things-not-to-say.
- **understanding-your-diagnosis:** Interactive decision tree showing the diagnostic pathway: Did you have cognitive testing? Biomarkers? Imaging? Each path leads to an explanation of what that test is and what results mean. JSON format: decision_tree tool with nodes and terminal explanations.

