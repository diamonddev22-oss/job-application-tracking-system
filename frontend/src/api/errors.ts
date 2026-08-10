import axios from 'axios';
import type { ApiErrorResponse } from '../types';

const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';

/** Pulls the human-readable message out of the backend's ErrorResponse envelope, if present. */
export function getErrorMessage(error: unknown, fallback: string = DEFAULT_MESSAGE): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message ?? fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

/** Field-level validation errors from @Valid request bodies, keyed by field name. */
export function getFieldErrors(error: unknown): Record<string, string> | null {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.fieldErrors ?? null;
  }
  return null;
}
