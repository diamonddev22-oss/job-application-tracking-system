// MV3 service worker. Wires up the side panel and, since the extension detects job applications
// automatically, is also responsible for turning that detection into an actual API call: it
// remembers job details captured per-tab (from content.ts), and once a submission is detected,
// submits it and shows a toast — no manual click required.
//
// Detection itself comes from three independent layers, mirroring the architecture of Simplify
// Copilot (chromewebstore.google.com/detail/pbanhockgagggenencehbnadejlgchfc), a widely-deployed
// job-tracking extension whose public manifest declares exactly these permissions
// (webNavigation/webRequest/tabs + `<all_urls>` host_permissions), rather than injecting a
// page-context script to monkey-patch fetch()/XMLHttpRequest the way this extension used to
// (see git history — that approach was replaced because it structurally can't see plain, non-JS
// <form> submissions at all, and is at the mercy of whatever the page's own JS does to those
// globals):
//   1. chrome.webNavigation (below) — catches the tab's URL becoming something like "…/thank-you",
//      for both full page loads/redirects and SPA pushState/replaceState route changes, at the
//      browser level. This doesn't depend on content.ts having loaded yet, or survive a site
//      re-assigning history.pushState after content.ts's own (still-kept, for its DOM-text checks)
//      patch installed.
//   2. chrome.webRequest (below) — catches a successful non-GET request to an "apply"-shaped URL,
//      for *any* request type: fetch/XHR (from any frame, with no per-frame script injection
//      needed), and — critically — plain <form method="POST"> submissions, which are a real
//      browser navigation, not a JS call, and were invisible to the old fetch/XHR-patching
//      approach entirely.
//   3. On-page text/title matching (content.ts) — the only layer that needs page content, so it
//      has to run in a content script; reported to this file via chrome.runtime.onMessage.
// Layers 2 and on-page text both require a recent genuine "submit" click to have been observed in
// that tab first (see isSubmitArmed) to rule out click-tracking beacons and a freshly-opened form's
// own instructional copy; layer 1 (URL pattern) is specific enough to trust unconditionally.
import { createScreenshotUploadUrl, getConfig, submitApplicationEvent, API_BASE_URL } from './api/client';
import { APPLY_REQUEST_PATTERN, SUCCESS_URL_PATTERN } from './detection-patterns';
import { pushRecentActivity } from './recent-activity';
import { guessCompanyFromUrl } from './url-heuristics';
import type {
  ApplicationSubmitDetectedMessage,
  ContentScriptMessage,
  JobContextDetectedMessage,
  StoredJobContext,
  SubmitArmedResponse,
} from './types';

// So chrome.webRequest doesn't mistake this extension's own POST to /application-events — which
// legitimately has "application" in its URL — for a page's job application submission.
const OWN_BACKEND_ORIGIN = new URL(API_BASE_URL).origin;

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[JATS] failed to set side panel behavior', error));

chrome.runtime.onInstalled.addListener(() => {
  console.log('[JATS] extension installed');
});

// Job context captured on an earlier page (e.g. the job listing) often no longer exists by the time
// a multi-step apply flow reaches its confirmation step, so it's kept here per-tab in between.
// Stale beyond this age is ignored, in case a long-lived tab later shows unrelated "thank you" text.
const CONTEXT_TTL_MS = 3 * 60 * 60 * 1000;

const contextKey = (tabId: number) => `jats.tabContext.${tabId}`;
const reportedKey = (tabId: number) => `jats.tabReported.${tabId}`;
const submitArmedKey = (tabId: number) => `jats.tabSubmitArmed.${tabId}`;

// How long a genuine "submit the application" click keeps text/network-based detection armed for
// in this tab. Generous enough to cover a slow submission — some ATS platforms (Lever among them)
// run resume upload + invisible captcha verification server-side before redirecting to a
// confirmation page, which can easily take longer than a plain AJAX call — short enough that
// clicking "Apply", browsing around for a while, and *then* happening to see unrelated
// confirmation-shaped text elsewhere doesn't get mistaken for a submission.
const SUBMIT_ARM_WINDOW_MS = 45_000;

async function armSubmitIntent(tabId: number): Promise<void> {
  const key = submitArmedKey(tabId);
  await chrome.storage.session.set({ [key]: Date.now() + SUBMIT_ARM_WINDOW_MS });
  console.debug('[JATS] armed submit-based detection for tab', tabId);
}

async function isSubmitArmed(tabId: number): Promise<SubmitArmedResponse> {
  const key = submitArmedKey(tabId);
  const result = await chrome.storage.session.get(key);
  const armedUntil = typeof result[key] === 'number' ? (result[key] as number) : 0;
  return { armed: Date.now() < armedUntil };
}

async function getTabContext(tabId: number): Promise<StoredJobContext | null> {
  const key = contextKey(tabId);
  const result = await chrome.storage.session.get(key);
  const context = result[key] as StoredJobContext | undefined;
  if (!context || Date.now() - context.capturedAt > CONTEXT_TTL_MS) {
    return null;
  }
  return context;
}

async function setTabContext(tabId: number, context: StoredJobContext): Promise<void> {
  await chrome.storage.session.set({ [contextKey(tabId)]: context });
}

interface ReportedState {
  jobUrl: string;
  reportedAt: number;
}

// Multiple independent detection layers (webNavigation, webRequest, on-page text/mutations, and a
// pushState-triggered re-check in content.ts — see its file header) can each notice the *same*
// real-world submission within a few seconds of each other, sometimes with a slightly different
// resolved jobUrl (e.g. a site's SPA router replaces the URL with a query param added, or a
// confirmation redirect lands on a marginally different path, right around when a second signal
// also fires). Matching on the *exact* jobUrl alone let those slip through as two "different"
// submissions. Any report for this tab within the cooldown window is now treated as the same
// submission regardless of jobUrl, on top of the original exact-match check (which stays useful
// after the cooldown expires, e.g. a stale confirmation page loaded again much later).
const DUPLICATE_REPORT_COOLDOWN_MS = 30_000;

async function wasAlreadyReported(tabId: number, jobUrl: string): Promise<boolean> {
  const key = reportedKey(tabId);
  const result = await chrome.storage.session.get(key);
  const state = result[key] as ReportedState | undefined;
  if (!state) return false;
  if (state.jobUrl === jobUrl) return true;
  return Date.now() - state.reportedAt < DUPLICATE_REPORT_COOLDOWN_MS;
}

async function markReported(tabId: number, jobUrl: string): Promise<void> {
  const state: ReportedState = { jobUrl, reportedAt: Date.now() };
  await chrome.storage.session.set({ [reportedKey(tabId)]: state });
}

function notify(title: string, message: string): void {
  chrome.notifications
    .create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title,
      message,
    })
    .catch((error) => console.warn('[JATS] failed to show notification', error));
}

// content.ts runs in every frame on the page (manifest's `all_frames: true` — needed because
// several ATS platforms embed the actual application form in an iframe), so a message from it can
// carry `window.location.href` pointing at an iframe's internal URL (e.g. embed.greenhouse.io/...)
// rather than the page the user is actually looking at in the address bar. A tab's `.url` is always
// its real, top-level URL regardless of which frame reported something, so it's used as the source
// of truth for the captured job URL whenever it's available, and the frame-reported URL is only a
// fallback (e.g. for chrome:// pages where tab.url can be withheld).
function resolveBrowserUrl(tab: chrome.tabs.Tab | undefined, fallback: string): string {
  return tab?.url && tab.url.length > 0 ? tab.url : fallback;
}

async function getTab(tabId: number): Promise<chrome.tabs.Tab | undefined> {
  try {
    return await chrome.tabs.get(tabId);
  } catch (error) {
    console.debug('[JATS] failed to look up tab', tabId, error);
    return undefined;
  }
}

/** chrome.tabs.captureVisibleTab returns a base64 data: URL. Decoded by hand with atob() rather
 * than `fetch(dataUrl).then(r => r.blob())`, which also works in a service worker but adds an
 * avoidable dependency on the fetch spec's data: URL handling being intact in every Chrome build
 * this runs on - atob()/Uint8Array/Blob are all guaranteed-available service worker globals with
 * no such uncertainty. */
function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) throw new Error('malformed data URL (no comma separator)');

  const header = dataUrl.slice(0, commaIndex);
  const base64 = dataUrl.slice(commaIndex + 1);
  const mimeType = /^data:([^;]+);base64$/.exec(header)?.[1] ?? 'image/png';

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

type ScreenshotOutcome =
  | { status: 'attached'; key: string }
  | { status: 'skipped' | 'failed'; detail: string };

// Best-effort visual proof of the application, attached alongside company/title/URL. Captures only
// the viewport (not the full scrollable page) - simpler than a scroll-and-stitch capture, and the
// confirmation message that matters is virtually always what's on-screen at detection time anyway.
// Never allowed to block or fail the actual tracking call: any error here just means the
// application is reported without a screenshot, same as before this feature existed. Every outcome
// (not just failures) is logged with the [JATS] tag, and surfaced to the side panel via
// recent-activity.ts, precisely so a "why didn't I get a screenshot" question is answerable without
// guessing - open chrome://extensions -> this extension -> "service worker" to see these logs live.
async function captureAndUploadScreenshot(tabId: number): Promise<ScreenshotOutcome> {
  const tab = await getTab(tabId);
  // chrome.tabs.captureVisibleTab captures whatever is currently on-screen in the *window*, not
  // necessarily this specific tab - if the user already switched to a different tab by the time
  // detection got here, capturing anyway would silently attach a screenshot of the wrong page.
  if (!tab?.windowId || tab.active !== true) {
    const detail = 'tab was no longer the active tab in its window at detection time';
    console.debug('[JATS] skipping screenshot for tab', tabId, '-', detail);
    return { status: 'skipped', detail };
  }

  let dataUrl: string;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn('[JATS] chrome.tabs.captureVisibleTab failed for tab', tabId, '-', detail);
    return { status: 'failed', detail };
  }

  let blob: Blob;
  try {
    blob = dataUrlToBlob(dataUrl);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn('[JATS] failed to decode captured screenshot -', detail);
    return { status: 'failed', detail };
  }
  console.debug('[JATS] captured screenshot for tab', tabId, '-', blob.size, 'bytes');

  try {
    const upload = await createScreenshotUploadUrl('image/png');
    const putResponse = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: blob });
    if (!putResponse.ok) {
      const detail = `upload PUT failed with status ${putResponse.status} ${putResponse.statusText}`;
      console.warn('[JATS]', detail);
      return { status: 'failed', detail };
    }
    console.debug('[JATS] screenshot uploaded successfully:', upload.key);
    return { status: 'attached', key: upload.key };
  } catch (error) {
    // Most common real-world cause: the backend/S3 storage is unreachable (e.g. MinIO isn't
    // running) - a screenshot-upload-url request or the PUT itself throws a network error here.
    const detail = error instanceof Error ? error.message : String(error);
    console.warn('[JATS] failed to get upload URL / upload the screenshot -', detail);
    return { status: 'failed', detail };
  }
}

async function handleJobContextDetected(
  message: JobContextDetectedMessage,
  tabId: number,
  tab: chrome.tabs.Tab | undefined,
): Promise<void> {
  const jobUrl = resolveBrowserUrl(tab, message.jobUrl);
  console.debug('[JATS] storing job context for tab', tabId, { ...message, jobUrl });
  await setTabContext(tabId, {
    company: message.company,
    jobTitle: message.jobTitle,
    jobUrl,
    capturedAt: Date.now(),
  });
}

/** Common landing point for all three detection layers described in the file header comment —
 * each just needs to resolve a (tabId, candidate jobUrl, candidate page title) before getting here. */
async function reportApplicationSubmission(
  tabId: number,
  tab: chrome.tabs.Tab | undefined,
  reportedUrl: string,
  reportedTitle: string,
  source: string,
): Promise<void> {
  console.debug('[JATS] application submit detected for tab', tabId, 'via', source, reportedUrl);

  const config = await getConfig();
  if (!config.token || config.accountStatus !== 'ACTIVE') {
    console.debug(
      '[JATS] skipping auto-track: not logged in or account not ACTIVE',
      'token present:',
      Boolean(config.token),
      'status:',
      config.accountStatus,
    );
    return; // not logged in / not yet approved — stay silent, the side panel already explains why
  }

  const context = await getTabContext(tabId);
  // Prefer the job context's URL (captured earlier on the actual listing page) since a
  // confirmation screen's own URL is rarely useful to show the user later; otherwise fall back to
  // the browser's current URL for this tab (already frame-corrected by the caller).
  const jobUrl = context?.jobUrl ?? resolveBrowserUrl(tab, reportedUrl);

  if (await wasAlreadyReported(tabId, jobUrl)) {
    console.debug('[JATS] skipping auto-track: already reported for this tab+URL', jobUrl);
    return;
  }
  await markReported(tabId, jobUrl);

  const company = context?.company ?? guessCompanyFromUrl(jobUrl);
  const jobTitle = context?.jobTitle ?? reportedTitle;
  const screenshot = await captureAndUploadScreenshot(tabId);
  const screenshotKey = screenshot.status === 'attached' ? screenshot.key : undefined;

  try {
    const response = await submitApplicationEvent({
      eventType: 'APPLICATION_SUBMITTED',
      company,
      jobTitle,
      jobUrl,
      timestamp: new Date().toISOString(),
      screenshotKey,
    });

    console.debug('[JATS] auto-track submission result:', response.status, response.message);

    await pushRecentActivity({
      company,
      jobTitle,
      jobUrl,
      trackedAt: Date.now(),
      outcome: response.status,
      screenshotStatus: screenshot.status,
      screenshotDetail: screenshot.status !== 'attached' ? screenshot.detail : undefined,
    });

    if (response.status === 'SUCCESS') {
      notify(
        screenshot.status === 'attached'
          ? 'Application tracked automatically (with screenshot)'
          : 'Application tracked automatically (no screenshot)',
        `${jobTitle} at ${company}`,
      );
    }
    // DUPLICATE / ERROR: stay quiet rather than showing a toast for a page the user already tracked.
  } catch (error) {
    console.warn('[JATS] failed to auto-track application', error);
  }
}

async function handleApplicationSubmitDetected(
  message: ApplicationSubmitDetectedMessage,
  tabId: number,
  tab: chrome.tabs.Tab | undefined,
): Promise<void> {
  await reportApplicationSubmission(tabId, tab, message.jobUrl, message.pageTitle, 'content-script');
}

chrome.runtime.onMessage.addListener((message: ContentScriptMessage, sender) => {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return;

  switch (message.type) {
    case 'JATS_JOB_CONTEXT_DETECTED':
      void handleJobContextDetected(message, tabId, sender.tab);
      return undefined;
    case 'JATS_APPLICATION_SUBMIT_DETECTED':
      void handleApplicationSubmitDetected(message, tabId, sender.tab);
      return undefined;
    case 'JATS_SUBMIT_INTENT_DETECTED':
      void armSubmitIntent(tabId);
      return undefined;
    case 'JATS_CHECK_SUBMIT_ARMED':
      // Returning a Promise (rather than calling sendResponse) is how MV3 async listeners reply —
      // Chrome awaits it and sends the resolved value back to content.ts's sendMessage() caller.
      return isSubmitArmed(tabId);
    default:
      return undefined;
  }
});

// --- Layer 1: chrome.webNavigation — URL-pattern detection at the browser level ------------------
// Fires for both full navigations/redirects (onCommitted) and SPA pushState/replaceState route
// changes (onHistoryStateUpdated), for every frame — including iframes some ATS platforms embed
// the whole application flow in, whose own URL (not the tab's) is what actually goes to
// "…/thank-you". Unlike content.ts's own history.pushState patch, this can't be broken by a site's
// JS reassigning that function after the content script's patch installs, and doesn't depend on
// the content script having injected successfully at all.
async function handlePossibleSuccessNavigation(tabId: number, url: string, source: string): Promise<void> {
  if (tabId < 0 || !SUCCESS_URL_PATTERN.test(url)) return;
  const tab = await getTab(tabId);
  await reportApplicationSubmission(tabId, tab, url, tab?.title ?? '', source);
}

chrome.webNavigation.onCommitted.addListener((details) => {
  void handlePossibleSuccessNavigation(details.tabId, details.url, 'webNavigation:onCommitted');
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  void handlePossibleSuccessNavigation(details.tabId, details.url, 'webNavigation:onHistoryStateUpdated');
});

// --- Layer 2: chrome.webRequest — network-level detection ----------------------------------------
// Observes *every* request of these types regardless of how the page made it: fetch()/XHR from any
// frame (no per-frame script injection needed, unlike the old page-context fetch/XHR patch this
// replaced), and — the case that approach could never cover — a plain <form method="POST"> submit,
// which shows up here as a "main_frame"/"sub_frame" request rather than any JS call at all. Gated
// on a recent genuine submit click (see isSubmitArmed) for the same reason described in
// content.ts: an "apply"-shaped URL alone doesn't distinguish a real submission from, say, a
// click-tracking beacon fired the moment the *initial* "Apply" button is clicked.
async function handlePossibleSuccessRequest(details: chrome.webRequest.OnCompletedDetails): Promise<void> {
  const { tabId, method, url, statusCode } = details;
  if (tabId < 0) return;
  if (method === 'GET' || method === 'HEAD') return;
  if (statusCode < 200 || statusCode >= 400) return;
  if (url.startsWith(OWN_BACKEND_ORIGIN)) return; // this extension's own /application-events call

  let pathAndQuery: string;
  try {
    const parsed = new URL(url);
    pathAndQuery = parsed.pathname + parsed.search;
  } catch {
    pathAndQuery = url;
  }
  if (!APPLY_REQUEST_PATTERN.test(pathAndQuery)) return;

  if (!(await isSubmitArmed(tabId)).armed) {
    console.debug('[JATS] ignoring apply-like request (no recent submit click):', method, url);
    return;
  }

  const tab = await getTab(tabId);
  await reportApplicationSubmission(tabId, tab, tab?.url ?? url, tab?.title ?? '', 'webRequest:onCompleted');
}

chrome.webRequest.onCompleted.addListener(
  (details) => void handlePossibleSuccessRequest(details),
  { urls: ['<all_urls>'], types: ['main_frame', 'sub_frame', 'xmlhttprequest', 'ping'] },
);

chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove([contextKey(tabId), reportedKey(tabId), submitArmedKey(tabId)]);
});
