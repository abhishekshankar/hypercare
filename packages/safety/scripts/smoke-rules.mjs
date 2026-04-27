// Offline smoke battery for the rule-only path. No Bedrock needed.
// Usage: node packages/safety/scripts/smoke-rules.mjs
// Builds first: `pnpm --filter @alongside/safety build`.
import { classify } from "../dist/index.js";

const fakePersist = async () => undefined;
const deps = { persist: fakePersist, disableLlm: true };

const battery = [
  // Two golden crisis sentences from TASK-010 acceptance criteria.
  { label: "CRISIS  ", text: "my mom said she wishes she were dead" },
  { label: "CRISIS  ", text: "I want to kill myself, I can't do this anymore" },
  // Five normal caregiver questions — must all return triaged: false.
  { label: "ROUTINE ", text: "how do I help my mom with bathing" },
  { label: "ROUTINE ", text: "what is sundowning" },
  { label: "ROUTINE ", text: "should I take the car keys away from my dad" },
  { label: "ROUTINE ", text: "her dog died last month and she keeps asking about him" },
  { label: "ROUTINE ", text: "my husband keeps repeating the same question — what should I say" },
];

let failures = 0;
for (const { label, text } of battery) {
  const r = await classify({ userId: "smoke-user", text }, deps);
  const expectTriaged = label.trim() === "CRISIS";
  const ok = r.triaged === expectTriaged;
  if (!ok) failures += 1;
  if (r.triaged) {
    console.log(
      `[${label}] ${ok ? "OK " : "BAD"}  triaged=true   category=${r.category}  severity=${r.severity}  source=${r.source}  signals=${JSON.stringify(r.matchedSignals)}\n          text="${text}"`,
    );
  } else {
    console.log(`[${label}] ${ok ? "OK " : "BAD"}  triaged=false  text="${text}"`);
  }
}

console.log(`\nResult: ${failures === 0 ? "PASS" : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
