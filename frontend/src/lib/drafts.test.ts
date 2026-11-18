import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDrafts, draftKey, readDraft, saveDraft } from "./drafts";

// Keeps items as own properties, as the browser's does, so Object.keys lists them.
function fakeStorage(): Storage {
  const storage = {} as Record<string, string>;
  Object.defineProperties(storage, {
    getItem: { value: (key: string) => (key in storage ? storage[key] : null) },
    setItem: { value: (key: string, value: string) => void (storage[key] = String(value)) },
    removeItem: { value: (key: string) => void delete storage[key] },
  });
  return storage as unknown as Storage;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("drafts", () => {
  it("keeps a draft per user and chat", () => {
    saveDraft(draftKey(1, 7), "for chat 7");
    saveDraft(draftKey(1, null), "for a new chat");
    expect(readDraft(draftKey(1, 7))).toBe("for chat 7");
    expect(readDraft(draftKey(1, null))).toBe("for a new chat");
    expect(readDraft(draftKey(2, 7))).toBe("");
  });

  it("removes a draft once it's empty", () => {
    saveDraft(draftKey(1, 7), "text");
    saveDraft(draftKey(1, 7), "   ");
    expect(localStorage.getItem(draftKey(1, 7))).toBeNull();
  });

  it("clears every draft and nothing else", () => {
    localStorage.setItem("ai_hub_theme", "dark");
    saveDraft(draftKey(1, 7), "one");
    saveDraft(draftKey(2, null), "two");
    clearDrafts();
    expect(readDraft(draftKey(1, 7))).toBe("");
    expect(readDraft(draftKey(2, null))).toBe("");
    expect(localStorage.getItem("ai_hub_theme")).toBe("dark");
  });

  it("works without storage, as in some private windows", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    });
    expect(() => saveDraft(draftKey(1, 7), "text")).not.toThrow();
    expect(readDraft(draftKey(1, 7))).toBe("");
    expect(() => clearDrafts()).not.toThrow();
  });
});
