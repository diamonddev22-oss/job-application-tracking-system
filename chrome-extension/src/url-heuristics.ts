// Used by background.ts (an ES module) as its last-resort company-name guess, when no job context
// was captured for a tab at all (e.g. a submission detected via chrome.webNavigation/webRequest
// directly, with nothing from content.ts to prefer instead — see reportApplicationSubmission).
// content.ts needs the exact same logic but keeps its own local copy instead of importing from
// here — see detection-patterns.ts's header comment for why (declaratively injected content
// scripts can't use ES import/export at runtime at all). Keep the two copies in sync by hand.

// Some ATS platforms host every one of their customers' job postings under one shared domain, so
// naively deriving "the company" from the hostname (as the generic fallback below does) actually
// returns the *ATS vendor's own name* instead — e.g. jobs.lever.co/acme/1234 would otherwise guess
// "Lever", not "Acme". The real company has to be read from a different part of the URL instead:
// the tenant subdomain for Workday (acme.wd1.myworkdayjobs.com -> "acme"), or the first path
// segment for the rest (jobs.lever.co/acme/1234 -> "acme").
const WORKDAY_TENANT_PATTERN = /^([a-z0-9-]+)\.[a-z0-9-]+\.myworkdayjobs\.com$/i;
const PATH_TENANT_ATS_HOSTS = [
  'lever.co',
  'greenhouse.io',
  'ashbyhq.com',
  'smartrecruiters.com',
  'breezy.hr',
  'jobvite.com',
  'recruitee.com',
];

function isOrEndsWith(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith(`.${suffix}`);
}

/** Turns a URL slug/subdomain like "acme-corp" or "acme_corp" into "Acme Corp". */
export function humanizeSlug(rawSlug: string): string {
  let decoded = rawSlug;
  try {
    decoded = decodeURIComponent(rawSlug);
  } catch {
    // malformed percent-encoding — fall back to the raw slug as-is
  }
  const words = decoded
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function guessCompanyFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    const workdayMatch = host.match(WORKDAY_TENANT_PATTERN);
    if (workdayMatch) {
      const guess = humanizeSlug(workdayMatch[1]);
      if (guess) return guess;
    }

    if (PATH_TENANT_ATS_HOSTS.some((atsHost) => isOrEndsWith(host, atsHost))) {
      const firstSegment = parsed.pathname.split('/').find((segment) => segment.length > 0);
      const guess = firstSegment ? humanizeSlug(firstSegment) : '';
      if (guess) return guess;
    }

    const parts = host.split('.');
    const base = parts.length > 2 ? parts[parts.length - 2] : parts[0];
    return humanizeSlug(base) || 'Unknown company';
  } catch {
    return 'Unknown company';
  }
}
