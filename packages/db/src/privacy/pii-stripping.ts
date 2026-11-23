function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type PiiContext = {
  email: string;
  crFirstName: string | null;
};

/**
 * Strip obvious PII from safety-flag `last_message_text` on de-identification (ADR 0021).
 */
export function buildPiiResolvers(pii: PiiContext): { strip: (s: string) => string } {
  const emailRe = new RegExp(escapeRe(pii.email.trim()), "gi");
  const name = pii.crFirstName?.trim();
  const nameRe =
    name != null && name.length > 0 ? new RegExp(`\\b${escapeRe(name)}\\b`, "gi") : null;
  const phoneRe = /\b(\+?1[-.\s]?)?(\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})\b/g;
  return {
    strip: (s) => {
      let out = s;
      out = out.replace(emailRe, "[redacted]");
      if (nameRe) {
        out = out.replace(nameRe, "[redacted]");
      }
      out = out.replace(phoneRe, "[redacted]");
      return out;
    },
  };
}
