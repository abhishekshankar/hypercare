import { readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { moduleFrontMatterSchema, type ModuleFrontMatter } from "./schema.js";

export type ParsedModuleFile = {
  filePath: string;
  fileStem: string;
  front: ModuleFrontMatter;
  body: string;
};

/**
 * Read and validate one Markdown file from `content/modules/<slug>.md`.
 */
export async function parseModuleFile(filePath: string): Promise<ParsedModuleFile> {
  const raw = await readFile(filePath, "utf-8");
  const parsed = matter(raw);
  const front = moduleFrontMatterSchema.parse(parsed.data);
  const fileStem = path.basename(filePath, path.extname(filePath));
  if (fileStem !== front.slug) {
    throw new Error(
      `File name must match front-matter slug: file "${fileStem}" !== slug "${front.slug}" (${filePath})`,
    );
  }
  return { filePath, fileStem, front, body: parsed.content };
}
