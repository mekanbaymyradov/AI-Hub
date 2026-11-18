// Unsent composer text, saved per user and chat so a reload or a switch to
// another chat doesn't lose it. Storage that throws leaves drafts unsaved.

const PREFIX = "ai_hub_draft:";

/** Return the storage key for a user's draft in a chat; a null chat is a new one. */
export function draftKey(userId: number | undefined, chatId: number | null): string {
  return `${PREFIX}${userId ?? "anonymous"}:${chatId ?? "new"}`;
}

export function readDraft(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/** Save the draft, or remove it once it's empty. */
export function saveDraft(key: string, text: string): void {
  try {
    if (text.trim()) localStorage.setItem(key, text);
    else localStorage.removeItem(key);
  } catch {
    // Unsaved: it stays in the composer for this visit.
  }
}

/** Remove every draft, so the next person on this browser doesn't see them. */
export function clearDrafts(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Nothing was saved, then.
  }
}
