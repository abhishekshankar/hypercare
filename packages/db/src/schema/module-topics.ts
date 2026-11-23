import { index, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { modules } from "./modules.js";
import { topics } from "./topics.js";

export const moduleTopics = pgTable(
  "module_topics",
  {
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    topicSlug: text("topic_slug")
      .notNull()
      .references(() => topics.slug, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ name: "module_topics_module_id_topic_slug_pk", columns: [t.moduleId, t.topicSlug] }),
    index("module_topics_topic_slug_idx").on(t.topicSlug),
  ],
);
