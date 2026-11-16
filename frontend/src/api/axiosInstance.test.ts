import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiClient,
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
  setSessionExpiredHandler,
} from "./axiosInstance";

const tokenResponse = (token: string) =>
  ({ data: { access_token: token, expires_in: 900 } }) as AxiosResponse;

// No status means no response, as with a network error.
const failure = (status?: number) =>
  new AxiosError(
    "Request failed",
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    status === undefined ? undefined : ({ status, data: {} } as AxiosResponse)
  );

afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
  setSessionExpiredHandler(() => {});
});

describe("refreshAccessToken", () => {
  it("shares one request between callers that fail together", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue(tokenResponse("new"));
    const tokens = await Promise.all([refreshAccessToken(), refreshAccessToken()]);
    expect(post).toHaveBeenCalledOnce();
    expect(tokens).toEqual(["new", "new"]);
    expect(getAccessToken()).toBe("new");
  });

  it("sends a new request once the last one has settled", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue(tokenResponse("new"));
    await refreshAccessToken();
    await refreshAccessToken();
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("signs the user out when the API rejects the refresh token", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(failure(401));
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    setAccessToken("old");
    await expect(refreshAccessToken()).rejects.toThrow();
    expect(expired).toHaveBeenCalledOnce();
    expect(getAccessToken()).toBeNull();
  });

  it("keeps the user signed in after a network error", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(failure());
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    await expect(refreshAccessToken()).rejects.toThrow();
    expect(expired).not.toHaveBeenCalled();
  });
});

describe("apiClient", () => {
  it("refreshes once for requests that get a 401 together, then retries each", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue(tokenResponse("new"));
    // Answers 401 until a request carries the refreshed token.
    const adapter: AxiosAdapter = async (config) => {
      if (config.headers.Authorization === "Bearer new") {
        return { data: config.url, status: 200, statusText: "OK", headers: {}, config };
      }
      throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, {
        data: {},
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config,
      });
    };
    setAccessToken("expired");

    const [a, b] = await Promise.all([apiClient.get("/a", { adapter }), apiClient.get("/b", { adapter })]);

    expect([a.data, b.data]).toEqual(["/a", "/b"]);
    expect(post).toHaveBeenCalledOnce();
  });
});
