import { describe, expect, it } from "vitest";

import {
  aggregateRecentTopicWeights,
  normalizeTopTopics,
} from "../../src/topics/signal.js";

function dayOffset(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

describe("getRecentTopicSignal helpers", () => {
  it("empty history — no slugs, zero messages in scoring map (aggregator)", () => {
    const { scores, messagesConsidered } = aggregateRecentTopicWeights([], new Date("2026-01-20T12:00:00Z"));
    expect(Array.from(scores.entries())).toEqual([]);
    expect(messagesConsidered).toBe(0);
    expect(normalizeTopTopics(scores)).toEqual([]);
  });

  it("three messages all sundowning — one slug at weight 1", () => {
    const now = new Date("2026-01-20T12:00:00Z");
    const { scores } = aggregateRecentTopicWeights(
      [
        { createdAt: now, classifiedTopics: ["sundowning"] },
        { createdAt: now, classifiedTopics: ["sundowning"] },
        { createdAt: now, classifiedTopics: ["sundowning"] },
      ],
      now,
    );
    const top = normalizeTopTopics(scores, 5);
    expect(top).toEqual([{ slug: "sundowning", weight: 1 }]);
  });

  it("recency: a fresh bathing message beats five older sundowning tags (top-1 per message)", () => {
    const now = new Date("2026-01-20T12:00:00Z");
    const dBath = -1; // message from yesterday → much higher exp weight than 13d-old mass
    const dSun = -13;
    const { scores } = aggregateRecentTopicWeights(
      [
        { createdAt: dayOffset(now, dBath), classifiedTopics: ["bathing-resistance", "x"] },
        { createdAt: dayOffset(now, dSun), classifiedTopics: ["sundowning"] },
        { createdAt: dayOffset(now, dSun), classifiedTopics: ["sundowning"] },
        { createdAt: dayOffset(now, dSun), classifiedTopics: ["sundowning"] },
        { createdAt: dayOffset(now, dSun), classifiedTopics: ["sundowning"] },
        { createdAt: dayOffset(now, dSun), classifiedTopics: ["sundowning"] },
      ],
      now,
    );
    const bath = scores.get("bathing-resistance") ?? 0;
    const sun = scores.get("sundowning") ?? 0;
    expect(bath).toBeGreaterThan(sun);
    const top = normalizeTopTopics(scores, 2);
    expect(top[0]!.slug).toBe("bathing-resistance");
    expect(top[0]!.weight).toBe(1);
  });
});

describe("messagesConsidered", () => {
  it("counts all user rows including those with empty topic lists", () => {
    const now = new Date("2026-01-20T12:00:00Z");
    const { messagesConsidered } = aggregateRecentTopicWeights(
      [
        { createdAt: now, classifiedTopics: [] },
        { createdAt: now, classifiedTopics: ["sundowning"] },
      ],
      now,
    );
    expect(messagesConsidered).toBe(2);
  });
});
