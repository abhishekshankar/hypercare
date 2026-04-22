import { expectTypeOf, test } from "vitest";
test("schema infers stable row types", () => {
    expectTypeOf().toMatchTypeOf();
    expectTypeOf().toHaveProperty("stageAnswers");
    expectTypeOf().toHaveProperty("userId");
    expectTypeOf().toHaveProperty("retrieval");
    expectTypeOf().toHaveProperty("tier");
    expectTypeOf().toHaveProperty("embedding");
    expectTypeOf().toHaveProperty("confidence");
});
