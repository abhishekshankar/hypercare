export const WHEN_TO_CALL_DOCTOR: readonly string[] = [
  "New confusion that came on suddenly, or a big change from their usual",
  "Fever, signs of infection, or pain you can’t get under control",
  "A new medicine or dose change, and their alertness or behavior changes fast",
  "Falls with a head hit, or any fall with new confusion, vomiting, or they won’t use an arm/leg",
  "Not eating or drinking, or you see dehydration (very dry mouth, almost no urine for 12+ hours)",
  "Weakness on one side, slurred speech, or a face that doesn’t look even — especially if it started quickly",
] as const;

export const WHEN_TO_CALL_911: readonly string[] = [
  "Trouble breathing, or breathing very slowly or oddly",
  "Possible stroke: sudden trouble speaking, face drooping, one-sided weakness, sudden severe headache",
  "Chest pain, they’re cold/clammy, or they pass out or won’t stay awake",
  "Severe injury or bleeding, choking, or a situation that feels life-threatening right now",
  "They’re not responding when you try to rouse them",
] as const;
