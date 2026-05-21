/**
 * Link „referenca“ za taktiku čuva se u koloni `description` (bez promene šeme):
 * prvi red je interni prefiks + URL, ostatak je korisnički opis.
 */
const TACTIC_REF_LINE_PREFIX = "__TREF__::";

export function unpackTacticDescription(stored: string | null | undefined): {
  referenceUrl: string;
  body: string;
} {
  const s = (stored ?? "").replace(/\r\n/g, "\n");
  if (!s.startsWith(TACTIC_REF_LINE_PREFIX)) {
    return { referenceUrl: "", body: s };
  }
  const rest = s.slice(TACTIC_REF_LINE_PREFIX.length);
  const nl = rest.indexOf("\n");
  if (nl === -1) {
    return { referenceUrl: rest.trim(), body: "" };
  }
  return {
    referenceUrl: rest.slice(0, nl).trim(),
    body: rest.slice(nl + 1),
  };
}

export function packTacticDescription(body: string, referenceUrl: string): string {
  const ref = referenceUrl.trim();
  const b = body.replace(/\r\n/g, "\n");
  if (!ref) return b;
  return `${TACTIC_REF_LINE_PREFIX}${ref}\n${b}`;
}
