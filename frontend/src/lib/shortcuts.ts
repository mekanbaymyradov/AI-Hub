export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);

// The new-chat shortcut as each platform writes it; the handler is in the chat page.
// Unspaced, so the hint fits beside "New thread" in the sidebar.
export const NEW_CHAT_KEYS = IS_MAC ? "⌘⇧O" : "Ctrl+Shift+O";

// The chat search shortcut; the handler is in the sidebar.
export const SEARCH_KEYS = IS_MAC ? "⌘K" : "Ctrl+K";
