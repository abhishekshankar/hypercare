export { chunkModuleBody, type TextChunk } from "./chunk.js";
export { buildEmbeddingText, embedTitanV2 } from "./embed.js";
export { parseModuleFile, type ParsedModuleFile } from "./parse.js";
export { moduleFrontMatterSchema, type ModuleFrontMatter, parseReviewDate } from "./schema.js";
export {
  contentHashForChunk,
  loadExistingChunkMap,
  resolveEmbeddings,
  upsertModuleWithChunks,
  type UpsertOneResult,
} from "./upsert.js";
export { requireDatabaseUrlAdmin, resolveModulesDir, runLoad } from "./cli.js";
export {
  buildModuleFrontMatterFromModuleRow,
  publishModuleFromDatabase,
  runIngestAllModulesFromDisk,
} from "./ingest.js";
export {
  APP_ROLES,
  hasAnyRole,
  isAppRole,
  isPrivilegedContentRole,
  type AppRole,
} from "./app-role.js";
export {
  DRAFT_STATUSES,
  assertCanCallPublish,
  canPublishForCategory,
  evidenceRequiredForMoveToExpertReview,
  hasAllRequiredApprovals,
  isDraftStatus,
  requiredReviewRolesForCategory,
  validateTransitionRequest,
  type DraftStatus,
} from "./workflow.js";
export { replaceModuleChunkRowsInTx } from "./upsert.js";
export * from "./stage-rules/index.js";
