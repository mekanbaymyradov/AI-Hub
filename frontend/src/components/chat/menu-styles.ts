// Shared by the chat page's dropdown menus, so they all look the same.

export const MENU_CONTENT =
  "z-50 rounded-xl border border-line-1 bg-overlay p-1 text-zinc-900 shadow-2xl backdrop-blur-md dark:text-foreground";

const MENU_ITEM_BASE = "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors";

export const MENU_ITEM = `${MENU_ITEM_BASE} text-zinc-700 hover:bg-fill-1 hover:text-fg-1 focus:bg-fill-1 focus:text-fg-1 dark:text-zinc-200`;

export const MENU_ITEM_SELECTED = `${MENU_ITEM_BASE} bg-blue-50 font-medium text-blue-600 dark:bg-white/10 dark:text-white`;

export const MENU_ITEM_DANGER = `${MENU_ITEM_BASE} text-red-500 hover:bg-red-50 hover:text-red-600 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300 dark:focus:bg-red-500/10`;
