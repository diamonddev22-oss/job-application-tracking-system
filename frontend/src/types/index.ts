export type Role = 'USER' | 'MANAGER';

/** Target application count used to visualize progress on dashboards — a simple, fixed job-search
 * goal rather than something configurable per user (keeps the "goal" charts meaningful without
 * needing a settings page or backend field for it). */
export const APPLICATION_GOAL = 100;

export type AccountStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED';

export const ACCOUNT_STATUSES: AccountStatus[] = ['PENDING_APPROVAL', 'ACTIVE', 'REJECTED'];

export type ApplicationStatus =
  | 'APPLIED'
  | 'SCREENING'
  | 'INTERVIEW'
  | 'OFFER'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN';

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'APPLIED',
  'SCREENING',
  'INTERVIEW',
  'OFFER',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
];

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
}

/** Response from POST /auth/login and POST /auth/register. */
export interface AuthResponse {
  token: string;
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
}

/** Response from GET /users/me. */
export interface UserSummary {
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
  createdAt: string;
}

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

export interface ApplicationHistoryEntry {
  id: string;
  oldStatus: ApplicationStatus | null;
  newStatus: ApplicationStatus;
  changedAt: string;
}

/** Standard success envelope every backend endpoint wraps its payload in. */
export interface OverviewStats {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  rejectedUsers: number;
  totalApplications: number;
}

export interface DailyApplicationCount {
  date: string;
  count: number;
}

export type ApplicationStatusBreakdown = Partial<Record<ApplicationStatus, number>>;

export interface ApplicationStats {
  statusBreakdown: ApplicationStatusBreakdown;
  dailyTrend: DailyApplicationCount[];
}

/** A single uploaded resume version — see backend/app/resumes/schemas.py's ResumeResponse. */
export interface ManagedResume {
  id: string;
  fileUrl: string;
  version: number;
  createdAt: string;
}

export interface ManagerUser {
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
  createdAt: string;
  applicationCount: number;
  /** The most recently uploaded resume for this applicant, or null if the manager hasn't
   * uploaded one yet. An applicant can't be approved without one — see ManagerUserRow. */
  latestResume: ManagedResume | null;
}

export interface ManagerApplication {
  id: string;
  userId: string;
  userEmail: string;
  company: string;
  jobTitle: string;
  jobUrl: string;
  status: ApplicationStatus;
  appliedDate: string;
  screenshotUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string | null;
  data: T;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface ApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  fieldErrors?: Record<string, string> | null;
}
