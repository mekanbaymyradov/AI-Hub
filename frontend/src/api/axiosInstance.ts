import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "@/config";
import { type Token } from "./types";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  paramsSerializer: {
    indexes: null,
  },
});

let currentAccessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  currentAccessToken = token;
};

export const getAccessToken = () => currentAccessToken;

let onSessionExpired = () => {};

/** Set what runs when the API rejects the refresh token, so the app can sign the user out. */
export const setSessionExpiredHandler = (handler: () => void) => {
  onSessionExpired = handler;
};

// The API revokes the whole session when a refresh token is used twice, so
// requests that fail together must share one refresh instead of each sending
// their own with the same cookie.
let pendingRefresh: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  pendingRefresh ??= axios
    // Not apiClient, so a failed refresh can't trigger another refresh.
    .post<Token>("/auth/token/refresh", {}, { baseURL: API_BASE_URL, withCredentials: true })
    .then(({ data }) => {
      setAccessToken(data.access_token);
      return data.access_token;
    })
    .catch((error: unknown) => {
      setAccessToken(null);
      // Only a 401 means the session is gone; a network error may pass, so it keeps the user signed in.
      if (axios.isAxiosError(error) && error.response?.status === 401) onSessionExpired();
      throw error;
    })
    .finally(() => {
      pendingRefresh = null;
    });
  return pendingRefresh;
}

apiClient.interceptors.request.use((config) => {
  if (currentAccessToken) {
    config.headers.Authorization = `Bearer ${currentAccessToken}`;
  }
  return config;
});

type RetriableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RetriableRequest | undefined;
    // A 401 from sign-in means a wrong code, not an expired access token, so there is nothing to refresh.
    const isSignIn = request?.url?.startsWith("/auth/otp/");
    if (error.response?.status !== 401 || !request || request._retry || isSignIn) {
      throw error;
    }

    request._retry = true;
    const token = await refreshAccessToken();
    request.headers.Authorization = `Bearer ${token}`;
    return apiClient(request);
  },
);
