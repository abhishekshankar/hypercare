/** Prepended to the transcript instruction so Haiku omits caregiver-forbidden facts. */
export function augmentMemoryUserMessageWithForgotten(
  baseUserMessage: string,
  forgottenTexts: readonly string[],
): string {
  if (forgottenTexts.length === 0) return baseUserMessage;
  const lines = forgottenTexts
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => `- ${t}`);
  if (lines.length === 0) return baseUserMessage;
  return [
    "The caregiver has asked you to forget the following facts. Do not re-introduce them into the summary (omit entirely; do not paraphrase them back in):",
    ...lines,
    "",
    baseUserMessage,
  ].join("\n");
}

export function forgottenVerifierRetryPrefix(forgottenTexts: readonly string[]): string {
  const lines = forgottenTexts
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => `- ${t}`);
  return [
    "Your last summary still included facts the caregiver asked to forget. Regenerate the four sections from scratch.",
    "These phrases and facts must not appear anywhere in the new summary (even paraphrased):",
    ...lines,
    "Stay within the usual rules: short, no medications/diagnoses, no long quotes.",
    "",
  ].join("\n");
}
