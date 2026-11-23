import type { StageAnswersRecord } from "./v0-keys.js";
import type { AloneSafetyChip, StageV1Answers } from "./v1-types.js";

/**
 * Deterministic v0 → v1 mapping for migration and “replay on first v1 render”.
 * Conservative where v0 was ambiguous (e.g. meds `no` → `reminders`, not `hands_on_help`).
 */
export function mapStageAnswersV0ToV1(stageAnswers: StageAnswersRecord): StageV1Answers {
  const a = stageAnswers;

  const med = a.manages_meds;
  let medManagementV1: StageV1Answers["medManagementV1"] = null;
  if (med === "yes") medManagementV1 = "self";
  else if (med === "no") medManagementV1 = "reminders";
  else if (med === "unsure") medManagementV1 = "reminders";

  const dr = a.drives;
  let drivingV1: StageV1Answers["drivingV1"] = null;
  if (dr === "yes") drivingV1 = "safe";
  else if (dr === "no") drivingV1 = "stopped_long_ago";
  else if (dr === "unsure") drivingV1 = "worried";

  const la = a.left_alone;
  let aloneSafetyV1: AloneSafetyChip[] | null = null;
  if (la === "yes") aloneSafetyV1 = ["nothing"];
  else if (la === "no") aloneSafetyV1 = ["wandering", "falls"];
  else if (la === "unsure") aloneSafetyV1 = ["other"];

  const rec = a.recognizes_you;
  let recognitionV1: StageV1Answers["recognitionV1"] = null;
  if (rec === "yes") recognitionV1 = "yes_usually";
  else if (rec === "no") recognitionV1 = "rarely";
  else if (rec === "unsure") recognitionV1 = "sometimes";

  const bat = a.bathes_alone;
  let bathingDressingV1: StageV1Answers["bathingDressingV1"] = null;
  if (bat === "yes") bathingDressingV1 = "on_own";
  else if (bat === "no") bathingDressingV1 = "hands_on_help";
  else if (bat === "unsure") bathingDressingV1 = "with_reminders";

  const wan = a.wandering_incidents;
  let wanderingV1: StageV1Answers["wanderingV1"] = null;
  if (wan === "no") wanderingV1 = "no";
  else if (wan === "yes") wanderingV1 = "often";
  else if (wan === "unsure") wanderingV1 = "once";

  const conv = a.conversations;
  let conversationV1: StageV1Answers["conversationV1"] = null;
  if (conv === "yes") conversationV1 = "yes";
  else if (conv === "no") conversationV1 = "rarely_makes_sense";
  else if (conv === "unsure") conversationV1 = "only_short";

  const sl = a.sleeps_through_night;
  let sleepV1: StageV1Answers["sleepV1"] = null;
  if (sl === "yes") sleepV1 = "sleep_through";
  else if (sl === "no") sleepV1 = "most_nights_hard";
  else if (sl === "unsure") sleepV1 = "some_nights_hard";

  return {
    medManagementV1,
    drivingV1,
    aloneSafetyV1,
    recognitionV1,
    bathingDressingV1,
    wanderingV1,
    conversationV1,
    sleepV1,
  };
}
