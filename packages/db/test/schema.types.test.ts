import type { InferSelectModel } from "drizzle-orm";
import { expectTypeOf, test } from "vitest";
import {
  careProfile,
  conversations,
  messages,
  moduleChunks,
  modules,
  safetyFlags,
  users,
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
  expectTypeOf<InferSelectModel<typeof moduleChunks>>().toHaveProperty("embedding");
  expectTypeOf<InferSelectModel<typeof safetyFlags>>().toHaveProperty("confidence");
});
