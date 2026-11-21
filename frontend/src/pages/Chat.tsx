import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { useTranslation } from "react-i18next";
import { isAxiosError } from "axios";

import { SidebarProvider } from "@/components/ui/sidebar";
import { chatTransport } from "@/api/chat";
import { getErrorMessage, getErrorTraceId } from "@/api/errors";
import { type Effort } from "@/api/types";
import { useStoredState } from "@/hooks/use-stored-state";
import {
  prependChatToCache,
  queryKeys,
  seedEmptyChatMessagesCache,
  touchChatInCache,
  updateChatNameInCache,
  useChatMessages,
  useChats,
  useModels,
} from "@/api/queries";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppSidebar } from "@/components/chat/AppSidebar";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatInput, type OutgoingMessage } from "@/components/chat/ChatInput";
import { NamePromptModal } from "@/components/chat/NamePromptModal";
import {
  getActiveToolName,
  messagePublicToChatUIMessage,
  toRenderableUIMessage,
  type ChatUIMessage,
  type SendRequestMetadata,
  type UIMessage,
} from "@/components/chat/types";

export default function Chat() {
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  // Saved, so a returning user finds the model and effort they last picked.
  const [selectedModelId, setSelectedModelId] = useStoredState<string | null>(
    "ai_hub_model",
    null,
    (value): value is string | null => typeof value === "string" || value === null
  );
  // Kept here rather than in ChatInput so a retry answers with the same effort.
  const [effort, setEffort] = useStoredState<Effort | null>(
    "ai_hub_effort",
    null,
    (value): value is Effort | null => value === null || value === "low" || value === "medium" || value === "high"
  );
  const { data: models = [] } = useModels();
  // Read out by screen readers, which can't see the reply start, finish or fail.
  const [announcement, setAnnouncement] = useState("");
  // A saved model the API no longer offers falls back to the first, as ChatInput shows it.
  const activeModelId = models.some((m) => m.id === selectedModelId) ? selectedModelId : (models[0]?.id ?? null);

  // The open chat lives in the URL, so a reload or a shared link reopens it.
  const navigate = useNavigate();
  const { chatId } = useParams();
  const activeChatId = chatId === undefined ? null : Number(chatId);

  // The chat the current stream just created. Moving to its URL must keep the reply that is still streaming.
  const createdChatIdRef = useRef<number | null>(null);
  // Tracks the previous activeChatId so the reset effect only fires when the route chat actually changes.
  const prevActiveChatIdRef = useRef<number | null>(activeChatId);
  // Tracks which chat ID the active stream belongs to (for `data-chat-name` and cache invalidation).
  const streamChatIdRef = useRef<number | null>(activeChatId);
  // Tracks whether the current chat has new messages from this session that should refresh when leaving.
  const dirtyChatIdRef = useRef<number | null>(null);

  const {
    messages: chatMessages,
    setMessages,
    sendMessage,
    regenerate,
    stop,
    clearError,
    status,
    error,
  } = useChat<ChatUIMessage>({
    transport: chatTransport,
    // At most 20 renders a second: each re-renders the reply being streamed,
    // which costs more the longer it gets, and models send chunks faster.
    throttle: 50,
    onData: (dataPart) => {
      if (dataPart.type === "data-chat-name" && streamChatIdRef.current !== null) {
        updateChatNameInCache(queryClient, streamChatIdRef.current, dataPart.data.name);
      }
    },
    onFinish: ({ isAbort, isError }) => {
      if (streamChatIdRef.current !== null) {
        dirtyChatIdRef.current = streamChatIdRef.current;
      }
      // i18n.t, not t: useChat keeps the callbacks from the first render, and t would keep its language.
      setAnnouncement(i18n.t(isError ? "chat.replyFailed" : isAbort ? "chat.replyStopped" : "chat.replyReady"));
    },
  });

  const isStreaming = status === "submitted" || status === "streaming";
  const isStreamingRef = useRef(isStreaming);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const { data: chatsData } = useChats();

  const currentChatTitle = activeChatId
    ? chatsData?.pages.flatMap((page) => page.items).find((chat) => chat.id === activeChatId)?.name ??
      t("chat.conversation")
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
    void stop();
  }, [stop]);

  // Runs before the history effect below, so a cached chat's messages replace the cleared ones.
  useEffect(() => {
    if (prevActiveChatIdRef.current === activeChatId) {
      return;
    }
    prevActiveChatIdRef.current = activeChatId;

    if (activeChatId !== null && activeChatId === createdChatIdRef.current) {
      createdChatIdRef.current = null;
      return;
    }
    createdChatIdRef.current = null;

    if (dirtyChatIdRef.current !== null && dirtyChatIdRef.current !== activeChatId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatMessages(dirtyChatIdRef.current),
      });
      dirtyChatIdRef.current = null;
    }

    streamChatIdRef.current = activeChatId;
    void stop();
    clearError();
    setMessages([]);
  }, [activeChatId, clearError, queryClient, setMessages, stop]);

  useEffect(() => {
    if (!historyData || isStreamingRef.current) return;

    // The first page holds the newest messages, and each page reads oldest first.
    const history = historyData.pages.toReversed().flatMap((page) => page.items);
    if (history.length === 0) return;

    const historyMessages = history.map(messagePublicToChatUIMessage);

    setMessages((prev) => {
      if (prev.length === 0) return historyMessages;

      const prevById = new Map(prev.map((m) => [m.id, m]));
      const historyIds = new Set(historyMessages.map((m) => m.id));
      const mergedHistory = historyMessages.map((m) => prevById.get(m.id) ?? m);
      // Preserve any messages streamed during this session that aren't in the paged history yet.
      const sessionTail = prev.filter((m) => !historyIds.has(m.id));
      return [...mergedHistory, ...sessionTail];
    });
  }, [historyData, setMessages]);

  // Changing the URL is enough: the effect above stops the reply and clears the screen.
  const handleSelectChat = useCallback(
    (id: number) => {
      if (id !== activeChatId) navigate(`/chats/${id}`);
    },
    [activeChatId, navigate]
  );

  const handleNewThread = useCallback(() => {
    // Cleared here too: on "/" already, as after a first message that failed, the URL doesn't change.
    if (dirtyChatIdRef.current !== null) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatMessages(dirtyChatIdRef.current),
      });
      dirtyChatIdRef.current = null;
    }
    streamChatIdRef.current = null;
    void stop();
    clearError();
    setMessages([]);
    navigate("/");
  }, [clearError, navigate, queryClient, setMessages, stop]);

  // The shortcut ChatGPT uses, so it's already familiar to many people.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // The physical key, so it works in any layout: in Russian, Ctrl+K types "л".
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === "KeyO") {
        e.preventDefault();
        handleNewThread();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNewThread]);

  const handleSend = async ({ prompt, attachments, modelId, effort }: OutgoingMessage) => {
    if (isStreaming) return;

    const sendText = prompt || t("chat.attachedFiles");
    clearError();
    setAnnouncement(t("chat.writingReply"));
    streamChatIdRef.current = activeChatId;

    if (activeChatId !== null) {
      touchChatInCache(queryClient, activeChatId);
    }

    const requestMetadata: SendRequestMetadata = {
      chatId: activeChatId,
      modelId,
      attachmentIds: attachments.map((a) => a.id),
      effort,
      models,
      onChatCreated: (newChat) => {
        createdChatIdRef.current = newChat.id;
        streamChatIdRef.current = newChat.id;
        dirtyChatIdRef.current = newChat.id;
        // Optimistically update the sidebar and seed the message cache before navigating,
        // so moving to `/chats/${newChat.id}` causes zero extra network requests or flicker.
        prependChatToCache(queryClient, newChat);
        seedEmptyChatMessagesCache(queryClient, newChat.id);
        // Replace, so Back doesn't return to the empty new-chat screen.
        navigate(`/chats/${newChat.id}`, { replace: true });
      },
    };

    await sendMessage(
      {
        text: sendText,
        metadata: { attachments },
      },
      {
        metadata: requestMetadata,
      }
    );
  };

  const handleRetry = useCallback(
    async (targetModelId?: string) => {
      if (isStreaming || activeChatId === null) return;

      const modelToUse = targetModelId || activeModelId;
      if (!modelToUse) return;

      clearError();
      setAnnouncement(t("chat.writingReply"));
      streamChatIdRef.current = activeChatId;
      touchChatInCache(queryClient, activeChatId);

      if (targetModelId && targetModelId !== selectedModelId) {
        setSelectedModelId(targetModelId);
      }

      const requestMetadata: SendRequestMetadata = {
        chatId: activeChatId,
        modelId: modelToUse,
        attachmentIds: [],
        effort,
        models,
      };

      await regenerate({
        metadata: requestMetadata,
      });
    },
    [isStreaming, activeChatId, activeModelId, selectedModelId, effort, models, clearError, queryClient, regenerate, setSelectedModelId, t]
  );

  const lastChatMessage = chatMessages[chatMessages.length - 1];
  const activeTool = isStreaming ? getActiveToolName(lastChatMessage) : null;
  const streamErrorText =
    status === "error" && error
      ? getErrorMessage(error, t("chat.streamFailed"))
      : undefined;
  const streamErrorId = status === "error" && error ? getErrorTraceId(error) : undefined;

  const lastPromptHasAttachments = useMemo(() => {
    const lastUserMsg = [...chatMessages].reverse().find((m) => m.role === "user");
    return Boolean(lastUserMsg?.metadata?.attachments && lastUserMsg.metadata.attachments.length > 0);
  }, [chatMessages]);

  const messages: UIMessage[] = useMemo(() => {
    const rendered = chatMessages.map((msg, idx) => {
      const isLastAssistant =
        idx === chatMessages.length - 1 && msg.role === "assistant";
      return isLastAssistant
        ? toRenderableUIMessage(msg, streamErrorText, streamErrorId)
        : toRenderableUIMessage(msg);
    });

    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg?.role === "user") {
      if (isStreaming) {
        // Show the assistant streaming placeholder immediately while POST /chats and stream headers are in flight.
        rendered.push({
          id: `${lastMsg.id}-pending`,
          role: "ai",
          content: "",
          modelId: activeModelId,
        });
      } else if (streamErrorText) {
        rendered.push({
          id: `${lastMsg.id}-error`,
          role: "ai",
          content: "",
          error: streamErrorText,
          errorId: streamErrorId,
          modelId: activeModelId,
        });
      }
    }

    return rendered;
  }, [chatMessages, isStreaming, streamErrorText, streamErrorId, activeModelId]);

  const isInitialState = activeChatId === null && messages.length === 0 && !isStreaming;
  const lastPrompt = messages.findLast((m) => m.role === "user")?.content;

  return (
    <SidebarProvider>
      <div className="flex h-full w-full bg-canvas text-zinc-900 dark:text-foreground font-sans overflow-hidden transition-colors duration-200">
        <AppSidebar
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onNewThread={handleNewThread}
        />

        <main className="flex flex-col flex-1 min-w-0 h-full overflow-hidden relative">
          <p role="status" className="sr-only">{announcement}</p>
          <ChatHeader chatId={activeChatId} chatTitle={currentChatTitle} onNewThread={handleNewThread} />

          {/* A crash in a message leaves the sidebar and input usable. */}
          <ErrorBoundary>
            <ChatMessageList
              messages={messages}
              isLoadingHistory={messagesQuery.isLoading}
              activeChatId={activeChatId}
              isStreaming={isStreaming}
              activeTool={activeTool}
              olderMessages={messagesQuery}
              models={models}
              lastPromptHasAttachments={lastPromptHasAttachments}
              onRetry={handleRetry}
            />
          </ErrorBoundary>

          <ChatInput
            chatId={activeChatId}
            lastPrompt={lastPrompt}
            onSend={handleSend}
            onStop={handleStopGeneration}
            isStreaming={isStreaming}
            isInitialState={isInitialState}
            selectedModelId={selectedModelId}
            onSelectModelId={setSelectedModelId}
            effort={effort}
            onEffortChange={setEffort}
          />
        </main>
      </div>

      <NamePromptModal />
    </SidebarProvider>
  );
}
