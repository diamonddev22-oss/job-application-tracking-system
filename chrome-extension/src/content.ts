// Injected on every page (see manifest content_scripts). There is no universal browser signal for
// "a job application was submitted" — every site works differently — so this uses a best-effort,
// site-agnostic heuristic:
//
//   1. Opportunistically capture job details (company/title) from schema.org JobPosting structured
//      data whenever a page has it, and hand that off to the background worker to remember per-tab.
//      Multi-step apply flows often lose that markup by the time the user reaches a confirmation
//      screen, so it has to be captured earlier and carried forward.
//   2. Watch for signals that the current page is an application confirmation: the URL changing to
//      something like "…/thank-you" or "…/application-submitted" (covers both full navigations and
//      SPA route changes — also independently watched for at the browser level via
//      chrome.webNavigation in background.ts, which doesn't depend on this script having loaded or
//      on the page's own JS not having clobbered history.pushState), or on-page text appearing that
//      matches common confirmation phrasing (covers SPAs that show a success message without
//      changing the URL at all, including inside Shadow DOM). Network-request-based detection (a
//      successful POST to an "apply"-shaped endpoint, including plain, non-JS <form> submissions)
//      is handled entirely in background.ts via chrome.webRequest — see its top-of-file comment.
//   3. Crucially, on-page-text detection ONLY counts if a genuine "submit the application" click
//      was recently observed in this tab (see watchForSubmitClicks below) — the initial
//      "Apply"/"Apply Now" button *usually* just opens a form, and that form's own instructional
//      copy ("Complete your application below") can otherwise look exactly like a real
//      confirmation to a wording-based heuristic. But "Apply" is also, on some one-click-apply job
//      boards, the entire submission — so a click on it doesn't just get ignored outright; it's
//      given a brief moment to reveal whether a form actually appeared before deciding whether to
//      arm (see formLooksFreshlyOpened). The URL-based check is exempt from this gate entirely
//      since a "…/thank-you"-style URL is specific enough on its own, and is what covers
//      full-page-reload confirmations where this script (and any click it saw) doesn't survive the
//      navigation anyway.
// Note: no runtime imports here on purpose, not even from detection-patterns.ts — declaratively
// injected content scripts (manifest.json, no `"type": "module"`) load as classic scripts and
// can't use ES import/export at all. background.ts *is* an ES module (its manifest entry does set
// `"type": "module"`) and imports SUCCESS_URL_PATTERN from detection-patterns.ts for its own,
// independent webNavigation-based check; the copy below must be kept in sync with it by hand.
import type {
  ApplicationSubmitDetectedMessage,
  JobContextDetectedMessage,
  SubmitArmedResponse,
  SubmitIntentDetectedMessage,
} from './types';

const LOG_PREFIX = '[JATS]';

// The bare "/thanks" alternative exists specifically for Lever (jobs.lever.co), which redirects to
// ".../thanks" (not ".../thank-you") on a successful submission — see detection-patterns.ts, kept
// in sync with this copy by hand, for the full rationale.
const SUCCESS_URL_PATTERN =
  /(thank[-_ ]?you|\/thanks(?=[/?#]|$)|application[-_ ]?(submitted|received|success|complete|confirmation|confirmed)|apply[-_ ]?(success|complete|confirmation|confirmed)|applied[-_ ]?(success|confirmation)|submission[-_ ]?(received|confirmed|complete))/i;

// Rather than enumerating exact phrasings (which is brittle — "your application was sent" vs.
// "application submitted successfully" vs. "we've received your application" all describe the
// same event with the key words in different order and with different linking verbs in between),
// this looks for "application"/"submission" appearing near a positive verb in *either* order,
// within a short character window. That's resilient to whatever linking words a given site uses
// ("has been", "was", "is", "successfully", etc.) without having to guess all of them up front.
const THANK_YOU_PATTERN = /thank(s| you)\b[^.!\n]{0,60}\b(applying|your application|your interest|apply)\b/i;
// "complete" (present tense, no "d") is kept separate with a much tighter gap than the other verbs
// — it's exactly what an *instruction* on the apply form itself tends to say too ("Please complete
// the application form below"), which the wider 45-char window would otherwise happily match. A
// short gap still catches genuine banners like "Application Complete" / "Your application is
// complete" while avoiding the far more common instructional phrasing that has other words between
// "application" and "complete".
const APPLICATION_THEN_VERB_PATTERN =
  /\b(your\s+)?application[s]?\b[^.!\n]{0,45}\b(submitted|received|sent|completed|confirmed)\b|\b(your\s+)?application[s]?\b[^.!\n]{0,12}\bcomplete\b/i;
const VERB_THEN_APPLICATION_PATTERN =
  /\b(submitted|received|sent|completed|confirmed)\b[^.!\n]{0,45}\b(your\s+)?application[s]?\b/i;
const APPLIED_PATTERN =
  /\b(successfully applied|you('ve| have) (successfully )?applied|application (sent|submitted|received)|applied successfully)\b/i;
const SUBMISSION_PATTERN = /\bsubmission\b[^.!\n]{0,40}\b(received|confirmed|successful|complete[d]?)\b/i;

const SUCCESS_TEXT_PATTERNS = [
  THANK_YOU_PATTERN,
  APPLICATION_THEN_VERB_PATTERN,
  VERB_THEN_APPLICATION_PATTERN,
  APPLIED_PATTERN,
  SUBMISSION_PATTERN,
  /application confirmation/i,
];

// Only worth guessing job details from generic page content (no structured data) when the page
// looks like a job/careers page at all — otherwise this would misfire on unrelated forms. Checked
// against the full URL (not just the path) so it also catches things like careers.company.com or
// company.com/?gh_jid=123, plus common ATS platforms that don't put "job" anywhere in the URL.
const JOB_URL_HINT_PATTERN =
  /(\bjob|\bcareer|\bapply|\bapplicat|\bposition|\bvacanc|\bopening|\bopportunit|\brecruit|\bhiring|\brole\b|\brequisition\b|greenhouse\.io|lever\.co|myworkdayjobs|icims\.com|smartrecruiters|jazzhr|bamboohr|taleo|successfactors|jobvite|ashbyhq|breezy\.hr|workable\.com)/i;

// Classifies a clicked control's accessible text as either the *final* "submit the application"
// action or the *initial* "Apply"/"Apply Now" call-to-action that merely opens the form — only the
// former is allowed to arm text/network-based detection (see watchForSubmitClicks). Checked in
// this order (start-pattern first) so that a button literally labelled "Apply" — the single most
// common case — is never mistaken for a final submit.
const APPLY_START_CLICK_PATTERN =
  /\bapply now\b|\bquick apply\b|\beasy apply\b|\bapply (for|to) this\b|^\s*apply\s*$/i;
const FINAL_SUBMIT_CLICK_PATTERN =
  /\bsubmit(ting)? (my |your |the )?application\b|\bsend (my |your )?application\b|\bfinish(ing)? (my |your )?application\b|\bcomplete (my |your )?application\b|^\s*submit\s*$/i;

// A generic type="submit" button inside *some* <form> is meaningless on its own — every login,
// search, newsletter, and "create account" form on the page also has one, and job/career sites
// like Workday put a real sign-in form right next to the application flow. This is checked against
// *any* click classified as a possible submit (final-submit wording, apply-start wording, or the
// generic-submit fallback below) so none of them can be fooled by, say, a "Sign In" button that
// happens to also literally contain the word "submit" in a hidden accessibility label.
const NON_APPLICATION_ACTION_PATTERN =
  /\b(sign|log)[\s-]?(in|out|up)\b|\bcreate account\b|\bregister\b|\bsubscribe\b|\bnewsletter\b|\bsearch\b|\bsave (this )?(job|search)\b|\b(forgot|reset) password\b|\bcontinue with (google|linkedin|facebook|apple|sso|microsoft)\b/i;

let alreadyReported = false;

interface DetectedJobContext {
  company: string;
  jobTitle: string;
}

function extractJobPostingFromJsonLd(): DetectedJobContext | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of Array.from(scripts)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? '');
    } catch {
      continue;
    }

    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    for (const candidate of candidates) {
      if (typeof candidate !== 'object' || candidate === null) continue;
      const item = candidate as Record<string, unknown>;
      const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
      if (!types.includes('JobPosting')) continue;

      const jobTitle = typeof item.title === 'string' ? item.title.trim() : '';
      const hiringOrg = item.hiringOrganization as Record<string, unknown> | undefined;
      const company = typeof hiringOrg?.name === 'string' ? hiringOrg.name.trim() : '';
      if (jobTitle && company) {
        return { company, jobTitle };
      }
    }
  }
  return null;
}

// Note: kept as a local copy rather than importing from url-heuristics.ts — see the "no runtime
// imports" note near the top of this file. background.ts imports the same logic from there for its
// own last-resort guess; keep the two copies in sync by hand.
//
// Some ATS platforms host every one of their customers' job postings under one shared domain, so
// naively deriving "the company" from the hostname alone actually returns the *ATS vendor's own
// name* instead — e.g. jobs.lever.co/acme/1234 would otherwise guess "Lever", not "Acme". The real
// company has to be read from a different part of the URL: the tenant subdomain for Workday
// (acme.wd1.myworkdayjobs.com -> "acme"), or the first path segment for the rest.
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

function humanizeSlug(rawSlug: string): string {
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

function guessCompanyFromUrl(): string {
  const host = window.location.hostname.replace(/^www\./, '');

  const workdayMatch = host.match(WORKDAY_TENANT_PATTERN);
  if (workdayMatch) {
    const guess = humanizeSlug(workdayMatch[1]);
    if (guess) return guess;
  }

  if (PATH_TENANT_ATS_HOSTS.some((atsHost) => host === atsHost || host.endsWith(`.${atsHost}`))) {
    const firstSegment = window.location.pathname.split('/').find((segment) => segment.length > 0);
    const guess = firstSegment ? humanizeSlug(firstSegment) : '';
    if (guess) return guess;
  }

  const parts = host.split('.');
  const base = parts.length > 2 ? parts[parts.length - 2] : parts[0];
  return humanizeSlug(base) || 'Unknown company';
}

function metaTagContent(selector: string): string {
  return document.querySelector(selector)?.getAttribute('content')?.trim() ?? '';
}

// Preferred over document.title whenever available — og:title (set for social-share previews) and
// the page's own <h1> almost always hold the exact, human-written job title verbatim (e.g.
// "Account Partner"), whereas <title> is frequently a generic "Careers at Acme" or has the job
// title buried behind extra boilerplate in a format this can't reliably guess at (site name
// first, last, or not there at all).
function guessJobTitleFromPage(): string {
  const metaTitle = metaTagContent('meta[property="og:title"]') || metaTagContent('meta[name="twitter:title"]');
  if (metaTitle) return metaTitle;

  const heading = document.querySelector('h1');
  const headingText = heading?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  if (headingText && headingText.length <= 150) return headingText;

  // Last resort: strip a common "... - SiteName" / "... | SiteName" suffix from the tab title.
  return document.title.split(/[-|·]/)[0].trim();
}

function guessCompanyFromPage(): string {
  return metaTagContent('meta[property="og:site_name"]') || guessCompanyFromUrl();
}

function sendMessage(
  message: JobContextDetectedMessage | ApplicationSubmitDetectedMessage | SubmitIntentDetectedMessage,
): void {
  chrome.runtime.sendMessage(message).catch((error) => {
    // Background service worker not reachable (e.g. extension reloading) — nothing to recover here.
    console.debug(LOG_PREFIX, 'failed to reach background worker', error);
  });
}

// Failing closed (not armed) on any messaging error: a background service worker that can't be
// reached can't submit the tracked application either, so being permissive here wouldn't recover
// anything — it would just risk a false-positive report.
async function isSubmitArmed(): Promise<boolean> {
  try {
    const response = (await chrome.runtime.sendMessage({ type: 'JATS_CHECK_SUBMIT_ARMED' })) as
      | SubmitArmedResponse
      | undefined;
    return response?.armed ?? false;
  } catch (error) {
    console.debug(LOG_PREFIX, 'failed to check submit-armed state', error);
    return false;
  }
}

function captureJobContext(): void {
  const structured = extractJobPostingFromJsonLd();
  if (structured) {
    console.debug(LOG_PREFIX, 'captured job context from JobPosting data', structured);
    sendMessage({ type: 'JATS_JOB_CONTEXT_DETECTED', ...structured, jobUrl: window.location.href });
    return;
  }

  if (JOB_URL_HINT_PATTERN.test(window.location.href)) {
    const jobTitle = guessJobTitleFromPage();
    if (jobTitle) {
      const context = { company: guessCompanyFromPage(), jobTitle };
      console.debug(LOG_PREFIX, 'captured low-confidence job context from page metadata', context);
      sendMessage({ type: 'JATS_JOB_CONTEXT_DETECTED', ...context, jobUrl: window.location.href });
    }
  }
}

function reportSuccessIfNotAlready(reason: string): void {
  if (alreadyReported) return;
  alreadyReported = true;
  console.debug(LOG_PREFIX, 'application submission detected:', reason);
  sendMessage({ type: 'JATS_APPLICATION_SUBMIT_DETECTED', jobUrl: window.location.href, pageTitle: document.title });
}

// Text/network-based signals are inherently ambiguous — an apply form's own "Complete your
// application" instructions, or a click-tracking beacon fired on the *initial* Apply click, can
// look identical to a real confirmation. Requiring a recent, genuine submit-like click (see
// watchForSubmitClicks) before trusting them rules those out without discarding the signal
// entirely — see the file header comment for why the URL-based check doesn't need this.
async function reportSuccessIfArmed(reason: string): Promise<void> {
  if (alreadyReported) return;
  if (!(await isSubmitArmed())) {
    console.debug(LOG_PREFIX, 'suppressed (no recent submit-application click seen):', reason);
    return;
  }
  reportSuccessIfNotAlready(reason);
}

function looksLikeSuccessByUrl(): boolean {
  return SUCCESS_URL_PATTERN.test(window.location.href);
}

function textMatchesSuccess(text: string): boolean {
  if (!text || text.trim().length < 8) return false;
  const sample = text.length > 3000 ? text.slice(0, 3000) : text;
  return SUCCESS_TEXT_PATTERNS.some((pattern) => pattern.test(sample));
}

function checkCurrentPage(): void {
  captureJobContext();
  if (looksLikeSuccessByUrl()) {
    reportSuccessIfNotAlready(`URL matched success pattern (${window.location.href})`);
  } else if (textMatchesSuccess(document.title)) {
    void reportSuccessIfArmed(`document title matched success pattern ("${document.title}")`);
  }
}

// Determines whether the user actually clicked a final "submit the application" control, as
// opposed to the initial "Apply"/"Apply Now" CTA that just opens the form. Listening at the
// document with `capture: true` also catches clicks that originate inside Shadow DOM — click
// events are `composed: true` by spec, so they still bubble/capture past shadow boundaries (unlike
// MutationObserver, which can't see into shadow trees at all) — but `event.target` gets retargeted
// to the shadow host in that case, so `event.composedPath()` is used instead to find the actual
// clicked element.
const CLICKABLE_SELECTOR = 'button, a, input[type="submit"], input[type="button"], [role="button"]';

function findClickedControl(path: readonly EventTarget[]): HTMLElement | null {
  for (let i = 0; i < Math.min(path.length, 8); i++) {
    const node = path[i];
    if (node instanceof HTMLElement && node.matches(CLICKABLE_SELECTOR)) {
      return node;
    }
  }
  return null;
}

function accessibleLabelOf(element: HTMLElement): string {
  const value = element instanceof HTMLInputElement ? element.value : '';
  return `${element.getAttribute('aria-label') ?? ''} ${element.textContent ?? ''} ${value}`.trim();
}

const FORM_FIELD_SELECTOR = 'input[type="text"], input[type="email"], input[type="tel"], input:not([type]), textarea';

// Broader than FORM_FIELD_SELECTOR above (which is specifically for the "does a form look
// freshly-opened/empty" check) — this one's for distinguishing a real application form (name,
// email, phone, resume upload, cover letter, ... — typically several fields) from a login form
// (usually just username/email + password) or a search/newsletter form (usually just one field),
// so a generic type="submit" click can require a minimum field count before it's trusted at all.
const GENERIC_FORM_FIELD_SELECTOR =
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="reset"]):not([type="image"]), textarea, select';
const APPLICATION_FORM_MIN_FIELDS = 4;

function looksLikeApplicationForm(form: HTMLElement): boolean {
  return form.querySelectorAll(GENERIC_FORM_FIELD_SELECTOR).length >= APPLICATION_FORM_MIN_FIELDS;
}

// Whether a substantial, still-empty form is currently on screen — i.e. the page is asking the
// user to fill something out, as opposed to having just confirmed something. Checked across
// Shadow DOM too (via the already-tracked shadow roots — see the Shadow DOM section below),
// since `querySelectorAll` alone can't see into them.
function formLooksFreshlyOpened(): boolean {
  const roots: (Document | ShadowRoot)[] = [document, ...findExistingShadowRoots(document.documentElement)];
  const fields: (HTMLInputElement | HTMLTextAreaElement)[] = [];
  for (const root of roots) {
    fields.push(...Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(FORM_FIELD_SELECTOR)));
  }
  if (fields.length < 2) return false;
  const emptyCount = fields.filter((field) => field.value.trim().length === 0).length;
  return emptyCount / fields.length >= 0.7;
}

function armSubmitDetection(label: string): void {
  console.debug(LOG_PREFIX, 'arming submit-based detection:', label.slice(0, 80) || '(no label)');
  sendMessage({ type: 'JATS_SUBMIT_INTENT_DETECTED' });
}

// "Apply"/"Apply Now" is ambiguous on its own: on most multi-step ATS flows it just reveals a form
// to fill out (must NOT arm — that was the original bug), but on some one-click-apply job boards
// (existing resume/profile on file, no extra info needed) it *is* the entire submission. Text
// can't tell these apart up front, so this waits briefly to see what the click actually did: if a
// big, still-empty form appeared, it was step 1 of several — don't arm yet, the real "Submit
// Application" button (below) will arm it properly once the user gets there. Otherwise, treat it
// as the rarer one-click case and arm anyway.
const AMBIGUOUS_CLICK_SETTLE_MS = 900;

function watchForSubmitClicks(): void {
  document.addEventListener(
    'click',
    (event) => {
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target as EventTarget];
      const control = findClickedControl(path);
      if (!control) return;

      const label = accessibleLabelOf(control);
      if (NON_APPLICATION_ACTION_PATTERN.test(label)) return; // "Sign In", "Search", etc. — never arm

      const formEl = control.closest('form');
      const isFinalSubmit = FINAL_SUBMIT_CLICK_PATTERN.test(label);
      const isApplyStart = APPLY_START_CLICK_PATTERN.test(label) && !isFinalSubmit;
      const isSemanticFormSubmit =
        formEl !== null &&
        ((control instanceof HTMLButtonElement && control.type === 'submit') ||
          (control instanceof HTMLInputElement && control.type === 'submit')) &&
        looksLikeApplicationForm(formEl);

      if (isFinalSubmit || isSemanticFormSubmit) {
        armSubmitDetection(label);
        return;
      }

      if (isApplyStart) {
        window.setTimeout(() => {
          if (formLooksFreshlyOpened()) {
            console.debug(LOG_PREFIX, 'apply-start click just opened a form, not arming yet:', label.slice(0, 80));
            return;
          }
          armSubmitDetection(label);
        }, AMBIGUOUS_CLICK_SETTLE_MS);
      }
    },
    { capture: true },
  );
}

// Many application flows are single-page apps that never do a full navigation, so URL changes via
// history.pushState/replaceState need their own signal (there's no native event for these).
function watchForSpaNavigation(): void {
  const notify = () => window.dispatchEvent(new Event('jats:locationchange'));
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = ((...args: Parameters<typeof history.pushState>) => {
    originalPushState(...args);
    notify();
  }) as typeof history.pushState;

  history.replaceState = ((...args: Parameters<typeof history.replaceState>) => {
    originalReplaceState(...args);
    notify();
  }) as typeof history.replaceState;

  window.addEventListener('popstate', notify);
  window.addEventListener('jats:locationchange', () => {
    alreadyReported = false; // new route — allow re-detection there
    checkCurrentPage();
  });
}

// --- Shadow DOM support -----------------------------------------------------------------------
// Several major ATS platforms (Workday among them) render their entire application flow inside
// Shadow DOM for style/markup encapsulation. `MutationObserver.observe(root, {subtree: true})`
// does NOT see into shadow trees at all, even open ones, unless a separate observer is attached to
// each shadow root directly. Patching `attachShadow` lets this capture the real ShadowRoot object
// at creation time and observe it, which works even for `mode: 'closed'` roots (that restriction
// only applies to *external* access via `element.shadowRoot` later, not to code that was already
// holding a reference from the moment of creation). This only works if the patch is installed
// before the page's own scripts run — see manifest.json's content_scripts `run_at: document_start`.
let debounceHandle: number | undefined;

function onPossibleSuccessMutation(mutations: MutationRecord[]): void {
  if (alreadyReported) return;
  window.clearTimeout(debounceHandle);
  debounceHandle = window.setTimeout(() => {
    for (const mutation of mutations) {
      const candidates = mutation.type === 'characterData' ? [mutation.target] : Array.from(mutation.addedNodes);
      for (const node of candidates) {
        const text = node.textContent ?? '';
        if (textMatchesSuccess(text)) {
          void reportSuccessIfArmed(`page content matched success pattern ("${text.trim().slice(0, 120)}")`);
          return;
        }
      }
    }
  }, 400);
}

function observeSuccessText(root: Document | ShadowRoot): void {
  new MutationObserver(onPossibleSuccessMutation).observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function findExistingShadowRoots(root: Node, found: ShadowRoot[] = []): ShadowRoot[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as Element | null;
  while (node) {
    if (node.shadowRoot) {
      found.push(node.shadowRoot);
      findExistingShadowRoots(node.shadowRoot, found);
    }
    node = walker.nextNode() as Element | null;
  }
  return found;
}

// Installed at the very top level (not gated on document.body existing) so it's in place before
// any page script has a chance to attach a shadow root, however early that happens.
const originalAttachShadow = Element.prototype.attachShadow;
Element.prototype.attachShadow = function patchedAttachShadow(this: Element, init: ShadowRootInit): ShadowRoot {
  const shadowRoot = originalAttachShadow.call(this, init);
  try {
    observeSuccessText(shadowRoot);
  } catch (error) {
    console.debug(LOG_PREFIX, 'failed to observe dynamically created shadow root', error);
  }
  return shadowRoot;
};

// Observing `document` (rather than `document.body`) works even before <body> exists yet — it
// still sees <body> itself get added, plus everything after — so this can also run immediately.
observeSuccessText(document);

function start(): void {
  console.debug(LOG_PREFIX, 'content script active on', window.location.href);
  watchForSpaNavigation();
  watchForSubmitClicks();
  // Covers any shadow roots that were attached before this script got a chance to run (the patch
  // above only catches ones created *after* this point).
  for (const shadowRoot of findExistingShadowRoots(document.documentElement)) {
    observeSuccessText(shadowRoot);
  }
  checkCurrentPage();
}

if (document.body) {
  start();
} else {
  document.addEventListener('DOMContentLoaded', start);
}
