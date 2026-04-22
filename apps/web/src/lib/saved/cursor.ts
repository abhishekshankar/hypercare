import { Buffer } from "node:buffer";

export type SaveListCursor = { savedAt: string; id: string };

export function encodeSaveListCursor(c: SaveListCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeSaveListCursor(raw: string | null | undefined): SaveListCursor | null {
  if (!raw?.trim()) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const o = JSON.parse(json) as unknown;
    if (!o || typeof o !== "object") return null;
    const rec = o as Record<string, unknown>;
    if (typeof rec.savedAt !== "string" || typeof rec.id !== "string") return null;
    if (!/^[0-9a-f-]{36}$/i.test(rec.id)) return null;
    return { savedAt: rec.savedAt, id: rec.id };
  } catch {
    return null;
  }
}
