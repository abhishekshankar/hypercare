import type { InferSelectModel } from "drizzle-orm";
import { expectTypeOf, test } from "vitest";
import {
  careProfile,
  careProfileChanges,
  conversations,
  lessonProgress,
  messages,
  moduleChunks,
  moduleTopics,
  modules,
  safetyFlags,
  topics,
  users,
  weeklyCheckins,
} from "../src/schema/index.js";

test("schema infers stable row types", () => {
  expectTypeOf<InferSelectModel<typeof users>>().toMatchTypeOf<{
    id: string;
    cognitoSub: string;
    email: string;
    displayName: string | null;
  }>();

  expectTypeOf<InferSelectModel<typeof careProfile>>().toHaveProperty("stageAnswers");
  expectTypeOf<InferSelectModel<typeof conversations>>().toHaveProperty("userId");
  expectTypeOf<InferSelectModel<typeof messages>>().toHaveProperty("retrieval");
  expectTypeOf<InferSelectModel<typeof modules>>().toHaveProperty("tier");
  expectTypeOf<InferSelectModel<typeof modules>>().toHaveProperty("tryThisToday");
  expectTypeOf<InferSelectModel<typeof moduleChunks>>().toHaveProperty("embedding");
  expectTypeOf<InferSelectModel<typeof safetyFlags>>().toHaveProperty("confidence");
  expectTypeOf<InferSelectModel<typeof topics>>().toHaveProperty("displayName");
  expectTypeOf<InferSelectModel<typeof moduleTopics>>().toMatchTypeOf<{
    moduleId: string;
    topicSlug: string;
  }>();
  expectTypeOf<InferSelectModel<typeof lessonProgress>>().toHaveProperty("source");
  expectTypeOf<InferSelectModel<typeof weeklyCheckins>>().toHaveProperty("triedSomething");
  expectTypeOf<InferSelectModel<typeof careProfileChanges>>().toHaveProperty("newValue");
});
