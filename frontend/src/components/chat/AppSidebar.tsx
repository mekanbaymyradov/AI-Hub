import React, { useState, useMemo } from "react";
import {
  SquarePen,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  MoreVertical,
  Pencil,
  Trash2,
  User as UserIcon,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

import { chatApi } from "@/api/chat";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { RenameChatModal } from "./RenameChatModal";
import { DeleteChatModal } from "./DeleteChatModal";
import { LogoutConfirmationModal } from "./LogoutConfirmationModal";
import { ProfileSettingsModal } from "./ProfileSettingsModal";

interface AppSidebarProps {
  activeChatId: number | null;
  onSelectChat: (id: number) => void;
  onNewThread: () => void;
}

export function AppSidebar({
  activeChatId,
  onSelectChat,
  onNewThread,
}: AppSidebarProps) {
  const { toggleSidebar } = useSidebar();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const isMac = useMemo(() => {
    return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/i.test(navigator.userAgent || "");
  }, []);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [chatToRename, setChatToRename] = useState<{ id: number; name: string } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  const [chatToDelete, setChatToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error("Failed to log out:", err);
    } finally {
      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
    }
  };

  const handleRename = async (newName: string) => {
    if (!chatToRename) return;
    setIsRenaming(true);
    try {
      await chatApi.renameChat(chatToRename.id, { name: newName });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      setChatToRename(null);
    } catch (err) {
      console.error("Failed to rename chat:", err);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!chatToDelete) return;
    setIsDeleting(true);
    try {
      await chatApi.deleteChat(chatToDelete.id);
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      if (activeChatId === chatToDelete.id) {
        onNewThread();
      }
      setChatToDelete(null);
    } catch (err) {
      console.error("Failed to delete chat:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const { data: chatsData } = useQuery({
    queryKey: ["chats"],
    queryFn: () => chatApi.getChats(),
  });

  const threads = chatsData?.items || [];
  const displayThreads = activeChatId === null
    ? [{ id: -1, name: "New Chat" }, ...threads]
    : threads;

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-zinc-200 dark:border-white/10 bg-white dark:bg-[#141416] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
        <SidebarHeader className="group-data-[state=expanded]:p-3 group-data-[state=expanded]:pb-2 group-data-[state=expanded]:pt-3.5 group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:py-3 flex flex-row items-center justify-between group-data-[state=collapsed]:justify-center">
          <div className="flex items-center gap-2.5 group-data-[state=collapsed]:hidden pl-0.5">
            <img src="/favicon.svg" alt="AI-Hub" className="h-6 w-6 object-contain shrink-0" />
            <div className="flex items-center gap-1.5">
              <p className="flex flex-row gap-0.5 font-semibold tracking-tight text-sm text-zinc-900 dark:text-zinc-100">
                AI <span className="text-blue-600 dark:text-blue-500">Hub</span>
              </p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger render={
              <Button
                variant="ghost"
                size="icon"
                className="group/logo-btn group-data-[state=expanded]:h-9 group-data-[state=expanded]:w-9 group-data-[state=collapsed]:h-8 group-data-[state=collapsed]:w-8 text-zinc-500 hover:text-zinc-900 dark:text-muted-foreground dark:hover:text-white rounded-lg p-0 cursor-pointer"
                onClick={toggleSidebar}
              >
                <div className="group-data-[state=expanded]:hidden flex items-center justify-center size-full">
                  <img
                    src="/favicon.svg"
                    alt="AI-Hub"
                    className="h-5 w-5 object-contain shrink-0 group-hover/logo-btn:hidden"
                  />
                  <PanelLeft className="h-4 w-4 text-zinc-600 dark:text-zinc-300 group-hover/logo-btn:text-zinc-900 dark:group-hover/logo-btn:text-white hidden group-hover/logo-btn:block" />
                </div>
                <PanelLeftClose className="h-4 w-4 group-data-[state=collapsed]:hidden" />
              </Button>
            } />
            <TooltipContent side="right" align="center">
              <span>Toggle sidebar</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 shadow-xs">
                {isMac ? "⌘ B" : "Ctrl + B"}
              </kbd>
            </TooltipContent>
          </Tooltip>
        </SidebarHeader>

        <SidebarContent className="group-data-[state=expanded]:px-3 group-data-[state=expanded]:py-2 group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:items-center group-data-[state=collapsed]:mt-3">
          <SidebarMenu className="gap-2 group-data-[state=collapsed]:items-center">
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={onNewThread}
                tooltip="New thread"
                className={cn(
                  "group/new-btn relative transition-all duration-200 overflow-hidden cursor-pointer active:scale-[0.97]",
                  "group-data-[state=expanded]:w-full group-data-[state=expanded]:h-10 group-data-[state=expanded]:px-2.5",
                  "group-data-[state=expanded]:bg-zinc-100 group-data-[state=expanded]:hover:bg-zinc-200/80 group-data-[state=expanded]:border-zinc-200/80 group-data-[state=expanded]:text-zinc-900",
                  "dark:group-data-[state=expanded]:bg-gradient-to-r dark:group-data-[state=expanded]:from-zinc-800/90 dark:group-data-[state=expanded]:to-zinc-900/90",
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
                      New thread
                    </span>
                  </div>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem className="group-data-[state=expanded]:hidden">
              <Tooltip open={isChatMenuOpen ? false : undefined}>
                <DropdownMenu open={isChatMenuOpen} onOpenChange={setIsChatMenuOpen}>
                  <DropdownMenuTrigger render={
                    <TooltipTrigger render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-muted-foreground dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    } />
                  } />
                  <DropdownMenuContent
                    side="right"
                    align="start"
                    sideOffset={10}
                    className="w-64 bg-white dark:bg-[#1e1e20] border border-zinc-200 dark:border-white/10 rounded-2xl p-2 shadow-2xl backdrop-blur-md text-zinc-900 dark:text-zinc-100"
                  >
                    <div className="text-xs text-zinc-500 dark:text-muted-foreground font-normal px-2.5 py-1 mb-1 select-none">
                      Recents
                    </div>
                    <div className="max-h-[340px] overflow-y-auto space-y-0.5">
                      {displayThreads.map((thread) => {
                        const isActive = activeChatId === thread.id || (activeChatId === null && thread.id === -1);
                        return (
                          <DropdownMenuItem
                            key={thread.id}
                            onClick={() => thread.id === -1 ? onNewThread() : onSelectChat(thread.id)}
                            className={cn(
                              "cursor-pointer px-3 py-2 text-[13px] rounded-xl transition-colors",
                              isActive
                                ? "bg-blue-50 text-blue-600 dark:bg-white/10 dark:text-white font-medium"
                                : "text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 focus:bg-zinc-100 dark:focus:bg-white/10"
                            )}
                          >
                            <span className="truncate">{thread.name || "New Chat"}</span>
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <TooltipContent side="right" align="center">
                  Click to view the list
                </TooltipContent>
              </Tooltip>
            </SidebarMenuItem>
          </SidebarMenu>

          <SidebarGroup className="p-0 group-data-[state=expanded]:mt-4 group-data-[state=collapsed]:hidden">
            <SidebarGroupLabel className="text-xs font-medium text-zinc-500 dark:text-muted-foreground mb-1 px-1">
              Earlier
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {displayThreads.map((thread) => {
                  const isActive = activeChatId === thread.id || (activeChatId === null && thread.id === -1);
                  return (
                    <SidebarMenuItem key={thread.id}>
                      <div
                        onClick={() => thread.id === -1 ? onNewThread() : onSelectChat(thread.id)}
                        className={cn(
                          "group/chat-row flex items-center gap-1.5 w-full h-8 px-1.5 rounded-lg text-[13px] cursor-pointer transition-colors relative",
                          isActive
                            ? "bg-blue-50 text-blue-600 dark:bg-white/10 dark:text-white font-medium border border-blue-100 dark:border-transparent"
                            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5"
                        )}
                      >
                        {thread.id !== -1 ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger render={
                              <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                className="opacity-0 group-hover/chat-row:opacity-100 data-[popup-open]:opacity-100 aria-expanded:opacity-100 focus:opacity-100 flex items-center justify-center h-6 w-6 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/10 shrink-0 transition-opacity duration-150 cursor-pointer"
                                title="Chat options"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>
                            } />
                            <DropdownMenuContent
                              side="top"
                              align="start"
                              sideOffset={6}
                              className="w-32 bg-white dark:bg-[#1f1f22] border border-zinc-200 dark:border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-md z-50 text-zinc-900 dark:text-zinc-100"
                            >
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setChatToRename({ id: thread.id, name: thread.name || "New Chat" });
                                }}
                                className="cursor-pointer flex items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 focus:bg-zinc-100 dark:focus:bg-white/10 rounded-lg transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Rename</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setChatToDelete({ id: thread.id, name: thread.name || "New Chat" });
                                }}
                                className="cursor-pointer flex items-center gap-2 px-2.5 py-1.5 text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 focus:bg-red-50 dark:focus:bg-red-500/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <div className="w-6 shrink-0" />
                        )}

                        <span className="truncate flex-1 text-left select-none">
                          {thread.name || "New Chat"}
                        </span>
                      </div>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="group-data-[state=expanded]:p-3 group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:pb-3 group-data-[state=collapsed]:items-center">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button
                  variant="ghost"
                  className={cn(
                    "cursor-pointer text-zinc-600 dark:text-muted-foreground hover:text-zinc-900 dark:hover:text-foreground transition-colors",
                    "group-data-[state=expanded]:w-full group-data-[state=expanded]:justify-start group-data-[state=expanded]:h-12 group-data-[state=expanded]:px-2 group-data-[state=expanded]:rounded-xl group-data-[state=expanded]:hover:bg-zinc-100 dark:group-data-[state=expanded]:hover:bg-white/5",
                    "group-data-[state=collapsed]:w-9 group-data-[state=collapsed]:h-9 group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:rounded-full group-data-[state=collapsed]:hover:bg-zinc-100 dark:group-data-[state=collapsed]:hover:bg-white/10 group-data-[state=collapsed]:flex group-data-[state=collapsed]:items-center group-data-[state=collapsed]:justify-center"
                  )}
                >
                  <Avatar className="h-7 w-7 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 shrink-0 group-data-[state=expanded]:mr-3">
                    {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name || "User"} />}
                    <AvatarFallback className="text-[10px] text-zinc-700 dark:text-zinc-200 uppercase font-semibold">
                      {user.avatar_initial || user.name?.slice(0, 1) || user.email?.slice(0, 1) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden group-data-[state=collapsed]:hidden">
                    <span className="font-medium text-xs text-zinc-900 dark:text-zinc-200 truncate w-full text-left">
                      {user.name || user.email.split("@")[0]}
                    </span>
                    <span className="text-[11px] text-zinc-500 truncate w-full text-left">
                      {user.email}
                    </span>
                  </div>
                </Button>
              } />
              <DropdownMenuContent
                side="top"
                align="start"
                sideOffset={8}
                className="w-56 bg-white dark:bg-[#1c1c1f] border border-zinc-200 dark:border-white/10 rounded-xl p-1.5 shadow-2xl backdrop-blur-md z-50 text-zinc-900 dark:text-foreground"
              >
                <div className="px-2.5 py-2 mb-1 border-b border-zinc-100 dark:border-white/10 flex items-center gap-2.5">
                  <Avatar className="h-8 w-8 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 shrink-0">
                    {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name || "User"} />}
                    <AvatarFallback className="text-xs text-zinc-700 dark:text-zinc-200 uppercase font-semibold">
                      {user.avatar_initial || user.name?.slice(0, 1) || user.email?.slice(0, 1) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                      {user.name || user.email.split("@")[0]}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {user.email}
                    </span>
                  </div>
                </div>

                <DropdownMenuItem
                  onClick={() => setIsProfileModalOpen(true)}
                  className="cursor-pointer flex items-center gap-2 px-2.5 py-2 text-xs text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 focus:bg-zinc-100 dark:focus:bg-white/10 rounded-lg transition-colors"
                >
                  <UserIcon className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span>Profile Settings</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={toggleTheme}
                  className="cursor-pointer flex items-center justify-between px-2.5 py-2 text-xs text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 focus:bg-zinc-100 dark:focus:bg-white/10 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {theme === "dark" ? <Sun className="h-3.5 w-3.5 text-current" /> : <Moon className="h-3.5 w-3.5 text-current" />}
                    <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 uppercase font-mono">{theme}</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setIsLogoutModalOpen(true)}
                  className="cursor-pointer flex items-center gap-2 px-2.5 py-2 text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 focus:bg-red-50 dark:focus:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </SidebarFooter>
      </Sidebar>

      <RenameChatModal
        isOpen={!!chatToRename}
        chat={chatToRename}
        onClose={() => setChatToRename(null)}
        onRename={handleRename}
        isRenaming={isRenaming}
      />

      <DeleteChatModal
        isOpen={!!chatToDelete}
        chat={chatToDelete}
        onClose={() => setChatToDelete(null)}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      />

      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        email={user?.email}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        isLoggingOut={isLoggingOut}
      />
    </>
  );
}
