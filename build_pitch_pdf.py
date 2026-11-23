"""
Build the Alongside pitch as a PDF.
Run: python build_pitch_pdf.py
Output: alongside-pitch.pdf
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.colors import HexColor, black
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    PageBreak,
    HRFlowable,
    KeepTogether,
)
from reportlab.pdfgen import canvas


# ---------- Page decoration ----------

def _draw_footer(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(HexColor("#888888"))
    canvas_obj.drawString(
        0.85 * inch, 0.55 * inch, "Alongside — Product pitch, v1 (April 2026)"
    )
    canvas_obj.drawRightString(
        letter[0] - 0.85 * inch, 0.55 * inch, f"{doc.page}"
    )
    canvas_obj.restoreState()


# ---------- Styles ----------

def build_styles():
    base = getSampleStyleSheet()

    styles = {}

    styles["title"] = ParagraphStyle(
        name="AlongsideTitle",
        parent=base["Title"],
        fontName="Helvetica-Bold",
        fontSize=34,
        leading=40,
        alignment=TA_LEFT,
        textColor=HexColor("#111111"),
        spaceAfter=10,
    )

    styles["subtitle"] = ParagraphStyle(
        name="AlongsideSubtitle",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=14,
        leading=20,
        alignment=TA_LEFT,
        textColor=HexColor("#444444"),
        spaceAfter=24,
    )

    styles["section"] = ParagraphStyle(
        name="AlongsideSection",
        parent=base["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        alignment=TA_LEFT,
        textColor=HexColor("#111111"),
        spaceBefore=22,
        spaceAfter=10,
    )

    styles["subsection"] = ParagraphStyle(
        name="AlongsideSubsection",
        parent=base["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        alignment=TA_LEFT,
        textColor=HexColor("#222222"),
        spaceBefore=12,
        spaceAfter=6,
    )

    styles["body"] = ParagraphStyle(
        name="AlongsideBody",
        parent=base["BodyText"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=16,
        alignment=TA_JUSTIFY,
        textColor=HexColor("#1a1a1a"),
        spaceAfter=10,
    )

    styles["pull"] = ParagraphStyle(
        name="AlongsidePull",
        parent=styles["body"],
        fontName="Helvetica-Oblique",
        fontSize=12,
        leading=18,
        textColor=HexColor("#333333"),
        leftIndent=18,
        rightIndent=18,
        spaceBefore=8,
        spaceAfter=14,
    )

    styles["oneliner"] = ParagraphStyle(
        name="AlongsideOneLiner",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12.5,
        leading=18,
        alignment=TA_LEFT,
        textColor=HexColor("#111111"),
        spaceBefore=8,
        spaceAfter=8,
    )

    styles["caption"] = ParagraphStyle(
        name="AlongsideCaption",
        parent=base["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=9,
        leading=12,
        textColor=HexColor("#666666"),
        spaceAfter=18,
    )

    return styles


# ---------- Helpers ----------

def hr(color="#cccccc", thickness=0.6, space_before=4, space_after=14):
    return HRFlowable(
        width="100%",
        thickness=thickness,
        color=HexColor(color),
        spaceBefore=space_before,
        spaceAfter=space_after,
    )


# ---------- Content ----------

def build_story(s):
    story = []

    # Cover
    story.append(Spacer(1, 0.4 * inch))
    story.append(Paragraph("Alongside", s["title"]))
    story.append(
        Paragraph(
            "The AI guide for families caring for someone with dementia "
            "&mdash; tailored to their stage, your situation, and what&rsquo;s "
            "actually happening this week.",
            s["subtitle"],
        )
    )
    story.append(hr(color="#111111", thickness=1.0, space_before=0, space_after=18))

    # The moment
    story.append(Paragraph("The moment", s["section"]))
    story.append(
        Paragraph(
            "It is 5:47 PM on a Tuesday. Your mother has asked the same question seventeen times. "
            "You have not eaten. Your sibling is not picking up. You open the Alzheimer&rsquo;s Association website "
            "&mdash; which you have read before &mdash; and it tells you, accurately and uselessly, that "
            "<i>behavioral changes are common in dementia</i>.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "You don&rsquo;t need <i>common</i>. You need <i>what do I do in the next ten minutes</i>.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "That moment is what Alongside is built for.",
            s["pull"],
        )
    )

    # What it is
    story.append(Paragraph("What it is", s["section"]))
    story.append(
        Paragraph(
            "Alongside is a web-based AI companion for the family caregiver &mdash; most often an adult "
            "daughter aged 45&ndash;65, or a spouse aged 65+ &mdash; who is reading this on a phone, late at "
            "night, exhausted. It does three jobs that look similar from the outside but are actually different:",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "It tells you <b>what to do right now</b>. The 2 AM &ldquo;she won&rsquo;t let me bathe her&rdquo; "
            "problem. Direct answer in the first two sentences. Specific. Non-clinical. Tailored to your mother, "
            "not a stock mother.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "It helps you <b>understand what&rsquo;s happening</b>. The &ldquo;why is she accusing me of "
            "stealing?&rdquo; question underneath the behavior. One paragraph, neurologically grounded, that gives "
            "you a frame.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "It helps you <b>see around the corner</b>. The &ldquo;what should I be ready for in the next few "
            "months?&rdquo; question most caregivers don&rsquo;t know to ask. Stage-aware, proactive, five minutes "
            "at a time.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "These three jobs map to the three surfaces of the product: a conversation with the AI, a browsable "
            "library, and a &ldquo;this week&rsquo;s focus&rdquo; card on the home screen that picks one thing "
            "worth your attention based on where you and your person actually are.",
            s["body"],
        )
    )

    # Why it exists
    story.append(Paragraph("Why it exists", s["section"]))
    story.append(
        Paragraph(
            "The dementia caregiving information landscape is good but unusable in the moment.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "The Alzheimer&rsquo;s Association has thorough content and a navigation problem. Teepa Snow&rsquo;s "
            "Positive Approach to Care is the gold standard for technique, packaged as expensive video courses "
            "for professional caregivers. A handful of apps exist &mdash; Dementia Careblazers, CareYaya, Rippl "
            "&mdash; but none have nailed the <i>AI guide for your specific situation</i> angle. Generic blog "
            "articles are either too early (you don&rsquo;t have the context yet) or too late (the situation has "
            "already moved on). The fundamental problem is not a content problem; it is an information-matching "
            "problem. AI-driven personalization tuned to stage and situation is genuinely the right tool for it.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "The evidence base for the intervention itself is strong. REACH II, the NYU Caregiver Intervention, "
            "Savvy Caregiver, and the Tailored Activity Program all show that caregiver education and skills "
            "training reduce caregiver burden and delay nursing home placement. Alongside is delivering that "
            "intervention, on demand, at the speed of the question.",
            s["body"],
        )
    )

    story.append(PageBreak())

    # The product
    story.append(Paragraph("The product, in eight screens", s["section"]))
    story.append(
        Paragraph(
            "That&rsquo;s the whole surface. v1 is small on purpose.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "A landing page with a persistent crisis strip &mdash; the Alzheimer&rsquo;s Association 24/7 "
            "helpline visible on every screen, never buried in a footer. A four-to-five minute onboarding that "
            "builds a structured care profile: who they are, behaviorally inferred stage (no jargon &mdash; "
            "<i>can Margaret manage her own medications? does she still drive?</i>), the living and care situation, "
            "who you are and how you&rsquo;re doing, and what matters to her &mdash; what she did for work, what "
            "brings her joy, what&rsquo;s important about her personality. The AI uses that last section to make "
            "the rest of the product feel like it sees your person as a person.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "A home screen with one input &mdash; <i>Ask anything about caring for Margaret</i> &mdash; and one "
            "card with this week&rsquo;s focus. No feed. No streak counter. No daily push. Caregivers are already "
            "anxious; an app that rewards anxiety-driven use is harmful.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "A conversation surface with a fixed response shape: direct answer first, why it&rsquo;s happening, "
            "tailored to your situation, you&rsquo;re not alone in one sentence, two follow-up chips, source "
            "attribution. Five-minute lessons. A library, browsable by situation. An editable care profile that "
            "doubles as the transparency layer &mdash; caregivers can see and control everything the AI knows "
            "about them. A help and safety screen with crisis lines, a <i>when to call 911</i> checklist, and the "
            "Alzheimer&rsquo;s Association helpline.",
            s["body"],
        )
    )
    story.append(Paragraph("That&rsquo;s the product.", s["pull"]))

    # What's underneath
    story.append(Paragraph("What&rsquo;s underneath", s["section"]))
    story.append(
        Paragraph(
            "The hard part is not the screens. It is the substrate the screens read from.",
            s["body"],
        )
    )

    story.append(Paragraph("Content", s["subsection"]))
    story.append(
        Paragraph(
            "Thirty to fifty expert-reviewed modules across seven clusters &mdash; behaviors, daily care, "
            "communication, medical, legal and financial, transitions, caring for yourself. Each module written "
            "by a senior medical writer or caregiver-experience writer, edited by a content lead, reviewed by a "
            "clinical expert (medical director for medical content, dementia care specialist for behavior, "
            "caregiver-support clinician for self-care), and reviewed by a real caregiver with a single prompt: "
            "<i>does this sound like a real person wrote it for you?</i> Annual re-review. A three-tier source "
            "hierarchy where Alongside&rsquo;s own reviewed modules are tier one, the Alzheimer&rsquo;s Association "
            "and NIA are tier two, and the major intervention literature is tier three. Retrieval prefers tier one. "
            "Falls back to tier two when tier one is thin. Triggers an honest refusal when all three are thin.",
            s["body"],
        )
    )

    story.append(Paragraph("Architecture", s["subsection"]))
    story.append(
        Paragraph(
            "A seven-layer RAG pipeline because naive retrieve-and-stuff fails badly in a high-stakes domain. "
            "Query understanding classifies every question on topic, urgency, stage relevance, and safety flags "
            "before retrieval. Hybrid retrieval combines semantic similarity, keyword search, and metadata filters "
            "&mdash; if Margaret is late stage, early-stage bathing advice doesn&rsquo;t surface. A grounding check "
            "verifies that retrieval returned at least one trusted source before generation. Post-generation "
            "verification runs a second cheap pass to confirm every factual claim has support in the retrieved "
            "context, that nothing contradicts it, that no banned patterns slipped through (no medication dosing, "
            "no diagnosis claims, no language about cure or reverse). Attribution is rendered with every answer.",
            s["body"],
        )
    )

    story.append(Paragraph("Safety", s["subsection"]))
    story.append(
        Paragraph(
            "A dedicated classifier runs before the main pipeline on every query, watching for six risk "
            "categories: caregiver self-harm, care recipient in danger, elder abuse including the caregiver&rsquo;s "
            "own breaking point, dangerous medication requests, medical emergencies disguised as questions, and "
            "financial or legal exploitation. Each category has a pre-scripted, expert-reviewed, versioned response "
            "&mdash; not LLM-improvised. The elder-abuse flow is reviewed quarterly by the caregiver-support "
            "clinician personally, and frames Adult Protective Services as &ldquo;a place to call for help, not to "
            "report yourself,&rdquo; because caregivers who admit to lashing out are in extraordinary distress and "
            "shame, and the response must not shame them. Two hundred adversarial queries, designed by two "
            "independent clinicians and fifty real caregivers, run before launch. Flagged-query audits every two "
            "weeks for the first three months, monthly thereafter.",
            s["body"],
        )
    )

    story.append(Paragraph("Family sharing", s["subsection"]))
    story.append(
        Paragraph(
            "A second caregiver &mdash; usually a sibling &mdash; can be invited onto the same care profile so "
            "the household shares the plan. Each caregiver keeps their own conversation history and saved answers. "
            "Privacy by default; sharing as opt-in.",
            s["body"],
        )
    )

    story.append(PageBreak())

    # Metrics
    story.append(Paragraph("The three metrics", s["section"]))
    story.append(
        Paragraph(
            "Helpfulness rate above 70%. Below 60% is a content problem, not a growth problem. Return rate of 50% "
            "at week 2, 40% at week 4, 25% at week 8 &mdash; caregiving is a multi-year journey, and users who "
            "don&rsquo;t return by week 4 will not. And the north star: a weekly one-question check-in &mdash; "
            "<i>did you try something this week that helped?</i> &mdash; answered yes by at least half of active "
            "caregivers. That is the metric that tells us the product is actually doing its job, not just being "
            "pleasant.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "Deliberately not tracked: session length, daily active users, streaks, any engagement metric that "
            "rewards anxiety-driven use.",
            s["body"],
        )
    )

    # GTM
    story.append(Paragraph("How we get there", s["section"]))
    story.append(
        Paragraph(
            "SEO on crisis queries is the primary channel. <i>Dementia patient won&rsquo;t shower. Mom keeps "
            "accusing me of stealing. How to handle sundowning. When to stop letting Dad drive.</i> Every seed "
            "query maps to a module. The library is the SEO surface and the product surface, by design.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "Geriatric practice partnerships are the second channel. Neurologists and memory clinics hand "
            "Alongside to families at the diagnosis visit. Print handouts. Simple signup link. Occasional "
            "clinician-facing updates.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "Local Alzheimer&rsquo;s Association chapter co-marketing is the third &mdash; non-competitive if "
            "positioned carefully, because they run the helpline and the support groups, and Alongside complements "
            "both.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "Paid social is a trap in this category. It reaches the caregiver&rsquo;s kids, not the caregiver. "
            "We do not run it.",
            s["body"],
        )
    )

    # What it is not
    story.append(Paragraph("What it is not", s["section"]))
    story.append(
        Paragraph(
            "It is not a brain-training app for the person with dementia. It is not a symptom tracker. It is not "
            "a medical device. It does not diagnose, dose, or treat. It does not claim to slow, reverse, or cure "
            "disease progression &mdash; none of those are honest claims, and a single dishonest claim in this "
            "domain forfeits trust permanently.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "It is not a therapist. The product&rsquo;s job is to get caregivers to real help, not to be the help.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "It is not for everyone yet. v1 is English-only, web-only, one care recipient per profile, primarily "
            "Western caregiving experience. Spanish is structured for in v2. Cultural and demographic-specific "
            "content &mdash; Black families, Latino caregiving, LGBTQ+ caregivers, rural caregiving &mdash; is in "
            "v2 with appropriate partnership and authentic authorship, not as thin overlays.",
            s["body"],
        )
    )

    # One liner
    story.append(Spacer(1, 0.2 * inch))
    story.append(hr(color="#111111", thickness=1.0, space_before=0, space_after=14))
    story.append(Paragraph("The pitch in one line", s["section"]))
    story.append(
        Paragraph(
            "Alongside turns the world&rsquo;s best dementia caregiving knowledge &mdash; Alzheimer&rsquo;s "
            "Association, Teepa Snow, the major intervention literature, expert review by a real clinical roster "
            "&mdash; into the answer you actually needed at 5:47 PM on Tuesday. Short. Specific to your situation. "
            "Grounded in a named source. There before the next question lands.",
            s["oneliner"],
        )
    )
    story.append(Paragraph("That&rsquo;s the product.", s["pull"]))

    return story


def main():
    output_path = "alongside-pitch.pdf"

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=0.85 * inch,
        rightMargin=0.85 * inch,
        topMargin=0.85 * inch,
        bottomMargin=0.85 * inch,
        title="Alongside — Product Pitch",
        author="Alongside",
        subject="The AI guide for families caring for someone with dementia",
    )

    styles = build_styles()
    story = build_story(styles)

    doc.build(story, onFirstPage=_draw_footer, onLaterPages=_draw_footer)
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
