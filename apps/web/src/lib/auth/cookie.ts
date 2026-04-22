const encoder = new TextEncoder();

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let binary = "";
  for (let i = 0; i < u8.length; i++) {
    binary += String.fromCharCode(u8[i]!);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replaceAll("-", "+").replaceAll("_", "/");
  const pad = (4 - (b64.length % 4)) % 4;
  const str = b64 + "=".repeat(pad);
  const bin = atob(str);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export type SignedPayload = Record<string, unknown>;

export async function signPayload(
  secret: string,
  payload: SignedPayload,
): Promise<string> {
  const key = await importHmacKey(secret);
  const body = new TextEncoder().encode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("HMAC", key, body);
  return `${base64UrlEncode(body)}.${base64UrlEncode(sig)}`;
}

export async function verifyPayload<T extends SignedPayload>(
  secret: string,
  value: string | undefined,
): Promise<T | null> {
  if (value == null || value.length === 0) {
    return null;
  }
  const parts = value.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [bodyB64, sigB64] = parts;
  if (bodyB64 == null || sigB64 == null) {
    return null;
  }
  let body: Uint8Array;
  let sig: Uint8Array;
  try {
    body = fromBase64Url(bodyB64);
    sig = fromBase64Url(sigB64);
  } catch {
    return null;
  }
  const key = await importHmacKey(secret);
  const data = new Uint8Array(body);
  const signature = new Uint8Array(sig);
  const valid = await crypto.subtle.verify("HMAC", key, signature, data);
  if (!valid) {
    return null;
  }
  let json: string;
  try {
    json = new TextDecoder().decode(body);
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed == null) {
    return null;
  }
  return parsed as T;
}
