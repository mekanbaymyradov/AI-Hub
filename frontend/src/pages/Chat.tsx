import { useState, useRef, useEffect, useMemo } from "react";
import {
  ArrowUp,
  Plus,
  MoreHorizontal,
  Maximize2,
  Mic,
  ChevronDown,
  BrainCircuit,
  LogIn,
  SquarePen,
  Search,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Library,
  Sparkles,
  MoreVertical,
  Pencil,
  Trash2,
  User as UserIcon,
  LogOut,
  Camera,
  Check,
  Loader2,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "cn";
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
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";

import { chatApi } from "@/api/chat";
import { llmApi } from "@/api/llm";
import { useAuth } from "@/context/AuthContext";
import { resizeAndCompressImageToWebP } from "@/utils/image";

type UIMessage = {
  id: string;
  role: "user" | "ai";
  content: string;
};


function AppSidebar({
  activeChatId,
  onSelectChat,
  onNewThread
}: {
  activeChatId: number | null;
  onSelectChat: (id: number) => void;
  onNewThread: () => void;
}) {
  const { toggleSidebar, state } = useSidebar();
  const { user, logout, updateUser, uploadAvatar, removeAvatar } = useAuth();
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const isMac = useMemo(() => {
    return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/i.test(navigator.userAgent || "");
  }, []);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileInstructionsInput, setProfileInstructionsInput] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  const openProfileModal = () => {
    setProfileNameInput(user?.name || "");
    setProfileInstructionsInput(user?.instructions || "");
    setProfileSaveSuccess(false);
    setAvatarError(null);
    setIsProfileModalOpen(true);
  };

  const handleProfileSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingProfile(true);
    try {
      await updateUser({
        name: profileNameInput.trim() || null,
        instructions: profileInstructionsInput.trim() || null,
      });
      setProfileSaveSuccess(true);
      setTimeout(() => {
        setIsProfileModalOpen(false);
        setProfileSaveSuccess(false);
      }, 500);
    } catch (err) {
      console.error("Failed to update profile:", err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      // Resize to 256x256 square and compress as WebP
      const webpFile = await resizeAndCompressImageToWebP(file, 256, 0.85);
      await uploadAvatar(webpFile);
    } catch (err: any) {
      console.error("Failed to upload avatar:", err);
      const errorMsg =
        err?.response?.data?.detail?.[0]?.msg ||
        (typeof err?.response?.data?.detail === "string" ? err.response.data.detail : null) ||
        err?.message ||
        "Failed to process and upload avatar.";
      setAvatarError(errorMsg);
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      await removeAvatar();
    } catch (err: any) {
      console.error("Failed to remove avatar:", err);
      const errorMsg =
        err?.response?.data?.detail?.[0]?.msg ||
        (typeof err?.response?.data?.detail === "string" ? err.response.data.detail : null) ||
        err?.message ||
        "Failed to remove avatar.";
      setAvatarError(errorMsg);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const queryClient = useQueryClient();
  const [chatToRename, setChatToRename] = useState<{ id: number; name: string } | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const [chatToDelete, setChatToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRename = async () => {
    if (!chatToRename || !renameInput.trim()) return;
    setIsRenaming(true);
    try {
      await chatApi.renameChat(chatToRename.id, { name: renameInput.trim() });
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
    queryFn: () => chatApi.getChats()
  });

  const threads = chatsData?.items || [];
  const displayThreads = activeChatId === null
    ? [{ id: -1, name: "New Chat" }, ...threads]
    : threads;

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-[#171717]">
      <SidebarHeader className="group-data-[state=expanded]:p-3 group-data-[state=expanded]:pb-2 group-data-[state=expanded]:pt-3.5 group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:py-3 flex flex-row items-center justify-between group-data-[state=collapsed]:justify-center">
        <div className="flex items-center gap-2.5 group-data-[state=collapsed]:hidden pl-0.5">
          <img src="/favicon.svg" alt="AI-Hub" className="h-6 w-6 object-contain shrink-0" />
          <div className="flex items-center gap-1.5">
            <p className="flex flex-row gap-0.5 font-semibold tracking-tight text-sm text-zinc-100">AI <span className="text-blue-600">Hub</span></p>
            <div
              aria-hidden="true"
              className="flex justify-center items-center h-[22px] px-2 rounded-full overflow-hidden backdrop-blur-[3px] select-none"
              style={{
                background: "#131314",
                boxShadow: "inset 0.603px -0.603px 5px 0 rgba(49, 134, 255, 0.85)",
              }}
            >
              <img
                src="https://www.gstatic.com/identity/boq/accountsettingsmobile/tier_wave_4d15c88d26ad039061707f8af71fc76d.svg"
                alt=""
                role="presentation"
                className="absolute bottom-0 object-contain"
              />
              <span className="text-[12px] font-semibold text-white tracking-normal leading-none font-sans">
                Pro
              </span>
            </div>
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger render={
            <Button
              variant="ghost"
              size="icon"
              className="group/logo-btn group-data-[state=expanded]:h-9 group-data-[state=expanded]:w-9 group-data-[state=collapsed]:h-8 group-data-[state=collapsed]:w-8 text-muted-foreground hover:text-white rounded-lg p-0 cursor-pointer"
              onClick={toggleSidebar}
            >
              <div className="group-data-[state=expanded]:hidden flex items-center justify-center size-full">
                <img 
                  src="/favicon.svg" 
                  alt="AI-Hub" 
                  className="h-5 w-5 object-contain shrink-0 group-hover/logo-btn:hidden" 
                />
                <PanelLeft className="h-4 w-4 text-zinc-300 group-hover/logo-btn:text-white hidden group-hover/logo-btn:block" />
              </div>
              <PanelLeftClose className="h-4 w-4 group-data-[state=collapsed]:hidden" />
            </Button>
          } />
          <TooltipContent side="right" align="center">
            <span>Toggle sidebar</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-white/10 text-zinc-300 border border-white/10 shadow-xs">
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
              tooltip="New chat"
              className={cn(
                "group/new-btn relative transition-all duration-200 overflow-hidden cursor-pointer active:scale-[0.97]",
                "group-data-[state=expanded]:w-full group-data-[state=expanded]:h-10 group-data-[state=expanded]:px-2.5",
                "group-data-[state=expanded]:bg-gradient-to-r group-data-[state=expanded]:from-zinc-800/90 group-data-[state=expanded]:to-zinc-900/90",
                "group-data-[state=expanded]:hover:from-zinc-700/90 group-data-[state=expanded]:hover:to-zinc-800/90",
                "group-data-[state=expanded]:border group-data-[state=expanded]:border-white/10 group-data-[state=expanded]:hover:border-white/20",
                "group-data-[state=expanded]:rounded-xl group-data-[state=expanded]:shadow-sm group-data-[state=expanded]:shadow-black/50",
                "group-data-[state=collapsed]:p-0! group-data-[state=collapsed]:h-8 group-data-[state=collapsed]:w-8",
                "group-data-[state=collapsed]:flex group-data-[state=collapsed]:items-center group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:rounded-lg",
                "group-data-[state=collapsed]:bg-white/[0.05] group-data-[state=collapsed]:hover:bg-white/10",
                "group-data-[state=collapsed]:border group-data-[state=collapsed]:border-white/10 group-data-[state=collapsed]:hover:border-white/20"
              )}
            >
              <div className="flex items-center gap-2.5 w-full min-w-0 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:gap-0 group-data-[state=collapsed]:w-full group-data-[state=collapsed]:h-full">
                <div className="flex items-center justify-center h-6 w-6 rounded-md bg-white/10 border border-white/10 text-white group-hover/new-btn:bg-white/15 group-hover/new-btn:border-white/20 transition-all shrink-0">
                  <SquarePen className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="font-medium text-sm text-zinc-100 group-hover/new-btn:text-white transition-colors whitespace-nowrap shrink-0 select-none group-data-[state=collapsed]:hidden">
                  New chat
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* SINGLE CHAT ICON DROPDOWN WHEN COLLAPSED */}
          <SidebarMenuItem className="group-data-[state=expanded]:hidden">
            <Tooltip open={isChatMenuOpen ? false : undefined}>
              <DropdownMenu open={isChatMenuOpen} onOpenChange={setIsChatMenuOpen}>
                <DropdownMenuTrigger render={
                  <TooltipTrigger render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-md text-muted-foreground hover:text-white hover:bg-white/5"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  } />
                } />
                <DropdownMenuContent
                  side="right"
                  align="start"
                  sideOffset={10}
                  className="w-64 bg-[#1e1e20] border-white/10 rounded-2xl p-2 shadow-2xl backdrop-blur-md"
                >
                  <div className="text-xs text-muted-foreground font-normal px-2.5 py-1 mb-1 select-none">
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
                            "cursor-pointer px-3 py-2 text-[13px] rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 focus:bg-white/10 focus:text-white transition-colors",
                            isActive && "bg-white/5 text-white font-medium"
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

        {/* FULL CHAT LIST WHEN EXPANDED */}
        <SidebarGroup className="p-0 group-data-[state=expanded]:mt-4 group-data-[state=collapsed]:hidden">
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground mb-1 px-1">Earlier</SidebarGroupLabel>
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
                          ? "bg-white/10 text-white font-medium"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                      )}
                    >
                      {/* Left: Vertical Three-Dot Icon with Drop-Up Menu */}
                      {thread.id !== -1 ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-0 group-hover/chat-row:opacity-100 data-[popup-open]:opacity-100 aria-expanded:opacity-100 focus:opacity-100 flex items-center justify-center h-6 w-6 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 shrink-0 transition-opacity duration-150 cursor-pointer"
                              title="Chat options"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          } />
                          <DropdownMenuContent
                            side="top"
                            align="start"
                            sideOffset={6}
                            className="w-32 bg-[#1f1f22] border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-md z-50"
                          >
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setChatToRename({ id: thread.id, name: thread.name || "New Chat" });
                                setRenameInput(thread.name || "New Chat");
                              }}
                              className="cursor-pointer flex items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-200 hover:text-white hover:bg-white/10 focus:bg-white/10 focus:text-white rounded-lg transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>Rename</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setChatToDelete({ id: thread.id, name: thread.name || "New Chat" });
                              }}
                              className="cursor-pointer flex items-center gap-2 px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-300 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <div className="w-6 shrink-0" />
                      )}

                      {/* Right: Chat Name */}
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
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className={cn(
                    "cursor-pointer text-muted-foreground hover:text-foreground transition-colors",
                    "group-data-[state=expanded]:w-full group-data-[state=expanded]:justify-start group-data-[state=expanded]:h-12 group-data-[state=expanded]:px-2 group-data-[state=expanded]:rounded-xl group-data-[state=expanded]:hover:bg-white/5",
                    "group-data-[state=collapsed]:w-9 group-data-[state=collapsed]:h-9 group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:rounded-full group-data-[state=collapsed]:hover:bg-white/10 group-data-[state=collapsed]:flex group-data-[state=collapsed]:items-center group-data-[state=collapsed]:justify-center"
                  )}
                >
                  <Avatar className="h-7 w-7 bg-zinc-800 border border-white/10 shrink-0 group-data-[state=expanded]:mr-3">
                    {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name || "User"} />}
                    <AvatarFallback className="text-[10px] text-zinc-200 uppercase font-semibold">
                      {user.avatar_initial || user.name?.slice(0, 1) || user.email?.slice(0, 1) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden group-data-[state=collapsed]:hidden">
                    <span className="font-medium text-xs text-zinc-200 truncate w-full text-left">
                      {user.name || user.email.split("@")[0]}
                    </span>
                    <span className="text-[11px] text-zinc-500 truncate w-full text-left">
                      {user.email}
                    </span>
                  </div>
                </Button>
              }
            />
            <DropdownMenuContent
              side="top"
              align="start"
              sideOffset={8}
              className="w-56 bg-[#1c1c1f] border border-white/10 rounded-xl p-1.5 shadow-2xl backdrop-blur-md z-50 text-foreground"
            >
              <div className="px-2.5 py-2 mb-1 border-b border-white/10 flex items-center gap-2.5">
                <Avatar className="h-8 w-8 bg-zinc-800 border border-white/10 shrink-0">
                  {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name || "User"} />}
                  <AvatarFallback className="text-xs text-zinc-200 uppercase font-semibold">
                    {user.avatar_initial || user.name?.slice(0, 1) || user.email?.slice(0, 1) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-semibold text-white truncate">
                    {user.name || user.email.split("@")[0]}
                  </span>
                  <span className="text-[11px] text-zinc-400 truncate">
                    {user.email}
                  </span>
                </div>
              </div>

              <DropdownMenuItem
                onClick={openProfileModal}
                className="cursor-pointer flex items-center gap-2 px-2.5 py-2 text-xs text-zinc-200 hover:text-white hover:bg-white/10 focus:bg-white/10 focus:text-white rounded-lg transition-colors"
              >
                <UserIcon className="h-3.5 w-3.5 text-zinc-400" />
                <span>Profile Settings</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setIsLogoutModalOpen(true)}
                className="cursor-pointer flex items-center gap-2 px-2.5 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-300 rounded-lg transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>

      {/* RENAME POPUP MODAL */}
      <AnimatePresence>
        {chatToRename && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-sm bg-[#1c1c1f] border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4 text-foreground"
            >
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">Rename Chat</h3>
                <p className="text-xs text-zinc-400">Enter a new name for this conversation.</p>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleRename(); }}>
                <Input
                  autoFocus
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  placeholder="Chat name"
                  className="h-10 bg-[#121214] border-white/10 text-white text-sm focus-visible:ring-1 focus-visible:ring-blue-500 rounded-xl"
                />

                <div className="flex justify-end gap-2 mt-5">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setChatToRename(null)}
                    disabled={isRenaming}
                    className="h-9 px-4 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!renameInput.trim() || isRenaming}
                    className="h-9 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    {isRenaming ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION POPUP MODAL */}
      <AnimatePresence>
        {chatToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-sm bg-[#1c1c1f] border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4 text-foreground"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-red-400">
                  <Trash2 className="h-4 w-4" />
                  <h3 className="text-base font-semibold text-white">Delete Chat?</h3>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Are you sure you want to delete <span className="text-zinc-200 font-medium">"{chatToDelete.name}"</span>? This will permanently remove the conversation and its history.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setChatToDelete(null)}
                  disabled={isDeleting}
                  className="h-9 px-4 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="h-9 px-4 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROFILE SETTINGS POPUP MODAL */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md bg-[#1c1c1f] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 text-foreground"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-zinc-300" />
                  <h3 className="text-base font-semibold text-white">Profile Settings</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Avatar management */}
              <div className="flex items-center gap-4">
                <div className="relative group/avatar shrink-0">
                  <Avatar className="h-16 w-16 bg-zinc-800 border-2 border-white/10">
                    {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={user?.name || "User"} />}
                    <AvatarFallback className="text-lg text-zinc-200 uppercase font-semibold">
                      {user?.avatar_initial || user?.name?.slice(0, 1) || user?.email?.slice(0, 1) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="h-8 px-3 text-xs bg-white/5 border-white/10 text-zinc-200 hover:text-white hover:bg-white/10 cursor-pointer"
                    >
                      <Camera className="h-3.5 w-3.5 mr-1.5" />
                      Upload photo
                    </Button>
                    {user?.avatar_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAvatarRemove}
                        disabled={isUploadingAvatar}
                        className="h-8 px-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    Automatically resized & compressed to WebP (max 2MB)
                  </span>
                  {avatarError && (
                    <span className="text-[11px] text-red-400 font-medium">
                      {avatarError}
                    </span>
                  )}
                </div>
              </div>

              <form onSubmit={handleProfileSave} className="space-y-4">
                {/* Email (Read only) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Email Address</label>
                  <Input
                    value={user?.email || ""}
                    disabled
                    className="h-10 bg-[#121214]/60 border-white/5 text-zinc-400 text-sm rounded-xl cursor-not-allowed"
                  />
                </div>

                {/* Display Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Display Name</label>
                  <Input
                    value={profileNameInput}
                    onChange={(e) => setProfileNameInput(e.target.value)}
                    placeholder="Enter your name"
                    className="h-10 bg-[#121214] border-white/10 text-white text-sm focus-visible:ring-1 focus-visible:ring-blue-500 rounded-xl"
                  />
                </div>

                {/* Custom Instructions */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Custom Instructions</label>
                  <Textarea
                    value={profileInstructionsInput}
                    onChange={(e) => setProfileInstructionsInput(e.target.value)}
                    placeholder="How would you like the AI to respond to you? (optional)"
                    rows={3}
                    className="min-h-[80px] bg-[#121214] border-white/10 text-white text-xs focus-visible:ring-1 focus-visible:ring-blue-500 rounded-xl resize-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-emerald-400 font-medium">
                    {profileSaveSuccess && (
                      <span className="flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Saved successfully
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsProfileModalOpen(false)}
                      disabled={isSavingProfile}
                      className="h-9 px-4 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSavingProfile}
                      className="h-9 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer"
                    >
                      {isSavingProfile ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LOGOUT CONFIRMATION POPUP MODAL */}
      <AnimatePresence>
        {isLogoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-sm bg-[#1c1c1f] border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4 text-foreground"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-red-400">
                  <LogOut className="h-4 w-4" />
                  <h3 className="text-base font-semibold text-white">Log out?</h3>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Are you sure you want to log out of <span className="text-zinc-200 font-medium">{user?.email}</span>? You will need to sign in again to access your account.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsLogoutModalOpen(false)}
                  disabled={isLoggingOut}
                  className="h-9 px-4 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="h-9 px-4 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  {isLoggingOut ? "Logging out..." : "Log out"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Sidebar>
  );
}

export default function Chat() {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4o");

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    let timeGreeting = "GOOD MORNING";
    if (hour >= 12 && hour < 18) {
      timeGreeting = "GOOD AFTERNOON";
    } else if (hour >= 18 || hour < 5) {
      timeGreeting = "GOOD EVENING";
    }

    const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "";
    if (displayName) {
      return `${timeGreeting}, ${displayName.toUpperCase()}`;
    }
    return timeGreeting;
  }, [user]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const { data: modelsData } = useQuery({
    queryKey: ["models"],
    queryFn: () => llmApi.getModels()
  });

  const { data: historyData } = useQuery({
    queryKey: ["chat-messages", activeChatId],
    queryFn: () => chatApi.getChatMessages(activeChatId!),
    enabled: !!activeChatId
  });

  useEffect(() => {
    if (historyData) {
      // API returns newest first (page 1), we need to reverse for UI display
      const uiMsgs: UIMessage[] = [...historyData.items].reverse().map(m => ({
        id: m.id.toString(),
        role: m.kind === "response" ? "ai" : "user",
        content: m.content
      }));
      setMessages(uiMsgs);
    }
  }, [historyData]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isStreaming]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isStreaming) return;

    const userMessage: UIMessage = { id: Date.now().toString(), role: "user", content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setIsStreaming(true);

    let streamBuffer = "";
    let aiMessageId = (Date.now() + 1).toString();

    // Add empty AI message placeholder
    setMessages(prev => [...prev, { id: aiMessageId, role: "ai", content: "" }]);

    await chatApi.streamMessage(
      {
        chat_id: activeChatId || undefined,
        model_id: selectedModel,
        prompt: text,
        attachment_ids: []
      },
      {
        onChatId: (newChatId) => {
          if (!activeChatId) {
            setActiveChatId(newChatId);
            queryClient.invalidateQueries({ queryKey: ["chats"] });
          }
        },
        onChunk: (chunk) => {
          streamBuffer += chunk;
          setMessages(prev =>
            prev.map(msg => msg.id === aiMessageId ? { ...msg, content: streamBuffer } : msg)
          );
        },
        onError: (err) => {
          setIsStreaming(false);
          setMessages(prev =>
            prev.map(msg => msg.id === aiMessageId ? { ...msg, content: streamBuffer + `\n\n**Error:** ${err}` } : msg)
          );
        },
        onComplete: () => {
          setIsStreaming(false);
        }
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isInitialState = messages.length === 0 && !isStreaming;

  const currentModelName = modelsData?.find(m => m.id === selectedModel)?.display_name || "Select Model";

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-[#0a0a0a] text-foreground font-sans overflow-hidden">
        <AppSidebar
          activeChatId={activeChatId}
          onSelectChat={(id) => setActiveChatId(id)}
          onNewThread={() => {
            setActiveChatId(null);
            setMessages([]);
          }}
        />

        <main className="flex flex-col flex-1 min-w-0 relative">

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full px-4" ref={scrollAreaRef}>
              <div className="max-w-3xl mx-auto pb-40 pt-6">
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex w-full mb-8 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "user" ? (
                        <div className="max-w-[70%] bg-zinc-800 text-zinc-100 px-5 py-3.5 rounded-[24px] text-[15px] leading-relaxed whitespace-pre-wrap shadow-sm">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="flex gap-4 w-full">
                          <Avatar className="bg-zinc-900 border border-white/10 mt-1">
                            <AvatarFallback className="text-[10px] text-zinc-400">AI</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-2 mt-2 text-[15px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
                            {msg.content}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                <AnimatePresence>
                  {isStreaming && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex gap-4 w-full mb-8"
                    >
                      <Avatar className="bg-zinc-900 border border-white/10 mt-1">
                        <AvatarFallback className="text-[10px] text-zinc-400">AI</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 flex items-center mt-2">
                        <div className="flex space-x-1.5 h-6 items-center px-1">
                          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} className="w-1.5 h-1.5 bg-zinc-500 rounded-full" />
                          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} className="w-1.5 h-1.5 bg-zinc-500 rounded-full" />
                          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} className="w-1.5 h-1.5 bg-zinc-500 rounded-full" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>

          <motion.div
            layout
            initial={false}
            animate={{
              justifyContent: isInitialState ? "center" : "flex-end",
              paddingBottom: isInitialState ? "0px" : "32px",
            }}
            className="absolute inset-0 pointer-events-none flex flex-col px-4 z-0 pt-12"
          >
            <div className="w-full max-w-2xl mx-auto pointer-events-auto flex flex-col">

              <AnimatePresence>
                {isInitialState && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                    transition={{ duration: 0.3 }}
                    className="text-center mb-8"
                  >
                    <h2 className="text-[28px] font-medium tracking-tight text-white mb-8">
                      {greeting}
                    </h2>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div layoutId="input-box" className="relative group w-full">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="relative flex flex-col bg-[#171717] border border-white/10 rounded-[24px] focus-within:ring-1 focus-within:ring-white/20 focus-within:border-white/20 transition-all overflow-hidden"
                >
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Send a message..."
                    className="min-h-[52px] max-h-[400px] w-full resize-none border-0 shadow-none focus-visible:ring-0 px-4 pt-4 pb-12 text-[15px] bg-transparent text-white placeholder:text-zinc-500"
                    rows={1}
                  />

                  <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={
                          <Button type="button" variant="ghost" className="h-8 px-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 text-xs font-normal">
                            <BrainCircuit className="h-3.5 w-3.5 mr-1.5" />
                            {currentModelName} <span className="ml-1 opacity-60">Low</span>
                            <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
                          </Button>
                        } />
                        <DropdownMenuContent className="bg-[#171717] border-white/10">
                          {modelsData?.map((model) => (
                            <DropdownMenuItem
                              key={model.id}
                              onClick={() => setSelectedModel(model.id)}
                              className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white cursor-pointer"
                            >
                              {model.display_name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="submit"
                        disabled={!input.trim() || isStreaming}
                        className="h-8 w-8 rounded-full bg-zinc-600 hover:bg-zinc-500 text-white disabled:opacity-50 disabled:bg-zinc-800 p-0 flex items-center justify-center transition-all shadow-none"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </form>
              </motion.div>



            </div>
          </motion.div>

        </main>
      </div>
    </SidebarProvider>
  );
}
