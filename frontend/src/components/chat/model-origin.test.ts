import { describe, expect, it } from "vitest";
import { type ModelPublic, type Provider } from "@/api/types";
import { modelOrigin } from "./model-origin";

const model = (provider: Provider, name: string): ModelPublic => ({
  id: `${provider}:${name}`,
  provider,
  display_name: name,
  supports_files: true,
});

describe("modelOrigin", () => {
  it("takes the maker from the provider when it serves its own model", () => {
    expect(modelOrigin(model("anthropic", "claude-sonnet-5"))).toEqual({
      maker: "anthropic",
      makerName: "Anthropic",
      host: undefined,
    });
    expect(modelOrigin(model("google", "gemini-3.7-flash")).makerName).toBe("Google");
  });

  it("reads the maker from a Groq model's name and keeps Groq as the host", () => {
    expect(modelOrigin(model("groq", "openai/gpt-oss-20b"))).toEqual({
      maker: "openai",
      makerName: "OpenAI",
      host: "Groq",
    });
    expect(modelOrigin(model("groq", "qwen/qwen3.8-27b"))).toEqual({
      maker: "qwen",
      makerName: "Alibaba",
      host: "Groq",
    });
  });

  it("falls back to the provider for a maker it doesn't know", () => {
    expect(modelOrigin(model("groq", "meta-llama/llama-5"))).toEqual({
      makerName: "Groq",
      host: undefined,
    });
  });
});
