import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const careProfile = pgTable(
  "care_profile",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    crFirstName: text("cr_first_name").notNull(),
    crAge: integer("cr_age"),
    crRelationship: text("cr_relationship").notNull(),
    crDiagnosis: text("cr_diagnosis"),
    crDiagnosisYear: integer("cr_diagnosis_year"),
    stageAnswers: jsonb("stage_answers").notNull().default(sql`'{}'::jsonb`),
    inferredStage: text("inferred_stage"),
    livingSituation: text("living_situation"),
    careNetwork: text("care_network"),
    careHoursPerWeek: integer("care_hours_per_week"),
    caregiverProximity: text("caregiver_proximity"),
    caregiverAgeBracket: text("caregiver_age_bracket"),
    caregiverWorkStatus: text("caregiver_work_status"),
    caregiverState1_5: integer("caregiver_state_1_5"),
    hardestThing: text("hardest_thing"),
    crBackground: text("cr_background"),
    crJoy: text("cr_joy"),
    crPersonalityNotes: text("cr_personality_notes"),
    /** 0 = sprint-2 yes/no/unsure `stage_answers` only; 1 = TASK-034 v1 ordinals. */
    stageQuestionsVersion: integer("stage_questions_version").notNull().default(0),
    medManagementV1: text("med_management_v1"),
    drivingV1: text("driving_v1"),
    aloneSafetyV1: text("alone_safety_v1").array(),
    recognitionV1: text("recognition_v1"),
    bathingDressingV1: text("bathing_dressing_v1"),
    wanderingV1: text("wandering_v1"),
    conversationV1: text("conversation_v1"),
    sleepV1: text("sleep_v1"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "care_profile_cr_relationship_check",
      sql`${t.crRelationship} IN ('parent', 'spouse', 'sibling', 'in_law', 'other')`,
    ),
    check(
      "care_profile_cr_diagnosis_check",
      sql`(${t.crDiagnosis} IS NULL OR ${t.crDiagnosis} IN (
        'alzheimers', 'vascular', 'lewy_body', 'frontotemporal', 'mixed',
        'unknown_type', 'suspected_undiagnosed'
      ))`,
    ),
    check(
      "care_profile_inferred_stage_check",
      sql`(${t.inferredStage} IS NULL OR ${t.inferredStage} IN ('early', 'middle', 'late', 'unknown'))`,
    ),
    check(
      "care_profile_living_situation_check",
      sql`(${t.livingSituation} IS NULL OR ${t.livingSituation} IN (
        'with_caregiver', 'alone', 'with_other_family', 'assisted_living',
        'memory_care', 'nursing_home'
      ))`,
    ),
    check(
      "care_profile_care_network_check",
      sql`(${t.careNetwork} IS NULL OR ${t.careNetwork} IN (
        'solo', 'siblings_helping', 'paid_help', 'spouse_of_cr'
      ))`,
    ),
    check(
      "care_profile_caregiver_proximity_check",
      sql`(${t.caregiverProximity} IS NULL OR ${t.caregiverProximity} IN (
        'same_home', 'same_city', 'remote'
      ))`,
    ),
    check(
      "care_profile_caregiver_age_bracket_check",
      sql`(${t.caregiverAgeBracket} IS NULL OR ${t.caregiverAgeBracket} IN (
        'under_40', '40_54', '55_64', '65_74', '75_plus'
      ))`,
    ),
    check(
      "care_profile_caregiver_work_status_check",
      sql`(${t.caregiverWorkStatus} IS NULL OR ${t.caregiverWorkStatus} IN ('working', 'retired', 'other'))`,
    ),
    check(
      "care_profile_caregiver_state_1_5_check",
      sql`(${t.caregiverState1_5} IS NULL OR (${t.caregiverState1_5} >= 1 AND ${t.caregiverState1_5} <= 5))`,
    ),
    check(
      "care_profile_stage_questions_version_check",
      sql`(${t.stageQuestionsVersion} IS NOT NULL AND ${t.stageQuestionsVersion} >= 0 AND ${t.stageQuestionsVersion} <= 1)`,
    ),
    check(
      "care_profile_med_management_v1_check",
      sql`(${t.medManagementV1} IS NULL OR ${t.medManagementV1} IN ('self', 'reminders', 'hands_on_help'))`,
    ),
    check(
      "care_profile_driving_v1_check",
      sql`(${t.drivingV1} IS NULL OR ${t.drivingV1} IN ('safe', 'worried', 'stopped_recent', 'stopped_long_ago', 'never_drove'))`,
    ),
    check(
      "care_profile_recognition_v1_check",
      sql`(${t.recognitionV1} IS NULL OR ${t.recognitionV1} IN ('yes_always', 'yes_usually', 'sometimes', 'rarely'))`,
    ),
    check(
      "care_profile_bathing_dressing_v1_check",
      sql`(${t.bathingDressingV1} IS NULL OR ${t.bathingDressingV1} IN ('on_own', 'with_reminders', 'hands_on_help'))`,
    ),
    check(
      "care_profile_wandering_v1_check",
      sql`(${t.wanderingV1} IS NULL OR ${t.wanderingV1} IN ('no', 'once', 'few_times', 'often'))`,
    ),
    check(
      "care_profile_conversation_v1_check",
      sql`(${t.conversationV1} IS NULL OR ${t.conversationV1} IN ('yes', 'yes_repeats', 'only_short', 'rarely_makes_sense'))`,
    ),
    check(
      "care_profile_sleep_v1_check",
      sql`(${t.sleepV1} IS NULL OR ${t.sleepV1} IN ('sleep_through', 'some_nights_hard', 'most_nights_hard'))`,
    ),
  ],
);
