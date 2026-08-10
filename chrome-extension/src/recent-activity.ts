// Shared between background.ts (writer, after every auto-tracked submission) and sidepanel.ts
// (reader/renderer). Both are loaded as ES modules (manifest's `background.type: "module"` and the
// side panel's `<script type="module">`), unlike content.ts, so this can be a normal import on both
// sides — see detection-patterns.ts's header comment for why content.ts can't do the same.
//
// Exists so the user has some visible confirmation that auto-detection (and specifically, the
// screenshot capture/upload it attempts) actually did something, beyond the one-shot desktop
// notification that's easy to miss or dismiss without reading closely.

export type ScreenshotStatus = 'attached' | 'skipped' | 'failed' | 'not_applicable';

export interface RecentActivityEntry {
  company: string;
  jobTitle: string;
  jobUrl: string;
  trackedAt: number;
  outcome: 'SUCCESS' | 'DUPLICATE' | 'ERROR';
  screenshotStatus: ScreenshotStatus;
  /** Human-readable reason, only set for 'skipped'/'failed' — shown as a tooltip in the side panel
   * so a user (or whoever's debugging with them) doesn't have to open the service worker console. */
  screenshotDetail?: string;
}

const RECENT_ACTIVITY_KEY = 'jats.recentActivity';
const RECENT_ACTIVITY_LIMIT = 8;

export async function pushRecentActivity(entry: RecentActivityEntry): Promise<void> {
  const existing = await getRecentActivity();
  const updated = [entry, ...existing].slice(0, RECENT_ACTIVITY_LIMIT);
  await chrome.storage.local.set({ [RECENT_ACTIVITY_KEY]: updated });
}

export async function getRecentActivity(): Promise<RecentActivityEntry[]> {
  const result = await chrome.storage.local.get(RECENT_ACTIVITY_KEY);
  return (result[RECENT_ACTIVITY_KEY] as RecentActivityEntry[] | undefined) ?? [];
}

/** Fires whenever pushRecentActivity() (in the background worker) updates the list — lets the side
 * panel repaint live if it happens to already be open when a submission is detected, without
 * polling. */
export function onRecentActivityChanged(callback: (entries: RecentActivityEntry[]) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !(RECENT_ACTIVITY_KEY in changes)) return;
    callback((changes[RECENT_ACTIVITY_KEY].newValue as RecentActivityEntry[] | undefined) ?? []);
  });
}
