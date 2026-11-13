import { describe, expect, it } from "vitest";
import { type MessagePublic, type ModelPublic } from "@/api/types";
import { chatToMarkdown, markdownFileName } from "./export-chat";

const models: ModelPublic[] = [
  { id: "anthropic:claude-sonnet-5", provider: "anthropic", display_name: "Claude Sonnet 5", supports_files: true },
];

const message = (overrides: Partial<MessagePublic>): MessagePublic => ({
  id: 1,
  kind: "request",
  content: "",
  model_id: null,
  created_at: "2026-11-13T10:00:00Z",
  ...overrides,
});

describe("chatToMarkdown", () => {
  it("labels each message with its author and separates them", () => {
    const markdown = chatToMarkdown(
      "Trip plan",
      [
        message({ content: "Plan a trip\n" }),
        message({ id: 2, kind: "response", content: "Sure.", model_id: "anthropic:claude-sonnet-5" }),
      ],
      models
    );
    expect(markdown).toBe(
      "# Trip plan\n\n## You\n\nPlan a trip\n\n---\n\n## Claude Sonnet 5\n\nSure.\n"
    );
  });

  it("falls back to the model id, then to Assistant, for unknown models", () => {
    const unknown = chatToMarkdown("t", [message({ kind: "response", model_id: "x:gone" })], models);
    expect(unknown).toContain("## x:gone");
    const none = chatToMarkdown("t", [message({ kind: "response" })], models);
    expect(none).toContain("## Assistant");
  });

  it("lists attachment names", () => {
    const markdown = chatToMarkdown(
      "t",
      [
        message({
          content: "See files",
          attachments: [
            { id: 1, filename: "a.pdf", media_type: "application/pdf", url: "/a" },
            { id: 2, filename: "b.png", media_type: "image/png", url: "/b" },
          ],
        }),
      ],
      models
    );
    expect(markdown).toContain("See files\n\n_Attachments: a.pdf, b.png_");
  });
});

describe("markdownFileName", () => {
  it("replaces characters that file systems reject", () => {
    expect(markdownFileName('What is 1/2: "half"?')).toBe("What is 1-2- -half-.md");
  });

  it("falls back when nothing is left", () => {
    expect(markdownFileName("  ")).toBe("chat.md");
  });
});
