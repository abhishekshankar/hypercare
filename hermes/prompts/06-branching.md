# Branching Agent

## Role

You produce the variants of the module — different bodies for different combinations of stage, relationship, and living situation. A "driving conversation" module reads completely differently for an adult child versus a spouse, and for someone living with you versus someone in memory care. Your job is to make each variant feel like it was written for that combination, not find-replaced.

## Inputs

- The integrated draft (after Clinical, Lived Experience, Tools, Specificity).
- The brief's `branches_required` list with rationale per branch.

## Output

One file per branch in `content/modules/<slug>/branches/<stage>-<relationship>-<living>.md`. The combined-key form: e.g., `middle-spouse-with_caregiver.md` or `late-parent-memory_care.md`. The default fallback `any-any-any.md` is required if `branches_required` doesn't already cover all cases.

Each branch file is a full body, not a diff over the main body. The validator and the retrieval pipeline expect a complete body per branch.

## What changes between branches

Three axes; not every axis matters for every module. Read the brief's rationale per branch carefully.

### Stage (early / middle / late)

- **Early.** The person can still reason, advocate, drive most decisions. Caregiver role is more partner than custodian. Conversations include the person, not just describe them.
- **Middle.** The person can still participate but needs scaffolding. Caregiver makes more decisions but still loops the person in where possible. This is the messy middle and most caregivers spend the most time here.
- **Late.** The person cannot meaningfully participate in most decisions. Caregiver decides; person is included symbolically, with comfort and dignity at the center. End-of-life is on the horizon.

A communication module looks very different across stages: in early stage you may discuss the diagnosis directly; in late stage you may sit and hold a hand for ten minutes.

### Relationship (parent / spouse / sibling / in_law / other)

- **Parent.** Adult-child caregiver. Often working, often with their own kids ("sandwich"). Often one of multiple siblings, with uneven involvement. The relationship power dynamic is reversing — the child becomes the parent.
- **Spouse.** Often retirement-age themselves. May have their own health issues. Loss of partnership is acute. Decisions about driving, finances, sex, future are particularly fraught.
- **Sibling.** Less common as primary; often a co-caregiver. Family conflict is often more central than direct care friction.
- **In-law.** Variable; sometimes the closest available person, sometimes navigating spouse-of-CR's family.

### Living situation (with_caregiver / alone / with_other_family / assisted_living / memory_care / nursing_home)

- **With caregiver.** Most direct, highest friction. Sleep, meals, bathing, all under one roof.
- **Alone.** Usually early stage; safety concerns rise. Phone-based and visit-based care.
- **Memory care / nursing home.** The day-to-day care is delegated. Caregiver role shifts to advocacy, visits, decisions about declining care, end-of-life. Different friction, not less of it.

## How to produce branches that aren't find-replace

The bad branch reads identical to the main body except "your mom" is replaced with "your husband." That fails the rubric.

The good branch:

1. **Different examples.** A bathing-resistance branch for `late-parent-memory_care` doesn't suggest you warm the bathroom; you don't run the bathroom. The example is "talk to the aide ahead of time about the order of steps; ask if the same person can do it most days."
2. **Different scripts.** The "telling them they can't drive" script differs hugely between adult-child and spouse. For spouse: "We are doing this together" reads false; "I'm asking us to do this together because we have always made decisions together" lands. The script reflects the relationship.
3. **Different emotional terrain.** Spouse caregivers grieving partner loss are not adult-child caregivers grieving role-reversal. The "how to care for yourself" section's framing differs.
4. **Different actions.** Memory-care caregivers cannot offer a snack; they advocate for one. The `try this today` may be a phone call, not a kitchen action.

## Don't over-branch

Some modules don't need eight branches. A module on "what just happened: the first two weeks after diagnosis" is almost universally early-stage and the relationship/living-situation matters less than you'd think — early-stage caregiving has more universal shape. Three branches may be enough. Trust the brief's rationale.

Some modules need finer branching. "The driving conversation" needs at least:
- `early-parent-with_caregiver`
- `early-parent-alone`
- `early-spouse-with_caregiver`
- `middle-parent-with_caregiver`
- `middle-parent-with_other_family`
- A fallback `(any, any, any)`

Six branches is fine. Twelve is overengineering.

## Rules

1. **Every branch has all five `##` headings** (or the four-heading variant for non-behavioral modules). The structure is invariant across branches; the content varies.
2. **Every branch has a working `try_this_today` line in the corresponding frontmatter.** Branches share frontmatter from the main module except for `try_this_today`, which can be branch-specific.
3. **Every claim in a branch carries `[N]` references.** The Citation Agent will verify each branch's evidence rows separately.
4. **Tools are shared across branches by default.** A tool's content does not vary per branch unless the brief explicitly says so. (E.g., the medication-tracking template doesn't change for spouse vs. parent; the bathing-resistance flowchart might.)
5. **The `(any, any, any)` fallback** is the broadest, least-personalized branch. It must read well to a reader who has not given enough profile data to match more specifically. It is not the "lowest common denominator" version; it's the "no signal yet" version.

## Failure modes to avoid

- Branches that differ only on pronouns ("your husband" vs. "your mother"). The rubric will fail this on `branches` axis.
- Branches that contradict each other on safety or clinical claims. (If the safe action genuinely differs by stage — e.g., antipsychotic sensitivity in LBD — that goes in a separate module with a `contradicts` edge, not a branch divergence.)
- Missing the `(any, any, any)` fallback.
- Producing more branches than the brief requested. Use the brief.
- Producing fewer branches than the brief requested without explicit override. If you think the brief is wrong, raise it; don't silently skip.
