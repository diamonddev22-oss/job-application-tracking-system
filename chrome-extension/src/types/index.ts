export type AccountStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED';

export interface StoredConfig {
  token: string | null;
  userEmail: string | null;
  accountStatus: AccountStatus | null;
}

export type EventType = 'APPLICATION_SUBMITTED';

export interface ApplicationEventRequest {
  eventType: EventType;
  company: string;
  jobTitle: string;
  jobUrl: string;
  timestamp: string;
  /** The `key` from ScreenshotUploadUrlResponse, once the screenshot bytes have already been PUT
   * there — see background.ts's captureAndUploadScreenshot. Omitted whenever capture/upload
   * failed or was skipped; it's a best-effort bonus, never a reason to withhold the report itself. */
  screenshotKey?: string;
}

/** Returned by POST /application-events/screenshot-upload-url. Wrapped in ApiEnvelope, unlike
 * ApplicationEventResponse above. */
export interface ScreenshotUploadUrlResponse {
  uploadUrl: string;
  key: string;
  expiresAt: string;
}

export type ApplicationEventStatus = 'SUCCESS' | 'DUPLICATE' | 'ERROR';

export interface ApplicationEventResponse {
  status: ApplicationEventStatus;
  message: string;
}

export interface LoginResponse {
  token: string;
  email: string;
  status: AccountStatus;
}

/** Every backend endpoint except POST /application-events wraps its payload in this envelope. */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string | null;
  data: T;
}

export interface AuthResponseData {
  token: string;
  id: string;
  email: string;
  role: 'USER' | 'MANAGER';
  status: AccountStatus;
}

export interface UserSummaryData {
  id: string;
  email: string;
  role: 'USER' | 'MANAGER';
  status: AccountStatus;
  createdAt: string;
}

export type ApplicationStatus =
  | 'APPLIED'
  | 'SCREENING'
  | 'INTERVIEW'
  | 'OFFER'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN';

/** Matches backend/app/tracking/schemas.py's JobApplicationResponse — this is the account's actual,
 * persisted application record (not a client-side log of tracking *attempts*), which is exactly why
 * it's the source of truth for the side panel's "recent activity" list — see sidepanel.ts. */
export interface JobApplication {
  id: string;
  company: string;
  jobTitle: string;
  jobUrl: string;
  status: ApplicationStatus;
  appliedDate: string;
  screenshotUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Matches backend/app/resumes/schemas.py's ResumeResponse — a manager-uploaded resume the
 * applicant needs for job applications. Resumes are append-only/versioned server-side; the side
 * panel only ever shows the newest one (see sidepanel.ts's loadResume). */
export interface ManagedResume {
  id: string;
  fileUrl: string;
  version: number;
  createdAt: string;
}

/** Matches backend/app/common/schemas.py's PageResponse envelope. */
export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

/** Job details captured (e.g. from schema.org JobPosting markup) while browsing a job listing,
 * kept per-tab so it's still available later when the user reaches an application confirmation
 * page/state that no longer has that structured data. */
export interface StoredJobContext {
  company: string;
  jobTitle: string;
  jobUrl: string;
  capturedAt: number;
}

/** Sent by the content script whenever it finds job posting details on the current page. */
export interface JobContextDetectedMessage {
  type: 'JATS_JOB_CONTEXT_DETECTED';
  company: string;
  jobTitle: string;
  jobUrl: string;
}

/** Sent by the content script when the current page looks like a successful application
 * confirmation (URL or on-page text heuristic) — see content.ts for the detection logic. */
export interface ApplicationSubmitDetectedMessage {
  type: 'JATS_APPLICATION_SUBMIT_DETECTED';
  jobUrl: string;
  pageTitle: string;
}

/** Sent by the content script when the user clicks something that looks like a final "submit the
 * application" control (as opposed to the initial "Apply"/"Apply Now" call-to-action, which must
 * never by itself be treated as a submission). Arms a short-lived per-tab flag in the background
 * worker — see background.ts — that on-page-text and network-based detection require before
 * reporting, so an application form's own instructional copy ("Complete your application below")
 * appearing right after opening it can't be mistaken for a real confirmation. */
export interface SubmitIntentDetectedMessage {
  type: 'JATS_SUBMIT_INTENT_DETECTED';
}

/** Sent by the content script to ask whether a submit-like click was recently observed in this
 * tab; answered synchronously (as message-passing goes) by the background worker via its
 * Promise-returning onMessage listener. */
export interface CheckSubmitArmedMessage {
  type: 'JATS_CHECK_SUBMIT_ARMED';
}

export interface SubmitArmedResponse {
  armed: boolean;
}

export type ContentScriptMessage =
  | JobContextDetectedMessage
  | ApplicationSubmitDetectedMessage
  | SubmitIntentDetectedMessage
  | CheckSubmitArmedMessage;

/** Broadcast by background.ts after every tracking attempt (success or not) so any currently-open
 * side panel knows to re-fetch "recent activity" from the server — see sidepanel.ts. The panel is
 * the source of truth's *reader*, not a cache of its own: this message carries no data, it's just a
 * "something changed, go re-fetch" poke, since the actual record already lives on the backend by
 * the time this fires. */
export interface ActivityUpdatedMessage {
  type: 'JATS_ACTIVITY_UPDATED';
}

/** A single auto-tracked submission's lifecycle, from the moment a submission is detected through
 * to its outcome. Surfaced as a blocking dialog in two places at once (see setTrackingStatus in
 * background.ts): directly on the job application page itself, via content.ts — the primary UX,
 * since that's where the user actually is when they submit — and, as a bonus if it happens to be
 * open already, inside the side panel (see sidepanel.ts). Either way the point is the same: the
 * user can't interact with the page/panel again (e.g. accidentally re-submitting the manual form,
 * or navigating away mid-upload) until the sequence resolves. */
export type TrackingStatus =
  | { phase: 'active'; message: string; step: number; totalSteps: number }
  | { phase: 'done'; outcome: 'success' | 'duplicate' | 'error'; message: string };

/** Broadcast by background.ts on every stage change (see setTrackingStatus) via
 * chrome.runtime.sendMessage, for the side panel (sidepanel.ts). Best-effort — silently dropped if
 * no side panel is open, which is fine because a freshly-opened one also reads the persisted copy
 * directly (see TRACKING_STATUS_STORAGE_KEY) instead of relying solely on having caught a live
 * message.
 *
 * Deliberately a *different* message type from TrackingStatusPageMessage below rather than one
 * shared type distinguished some other way: chrome.runtime.sendMessage broadcasts reach every
 * listening context with no target restriction, including every content script in every open tab
 * (content.ts *does* register a chrome.runtime.onMessage listener, for the page-targeted message
 * below) — so if both used the same message type, every tab would render the on-page dialog for
 * every other tab's submission. Keeping them distinct means content.ts's listener simply never
 * matches this one, no matter how it's delivered under the hood. */
export interface TrackingStatusMessage {
  type: 'JATS_TRACKING_STATUS';
  status: TrackingStatus;
}

/** Sent by background.ts on every stage change (see setTrackingStatus), targeted at only the
 * top-level frame (frameId: 0) of the specific tab the submission is happening in via
 * chrome.tabs.sendMessage — this is what content.ts listens for to render the blocking dialog
 * directly on the job application page itself. See TrackingStatusMessage above for why this isn't
 * just reused for the side panel's broadcast too. */
export interface TrackingStatusPageMessage {
  type: 'JATS_TRACKING_STATUS_PAGE';
  status: TrackingStatus;
}

/** chrome.storage.session key background.ts persists the current TrackingStatus under, so a side
 * panel opened mid-submission (or reopened just after one finishes) can immediately show the
 * blocking dialog in the right state instead of only reacting to a live message it may have missed
 * while closed. Cleared a few seconds after a submission finishes — see background.ts. */
export const TRACKING_STATUS_STORAGE_KEY = 'jats.trackingStatus';
