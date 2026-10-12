import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { SidebarProvider } from "@/components/ui/sidebar";
import { chatApi } from "@/api/chat";
import { useAuth } from "@/context/AuthContext";
import { type AttachmentPublic } from "@/api/types";

import { AppSidebar } from "@/components/chat/AppSidebar";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatGreeting } from "@/components/chat/ChatGreeting";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { type UIMessage } from "@/components/chat/types";

export default function Chat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const isStreamingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [activeChatId, setActiveChatId] = useState<number | null>(null);

  const { data: chatsData } = useQuery({
    queryKey: ["chats"],
    queryFn: () => chatApi.getChats(),
  });

  const currentChatTitle = activeChatId
    ? chatsData?.items.find((t) => t.id === activeChatId)?.name || "Conversation"
    : undefined;

  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["chat-messages", activeChatId],
    queryFn: () => chatApi.getChatMessages(activeChatId!),
    enabled: !!activeChatId,
  });

  useEffect(() => {
    if (historyData && !isStreamingRef.current) {
      const sorted = [...historyData.items].sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.id - b.id;
      });

      const uiMsgs: UIMessage[] = sorted.map((m) => ({
        id: m.id.toString(),
        role: m.kind === "response" ? "ai" : "user",
        content: m.content,
        attachments: m.attachments || [],
        created_at: m.created_at,
        model_id: m.model_id,
      }));

      setMessages(uiMsgs);
    }
  }, [historyData]);

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    isStreamingRef.current = false;
  }, []);

  const handleSelectChat = useCallback((id: number) => {
    if (id === activeChatId) return;
    handleStopGeneration();
    setActiveChatId(id);
    setMessages([]);
  }, [activeChatId, handleStopGeneration]);

  const handleNewThread = useCallback(() => {
    handleStopGeneration();
    setActiveChatId(null);
    setMessages([]);
  }, [handleStopGeneration]);

  const handleSend = async (
    text: string,
    attachments: AttachmentPublic[],
    modelId: string
  ) => {
    if ((!text.trim() && attachments.length === 0) || isStreaming) return;

    const sendText = text.trim() || (attachments.length > 0 ? "Attached files" : "");
    const currentAttachments = [...attachments];
    const currentAttachmentIds = currentAttachments.map((a) => a.id);

    const userMessage: UIMessage = {
      id: Date.now().toString(),
      role: "user",
      content: sendText,
      attachments: currentAttachments,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);

    setIsStreaming(true);
    isStreamingRef.current = true;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let streamBuffer = "";
    const aiMessageId = (Date.now() + 1).toString();

    setMessages((prev) => [
      ...prev,
      {
        id: aiMessageId,
        role: "ai",
        content: "",
        created_at: new Date().toISOString(),
      },
    ]);

    let resolvedChatId = activeChatId;

    await chatApi.streamMessage(
      {
        chat_id: activeChatId || undefined,
        model_id: modelId,
        prompt: sendText,
        attachment_ids: currentAttachmentIds,
      },
      {
        onChatId: (newChatId) => {
          resolvedChatId = newChatId;
          if (!activeChatId) {
            setActiveChatId(newChatId);
            queryClient.invalidateQueries({ queryKey: ["chats"] });
          }
        },
        onChunk: (chunk) => {
          streamBuffer += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId ? { ...msg, content: streamBuffer } : msg
            )
          );
        },
        onError: (err) => {
          setIsStreaming(false);
          isStreamingRef.current = false;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? {
                    ...msg,
                    content: streamBuffer
                      ? `${streamBuffer}\n\n**Error:** ${err}`
                      : `**Error:** ${err}`,
                  }
                : msg
            )
          );
        },
        onComplete: () => {
          setIsStreaming(false);
          isStreamingRef.current = false;
          queryClient.invalidateQueries({ queryKey: ["chats"] });
          if (resolvedChatId) {
            queryClient.invalidateQueries({
              queryKey: ["chat-messages", resolvedChatId],
            });
          }
        },
      },
      controller.signal
    );
  };

  const isInitialState = activeChatId === null && messages.length === 0 && !isStreaming;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-zinc-50/70 dark:bg-[#0a0a0a] text-zinc-900 dark:text-foreground font-sans overflow-hidden transition-colors duration-200">
        <AppSidebar
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onNewThread={handleNewThread}
        />

        <main className="flex flex-col flex-1 min-w-0 relative">
          <ChatHeader chatTitle={currentChatTitle} />

          <ChatMessageList
            messages={messages}
            isLoadingHistory={isLoadingHistory}
            activeChatId={activeChatId}
            isStreaming={isStreaming}
          />

          <ChatInput
            onSend={handleSend}
            onStop={handleStopGeneration}
            isStreaming={isStreaming}
            isInitialState={isInitialState}
            greetingNode={
              <ChatGreeting userName={user?.name} userEmail={user?.email} />
            }
          />
        </main>
      </div>
    </SidebarProvider>
  );
}
