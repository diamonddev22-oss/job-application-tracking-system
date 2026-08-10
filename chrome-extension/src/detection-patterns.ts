// Used by background.ts for its webNavigation/webRequest-based detection layers (see that file's
// header comment). content.ts needs the same SUCCESS_URL_PATTERN for its own, in-page URL check,
// but keeps its own local copy instead of importing from here — declaratively injected content
// scripts load as classic (non-module) scripts and can't use ES import/export at runtime at all.
// Keep the two copies in sync by hand if this changes.

/** A URL that itself strongly suggests a successful application confirmation, e.g.
 * "…/thank-you" or "…/application-submitted". Specific enough to trust on its own, without
 * needing corroboration from a recent submit-like click.
 *
 * The bare "/thanks" alternative (as its own path segment, via the lookahead) exists specifically
 * for Lever (jobs.lever.co) — on a successful submission it redirects to ".../thanks", not
 * ".../thank-you", which the "thank[-_ ]?you" alternative alone doesn't cover (it requires "you"
 * to actually follow "thank"). Anchored to a "/" immediately before it and a "/", "?", "#", or the
 * end of the string immediately after, so it doesn't fire on unrelated words like "thanksgiving"
 * or a URL that merely contains "no-thanks" somewhere. */
export const SUCCESS_URL_PATTERN =
  /(thank[-_ ]?you|\/thanks(?=[/?#]|$)|application[-_ ]?(submitted|received|success|complete|confirmation|confirmed)|apply[-_ ]?(success|complete|confirmation|confirmed)|applied[-_ ]?(success|confirmation)|submission[-_ ]?(received|confirmed|complete))/i;

/** A request URL that looks like it's part of an application submission (as opposed to some
 * unrelated form on the same page). Deliberately excludes a bare "submit" — that word alone shows
 * up on every contact form, newsletter signup, and comment box on the web — "apply"/"application"
 * are far more specific to this use case. Used to filter chrome.webRequest events in background.ts. */
export const APPLY_REQUEST_PATTERN = /\b(apply|application)/i;
