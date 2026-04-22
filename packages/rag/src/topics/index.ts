export {
  type TopicClassifyDeps,
  type TopicClassifyInput,
  type TopicClassifyResult,
  classifyTopics,
} from "./classifier.js";
export {
  type RecentTopicSignal,
  aggregateRecentTopicWeights,
  getRecentTopicSignal,
  normalizeTopTopics,
} from "./signal.js";
export { buildTopicClassifierSystemPrompt } from "./prompt.js";
