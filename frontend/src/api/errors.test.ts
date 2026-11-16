import { AxiosError, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { getErrorMessage, getErrorType } from "./errors";

function apiError(data: unknown, status = 422) {
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    data,
    status,
  } as AxiosResponse);
}

describe("getErrorMessage", () => {
  it("reads the first detail of an API error", () => {
    const error = apiError({ detail: [{ msg: "Name is too long", type: "value_error" }] });
    expect(getErrorMessage(error, "fallback")).toBe("Name is too long");
  });

  it("reads a string detail", () => {
    expect(getErrorMessage(apiError({ detail: "Not found" }, 404), "fallback")).toBe("Not found");
  });

  it("falls back when the API sent no detail", () => {
    expect(getErrorMessage(apiError(undefined, 500), "fallback")).toBe("fallback");
  });

  // The chat stream reports a failed reply as an Error holding the API's JSON body.
  it("reads an API body inside an Error message", () => {
    const error = new Error(JSON.stringify({ detail: [{ msg: "Model failed", type: "llm.model_error" }] }));
    expect(getErrorMessage(error, "fallback")).toBe("Model failed");
  });

  it("uses a plain Error's message", () => {
    expect(getErrorMessage(new Error("Network down"), "fallback")).toBe("Network down");
  });

  it("falls back for an empty Error or a non-Error", () => {
    expect(getErrorMessage(new Error(""), "fallback")).toBe("fallback");
    expect(getErrorMessage("boom", "fallback")).toBe("fallback");
  });
});

describe("getErrorType", () => {
  it("reads the type of an API error", () => {
    const error = apiError({ detail: [{ msg: "Model failed", type: "llm.model_error" }] });
    expect(getErrorType(error)).toBe("llm.model_error");
  });

  it("reads the type from an API body inside an Error message", () => {
    const error = new Error(JSON.stringify({ detail: [{ msg: "Model failed", type: "llm.model_error" }] }));
    expect(getErrorType(error)).toBe("llm.model_error");
  });

  it("is undefined when there is no type", () => {
    expect(getErrorType(apiError({ detail: "Not found" }, 404))).toBeUndefined();
    expect(getErrorType(new Error("Network down"))).toBeUndefined();
  });
});
