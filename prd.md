**HYPERCARE**

Product Requirements Document — v1

_An AI-guided companion for families caring for someone with dementia_

Status: Draft v1 • April 2026

# **1\. Executive summary**

Alongside is a web-based AI companion for family members caring for someone with dementia. It combines a living care profile, situation-specific guidance on demand, and a proactive, stage-aware learning path grounded in reviewed expert sources. The product is built around a single insight: caregiver needs change dramatically as the disease progresses, and generic content fails because it is almost always either too early or too late for where a specific family is today.

Alongside is not a brain-training app for the person with dementia, not a symptom tracker, and not a medical device. It educates and supports the caregiver — the domain where evidence for impact is strongest (REACH II, NYU Caregiver Intervention, Savvy Caregiver) and where regulatory risk is lowest.

The category is underserved. The Alzheimer's Association has thorough content but a navigation problem; Teepa Snow's Positive Approach to Care (PAC) is the gold standard for technique but shaped as expensive video courses aimed at professional caregivers; a handful of apps exist (Dementia Careblazers, CareYaya, Rippl) but none have nailed the "AI guide for your specific situation" angle. This is the opening Alongside is built for.

## **1.1 Product in one line**

The AI guide that helps you care for someone with dementia — tailored to their stage, your situation, and what's actually happening this week.

## **1.2 What v1 ships**

- A responsive web product (no native mobile app in v1).

- A 4–5 minute onboarding that builds a structured care profile.

- An "ask anything about caring for \[name\]" conversational surface grounded in reviewed sources.

- A proactive "this week's focus" lesson surface — stage- and situation-aware 5-minute lessons.

- A browsable library of 30–50 expert-reviewed modules.

- An editable care profile and a transparent "what the AI knows about my situation" surface.

- A safety/escalation system with a dedicated classifier and pre-scripted crisis response flows.

## **1.3 What v1 deliberately excludes**

Each of these is tempting; each is deferred on purpose.

- Multi-patient profiles (one caregiver, one care recipient in v1).[^family-sharing-v2]

- Native mobile apps (iOS/Android).

- Peer/community features, creator economy, expert 1:1 booking.

- Symptom tracker, health-record integrations, caregiver journaling.

- Video content, podcasts, games, any brain-training for the person with dementia.

- Spaced repetition / SRS on techniques (deferred to v2).

- Non-English content (Spanish planned for v2; content structured to support it).

- Any claim the product slows, reverses, or cures disease progression.

# **2\. Problem and user**

## **2.1 Who this is for**

The primary user is the family caregiver — most often an adult child (commonly a daughter aged 45–65) or a spouse (often themselves 65+). They are overwhelmed, time-starved, and reading this on a phone, probably at night, probably tired. They are not medical professionals, and they should never need to be.

A secondary consideration: in many families, caregiving is split across siblings with unequal involvement. v1 is tuned to the primary caregiver's voice; family sharing is a v2 concern.[^family-sharing-v2]

[^family-sharing-v2]: **Sprint 5 update (TASK-038):** family sharing v1 shipped — multiple caregivers may share one `care_profile` via `care_profile_members`, with conversation history and saved answers staying per-caregiver by default. The "v2 concern" framing here is preserved for narrative continuity; the data model and privacy posture are documented in [`docs/schema-v2.md`](docs/schema-v2.md) § `care_profile_members` and [ADR 0027](docs/adr/0027-family-sharing-data-model-and-privacy.md). The "multi-patient profiles" deferral above is unchanged: one care **recipient** per profile remains the v1 contract.

## **2.2 The jobs to be done**

From conversations with caregivers and caregiver-support literature, Alongside has to do three jobs at once, and they are different in shape:

- **Tell me what to do right now**. The 2am "she won't let me bathe her" problem. Needs: fast, concrete, situation-specific, non-clinical answer with a try-this-now technique.

- **Help me understand what's happening**. The "why is she accusing me of stealing?" question underneath the behavior. Needs: a brief, honest, neurologically grounded explanation that gives the caregiver a frame.

- **Help me see around the corner**. The "what do I need to be ready for in the next few months?" question most caregivers don't know to ask. Needs: stage-aware, proactive, short-form learning.

## **2.3 Why generic content fails**

Caregiver needs are a moving target. Someone whose mother was diagnosed last month needs totally different help than someone whose father has stopped recognizing them. A generic blog article is either too early (irrelevant) or too late (assumes context the reader doesn't have). The premise of Alongside is that AI-driven personalization tuned to stage and situation is genuinely the right tool for this — not as a gimmick but because the underlying problem is an information-matching problem.

## **2.4 Evidence base for the intervention**

Caregiver education and skills training — the thing Alongside is actually delivering — are well-evidenced to reduce caregiver burden and delay nursing home placement. Named, peer-reviewed interventions relevant to the product include:

- REACH II — Resources for Enhancing Alzheimer's Caregiver Health.

- The NYU Caregiver Intervention (Mittelman et al.).

- Savvy Caregiver Program.

- Tailored Activity Program (TAP).

- Teepa Snow's Positive Approach to Care (PAC) techniques.

- Naomi Feil's Validation Therapy (for middle- and late-stage communication).

The content strategy (Section 7\) is explicitly organized around these sources.

# **3\. Goals and non-goals**

## **3.1 Goals (v1)**

- **Helpfulness.** Achieve a ≥ 70% "this helped" rate on answers within 48 hours of delivery.

- **Retention.** ≥ 40% week-4 return rate and ≥ 25% week-8 return rate. Caregiving is a multi-year journey; users who don't return by week 4 will not.

- **Behavior change.** On the weekly check-in, ≥ 50% of active caregivers answer "yes" to "Did you try something this week that helped?"

- **Trust.** Zero unreviewed medical claims in shipped content. 100% of medical modules carry a named expert reviewer. 100% of flagged crisis queries receive the correct pre-scripted escalation response.

## **3.2 Explicit non-goals**

- Engagement maximization, daily streaks, DAU chasing. Caregivers are already anxious; rewarding anxiety-driven use is harmful.

- Therapist replacement. The product gets users to real help; it does not try to be the help.

- Medical-device territory. No diagnosis, no dosing, no treatment recommendations.

- Any claim about disease modification in the person with dementia.

## **3.3 North-star metric**

"Did you do something differently this week because of what you learned here?" Measured by a weekly one-question check-in. This is the metric that tells us the product is actually doing its job, not just being pleasant.

# **4\. Core product principles**

Five rules, from which everything else in this document derives. If any of these is wrong, the product is wrong.

### **4.1 One care recipient per profile; caregivers and households**

The product is emotionally and informationally tuned to **one care recipient per Alongside care profile**. **Multi-patient dashboards** (one logged-in caregiver formally managing two parents in one account) remain out of scope for v1 — if a user cares for two parents, they still use two accounts today.

**Family sharing (Sprint 5, TASK-038):** a **second caregiver** (e.g. a sibling) can be invited onto the **same** care profile so the household shares the plan (stage, situation notes, library catalog). Each caregiver keeps their **own** Cognito identity, **own** conversation threads, and **own** saved answers unless a future opt-in changes that; see `docs/adr/0027-family-sharing-data-model-and-privacy.md`. Deeper “caregiver team” workflows (ownership transfer, cross-thread sharing) stay on the roadmap beyond v1.

### **4.2 Crisis-first, not curriculum-first**

The homepage is not a learning path. It is "what do you need right now." Learning happens in the margins and in short, daily 5-minute nudges, not as the primary mode. This is the single biggest departure from Duolingo/Oboe-style learning products.

### **4.3 Grounded beats generated**

Every piece of substantive guidance traces to a reviewed source. The AI retrieves, personalizes tone, and adapts to the care profile. It does not invent care techniques.

### **4.4 Short beats long**

Caregivers are exhausted. No lesson exceeds 5 minutes. No answer exceeds a phone screen unless the user taps "tell me more." Empathy is expressed through brevity, not paragraphs of validation.

### **4.5 Escalation is a first-class feature**

Safety resources (988, the Alzheimer's Association 24/7 helpline, APS) are one tap from every screen, not buried in a footer. Crisis response is pre-scripted, expert-reviewed, and versioned — not LLM-improvised.

# **5\. The care profile — the spine of the product**

The care profile is the most important data model in the product. Every other surface reads from it. It has to capture enough to personalize meaningfully without feeling like a medical intake form. Target: 4–5 minutes for initial capture, then evolves through use.

## **5.1 Section 1 — About the person you care for (the CR)**

- First name. Used throughout the product ("When Margaret gets agitated…").

- Age.

- Relationship to caregiver (parent, spouse, sibling, in-law, other).

- Diagnosis, if known: Alzheimer's, vascular, Lewy body, frontotemporal, mixed, "dementia — type unknown," or "not formally diagnosed but I suspect."

- How long since diagnosis (or since symptoms started, if no diagnosis).

- Stage — captured behaviorally, not by jargon (see 5.2).

## **5.2 Section 2 — Stage assessment, disguised as a conversation**

Do not ask "what GDS stage is your mom?" Caregivers don't know and shouldn't need to. Instead, ask 6–8 behavioral questions and infer stage internally. The display label to the user is plain English ("middle stage of dementia, where…"), never a clinical code.

- Can \[name\] manage their own medications?

- Does \[name\] still drive? If not, when did they stop?

- Can \[name\] be left alone safely for a few hours?

- Does \[name\] recognize you most of the time?

- Can \[name\] bathe and dress without help?

- Has \[name\] had incidents of getting lost or wandering?

- Does \[name\] still carry on conversations that make sense to you?

- Does \[name\] sleep through the night usually?

## **5.3 Section 3 — Living and care situation**

- Where does \[name\] live? (with you, alone, with another family member, assisted living, memory care, nursing home)

- Who else is involved in care? (solo / siblings helping / paid help / spouse of CR)

- How many hours a week do you spend on care?

- Do you live in the same home? Same city? Remote?

## **5.4 Section 4 — About you, the caregiver**

- Your first name.

- Your age bracket. (A 55-year-old daughter and a 78-year-old spouse need different framings.)

- Working / retired / other.

- How are you doing? 1–5, phrased humanely: "I've got this" → "I'm at the end of my rope."

- What's the hardest thing right now? Free text, with chip starters: sleep, behavior changes, managing alone, family conflict, guilt, finances, my own health, making decisions about care.

## **5.5 Section 5 — What matters to \[CR name\]**

The section most products skip, and the most important for making the product feel human. Three short prompts:

- What did \[name\] do for work, or what were they known for?

- What brings \[name\] joy, even now?

- Anything about \[name\]'s personality or history that's important for me to understand?

The AI uses this to personalize examples ("Since Margaret was a teacher, you might try…"). It also signals to the caregiver: this product sees your person as a person.

## **5.6 Evolution over time**

The profile is never "done." After every significant interaction, the system quietly updates: new behaviors mentioned, transitions (moved to memory care, stopped recognizing grandchildren, new medication), caregiver state changes. A weekly check-in prompt ("How has this week been?") surfaces updates naturally. A prominent "My situation has changed" button on the profile screen walks users through an evolved-state questionnaire when the ground shifts.

# **6\. Screens and flows**

v1 has eight screens. That's the whole product surface.

## **6.1 Screen 1 — Landing / first-run**

Single page. Warm but serious typography — closer to the New York Times than to Duolingo.

- **Headline:** _"Caregiving for someone with dementia is relentless. You shouldn't have to figure it out alone."_

- **Sub-headline:** Guidance tailored to your situation, from trusted sources, whenever you need it.

- **Primary CTA:** "Get started."

- **Persistent crisis strip:** "If you're in crisis right now, call the Alzheimer's Association 24/7 helpline: 800-272-3900." Always visible.

  _Implementation note (TASK-005):_ placement (`sticky` vs `fixed`), palette, and typography tokens are recorded in [`docs/adr/0003-design-tokens-and-crisis-strip.md`](docs/adr/0003-design-tokens-and-crisis-strip.md).

## **6.2 Screen 2 — Onboarding**

The care profile questionnaire from Section 5, split into 5 short steps. One question per screen on mobile, 2–3 on desktop. Progress bar. Persistent micro-copy: "You can change any of this later." Target duration: 4–5 minutes.

End state: a short summary screen reflecting back what the product now knows. Example:

_"Okay. You're caring for your mom Margaret, 78, who was diagnosed with Alzheimer's two years ago and lives with you. The hardest thing right now is sundowning. Let's start there."_

## **6.3 Screen 3 — Home**

The most important screen in the product. Above the fold, three elements:

1. A single "Ask anything about caring for \[name\]" input. Placeholder text rotates through realistic examples based on the CR's stage ("How do I get Margaret to take a shower?" / "She keeps asking the same question, what do I do?").

2. A "This week's focus" card — one concrete topic picked by the system based on the profile and what the user has asked recently. Tappable, opens a 5-minute lesson.

3. A "How are you doing?" check-in card — not always shown; surfaces every few days.

Below the fold: recent conversations, saved answers, and a "Things I want to revisit" list.

Explicitly absent: feed, recommendations river, streak counter, gamification. The emotional register matters: this is not a learning app that rewards anxiety.

## **6.4 Screen 4 — Conversation (the core loop)**

When the caregiver asks something, the response follows a fixed structure:

- **The direct answer first.** Not "I'm sorry you're going through this." The first two sentences are actionable. E.g., "This is sundowning — a common late-afternoon agitation in dementia. In the moment, try: \[three specific techniques\]."

- **Why this is happening.** One paragraph, grounded. "Sundowning is linked to changes in the brain's circadian rhythm and accumulated fatigue through the day…"

- **Tailored to your situation.** References the profile: "Since Margaret has trouble sleeping through the night, you might also…"

- **You're not alone.** One sentence, real: "Most caregivers tell us sundowning is the hardest part of middle-stage dementia."

- **Two follow-up chips.** "Tell me more about why this happens" / "What if it keeps happening every day?"

- **Save \+ feedback.** Small "Save this" button and "Was this helpful?" thumbs.

- **Source attribution.** Small text at the bottom: "Based on guidance from the Alzheimer's Association and Teepa Snow's Positive Approach to Care. Reviewed by \[expert name, credential\]."

Crisis-territory queries are handled by a distinct response pattern (see Section 9).

## **6.5 Screen 5 — Daily lesson**

Opened from the "This week's focus" card. Always 5 minutes. Structure:

- 60-second setup: what this is, why it matters for \[name\]'s stage.

- 2–3 minutes of core content in 3–4 swipeable cards (text \+ optional 30-second audio; no video in v1).

- 30-second "try this today" — one concrete action.

- "Got it" / "I want to revisit this" close.

Critically, lessons are not a linear curriculum. The system picks the next lesson based on profile \+ recent asks \+ current-stage relevance. Users can browse the library manually, but the default is guided.

## **6.6 Screen 6 — The library**

A searchable, browsable index of all content modules, organized by situation — Behaviors, Daily Care, Communication, Medical, Legal & Financial, Transitions, Taking Care of Yourself — rather than by stage. Stage is a filter. This screen is for the quiet moments when a caregiver wants to read ahead or look something up.

## **6.7 Screen 7 — Care profile (editable)**

Shows everything the product knows, editable. Split into the same 5 sections as onboarding. Prominent "My situation has changed" button walks users through an evolved-state questionnaire. Doubles as the transparency layer — caregivers can see and control what the AI is using to personalize, which matters for trust.

## **6.8 Screen 8 — Help & safety**

Always linked from the top nav. Never buried. Contents:

- Alzheimer's Association 24/7 helpline: 800-272-3900.

- 988 Suicide & Crisis Lifeline.

- Adult Protective Services (link to state-specific office finder).

- "When to call the doctor" checklist.

- "When to call 911" checklist.

- Caregiver burnout self-assessment.

- Product support contact.

# **7\. Content strategy**

## **7.1 The v1 library: 30–50 modules**

Content is organized by situation (not by stage, not by disease biology) because that's how caregivers actually arrive. Stage is a filter.

### **Behaviors**

Sundowning, repetitive questions, accusations and paranoia, agitation and aggression, wandering, shadowing, hallucinations and delusions, refusal of care, inappropriate behaviors.

### **Daily care**

Bathing resistance, dressing, eating and swallowing, toileting and incontinence, sleep problems, medication management, oral care.

### **Communication**

How to talk to someone with dementia, validation therapy basics, redirecting vs. arguing, when they don't recognize you, meaningful activities by stage.

### **Medical**

Understanding the diagnosis, working with the neurologist, common comorbidities, managing medications, hospital visits and dementia, end-of-life signs.

### **Legal & financial**

Power of attorney, advance directives, Medicare/Medicaid basics, paying for care, when to consider memory care.

### **Transitions**

When they can't live alone anymore, the driving conversation, moving to memory care, hospice and dementia.

### **Caring for yourself**

Caregiver burnout, guilt, grief while they're still here, asking for help, family conflict, respite care.

## **7.2 Module shape**

Each module carries:

- At least one reviewed expert source.

- One lived-experience caregiver quote.

- One concrete "try this" action.

- One related-module link.

- An evidence table (structured source document that stays with the module and feeds the RAG system).

- Review metadata: writer, editor, clinical reviewer, caregiver reviewer, review date, next review due.

## **7.3 Source tiers**

Not all sources are equal. The content system maintains three tiers:

| Tier   | Description                                                   | Example sources                           |
| :----- | :------------------------------------------------------------ | :---------------------------------------- |
| Tier 1 | Reviewed internal modules. Explicit stage, topic, confidence. | The 50 Alongside modules                  |
| Tier 2 | Curated external sources, indexed and labeled.                | Alzheimer's Association, NIA, Mayo Clinic |
| Tier 3 | Structured summaries of major intervention literature.        | REACH II, NYU CI, Savvy Caregiver, TAP    |

Retrieval strongly prefers Tier 1, falls back to Tier 2 only when Tier 1 is thin, and triggers the refusal path (Section 8.8) when all three tiers are thin.

## **7.4 Pilot modules**

The first four modules to draft — chosen because together they stress-test the voice end to end:

- Module 1 — "What just happened: the first two weeks after a dementia diagnosis."

- Module 2 — The diagnosis, demystified.

- Module 23 — How to talk with someone with dementia: the basics.

- Module 47 — Caregiver guilt and ambiguous grief.

# **8\. Content pipeline and expert roster**

## **8.1 The expert roster**

The expert layer is what separates Alongside from a ChatGPT wrapper. Five roles, some combinable:

| Role                        | Scope                                                   | Commitment      | Compensation (indicative)           |
| :-------------------------- | :------------------------------------------------------ | :-------------- | :---------------------------------- |
| Medical Director            | Final sign-off on medical content; credibility anchor.  | 4–8 hrs/mo      | $1.5–3K/mo cash \+ 0.25–0.5% equity |
| Dementia Care Specialist    | Techniques, behavior content — the most important hire. | 10–20 hrs/mo    | $80–120/hr or retainer              |
| Caregiver-Support Clinician | Self-care, crisis, burnout, grief, escalation scripts.  | 6–10 hrs/mo     | $100–150/hr                         |
| Lived-Experience Reviewers  | 2–3 current/recent caregivers who read every module.    | 4–6 hrs/mo each | $75–100/hr                          |
| Domain SMEs (ad hoc)        | Legal/financial/hospice specialists for their modules.  | As needed       | $150–300/hr                         |

## **8.2 The content team**

- Senior Medical Writer (contract, \~0.5–0.75 FTE): $8–12K/mo.

- Caregiver-Experience Writer (often combined with Content Lead in v1): $8–10K/mo.

- Content Lead / Editor (full-time, in-house). Owns voice, workflow, and final editorial eye.

- Content Operations (0.5 FTE, can be combined with Content Lead in v1). Owns the review tool.

Steady-state content production: \~$16–22K/mo during the initial 50-module ramp, dropping materially after launch.

## **8.3 The 7-stage drafting process**

Each module takes 3–4 weeks at the start, compressing to \~2 weeks once the pipeline is humming.

4. Brief (Content Lead, 30 min) — topic, audience, stage, outcome, sources, related links, library slot.

5. Source research (Writer, 2–4 hrs) — pull from Alzheimer's Association, NIH/NIA, Cochrane, REACH II / NYU CI / Savvy Caregiver / TAP, PAC materials, 1–2 recent peer-reviewed papers. Build the evidence table.

6. Draft (Writer, 3–6 hrs) — 400–800 words \+ 30-second "try this" \+ related links. Every factual claim traces to the evidence table.

7. Content Lead edit (2 hrs) — voice, structure, length, clarity.

8. Expert review — routed by topic to Medical Director / Care Specialist / Caregiver-Support Clinician. 5-business-day SLA.

9. Lived-experience review (2–3 days) — one prompt: "Does this sound like a real person wrote it for you? What's missing from real life?"

10. Final approval and publish (Content Lead; Medical Director for medical content).

## **8.4 Maintenance cadence**

- Annual re-review of every module (\~1/week once the library hits 50).

- Immediate re-review when guidelines change (e.g., FDA approval of a new disease-modifying therapy).

- Quarterly content audit: what's used, what's missing, which RAG answers are generating coverage gaps.

- Publish 2–4 new modules/month post-launch, driven by what caregivers are actually asking.

# **9\. Technical architecture**

## **9.1 Why naive RAG fails here**

The default "embed docs, retrieve top-k, stuff into prompt" approach has three failure modes that are acutely bad for this product:

- Retrieval is semantic, but the right answer is personalized. "Mom keeps asking what day it is" and "Dad forgets what day it is" retrieve similar chunks, but the right answer depends on relationship, stage, and caregiver context.

- The model averages across sources. Indexing the Alzheimer's Association, Teepa Snow, and a Reddit caregiver thread produces a confident-sounding synthesis grounded in nothing.

- The model fabricates when retrieval is thin. A confident-but-subtly-wrong answer about medication or symptoms is unacceptable in this domain.

The architecture below addresses each failure.

## **9.2 The seven-layer RAG pipeline**

### **Layer 1 — Source library and content hierarchy**

Three tiers (see Section 7.3). Retrieval strongly prefers Tier 1; falls back to Tier 2; triggers refusal if all are thin.

### **Layer 2 — Query understanding**

Before retrieval, classify the query along four dimensions:

- Topic (behavior / daily care / medical / legal / self-care / crisis).

- Urgency (informational / acute-situation / crisis).

- Stage relevance (early / middle / late / any).

- Safety flags (self-harm, elder abuse, medication overdose, etc.).

Small, fast structured-output classifier call. Routes to the right retrieval subset, adjusts the response template, and triggers the safety path when needed.

### **Layer 3 — Retrieval**

Hybrid retrieval: semantic similarity (embeddings) \+ keyword/BM25 \+ metadata filters (stage, topic). Top-k from each, then rerank with a cross-encoder. Metadata filters matter — if CR is late-stage, don't retrieve early-stage bathing advice.

The care profile is not indexed. It is injected separately into the prompt (Layer 5), keeping personalization transparent and debuggable.

### **Layer 4 — Grounding check**

Before generation, verify: did retrieval return at least one Tier 1 or high-confidence Tier 2 chunk? If no, route to the refusal path. This is the single most important reliability guardrail.

### **Layer 5 — Prompt composition**

Fixed structure:

- System prompt — voice, format constraints, refusal rules, safety rules.

- Care profile — compiled into a structured summary (not raw JSON).

- Retrieved context — ranked chunks with source attribution tags.

- Response scaffold — direct answer / why / tailored to you / you're not alone / chips.

- User query, with Layer 2 classification flags.

The generation model's job is to synthesize retrieved context, personalized to the profile — not to generate from its own knowledge. Any ungrounded claim is a failure.

### **Layer 6 — Post-generation verification**

A second, cheap pass checks:

- Does every factual claim have supporting text in the retrieved context?

- Does the answer contradict retrieved context?

- Does it contain banned patterns (specific medication dosing, diagnosis claims, "cure" / "reverse," etc.)?

- Does it respect the response scaffold?

On failure: regenerate with the failure flagged, or fall back to a pre-written safe response. Catches most hallucinations at a few cents per query.

### **Layer 7 — Attribution and evidence display**

Every answer renders source attribution: "Based on \[module name\], reviewed by \[expert\]" for Tier 1; "Includes guidance from the Alzheimer's Association" for Tier 2\. Trust-building and a second check — if attribution looks wrong, readers can flag it.

## **9.3 The refusal path**

When grounding fails (no good source for this question), the system does not punt with "I can't answer." It:

11. Acknowledges the question warmly.

12. Says honestly: "I don't have reviewed guidance on this specific situation yet."

13. Offers the nearest reviewed topic (if any), plus the Alzheimer's Association helpline, plus a "Would you like us to add this topic?" button.

The "add this topic" button feeds the content pipeline's queue of requested modules. This is how the library grows in the right direction.

## **9.4 Models and stack**

| Component             | Choice                                          | Notes                                                         |
| :-------------------- | :---------------------------------------------- | :------------------------------------------------------------ |
| Generation model      | Strong frontier model (Claude Opus tier)        | Cost matters at scale; profile and source caching helps.      |
| Classifier & verifier | Fast, cheap model (Haiku tier)                  | Runs on every query; dominates latency budget.                |
| Embeddings            | Top-tier embedding model                        | Don't cheap out — retrieval quality is directly felt.         |
| Vector store          | pgvector (v1)                                   | Scale is small; pgvector keeps ops simple. Migrate if needed. |
| Reranker              | Cross-encoder (Cohere or OSS)                   | Real quality improvement, worth the latency cost.             |
| Observability         | Log every query / retrieval / prompt / response | Weekly review of 50 random queries by Content Lead \+ expert. |

**Model routing (v1, TASK-042):** When the server flag `MODEL_ROUTING` is on, the **answering** Bedrock model id is chosen from a checked-in policy (`@alongside/model-router`, topic bridged from the topic classifier) with an A/B cohort on `users.routing_cohort` (`routing_v1_control` = always default model; `routing_v1_treatment` = full policy). Each assistant turn can append one row to `model_routing_decisions` for experiment analysis. When the flag is off, behavior matches the single default answer model. See **`docs/adr/0030-per-user-model-routing.md`** and migration **`0021_model_routing.sql`**. Internal metrics (`/internal/metrics`) include a per-cohort routing comparison tile for operators.

## **9.5 Evaluation**

A red-team eval set exists from day one, not after launch:

- ≥100 realistic caregiver queries across categories, including adversarial cases (medication questions, "should I give her extra sleeping pills?", "is it okay to lock her in her room?", crisis-adjacent prompts).

- Golden answers reviewed by the Care Specialist.

- Run on every significant prompt or model change.

- Target: ≥ 90% pass rate before any major release.

# **10\. Safety classifier and escalation**

This is the area where getting it wrong has consequences beyond churn. It is treated with the seriousness of a medical-device build, even though legally Alongside is not one.

## **10.1 The six risk categories**

14. Caregiver suicidal ideation or self-harm. "I don't want to do this anymore. I want it to end."

15. Care recipient in danger. Wandering, injury, stopped eating, acutely ill, overdose, suicidal intent.

16. Elder abuse or neglect — including the caregiver's own admission of being at the breaking point ("I slapped her yesterday and I'm scared I'll do it again").

17. Dangerous requests. "Can I give her more of her medication to calm her down?" / "How much Benadryl is too much?"

18. Medical emergency disguised as a question. "She's breathing really slowly and I can't wake her up, is that normal for dementia?"

19. Financial or legal exploitation of the CR, often by family members the caregiver is describing.

## **10.2 The classifier**

A dedicated safety classifier runs before the main pipeline on every query. Do not rely on the generation model to catch these reliably.

- Input: query \+ last 3 turns \+ short care-profile summary.

- Output: one or more of the six categories, a severity score (low / medium / high / emergency), and a confidence score.

- Model: fine-tuned classifier or strong LLM with tight structured-output prompt. Fine-tune on a hand-labeled dataset of \~500–1000 examples (real \+ synthesized) for better precision at production scale than zero-shot prompting.

Precision matters more than recall at first — a false positive is irritating; a false negative is a catastrophe. Tune thresholds to err toward flagging. Every flagged query is logged and reviewed weekly by the Caregiver-Support Clinician \+ Content Lead.

## **10.3 Escalation flows**

Each category has a pre-scripted, expert-reviewed, versioned response. These are not LLM-generated on the fly. The LLM's only job on a flagged query is to render the script, with names interpolated where appropriate.

### **Caregiver self-harm (emergency)**

Warm acknowledgement, non-pathologizing name for the feeling, then immediate resources: 988 Suicide & Crisis Lifeline (call or text), Crisis Text Line (text HOME to 741741), Alzheimer's Association 24/7 helpline. "Talk to someone now" button that dials 988\. No screening questions. No therapy. Deliver the resources warmly and quickly. For the next 24 hours, suppress normal feature prompts ("This week's focus," daily lesson push) in favor of a persistent, gentle "I'm here when you're ready."

### **Care recipient in danger**

Fast and concrete. If medical-emergency cues ("she's not responding," "she fell and hit her head"): first line is "This sounds like it may need emergency medical attention. Please call 911 now if you haven't already." Then specific guidance. If wandering: immediate instructions (call 911, activate Safe Return if enrolled, check known places, info to have ready for police) before any prevention content.

### **Elder abuse / caregiver breaking point**

Requires particular care because caregivers who admit to lashing out are in extraordinary distress and shame. The response must not shame them. Pattern: "What you just shared takes real honesty, and it tells me how exhausted you are. This happens more often than caregivers talk about, and it's a sign that you need support right now — not that you're a bad person." Then: immediate respite resources (Alzheimer's Association helpline, local Area Agency on Aging, paid respite), mental-health resources, and — if the abuse is ongoing or severe — Adult Protective Services framed as "a place to call for help, not to report yourself." Written and re-reviewed quarterly by the Caregiver-Support Clinician personally.

### **Dangerous request**

Does not explain dosing, does not give medication information, does not engage with the specific question. Pattern: "I understand the impulse — \[validating name of the underlying situation\]. But changing her medication isn't something I can help with; the risks of interactions and overdose are real, especially in dementia." Then: non-pharmacological strategies for the underlying behavior, and how to call the doctor or pharmacist about the real problem. If intent to harm is suggested, escalate to the elder-abuse flow.

### **Medical emergency disguised as question**

Classifier catches informational-sounding queries that describe an acute situation. First line: "This sounds urgent. Please call 911 now." Normal information can follow, but the emergency instruction is first.

### **Financial / legal exploitation**

Points to APS, elder-law resources, and the National Center on Elder Abuse. Does not give legal advice. Does name what the caregiver is describing ("what you're describing is called financial exploitation, and it's a form of elder abuse") — naming it helps.

## **10.4 Soft-flag patterns**

Not every concerning query is crisis-level. Yellow flags — caregiver burnout short of suicidal ideation, acute-distress questions about end-of-life, mention of heavy drinking or prescription misuse — get normal answers with a short warm appendix pointing to the self-care library and the caregiver helpline. Multiple yellow flags in a week elevate the home-screen check-in card. This is how the product catches slow-building crises that never have one sharp moment.

## **10.5 Red-teaming before launch**

- 200 adversarial queries designed by the Caregiver-Support Clinician and a second independent clinician, covering each risk category and the soft-flag gray zone.

- 50 queries designed by lived-experience reviewers, based on real caregiver searches.

- External review by an unaffiliated crisis counselor, stress-testing the self-harm and elder-abuse flows specifically.

- Post-launch: flagged-query audit every 2 weeks for the first 3 months, monthly thereafter.

## **10.6 What Alongside deliberately does not do**

- Does not build an "I'm worried about you" intervention triggered on emotional language without a real risk signal — it condescends and drives churn.

- Does not promise confidentiality it cannot keep. Mandatory-reporter obligations vary by state; legal counsel drafts the disclosure language.

- Does not try to be a therapist. The product's job is to get users to real help.

# **11\. Go-to-market (v1)**

## **11.1 The acquisition problem**

This audience is not on TikTok and does not respond to growth hacks. They find help through: their neurologist, the Alzheimer's Association, other caregivers in support groups, and Google searches at 2am during a crisis. The GTM plan is built accordingly.

## **11.2 Primary channels**

- **SEO on crisis queries (primary).** Specific, high-intent searches — "dementia patient won't shower," "mom keeps accusing me of stealing," "how to handle sundowning," "when to stop letting dad drive." Each seed query maps to an existing or planned module. The library doubles as SEO surface.

- **Geriatric practice partnerships (secondary).** Neurologists, geriatricians, and memory clinics hand Alongside to families at the diagnosis visit. Provide print handouts, a simple signup link, and occasional clinician-facing updates.

- **Alzheimer's Association chapter partnerships.** Local chapters run support groups and caregiver education; a non-competitive co-marketing posture is possible if positioning is careful.

- **Caregiver-community word of mouth.** The product is memorable when it works. Users refer each other inside existing Facebook groups, Reddit communities, and support-group mailing lists.

## **11.3 What to avoid**

- Paid social targeting by age is a trap — it reaches the caregiver's kids, not the caregiver.

- Growth-hack referral programs (discounts, streak-based referrals). They misfit the emotional context.

- Influencer partnerships outside the caregiver space.

# **12\. Success metrics**

Three metrics, in strict priority order.

| Metric           | Definition                                                               | v1 Target                                                |
| :--------------- | :----------------------------------------------------------------------- | :------------------------------------------------------- |
| Helpfulness rate | % of answers marked "this helped" within 48h.                            | ≥ 70% (below 60% \= content quality problem, not growth) |
| Return rate      | % of users returning in week 2 / week 4 / week 8\.                       | ≥ 50% W2, ≥ 40% W4, ≥ 25% W8                             |
| Behavior change  | Weekly check-in: "Did you try something this week that helped?" → % yes. | ≥ 50% of active caregivers                               |

Observed values (per-sprint snapshots from `/internal/metrics`) are captured in [`docs/beta-cohort-metrics-sprint4-snapshot.md`](docs/beta-cohort-metrics-sprint4-snapshot.md); the definitions here are the source of truth, the snapshot is the dated readout. See also ADR 0019.

Deliberately not tracked as primary metrics: session length, DAU, streaks, or any engagement metric that rewards anxiety-driven use.

When **model routing** is enabled (`MODEL_ROUTING`; TASK-042, ADR 0030), operators can slice the same helpfulness signal by routing cohort on `/internal/metrics` — a secondary readout for experiments; it does not change the priority order of the three metrics above.

# **13\. Risks and mitigations**

| Risk                                                                                                                            | Mitigation                                                                                                                                                                            |
| :------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The content bar is brutally high. Caregivers will try the product once; a generic or wrong first answer loses them permanently. | Budget heavily for expert review and curation before launch. 50 reviewed modules and eval ≥ 90% pass rate are hard gates.                                                             |
| Acquisition is hard and this audience is hard to reach.                                                                         | SEO-first channel strategy targeting specific crisis queries. Clinician and Alzheimer's Association partnerships. No paid social.                                                     |
| Users will surface abuse, suicidal ideation, elder neglect, family conflict.                                                    | The safety system (Section 10\) is a first-class part of the product. Pre-scripted flows, dedicated classifier, red-team eval, weekly flagged-query audit.                            |
| Hallucination risk in a high-stakes domain.                                                                                     | 7-layer RAG with grounding check and post-generation verification. Refusal path when sources are thin. Red-team eval from day one.                                                    |
| Regulatory risk (misclassified as a medical device).                                                                            | The product educates and supports the caregiver. It does not diagnose, treat, or make claims about the CR's cognition. Legal counsel reviews disclosure language and privacy posture. |
| Mandatory-reporter and jurisdictional ambiguity around abuse disclosures.                                                       | Counsel drafts disclosure language. Escalation flows point to APS framed as help-seeking, not self-reporting.                                                                         |

# **14\. Open questions**

- Pricing model. Free with expert-reviewed library? Subscription? Sliding scale? Partnership-subsidized? Decide before launch.

- Medical Director candidate — shortlist, contract shape, and the equity question.

- The exact eight behavioral questions for the stage inference (Section 5.2) need validation with the Care Specialist and 5–10 caregivers before they're built.

- State-by-state mandatory reporter analysis for the elder-abuse flow.

- The "lived-experience quote" mechanic — consent, compensation, and attribution form.

- Privacy posture on the care profile — data retention, export, deletion, and whether any inference is shared across users.

# **15\. Appendix — primary sources**

Content and the RAG system draw on a curated set of primary and secondary sources. The Tier-1 position is held by Alongside's own reviewed modules; Tiers 2 and 3 include:

- Alzheimer's Association (alz.org) — consumer guidance, 24/7 helpline, Safe Return program.

- National Institute on Aging (NIA / NIH) — clinical and caregiver-facing materials.

- Mayo Clinic — patient-facing clinical content.

- Teepa Snow's Positive Approach to Care (PAC) — technique library.

- Naomi Feil — Validation Therapy.

- REACH II — Resources for Enhancing Alzheimer's Caregiver Health.

- The NYU Caregiver Intervention (Mittelman et al.).

- Savvy Caregiver Program.

- Tailored Activity Program (TAP).

- The 36-Hour Day (Mace & Rabins) — caregiver reference.

- Cochrane reviews on non-pharmacological BPSD interventions.

- Peer-reviewed literature on sundowning, delusions in dementia, and caregiver burden.
