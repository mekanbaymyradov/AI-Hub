import axios from "axios";
import { type ErrorResponse } from "./types";

/** Return the API's message for a failed request, or `fallback` when it sent none. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ErrorResponse>(error)) {
    return error.response?.data?.detail?.[0]?.msg ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
