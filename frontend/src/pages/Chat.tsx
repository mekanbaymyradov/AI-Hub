import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { SidebarProvider } from "@/components/ui/sidebar";
import { chatApi } from "@/api/chat";
import { queryKeys, useChatMessages, useChats, useModels } from "@/api/queries";
import { type ModelPublic } from "@/api/types";

import { AppSidebar } from "@/components/chat/AppSidebar";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatInput, type OutgoingMessage } from "@/components/chat/ChatInput";
import { NamePromptModal } from "@/components/chat/NamePromptModal";
import { type UIMessage } from "@/components/chat/types";

// Ids for messages shown before the API has saved them; history reloads replace them with real ids.
let nextLocalId = 0;
const localId = () => `local-${nextLocalId++}`;

function getNextModel(
  allModels: ModelPublic[],
  currentModelId: string,
  triedModelIds: Set<string>,
  requireFileSupport: boolean
): ModelPublic | null {
  if (allModels.length <= 1) return null;

  const currentIndex = allModels.findIndex((m) => m.id === currentModelId);
  const reordered =
    currentIndex >= 0
      ? [...allModels.slice(currentIndex + 1), ...allModels.slice(0, currentIndex)]
      : allModels;

  return (
    reordered.find(
      (m) =>
        !triedModelIds.has(m.id) &&
        (!requireFileSupport || m.supports_files !== false)
    ) ?? null
  );
}

export default function Chat() {
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const isStreamingRef = useRef(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const { data: models = [] } = useModels();
  const modelsRef = useRef(models);
  modelsRef.current = models;

  // The open chat lives in the URL, so a reload or a shared link reopens it.
  const navigate = useNavigate();
  const { chatId } = useParams();
  const activeChatId = chatId === undefined ? null : Number(chatId);
  // The chat the current stream just created. Moving to its URL must keep the reply that is still streaming.
  const createdChatIdRef = useRef<number | null>(null);

  const { data: chatsData } = useChats();

  const currentChatTitle = activeChatId
    ? chatsData?.pages.flatMap((page) => page.items).find((chat) => chat.id === activeChatId)?.name ??
      "Conversation"
    : undefined;

  const messagesQuery = useChatMessages(activeChatId);
  const historyData = messagesQuery.data;

  // A deleted, foreign or malformed chat id falls back to a new chat.
  const errorStatus = isAxiosError(messagesQuery.error) ? messagesQuery.error.response?.status : undefined;
  const chatNotFound = errorStatus === 404 || errorStatus === 422;
  useEffect(() => {
    if (chatNotFound) navigate("/", { replace: true });
  }, [chatNotFound, navigate]);

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    isStreamingRef.current = false;
    setActiveTool(null);
  }, []);

  // Runs before the history effect below, so a cached chat's messages replace the cleared ones.
  useEffect(() => {
    if (activeChatId !== null && activeChatId === createdChatIdRef.current) {
      createdChatIdRef.current = null;
      return;
    }
    handleStopGeneration();
    setMessages([]);
  }, [activeChatId, handleStopGeneration]);

  useEffect(() => {
    if (historyData && !isStreamingRef.current) {
      // The first page holds the newest messages, and each page reads oldest first.
      const history = historyData.pages.toReversed().flatMap((page) => page.items);

      const uiMsgs: UIMessage[] = history.map((m) => ({
        id: m.id.toString(),
        role: m.kind === "response" ? "ai" : "user",
        content: m.content,
        attachments: m.attachments ?? [],
      }));

      setMessages(uiMsgs);
    }
  }, [historyData]);

  // Changing the URL is enough: the effect above stops the reply and clears the screen.
  const handleSelectChat = useCallback((id: number) => {
    if (id !== activeChatId) navigate(`/chats/${id}`);
  }, [activeChatId, navigate]);

  const handleNewThread = useCallback(() => {
    // Cleared here too: on "/" already, as after a first message that failed, the URL doesn't change.
    handleStopGeneration();
    setMessages([]);
    navigate("/");
  }, [handleStopGeneration, navigate]);

  const updateMessage = (id: string, change: Partial<UIMessage>) =>
    setMessages((prev) => prev.map((msg) => (msg.id === id ? { ...msg, ...change } : msg)));

  const handleSend = async ({ prompt, attachments, modelId, effort }: OutgoingMessage) => {
    if (isStreaming) return;

    const sendText = prompt || "Attached files";
    const replyId = localId();
    setMessages((prev) => [
      ...prev,
      { id: localId(), role: "user", content: sendText, attachments },
      { id: replyId, role: "ai", content: "" },
    ]);

    setIsStreaming(true);
    isStreamingRef.current = true;

    const triedModelIds = new Set<string>([modelId]);
    let currentModelId = modelId;
    let resolvedChatId = activeChatId;
    const hasAttachments = attachments.length > 0;
    let currentAttachmentIds = attachments.map((a) => a.id);

    while (true) {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let streamBuffer = "";
      let hasError = false;
      let errorMessage = "";

      await chatApi.streamMessage(
        {
          chat_id: resolvedChatId,
          model_id: currentModelId,
          prompt: sendText,
          attachment_ids: currentAttachmentIds,
          effort,
        },
        {
          onChatId: (newChatId) => {
            resolvedChatId = newChatId;
            currentAttachmentIds = [];
            if (!activeChatId) {
              createdChatIdRef.current = newChatId;
              // Replace, so Back doesn't return to the empty new-chat screen.
              navigate(`/chats/${newChatId}`, { replace: true });
              queryClient.invalidateQueries({ queryKey: queryKeys.chats });
            }
          },
          onTool: (name) => {
            // Text after the tool call continues in a new paragraph.
            if (streamBuffer && !streamBuffer.endsWith("\n")) {
              streamBuffer += "\n\n";
            }
            setActiveTool(name);
          },
          onChunk: (chunk) => {
            setActiveTool(null);
            streamBuffer += chunk;
            updateMessage(replyId, { content: streamBuffer });
          },
          onError: (error) => {
            hasError = true;
            errorMessage = error;
          },
        },
        controller.signal
      );

      if (controller.signal.aborted) {
        setActiveTool(null);
        setIsStreaming(false);
        isStreamingRef.current = false;
        break;
      }

      if (hasError) {
        const nextModel = getNextModel(
          modelsRef.current,
          currentModelId,
          triedModelIds,
          hasAttachments
        );
        if (nextModel) {
          triedModelIds.add(nextModel.id);
          currentModelId = nextModel.id;
          setSelectedModelId(nextModel.id);

          setActiveTool(null);
          streamBuffer = "";
          updateMessage(replyId, { content: "", error: undefined });
          continue;
        } else {
          setActiveTool(null);
          setIsStreaming(false);
          isStreamingRef.current = false;
          updateMessage(replyId, { error: errorMessage });
          break;
        }
      }

      setActiveTool(null);
      setIsStreaming(false);
      isStreamingRef.current = false;
      queryClient.invalidateQueries({ queryKey: queryKeys.chats });
      if (resolvedChatId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(resolvedChatId) });
      }
      break;
    }
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
            isLoadingHistory={messagesQuery.isLoading}
            activeChatId={activeChatId}
            isStreaming={isStreaming}
            activeTool={activeTool}
            olderMessages={messagesQuery}
          />

          <ChatInput
            onSend={handleSend}
            onStop={handleStopGeneration}
            isStreaming={isStreaming}
            isInitialState={isInitialState}
            selectedModelId={selectedModelId}
            onSelectModelId={setSelectedModelId}
          />
        </main>
      </div>

      <NamePromptModal />
    </SidebarProvider>
  );
}
