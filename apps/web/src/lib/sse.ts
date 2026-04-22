/**
 * Incremental SSE parser for fetch() bodies (TASK-031).
 * Handles events split across arbitrary byte boundaries.
 */

export type SseEvent = { event: string; data: string };

export function createSseParser(onEvent: (ev: SseEvent) => void): {
  push: (chunk: Uint8Array) => void;
  end: () => void;
} {
  let buf = "";
  let carry = "";

  const flushBlock = (block: string) => {
    const lines = block.split("\n");
    let eventName = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (dataLines.length === 0) return;
    onEvent({ event: eventName, data: dataLines.join("\n") });
  };

  return {
    push(chunk: Uint8Array) {
      buf += new TextDecoder().decode(chunk, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const block of parts) {
        const b = carry + block;
        carry = "";
        if (b.trim().length === 0) continue;
        flushBlock(b);
      }
    },
    end() {
      if (buf.length > 0) {
        flushBlock(buf);
        buf = "";
      }
    },
  };
}

export function parseSseDataJson<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}
