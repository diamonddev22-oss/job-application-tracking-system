import { fetchCurrentUser, fetchRecentApplications, getConfig, saveConfig, submitApplicationEvent } from '../api/client';
import type { AccountStatus, ActivityUpdatedMessage, ApplicationEventResponse, JobApplication, StoredConfig } from '../types';

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
