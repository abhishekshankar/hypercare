import { describe, expect, it } from "vitest";

import { abuseCaregiverToCrRules } from "../src/rules/abuse-caregiver-to-cr.js";
import { abuseCrToCaregiverRules } from "../src/rules/abuse-cr-to-caregiver.js";
import { acuteMedicalRules } from "../src/rules/acute-medical.js";
import { neglectRules } from "../src/rules/neglect.js";
import { selfHarmCrRules } from "../src/rules/self-harm-cr.js";
import { selfHarmUserRules } from "../src/rules/self-harm-user.js";
import type { SafetyRule } from "../src/types.js";

function fires(rules: SafetyRule[], text: string): string[] {
  return rules.filter((r) => r.pattern.test(text)).map((r) => r.id);
}

function any(rules: SafetyRule[], text: string): boolean {
  return rules.some((r) => r.pattern.test(text));
}

describe("rule bank invariants", () => {
  const banks: Record<string, SafetyRule[]> = {
    self_harm_user: selfHarmUserRules,
    self_harm_cr: selfHarmCrRules,
    acute_medical: acuteMedicalRules,
    abuse_cr_to_caregiver: abuseCrToCaregiverRules,
    abuse_caregiver_to_cr: abuseCaregiverToCrRules,
    neglect: neglectRules,
  };

  it("each rule has a stable, unique id within its bank", () => {
    for (const [name, rules] of Object.entries(banks)) {
      const ids = rules.map((r) => r.id);
      expect(new Set(ids).size, `dup id in ${name}`).toBe(ids.length);
      for (const id of ids) {
        expect(id, `empty id in ${name}`).toMatch(/^\S+$/);
      }
    }
  });

  it("each bank has at least 4 patterns (TASK-010 §rule-based-layer)", () => {
    for (const [name, rules] of Object.entries(banks)) {
      expect(rules.length, `bank ${name} too small`).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("self_harm_user rules", () => {
  it.each([
    "I want to kill myself, I can't do this anymore",
    "I just want to end my life",
    "I want to end it all",
    "I don't want to live anymore",
    "I no longer want to be here",
    "I'd be better off dead",
    "I'm thinking about suicide",
  ])("flags: %s", (text) => {
    expect(any(selfHarmUserRules, text)).toBe(true);
  });

  it.each([
    "I want to kill this disease",
    "I want to end the meeting",
    "she has been dead for a year",
    "how do I help my mom with bathing",
    "what is sundowning",
  ])("does NOT flag: %s", (text) => {
    expect(any(selfHarmUserRules, text)).toBe(false);
  });
});

describe("self_harm_cr rules", () => {
  it.each([
    "mom keeps saying she wants to die",
    "she said she wishes she were dead",
    "he tried to kill himself last night",
    "my husband seems suicidal lately",
    "she doesn't want to live anymore",
    "she took all her pills last night",
  ])("flags: %s", (text) => {
    expect(any(selfHarmCrRules, text)).toBe(true);
  });

  it.each([
    "her dog died last month",
    "I want to die when she yells at me", // self-harm-user catches this elsewhere; this bank should not.
    "what do I do when my dad asks the same question",
  ])("does NOT flag: %s", (text) => {
    expect(any(selfHarmCrRules, text)).toBe(false);
  });
});

describe("acute_medical rules", () => {
  it.each([
    "she is not breathing",
    "she stopped breathing",
    "he won't wake up",
    "she's unresponsive after the fall",
    "I think he's having a stroke right now",
    "his face is drooping",
    "she fell and can't get up",
    "she fell and isn't responsive",
    "he is choking",
    "the bleeding won't stop",
    "she took too many pills",
  ])("flags: %s", (text) => {
    expect(any(acuteMedicalRules, text)).toBe(true);
  });

  it.each([
    "she had a stroke last year",
    "she fell yesterday but is fine now",
    "what happens if she stops eating", // hypothetical, not present-tense breathing
    "how do I help with bathing",
  ])("does NOT flag: %s", (text) => {
    expect(any(acuteMedicalRules, text)).toBe(false);
  });
});

describe("abuse_cr_to_caregiver rules", () => {
  it.each([
    "he hit me last night when I tried to change his shirt",
    "she punched me",
    "she pushed me down the stairs",
    "he threw me into the wall",
    "he threatened to kill me",
    "she attacked me when I came in the door",
    "I'm afraid of him",
    "I'm scared of her",
  ])("flags: %s", (text) => {
    expect(any(abuseCrToCaregiverRules, text)).toBe(true);
  });

  it.each([
    "she yelled at me again",
    "she pushed me to call the doctor",
    "it hit me that she doesn't recognise me anymore",
    "how do I help with bathing",
  ])("does NOT flag: %s", (text) => {
    expect(any(abuseCrToCaregiverRules, text)).toBe(false);
  });
});

describe("abuse_caregiver_to_cr rules", () => {
  it.each([
    "I slapped her yesterday",
    "I hit my mother",
    "I shoved him into the chair",
    "I lost it and hit her",
    "I snapped and shoved him",
    "I'm scared I'll hurt her",
    "I'm afraid I'll hit him",
    "I locked her in her room",
    "I tied him to the chair",
  ])("flags: %s", (text) => {
    expect(any(abuseCaregiverToCrRules, text)).toBe(true);
  });

  it.each([
    "I lost it when the pharmacy closed",
    "I am scared she'll fall",
    "how do I help with bathing",
    "what is sundowning",
  ])("does NOT flag: %s", (text) => {
    expect(any(abuseCaregiverToCrRules, text)).toBe(false);
  });
});

describe("neglect rules", () => {
  it.each([
    "what if I just stopped feeding her",
    "I'm going to stop giving her her meds",
    "I'm leaving him alone all weekend",
    "what if I just walked out and never came back",
    "I refuse to bathe her anymore",
  ])("flags: %s", (text) => {
    expect(any(neglectRules, text)).toBe(true);
  });

  it.each([
    "should I leave her alone for an hour while I shower", // narrowly OK — "an hour" is not in long-window list
    "I can't keep feeding her by hand",
    "how often should I help her bathe",
  ])("does NOT flag: %s", (text) => {
    const matched = fires(neglectRules, text);
    expect(matched, `unexpected hits: ${matched.join(",")}`).toEqual([]);
  });
});
