/** Rough English token count for v0 (character-based; no tokenizer dep). */
export function estimateTokenCount(text: string): number {
  if (!text.trim()) return 0;
  return Math.ceil(text.length / 4);
}
