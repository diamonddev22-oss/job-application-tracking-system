import {
  fetchCurrentUser,
  fetchMyResumes,
  fetchRecentApplications,
  getConfig,
  saveConfig,
  submitApplicationEvent,
} from '../api/client';
import type {
  AccountStatus,
  ActivityUpdatedMessage,
  ApplicationEventResponse,
  JobApplication,
  PersistedTrackingStatus,
  StoredConfig,
  TrackingStatus,
  TrackingStatusMessage,
} from '../types';
import { TRACKING_STALE_AFTER_MS, TRACKING_STATUS_STORAGE_KEY } from '../types';

const form = document.getElementById('applicationForm') as HTMLFormElement;
const companyInput = document.getElementById('company') as HTMLInputElement;
const jobTitleInput = document.getElementById('jobTitle') as HTMLInputElement;
const jobUrlInput = document.getElementById('jobUrl') as HTMLInputElement;
const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
const statusMessage = document.getElementById('statusMessage') as HTMLParagraphElement;
const loggedOutNotice = document.getElementById('loggedOutNotice') as HTMLDivElement;
const pendingNotice = document.getElementById('pendingNotice') as HTMLDivElement;
const openOptionsBtn = document.getElementById('openOptionsBtn') as HTMLButtonElement;
const activityEmpty = document.getElementById('activityEmpty') as HTMLParagraphElement;
const activityList = document.getElementById('activityList') as HTMLUListElement;
const resumeSection = document.getElementById('resumeSection') as HTMLDivElement;
const resumeEmpty = document.getElementById('resumeEmpty') as HTMLParagraphElement;
const resumeDownloadLink = document.getElementById('resumeDownloadLink') as HTMLAnchorElement;
const trackingDialog = document.getElementById('trackingDialog') as HTMLDivElement;
const trackingIcon = document.getElementById('trackingIcon') as HTMLDivElement;
const trackingDialogMessage = document.getElementById('trackingDialogMessage') as HTMLParagraphElement;
const trackingDialogStep = document.getElementById('trackingDialogStep') as HTMLParagraphElement;

async function prefillFromActiveTab(): Promise<void> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.url) {
    jobUrlInput.value = activeTab.url;
  }
}

function showStatus(message: string, variant: 'success' | 'duplicate' | 'error'): void {
  statusMessage.textContent = message;
  statusMessage.className = `status ${variant}`;
}

function disableForm(): void {
  form.querySelectorAll('input, button').forEach((el) => el.setAttribute('disabled', 'true'));
}

function applyAccountState(config: StoredConfig, accountStatus: AccountStatus | null): void {
  if (!config.token) {
    loggedOutNotice.classList.remove('hidden');
    disableForm();
  } else if (accountStatus !== null && accountStatus !== 'ACTIVE') {
    pendingNotice.classList.remove('hidden');
    disableForm();
  }
}

// How long the terminal (success/duplicate/error) state stays visible before the dialog closes
// itself and hands control of the panel back to the user.
const TRACKING_DONE_DIALOG_HIDE_MS = 2_200;
let trackingDoneTimeout: ReturnType<typeof setTimeout> | undefined;

// Safety net, independent of anything background.ts does: no real detect -> capture -> upload ->
// send sequence should ever legitimately take this long, so if no follow-up status arrives within
// this window of the last one, assume the background service worker died or an unhandled error
// silently swallowed the rest of the flow, and force the dialog closed rather than leave the user
// permanently locked out of the panel. Re-armed on every 'active' update (sliding window), so a
// slow but still-progressing submission is never cut off mid-flight. Shares TRACKING_STALE_AFTER_MS
// with loadTrackingStatus's own staleness check below — same reasoning, just applied to a status
// that's already showing live rather than one being freshly read from storage.
let trackingWatchdogTimeout: ReturnType<typeof setTimeout> | undefined;

function disarmTrackingWatchdog(): void {
  if (trackingWatchdogTimeout !== undefined) {
    clearTimeout(trackingWatchdogTimeout);
    trackingWatchdogTimeout = undefined;
  }
}

function armTrackingWatchdog(): void {
  disarmTrackingWatchdog();
  trackingWatchdogTimeout = setTimeout(() => {
    console.warn('[JATS] tracking status watchdog fired — no update in', TRACKING_STALE_AFTER_MS, 'ms; closing the dialog');
    renderTrackingStatus(null);
    chrome.storage.session.remove(TRACKING_STATUS_STORAGE_KEY).catch(() => undefined);
  }, TRACKING_STALE_AFTER_MS);
}

const TRACKING_OUTCOME_ICON: Record<Extract<TrackingStatus, { phase: 'done' }>['outcome'], string> = {
  success: '✅',
  duplicate: 'ℹ️',
  error: '⚠️',
};

/** Shows/updates/hides the full-panel blocking dialog for the lifecycle of a single auto-tracked
 * submission (see TrackingStatus in types/index.ts) - while it's visible, its `position: fixed`
 * overlay sits above every other control in the panel, so the user physically can't click the
 * manual form, resume link, etc. until this resolves to null (or the terminal state's own
 * auto-hide timer fires). */
function renderTrackingStatus(status: TrackingStatus | null): void {
  if (trackingDoneTimeout !== undefined) {
    clearTimeout(trackingDoneTimeout);
    trackingDoneTimeout = undefined;
  }

  if (!status) {
    disarmTrackingWatchdog();
    trackingDialog.classList.add('hidden');
    return;
  }

  trackingDialog.classList.remove('hidden');
  trackingDialogMessage.textContent = status.message;

  if (status.phase === 'active') {
    armTrackingWatchdog();
    trackingDialog.classList.remove('tracking-dialog-done');
    trackingDialogStep.textContent = `Step ${status.step} of ${status.totalSteps}`;
    return;
  }

  disarmTrackingWatchdog();
  trackingDialog.classList.add('tracking-dialog-done');
  trackingIcon.textContent = TRACKING_OUTCOME_ICON[status.outcome];
  trackingDialogStep.textContent = '';
  trackingDoneTimeout = setTimeout(() => trackingDialog.classList.add('hidden'), TRACKING_DONE_DIALOG_HIDE_MS);
}

/** Reads whatever background.ts last persisted (see TRACKING_STATUS_STORAGE_KEY) so opening the
 * panel mid-submission - or right after one just finished - shows the dialog immediately instead
 * of only reacting to a live JATS_TRACKING_STATUS message that may have been sent while the panel
 * was closed. Discards anything older than TRACKING_STALE_AFTER_MS rather than rendering it: a
 * genuinely-abandoned entry (e.g. the service worker died mid-submission before ever reaching a
 * terminal state, so the usual TRACKING_DONE_STORAGE_TTL_MS cleanup never got to run) would
 * otherwise resurface and permanently lock the panel the next time it's opened, however long after
 * the fact that is - the live watchdog above only guards a status that's already showing, not one
 * that's stale before it's even been read for the first time. */
async function loadTrackingStatus(): Promise<void> {
  const result = await chrome.storage.session.get(TRACKING_STATUS_STORAGE_KEY);
  const persisted = result[TRACKING_STATUS_STORAGE_KEY] as PersistedTrackingStatus | undefined;
  if (persisted && Date.now() - persisted.updatedAt > TRACKING_STALE_AFTER_MS) {
    console.warn('[JATS] discarding stale persisted tracking status from', new Date(persisted.updatedAt).toISOString());
    await chrome.storage.session.remove(TRACKING_STATUS_STORAGE_KEY);
    renderTrackingStatus(null);
    return;
  }
  renderTrackingStatus(persisted?.status ?? null);
}

/** Applicants only ever have a resume once a manager has approved them (uploading one is a
 * prerequisite for approval — see the web dashboard's ManagerUserRow), so this section only
 * bothers showing/fetching anything once the account is actually ACTIVE. */
async function loadResume(accountStatus: AccountStatus | null): Promise<void> {
  if (accountStatus !== 'ACTIVE') {
    resumeSection.classList.add('hidden');
    return;
  }

  resumeSection.classList.remove('hidden');
  try {
    const resumes = await fetchMyResumes();
    const latest = resumes[0]; // GET /resumes is already newest-version-first
    if (latest) {
      resumeEmpty.classList.add('hidden');
      resumeDownloadLink.classList.remove('hidden');
      resumeDownloadLink.href = latest.fileUrl;
    } else {
      resumeEmpty.textContent = "No resume on file yet — your manager hasn't uploaded one.";
      resumeEmpty.classList.remove('hidden');
      resumeDownloadLink.classList.add('hidden');
    }
  } catch (error) {
    resumeEmpty.textContent = error instanceof Error ? error.message : 'Failed to load your resume.';
    resumeEmpty.classList.remove('hidden');
    resumeDownloadLink.classList.add('hidden');
  }
}

async function init(): Promise<void> {
  const config = await getConfig();
  applyAccountState(config, config.accountStatus);
  await prefillFromActiveTab();
  await loadActivity();
  await loadResume(config.accountStatus);
  await loadTrackingStatus();

  if (!config.token) {
    return;
  }

  // Refresh in case the account was approved/rejected since the last login — best-effort,
  // falls back to the last known status (already applied above) if the backend is unreachable.
  try {
    const user = await fetchCurrentUser(config.token);
    if (user.status !== config.accountStatus) {
      await saveConfig({ ...config, accountStatus: user.status });
      loggedOutNotice.classList.add('hidden');
      pendingNotice.classList.add('hidden');
      form.querySelectorAll('input, button').forEach((el) => el.removeAttribute('disabled'));
      applyAccountState(config, user.status);
      await loadResume(user.status);
    }
  } catch {
    // Offline or token expired — the form already reflects the last known status.
  }
}

function formatRelativeTime(timestampMs: number): string {
  const diffSeconds = Math.round((Date.now() - timestampMs) / 1000);
  if (diffSeconds < 60) return 'just now';
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

const STATUS_LABEL: Record<JobApplication['status'], string> = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

function renderActivity(applications: JobApplication[]): void {
  activityList.innerHTML = '';

  if (applications.length === 0) {
    activityEmpty.classList.remove('hidden', 'activity-error');
    activityEmpty.textContent = 'Nothing tracked yet.';
    activityList.classList.add('hidden');
    return;
  }

  activityEmpty.classList.add('hidden');
  activityList.classList.remove('hidden');

  for (const application of applications) {
    const item = document.createElement('li');
    item.className = 'activity-item';

    const top = document.createElement('div');
    top.className = 'activity-item-top';

    const title = document.createElement('a');
    title.className = 'activity-title';
    title.href = application.jobUrl;
    title.target = '_blank';
    title.rel = 'noreferrer';
    title.textContent = `${application.jobTitle} · ${application.company}`;
    title.title = `${application.jobTitle} at ${application.company}`;
    top.appendChild(title);

    const time = document.createElement('span');
    time.className = 'activity-time';
    time.textContent = formatRelativeTime(Date.parse(application.createdAt));
    top.appendChild(time);

    item.appendChild(top);

    const badges = document.createElement('div');
    badges.className = 'activity-badges';

    const statusBadge = document.createElement('span');
    statusBadge.classList.add('badge', `badge-status-${application.status.toLowerCase()}`);
    statusBadge.textContent = STATUS_LABEL[application.status];
    badges.appendChild(statusBadge);

    if (application.screenshotUrl) {
      const shotBadge = document.createElement('span');
      shotBadge.classList.add('badge', 'badge-screenshot-attached');
      shotBadge.textContent = '📷 Screenshot';
      badges.appendChild(shotBadge);
    }

    item.appendChild(badges);
    activityList.appendChild(item);
  }
}

/** Recent activity always reflects the logged-in account's actual, persisted applications on the
 * server (GET /api/applications, newest first) — never a local, per-browser-install log — so it's
 * identical whether the user opens this panel on this machine, a different one, or after
 * reinstalling the extension entirely, and always matches what they and their manager see on the
 * web dashboard. */
async function loadActivity(): Promise<void> {
  const config = await getConfig();
  if (!config.token) {
    activityList.classList.add('hidden');
    activityEmpty.classList.remove('hidden', 'activity-error');
    activityEmpty.textContent = 'Log in to see your recent activity.';
    return;
  }

  try {
    renderActivity(await fetchRecentApplications());
  } catch (error) {
    activityList.classList.add('hidden');
    activityEmpty.classList.remove('hidden');
    activityEmpty.classList.add('activity-error');
    activityEmpty.textContent =
      error instanceof Error ? error.message : 'Failed to load recent activity.';
  }
}

// background.ts pokes this whenever an auto-tracked submission succeeds — see
// ActivityUpdatedMessage in types/index.ts for why this carries no data of its own.
chrome.runtime.onMessage.addListener((message: ActivityUpdatedMessage) => {
  if (message.type === 'JATS_ACTIVITY_UPDATED') {
    void loadActivity();
  }
});

// background.ts pushes one of these on every stage of an in-flight auto-tracked submission — see
// TrackingStatus in types/index.ts.
chrome.runtime.onMessage.addListener((message: TrackingStatusMessage) => {
  if (message.type === 'JATS_TRACKING_STATUS') {
    renderTrackingStatus(message.status);
  }
});

openOptionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;

  const company = companyInput.value.trim();
  const jobTitle = jobTitleInput.value.trim();
  const jobUrl = jobUrlInput.value.trim();

  try {
    const response: ApplicationEventResponse = await submitApplicationEvent({
      eventType: 'APPLICATION_SUBMITTED',
      company,
      jobTitle,
      jobUrl,
      timestamp: new Date().toISOString(),
    });

    if (response.status === 'SUCCESS') {
      showStatus(response.message, 'success');
      form.reset();
      void loadActivity(); // pull the newly-created record straight from the server
    } else if (response.status === 'DUPLICATE') {
      showStatus(response.message, 'duplicate');
    } else {
      showStatus(response.message, 'error');
    }
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Something went wrong', 'error');
  } finally {
    submitBtn.disabled = false;
    statusMessage.classList.remove('hidden');
  }
});

// The side panel stays open across tab switches within the same window, so re-run init()
// whenever the active tab changes to keep the prefilled job URL and account state current.
chrome.tabs.onActivated.addListener(() => {
  void init();
});

void init();
