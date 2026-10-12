// Shared by the chat page's dropdown menus, so they all look the same.

export const MENU_CONTENT =
  "z-50 rounded-xl border border-zinc-200 bg-white p-1 text-zinc-900 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-[#1c1c1f] dark:text-foreground";

const MENU_ITEM_BASE = "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors";

export const MENU_ITEM = `${MENU_ITEM_BASE} text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 focus:bg-zinc-100 focus:text-zinc-900 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white dark:focus:bg-white/10 dark:focus:text-white`;

export const MENU_ITEM_SELECTED = `${MENU_ITEM_BASE} bg-blue-50 font-medium text-blue-600 dark:bg-white/10 dark:text-white`;

export const MENU_ITEM_DANGER = `${MENU_ITEM_BASE} text-red-500 hover:bg-red-50 hover:text-red-600 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300 dark:focus:bg-red-500/10`;
