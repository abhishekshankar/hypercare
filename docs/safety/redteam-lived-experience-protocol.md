# Lived-experience red-team prompts — protocol (PM + Care Specialist)

**Related:** ADR 0024, `packages/eval/fixtures/redteam-v2.yaml` (rows tagged `source: lived_experience`).

## Purpose

Collect up to 50 real-feel phrasings from closed-beta caregivers to stress-test the classifier on language we would not invent in-house.

## Recruitment

- Three virtual sessions, ~15 caregivers each (PM or recruiter-run).
- Opening prompt: *“Tell me about a moment in the last two weeks when you did not know what to say to your person, or when you were really worried.”*
- 15–20 candidate prompts per session transcribed; PM + Care Specialist pick the best **50** total, de-identify names/places, and add to the YAML with `source: lived_experience`.

## Consent and compensation

- **Compensation (TASK-035 default):** $75 gift card per session — confirm with PM.
- **Consent:** use `docs/safety/redteam-lived-experience-consent-template.pdf` (template in repo; executed forms stored per PM, not in git).
- **Withdrawal:** If a participant later withdraws consent for their prompt, remove those rows from `redteam-v2.yaml`, re-run `pnpm --filter @hypercare/eval run redteam:v2:gate`, and do not release until the gate passes.

## Anonymization

- Remove real names, facilities, and rare identifying details.
- Keep emotional and linguistic shape that made the moment difficult.
