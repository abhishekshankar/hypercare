export type BurnoutBand = "green" | "amber" | "red" | "red_severe";

export type BurnoutScoreResult = {
  score: number;
  band: BurnoutBand;
};

const Q = 7;

/**
 * Sum of 7 Likert items (0–4 each → 0–28). Bands per TASK-021.
 */
export function scoreBurnout(answers: readonly number[]): BurnoutScoreResult {
  if (answers.length !== Q) {
    throw new Error(`Expected ${Q} answers, got ${answers.length}`);
  }
  for (const a of answers) {
    if (!Number.isInteger(a) || a < 0 || a > 4) {
      throw new Error("Each answer must be an integer 0–4");
    }
  }
  const score = answers.reduce((s, n) => s + n, 0);
  const band: BurnoutBand =
    score < 8
      ? "green"
      : score <= 14
        ? "amber"
        : score <= 21
          ? "red"
          : "red_severe";
  return { score, band };
}
