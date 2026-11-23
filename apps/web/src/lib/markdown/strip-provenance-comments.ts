/**
 * Hermes / lived-experience authoring uses HTML comments (e.g.
 * `<!-- provenance: composite -->`) in markdown source. They must not appear
 * in the caregiver-facing UI; strip before markdown render.
 */
const HERMES_PROVENANCE_COMMENT = /<!--\s*provenance\s*:[^>]*-->/gi;

export function stripHermesProvenanceHtmlComments(markdown: string): string {
  let s = markdown.replace(HERMES_PROVENANCE_COMMENT, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s;
}
