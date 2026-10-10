import { useState, useRef, useEffect, useMemo } from "react";
import { 
  ArrowUp, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Maximize2,
  Mic,
  MessageSquare,
  PanelLeftClose,
  ChevronDown,
  BrainCircuit,
  LogIn
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
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

type UIMessage = {
  id: string;
  role: "user" | "ai";
  content: string;
};

const SUGGESTIONS = [
  "Weather in Tokyo",
  "Show a sales dashboard",
  "Switch to dark mode",
  "Derive the geometric series",
  "Diagram a streaming chat app",
  "Add a thread list",
  "Remember my stack"
];

function AppSidebar({ 
  activeChatId, 
  onSelectChat,
  onNewThread
}: { 
  activeChatId: number | null; 
  onSelectChat: (id: number) => void;
  onNewThread: () => void;
}) {
  const { toggleSidebar } = useSidebar();
  const { user, logout } = useAuth();
  
  const { data: chatsData } = useQuery({
    queryKey: ["chats"],
    queryFn: () => chatApi.getChats()
  });

  const threads = chatsData?.items || [];

  return (
    <Sidebar className="border-r border-border bg-[#171717]">
      <SidebarHeader className="p-3 pb-2 pt-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MessageSquare className="h-4 w-4" />
          <span>assistant-ui</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={toggleSidebar}>
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </SidebarHeader>
      
      <SidebarContent className="px-3 py-2">
        <Button 
          variant="outline" 
          onClick={onNewThread}
          className="w-full justify-start h-9 mb-3 border-white/10 bg-transparent hover:bg-white/5 font-normal text-sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          New thread
        </Button>
        
        <div className="relative mb-6">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search threads" 
            className="w-full pl-9 h-9 bg-transparent border-white/10 focus-visible:ring-1 focus-visible:ring-white/20 text-sm"
          />
        </div>

        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground mb-1 px-1">Earlier</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {threads.map((thread) => (
                <SidebarMenuItem key={thread.id}>
                  <SidebarMenuButton 
                    onClick={() => onSelectChat(thread.id)}
                    isActive={activeChatId === thread.id}
                    className="text-[13px] text-muted-foreground hover:text-foreground hover:bg-white/5 h-8 px-1 data-active:bg-white/10 data-active:text-white"
                  >
                    <span className="truncate">{thread.name || "New Chat"}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-3">
        {user ? (
          <Button variant="ghost" onClick={logout} className="w-full justify-start h-12 px-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5">
            <Avatar className="h-7 w-7 mr-3 bg-zinc-800">
              <AvatarFallback className="text-[10px] text-white uppercase">{user.name?.slice(0, 2) || "U"}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-zinc-200 truncate">{user.name || user.email}</span>
          </Button>
        ) : (
          <Button variant="ghost" className="w-full justify-start h-9 px-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5">
            <LogIn className="mr-2 h-4 w-4" />
            Sign in
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export default function Chat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4o");
  
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

  const currentModelName = modelsData?.find(m => m.id === selectedModel)?.display_name || "GPT-6 Luna";

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
          
          <header className="flex h-12 items-center justify-between px-4 z-10">
            <div className="text-sm font-medium text-foreground">
              New chat
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </header>

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
                      className="mb-8"
                    >
                      <div className="flex gap-4">
                        <Avatar className={msg.role === "ai" ? "bg-zinc-800" : "bg-zinc-700"}>
                          <AvatarFallback className="text-xs text-white">
                            {msg.role === "ai" ? "AI" : "ME"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-2 mt-1.5 text-sm text-zinc-200 whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <AnimatePresence>
                  {isStreaming && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex gap-4 mb-8"
                    >
                      <Avatar className="bg-zinc-800">
                        <AvatarFallback className="text-xs text-white">AI</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 flex items-center mt-1.5">
                        <div className="flex space-x-1 h-5 items-center">
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
                      How can I help you today?
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
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-400 hover:text-white hover:bg-white/10">
                        <Plus className="h-4 w-4" />
                      </Button>
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
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-400 hover:text-white hover:bg-white/10">
                        <Mic className="h-4 w-4" />
                      </Button>
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

              <AnimatePresence>
                {isInitialState && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="flex flex-wrap justify-center gap-2 mt-4"
                  >
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleSend(suggestion)}
                        className="px-3 py-1.5 text-[13px] border border-white/10 rounded-full text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </motion.div>
          
        </main>
      </div>
    </SidebarProvider>
  );
}
