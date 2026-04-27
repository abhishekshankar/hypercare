/**
 * Prompt templates for Layer 4. Text is generated into `embedded.generated.ts`
 * at `@alongside/rag` build time so Next.js/OpenNext server bundles do not bake
 * absolute filesystem paths from the machine that ran `next build`.
 */
export { SYSTEM_PROMPT, USER_TEMPLATE } from "./embedded.generated.js";
