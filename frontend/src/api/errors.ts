import axios from "axios";
import { type ErrorDetail, type ErrorResponse } from "./types";

function parseErrorDetail(raw: string): ErrorDetail | undefined {
  try {
    const parsed = JSON.parse(raw) as { detail?: ErrorDetail[] | string } | null;
    if (parsed && Array.isArray(parsed.detail) && parsed.detail.length > 0) {
      return parsed.detail[0];
    }
    if (parsed && typeof parsed.detail === "string" && parsed.detail) {
      return { msg: parsed.detail, type: "http_error" };
    }
  } catch {
    // Plain error message, not a JSON ErrorResponse body.
  }
  return undefined;
}

/** Return the API's error type code (e.g. `llm.model_error`) if present. */
export function getErrorType(error: unknown): string | undefined {
  if (axios.isAxiosError<ErrorResponse>(error)) {
    const detail = error.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail[0]?.type;
    }
    return undefined;
  }
  if (error instanceof Error) {
    return parseErrorDetail(error.message)?.type;
  }
  return undefined;
}

/** Return the API's message for a failed request, or `fallback` when it sent none. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ErrorResponse | { detail?: string }>(error)) {
    const detail = error.response?.data?.detail;
    if (Array.isArray(detail) && detail[0]?.msg) {
      return detail[0].msg;
    }
    if (typeof detail === "string" && detail) {
      return detail;
    }
    return fallback;
  }
  if (error instanceof Error) {
    const detail = parseErrorDetail(error.message);
    if (detail?.msg) return detail.msg;
    return error.message || fallback;
  }
  return fallback;
}
