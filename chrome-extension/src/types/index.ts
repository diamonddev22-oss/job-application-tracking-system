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
