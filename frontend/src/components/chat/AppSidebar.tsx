import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CheckSquare,
  ListChecks,
  LogOut,
  MessageSquare,
  Moon,
  MoreVertical,
  PanelLeft,
  PanelLeftClose,
  Pencil,
  Search,
  SquarePen,
  Sun,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

import { getErrorMessage } from "@/api/errors";
import { useChats, useDeleteChat, useDeleteChats, useRenameChat } from "@/api/queries";
import { type ChatPublic } from "@/api/types";
import { useAuth } from "@/context/auth";
import { useTheme } from "@/context/theme";
import { useDialog } from "@/hooks/use-dialog";
import { useLoadMore } from "@/hooks/use-load-more";
import { displayName } from "@/lib/user";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IS_MAC, NEW_CHAT_KEYS, SEARCH_KEYS } from "@/lib/shortcuts";
import { ConfirmModal } from "./ConfirmModal";
import { MENU_CONTENT, MENU_ITEM, MENU_ITEM_DANGER, MENU_ITEM_SELECTED } from "./menu-styles";
import { ProfileSettingsModal } from "./ProfileSettingsModal";
import { RenameChatModal } from "./RenameChatModal";



interface AppSidebarProps {
  activeChatId: number | null;
  onSelectChat: (id: number) => void;
  onNewThread: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Return the translation key of the sidebar heading for a chat last active at `iso`, counted in local calendar days. */
function dateGroup(iso: string, now: Date) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysAgo = Math.ceil((startOfToday - new Date(iso).getTime()) / DAY_MS);
  if (daysAgo <= 0) return "sidebar.groups.today";
  if (daysAgo === 1) return "sidebar.groups.yesterday";
  if (daysAgo <= 7) return "sidebar.groups.previous7";
  if (daysAgo <= 30) return "sidebar.groups.previous30";
  return "sidebar.groups.older";
}

export function AppSidebar({ activeChatId, onSelectChat, onNewThread }: AppSidebarProps) {
  const { toggleSidebar, setOpen, isMobile, setOpenMobile } = useSidebar();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleSelectChat = (id: number) => {
    if (isMobile) setOpenMobile(false);
    onSelectChat(id);
  };

  const handleNewThread = () => {
    if (isMobile) setOpenMobile(false);
    if (isSelectionMode) handleCancelSelection();
    onNewThread();
  };

  const chatsQuery = useChats();
  const loadMoreChatsRef = useLoadMore(chatsQuery);
  const chats = useMemo(
    () => chatsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [chatsQuery.data]
  );
  const isNewChat = activeChatId === null;

  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const search = query.trim().toLowerCase();
  // Only loaded chats are searched; while a search shows few rows, the list's
  // sentinel stays on screen and older pages keep loading into it.
  const visibleChats = useMemo(
    () => (search ? chats.filter((chat) => chat.name.toLowerCase().includes(search)) : chats),
    [chats, search]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // The physical key, so it works in any layout: in Russian, Ctrl+K types "л".
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.code === "KeyK") {
        e.preventDefault();
        if (isMobile) setOpenMobile(true);
        else setOpen(true);
        // At once when the sidebar is open, so no keystroke is lost; again
        // after a collapsed one opens, when the input exists.
        searchRef.current?.select();
        requestAnimationFrame(() => searchRef.current?.select());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile, setOpen, setOpenMobile]);

  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const renameDialog = useDialog<ChatPublic>();
  const deleteDialog = useDialog<ChatPublic>();
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  // Multi-select state for deleting multiple chats
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<number>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  const renameChat = useRenameChat();
  const deleteChat = useDeleteChat();
  const deleteChats = useDeleteChats();
  const logOut = useMutation({
    mutationFn: async () => {
      // Leave the chat first, so signing out lands on the home page rather than the login page.
      navigate("/", { replace: true });
      await logout();
    },
  });

  // Fixed for the render, so every row is bucketed against the same moment.
  const now = new Date();

  const handleStartSelect = (chatId?: number) => {
    setOpen(true);
    setIsSelectionMode(true);
    setSelectedChatIds(chatId ? new Set([chatId]) : new Set());
  };

  const handleToggleChat = (chatId: number) => {
    setSelectedChatIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) {
        next.delete(chatId);
      } else {
        next.add(chatId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedChatIds.size === visibleChats.length) {
      setSelectedChatIds(new Set());
    } else {
      setSelectedChatIds(new Set(visibleChats.map((c) => c.id)));
    }
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedChatIds(new Set());
  };

  // The dialog stays open until the API answers, so a failure shows in it.
  const handleConfirmBulkDelete = () => {
    const ids = Array.from(selectedChatIds);
    if (ids.length === 0) return;
    deleteChats.mutate(ids, {
      onSuccess: () => {
        setIsBulkDeleteOpen(false);
        if (activeChatId !== null && ids.includes(activeChatId)) {
          handleNewThread();
        } else {
          handleCancelSelection();
        }
      },
    });
  };

  // Pressing Escape exits selection mode
  useEffect(() => {
    if (!isSelectionMode || isBulkDeleteOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancelSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSelectionMode, isBulkDeleteOpen]);

  const openRename = (chat: ChatPublic) => {
    renameChat.reset();
    renameDialog.show(chat);
  };

  const openDelete = (chat: ChatPublic) => {
    deleteChat.reset();
    deleteDialog.show(chat);
  };

  const handleRename = (name: string) => {
    if (!renameDialog.item) return;
    renameChat.mutate({ id: renameDialog.item.id, name }, { onSuccess: renameDialog.close });
  };

  const handleDelete = () => {
    const chat = deleteDialog.item;
    if (!chat) return;
    deleteChat.mutate(chat.id, {
      onSuccess: () => {
        deleteDialog.close();
        if (chat.id === activeChatId) onNewThread();
      },
    });
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-line-1 bg-panel text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
        <SidebarHeader className="group-data-[state=expanded]:p-3 group-data-[state=expanded]:pb-2 group-data-[state=expanded]:pt-3.5 group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:py-3 flex flex-row items-center justify-between group-data-[state=collapsed]:justify-center">
          <Logo className="pl-0.5 text-sm font-semibold group-data-[state=collapsed]:hidden" />
          <Tooltip>
            <TooltipTrigger render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("sidebar.toggle")}
                className="group/logo-btn group-data-[state=expanded]:h-9 group-data-[state=expanded]:w-9 group-data-[state=collapsed]:h-8 group-data-[state=collapsed]:w-8 text-zinc-500 hover:text-fg-1 dark:text-muted-foreground rounded-lg p-0 cursor-pointer"
                onClick={toggleSidebar}
              >
                {/* Collapsed, the logo stands in for the button until hovered. */}
                <div className="group-data-[state=expanded]:hidden flex items-center justify-center size-full">
                  <img
                    src="/favicon.svg"
                    alt=""
                    className="h-5 w-5 object-contain shrink-0 group-hover/logo-btn:hidden"
                  />
                  <PanelLeft className="h-4 w-4 text-fg-5 group-hover/logo-btn:text-fg-1 hidden group-hover/logo-btn:block" />
                </div>
                <PanelLeftClose className="h-4 w-4 group-data-[state=collapsed]:hidden" />
              </Button>
            } />
            <TooltipContent side="right" align="center">
              <span>{t("sidebar.toggle")}</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-fill-1 text-fg-4 border border-line-1 shadow-xs">
                {IS_MAC ? "⌘ B" : "Ctrl + B"}
              </kbd>
            </TooltipContent>
          </Tooltip>
        </SidebarHeader>

        <SidebarContent className="group-data-[state=expanded]:px-3 group-data-[state=expanded]:py-2 group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:items-center group-data-[state=collapsed]:mt-3 flex flex-col h-full min-h-0">
          <SidebarMenu className="gap-2 group-data-[state=collapsed]:items-center shrink-0">
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  if (isSelectionMode) handleCancelSelection();
                  handleNewThread();
                }}
                tooltip={`${t("sidebar.newThread")}  ${NEW_CHAT_KEYS}`}
                className={cn(
                  "group/new-btn relative transition-all duration-200 overflow-hidden cursor-pointer active:scale-[0.97]",
                  "group-data-[state=expanded]:w-full group-data-[state=expanded]:h-10 group-data-[state=expanded]:px-2.5",
                  "group-data-[state=expanded]:bg-zinc-100 group-data-[state=expanded]:hover:bg-zinc-200/80 group-data-[state=expanded]:border-zinc-200/80 group-data-[state=expanded]:text-zinc-900",
                  "dark:group-data-[state=expanded]:bg-linear-to-r dark:group-data-[state=expanded]:from-zinc-800/90 dark:group-data-[state=expanded]:to-zinc-900/90",
                  "dark:group-data-[state=expanded]:hover:from-zinc-700/90 dark:group-data-[state=expanded]:hover:to-zinc-800/90",
                  "dark:group-data-[state=expanded]:border-white/10 dark:group-data-[state=expanded]:hover:border-white/20 dark:group-data-[state=expanded]:text-white",
                  "group-data-[state=expanded]:border group-data-[state=expanded]:rounded-xl group-data-[state=expanded]:shadow-xs",
                  "group-data-[state=collapsed]:p-0! group-data-[state=collapsed]:h-8 group-data-[state=collapsed]:w-8",
                  "group-data-[state=collapsed]:flex group-data-[state=collapsed]:items-center group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:rounded-lg",
                  "group-data-[state=collapsed]:bg-zinc-100 group-data-[state=collapsed]:hover:bg-zinc-200 group-data-[state=collapsed]:border-zinc-200",
                  "dark:group-data-[state=collapsed]:bg-white/[0.05] dark:group-data-[state=collapsed]:hover:bg-white/10 dark:group-data-[state=collapsed]:border-white/10"
                )}
              >
                <div className="flex items-center gap-2.5 w-full min-w-0 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:gap-0 group-data-[state=collapsed]:w-full group-data-[state=collapsed]:h-full">
                  <div className="flex items-center justify-center h-6 w-6 rounded-md bg-blue-600 text-white shadow-xs shrink-0">
                    <SquarePen className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden group-data-[state=collapsed]:hidden">
                    <span className="font-medium text-sm text-zinc-800 dark:text-zinc-100 group-hover/new-btn:text-blue-600 dark:group-hover/new-btn:text-white transition-colors whitespace-nowrap block truncate select-none">
                      {t("sidebar.newThread")}
                    </span>
                  </div>
                  <kbd className="hidden shrink-0 rounded border border-line-1 bg-fill-1 px-1.5 py-0.5 font-mono text-[10px] font-medium text-fg-6 shadow-xs group-hover/new-btn:inline group-data-[state=collapsed]:hidden">
                    {NEW_CHAT_KEYS}
                  </kbd>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Collapsed, the chat list moves into this menu. */}
            <SidebarMenuItem className="group-data-[state=expanded]:hidden">
              <Tooltip open={isChatMenuOpen ? false : undefined}>
                <DropdownMenu open={isChatMenuOpen} onOpenChange={setIsChatMenuOpen}>
                  <DropdownMenuTrigger render={
                    <TooltipTrigger render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("sidebar.recentChats")}
                        className="h-8 w-8 rounded-md text-zinc-500 hover:text-fg-1 dark:text-muted-foreground hover:bg-fill-2 dark:hover:bg-fill-2 cursor-pointer"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    } />
                  } />
                  <DropdownMenuContent side="right" align="start" sideOffset={10} className={cn(MENU_CONTENT, "w-64 rounded-2xl p-2")}>
                    <div className="flex items-center justify-between px-2.5 py-1 mb-1 select-none">
                      <span className="text-xs text-zinc-500 dark:text-muted-foreground font-normal">Recents</span>
                      {chats.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsChatMenuOpen(false);
                            handleStartSelect();
                          }}
                          className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          <ListChecks className="h-3 w-3" />
                          <span>{t("sidebar.select")}</span>
                        </button>
                      )}
                    </div>
                    <div className="max-h-[340px] overflow-y-auto space-y-0.5">
                      {isNewChat && (
                        <DropdownMenuItem onClick={handleNewThread} className={cn(MENU_ITEM_SELECTED, "px-3 py-2 text-[13px] rounded-xl")}>
                          <span className="truncate">{t("sidebar.newChat")}</span>
                        </DropdownMenuItem>
                      )}
                      {chats.map((chat) => (
                        <DropdownMenuItem
                          key={chat.id}
                          onClick={() => handleSelectChat(chat.id)}
                          className={cn(chat.id === activeChatId ? MENU_ITEM_SELECTED : MENU_ITEM, "px-3 py-2 text-[13px] rounded-xl")}
                        >
                          <span className="truncate">{chat.name}</span>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <TooltipContent side="right" align="center">
                  {t("sidebar.openList")}
                </TooltipContent>
              </Tooltip>
            </SidebarMenuItem>
          </SidebarMenu>

          <SidebarGroup className="p-0 group-data-[state=expanded]:mt-4 group-data-[state=collapsed]:hidden flex-1 flex flex-col min-h-0">
            {isSelectionMode ? (
              <div className="flex items-center justify-between px-2 py-1.5 mb-1.5 rounded-lg bg-zinc-100/90 dark:bg-white/5 border border-line-3 text-xs select-none shrink-0 animate-in fade-in-50 duration-150">
                <div className="flex items-center gap-1.5 pl-0.5">
                  <span className="font-semibold text-fg-1">{selectedChatIds.size}</span>
                  <span className="text-fg-7">selected</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-2 py-0.5 rounded text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                  >
                    {selectedChatIds.size === visibleChats.length && visibleChats.length > 0 ? t("sidebar.deselectAll") : t("sidebar.selectAll")}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelSelection}
                    aria-label={t("sidebar.cancelSelection")}
                    className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between px-1 mb-1 shrink-0">
                <SidebarGroupLabel className="p-0 text-xs font-medium text-zinc-500 dark:text-muted-foreground select-none">
                  {t("sidebar.chats")}
                </SidebarGroupLabel>
                {chats.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger render={
                      <button
                        type="button"
                        onClick={() => handleStartSelect()}
                        aria-label={t("sidebar.selectChats")}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium text-fg-7 hover:text-fg-1 hover:bg-fill-1 transition-colors cursor-pointer"
                      >
                        <ListChecks className="h-3.5 w-3.5" />
                        <span>{t("sidebar.select")}</span>
                      </button>
                    } />
                    <TooltipContent side="top" align="end">
                      {t("sidebar.selectMultiple")}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}

            {(chats.length > 0 || query) && (
              <div className="relative mx-1 mb-2 shrink-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-7" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && query) {
                      e.stopPropagation();
                      setQuery("");
                    }
                  }}
                  placeholder={t("sidebar.search")}
                  aria-label={t("sidebar.search")}
                  aria-keyshortcuts={IS_MAC ? "Meta+K" : "Control+K"}
                  className="peer h-8 w-full rounded-lg border border-line-1 bg-fill-2 pl-8 pr-14 text-xs text-fg-2 placeholder:text-fg-7 outline-none transition-colors focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 pointer-coarse:h-10 [&::-webkit-search-cancel-button]:hidden"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      searchRef.current?.focus();
                    }}
                    aria-label={t("sidebar.clearSearch")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-fg-7 hover:bg-fill-1 hover:text-fg-1 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-line-1 bg-fill-1 px-1 py-px font-mono text-[10px] text-fg-7 peer-focus:hidden pointer-coarse:hidden">
                    {SEARCH_KEYS}
                  </kbd>
                )}
              </div>
            )}

            <SidebarGroupContent className="flex-1 overflow-y-auto min-h-0">
              <SidebarMenu className="gap-0.5">
                {search && visibleChats.length === 0 && (
                  <li className="list-none px-2 py-3 text-xs text-fg-7">
                    {chatsQuery.hasNextPage ? t("sidebar.searchingOlder") : t("sidebar.noMatch", { query: query.trim() })}
                  </li>
                )}
                {isNewChat && !isSelectionMode && !search && (
                  <SidebarMenuItem>
                    <ChatRowContent name={t("sidebar.newChat")} active onSelect={handleNewThread} />
                  </SidebarMenuItem>
                )}
                <AnimatePresence initial={false}>
                  {visibleChats.flatMap((chat, index) => {
                    const group = dateGroup(chat.updated_at, now);
                    const startsGroup =
                      index === 0 || dateGroup(visibleChats[index - 1].updated_at, now) !== group;
                    const row = (
                      <motion.li
                        key={chat.id}
                        layout="position"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{
                          opacity: 0,
                          height: 0,
                          x: -20,
                          scale: 0.96,
                          filter: "blur(2px)",
                          backgroundColor: "rgba(239, 68, 68, 0.12)",
                          transition: {
                            opacity: { duration: 0.32, ease: "easeOut" },
                            x: { duration: 0.32, ease: "easeOut" },
                            scale: { duration: 0.32, ease: "easeOut" },
                            filter: { duration: 0.32, ease: "easeOut" },
                            backgroundColor: { duration: 0.18 },
                            height: { duration: 0.34, ease: [0.4, 0, 0.2, 1], delay: 0.08 },
                          },
                        }}
                        transition={{ layout: { duration: 0.28, ease: "easeOut" } }}
                        data-slot="sidebar-menu-item"
                        data-sidebar="menu-item"
                        className="group/menu-item relative overflow-hidden list-none rounded-lg"
                      >
                        <ChatRowContent
                          name={chat.name}
                          active={chat.id === activeChatId}
                          onSelect={() => handleSelectChat(chat.id)}
                          onRename={() => openRename(chat)}
                          onDelete={() => openDelete(chat)}
                          onStartSelect={() => handleStartSelect(chat.id)}
                          selectionMode={isSelectionMode}
                          selected={selectedChatIds.has(chat.id)}
                          onToggleSelect={() => handleToggleChat(chat.id)}
                        />
                      </motion.li>
                    );
                    if (!startsGroup) return [row];
                    return [
                      <motion.li
                        key={`group-${group}`}
                        layout="position"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="list-none px-2 pt-3 pb-1 text-[11px] font-medium text-fg-8 select-none first:pt-1"
                      >
                        {t(group)}
                      </motion.li>,
                      row,
                    ];
                  })}
                </AnimatePresence>
                {/* Older chats load when this comes into view. */}
                <li ref={loadMoreChatsRef} aria-hidden="true" className="h-px" />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Docked Batch Action Bar during Selection Mode */}
          {isSelectionMode && (
            <div className="group-data-[state=collapsed]:hidden sticky bottom-0 z-20 shrink-0 mt-2 p-2 rounded-xl border border-zinc-200/90 dark:border-white/10 bg-overlay/95 backdrop-blur-md flex items-center justify-between gap-2 shadow-sm animate-in slide-in-from-bottom-2 duration-150">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelSelection}
                className="h-8 px-2.5 text-xs text-fg-6 hover:text-fg-1 cursor-pointer"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={selectedChatIds.size === 0}
                onClick={() => {
                  deleteChats.reset();
                  setIsBulkDeleteOpen(true);
                }}
                className="h-8 gap-1.5 px-3 text-xs bg-red-600 hover:bg-red-500 text-white font-medium shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t("sidebar.delete")}{selectedChatIds.size > 0 ? ` (${selectedChatIds.size})` : ""}</span>
              </Button>
            </div>
          )}
        </SidebarContent>

        <SidebarFooter className="group-data-[state=expanded]:p-3 group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:pb-3 group-data-[state=collapsed]:items-center">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button
                  variant="ghost"
                  aria-label={t("sidebar.accountMenu")}
                  className={cn(
                    "cursor-pointer text-zinc-600 dark:text-muted-foreground hover:text-zinc-900 dark:hover:text-foreground transition-colors",
                    "group-data-[state=expanded]:w-full group-data-[state=expanded]:justify-start group-data-[state=expanded]:h-12 group-data-[state=expanded]:px-2 group-data-[state=expanded]:rounded-xl group-data-[state=expanded]:hover:bg-fill-2 dark:group-data-[state=expanded]:hover:bg-fill-2",
                    "group-data-[state=collapsed]:w-9 group-data-[state=collapsed]:h-9 group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:rounded-full group-data-[state=collapsed]:hover:bg-fill-1 group-data-[state=collapsed]:flex group-data-[state=collapsed]:items-center group-data-[state=collapsed]:justify-center"
                  )}
                >
                  <UserAvatar user={user} className="h-7 w-7 group-data-[state=expanded]:mr-3" fallbackClassName="text-[10px]" />
                  <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden group-data-[state=collapsed]:hidden">
                    <span className="font-medium text-xs text-fg-2 truncate w-full text-left">
                      {displayName(user)}
                    </span>
                    <span className="text-[11px] text-zinc-500 truncate w-full text-left">{user.email}</span>
                  </div>
                </Button>
              } />
              <DropdownMenuContent side="top" align="start" sideOffset={8} className={cn(MENU_CONTENT, "w-56 p-1.5")}>
                <div className="px-2.5 py-2 mb-1 border-b border-zinc-100 dark:border-white/10 flex items-center gap-2.5">
                  <UserAvatar user={user} className="h-8 w-8" fallbackClassName="text-xs" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-semibold text-fg-1 truncate">{displayName(user)}</span>
                    <span className="text-[11px] text-fg-7 truncate">{user.email}</span>
                  </div>
                </div>

                <DropdownMenuItem onClick={() => { if (isMobile) setOpenMobile(false); setIsProfileOpen(true); }} className={cn(MENU_ITEM, "py-2")}>
                  <UserIcon className="h-3.5 w-3.5 text-fg-7" />
                  <span>{t("sidebar.profileSettings")}</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={toggleTheme} className={cn(MENU_ITEM, "justify-between py-2")}>
                  <div className="flex items-center gap-2">
                    {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    <span>{theme === "dark" ? t("sidebar.lightMode") : t("sidebar.darkMode")}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 uppercase font-mono">{t(`sidebar.themes.${theme}`)}</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => { if (isMobile) setOpenMobile(false); setIsLogoutOpen(true); }} className={cn(MENU_ITEM_DANGER, "py-2")}>
                  <LogOut className="h-3.5 w-3.5" />
                  <span>{t("sidebar.logOut")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </SidebarFooter>
      </Sidebar>

      <RenameChatModal
        open={renameDialog.open}
        chat={renameDialog.item}
        onClose={renameDialog.close}
        onRename={handleRename}
        pending={renameChat.isPending}
        error={renameChat.error && getErrorMessage(renameChat.error, t("sidebar.renameFailed"))}
      />

      <ConfirmModal
        open={deleteDialog.open}
        onClose={deleteDialog.close}
        onConfirm={handleDelete}
        pending={deleteChat.isPending}
        error={deleteChat.error && getErrorMessage(deleteChat.error, t("sidebar.deleteFailed"))}
        icon={Trash2}
        title={t("sidebar.deleteTitle")}
        description={
          <Trans
            i18nKey="sidebar.deleteBody"
            values={{ name: deleteDialog.item?.name }}
            components={{ b: <span className="text-fg-2 font-medium" /> }}
          />
        }
        confirmLabel={t("sidebar.delete")}
        pendingLabel={t("sidebar.deleting")}
      />

      <ConfirmModal
        open={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={handleConfirmBulkDelete}
        pending={deleteChats.isPending}
        error={deleteChats.error && getErrorMessage(deleteChats.error, t("sidebar.deleteManyFailed"))}
        icon={Trash2}
        title={
          selectedChatIds.size === 1
            ? t("sidebar.deleteTitle")
            : t("sidebar.deleteManyTitle", { count: selectedChatIds.size })
        }
        description={
          selectedChatIds.size === 1 ? (
            t("sidebar.deleteThisBody")
          ) : (
            <Trans
              i18nKey="sidebar.deleteManyBody"
              count={selectedChatIds.size}
              components={{ b: <span className="text-fg-2 font-medium" /> }}
            />
          )
        }
        confirmLabel={
          selectedChatIds.size === 1
            ? t("sidebar.delete")
            : t("sidebar.deleteMany", { count: selectedChatIds.size })
        }
        pendingLabel={t("sidebar.deleting")}
      />

      <ConfirmModal
        open={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={() => logOut.mutate()}
        pending={logOut.isPending}
        icon={LogOut}
        title={t("sidebar.logOutTitle")}
        description={
          <Trans
            i18nKey="sidebar.logOutBody"
            values={{ email: user?.email }}
            components={{ b: <span className="text-fg-2 font-medium" /> }}
          />
        }
        confirmLabel={t("sidebar.logOut")}
        pendingLabel={t("sidebar.loggingOut")}
      />

      <ProfileSettingsModal open={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
}

interface ChatRowContentProps {
  name: string;
  active: boolean;
  onSelect: () => void;
  // Without these the row has no menu, as for the not-yet-created new chat.
  onRename?: () => void;
  onDelete?: () => void;
  onStartSelect?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

function ChatRowContent({
  name,
  active,
  onSelect,
  onRename,
  onDelete,
  onStartSelect,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: ChatRowContentProps) {
  const { t } = useTranslation();

  if (selectionMode) {
    return (
      <div
        role="checkbox"
        aria-checked={selected}
        tabIndex={0}
        onClick={onToggleSelect}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onToggleSelect?.();
          }
        }}
        className={cn(
          "group/chat-row flex items-center gap-2.5 w-full h-8 px-2 rounded-lg text-[13px] transition-colors cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
          selected
            ? "bg-blue-50/90 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100 border border-blue-200/80 dark:border-blue-800/60 font-medium"
            : "text-fg-6 hover:text-fg-2 hover:bg-fill-2 border border-transparent"
        )}
      >
        <div
          className={cn(
            "h-4 w-4 rounded-[4px] flex items-center justify-center shrink-0 transition-all",
            selected
              ? "bg-blue-600 text-white shadow-xs"
              : "border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800/80 group-hover/chat-row:border-zinc-400 dark:group-hover/chat-row:border-zinc-500"
          )}
        >
          {selected && <Check className="h-3 w-3 stroke-[3]" />}
        </div>

        <span className="flex-1 truncate text-left">
          {name}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/chat-row flex items-center gap-1.5 w-full h-8 px-1.5 rounded-lg text-[13px] transition-colors",
        active
          ? "bg-blue-50 text-blue-600 dark:bg-white/10 dark:text-white font-medium border border-blue-100 dark:border-transparent"
          : "text-fg-6 hover:text-fg-2 hover:bg-fill-2"
      )}
    >
      {onRename && onDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <button
              type="button"
              aria-label={t("sidebar.chatOptions", { name })}
              className="opacity-0 pointer-coarse:opacity-100 group-hover/chat-row:opacity-100 data-[popup-open]:opacity-100 aria-expanded:opacity-100 focus:opacity-100 flex items-center justify-center h-6 w-6 rounded-md text-zinc-400 hover:text-fg-1 hover:bg-zinc-200 dark:hover:bg-white/10 shrink-0 transition-opacity duration-150 cursor-pointer"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          } />
          <DropdownMenuContent side="top" align="start" sideOffset={6} className={cn(MENU_CONTENT, "w-32")}>
            <DropdownMenuItem onClick={onRename} className={MENU_ITEM}>
              <Pencil className="h-3.5 w-3.5" />
              <span>{t("sidebar.rename")}</span>
            </DropdownMenuItem>
            {onStartSelect && (
              <DropdownMenuItem onClick={onStartSelect} className={MENU_ITEM}>
                <CheckSquare className="h-3.5 w-3.5" />
                <span>{t("sidebar.select")}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDelete} className={MENU_ITEM_DANGER}>
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t("sidebar.delete")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="w-6 shrink-0" />
      )}

      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        className="h-full flex-1 truncate rounded-md text-left select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      >
        {name}
      </button>
    </div>
  );
}
