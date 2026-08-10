import { fetchCurrentUser, getConfig, saveConfig, submitApplicationEvent } from '../api/client';
import { getRecentActivity, onRecentActivityChanged, pushRecentActivity, type RecentActivityEntry } from '../recent-activity';
import type { AccountStatus, ApplicationEventResponse, StoredConfig } from '../types';

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

async function init(): Promise<void> {
  const config = await getConfig();
  applyAccountState(config, config.accountStatus);
  await prefillFromActiveTab();
  await loadActivity();

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

const OUTCOME_LABEL: Record<RecentActivityEntry['outcome'], string> = {
  SUCCESS: 'Tracked',
  DUPLICATE: 'Duplicate',
  ERROR: 'Error',
};

/** Renders the screenshot badge for one activity entry, or null when there's nothing worth
 * showing (e.g. a future caller that never attempts a screenshot at all). Failed/skipped badges
 * carry the reason as a native tooltip so a "why no screenshot?" question is answerable by
 * hovering, without needing the service worker console. */
function screenshotBadge(entry: RecentActivityEntry): HTMLSpanElement | null {
  const badge = document.createElement('span');
  badge.classList.add('badge');

  switch (entry.screenshotStatus) {
    case 'attached':
      badge.classList.add('badge-screenshot-attached');
      badge.textContent = '📷 Screenshot attached';
      return badge;
    case 'skipped':
      badge.classList.add('badge-screenshot-skipped');
      badge.textContent = 'No screenshot';
      badge.title = entry.screenshotDetail ?? 'Screenshot capture was skipped.';
      return badge;
    case 'failed':
      badge.classList.add('badge-screenshot-failed');
      badge.textContent = 'Screenshot failed';
      badge.title = entry.screenshotDetail ?? 'Screenshot upload failed.';
      return badge;
    case 'not_applicable':
      return null;
  }
}

function renderActivity(entries: RecentActivityEntry[]): void {
  activityList.innerHTML = '';

  if (entries.length === 0) {
    activityEmpty.classList.remove('hidden');
    activityList.classList.add('hidden');
    return;
  }

  activityEmpty.classList.add('hidden');
  activityList.classList.remove('hidden');

  for (const entry of entries) {
    const item = document.createElement('li');
    item.className = 'activity-item';

    const top = document.createElement('div');
    top.className = 'activity-item-top';

    const title = document.createElement('a');
    title.className = 'activity-title';
    title.href = entry.jobUrl;
    title.target = '_blank';
    title.rel = 'noreferrer';
    title.textContent = `${entry.jobTitle} · ${entry.company}`;
    title.title = `${entry.jobTitle} at ${entry.company}`;
    top.appendChild(title);

    const time = document.createElement('span');
    time.className = 'activity-time';
    time.textContent = formatRelativeTime(entry.trackedAt);
    top.appendChild(time);

    item.appendChild(top);

    const badges = document.createElement('div');
    badges.className = 'activity-badges';

    const outcomeBadge = document.createElement('span');
    outcomeBadge.classList.add('badge', `badge-outcome-${entry.outcome.toLowerCase()}`);
    outcomeBadge.textContent = OUTCOME_LABEL[entry.outcome];
    badges.appendChild(outcomeBadge);

    const shotBadge = screenshotBadge(entry);
    if (shotBadge) badges.appendChild(shotBadge);

    item.appendChild(badges);
    activityList.appendChild(item);
  }
}

async function loadActivity(): Promise<void> {
  renderActivity(await getRecentActivity());
}

onRecentActivityChanged(renderActivity);

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

    // No screenshot for manual entries - there's no "moment of submission" to capture a page for,
    // since the user is just filling in this form well after the fact.
    await pushRecentActivity({
      company,
      jobTitle,
      jobUrl,
      trackedAt: Date.now(),
      outcome: response.status,
      screenshotStatus: 'not_applicable',
    });

    if (response.status === 'SUCCESS') {
      showStatus(response.message, 'success');
      form.reset();
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
