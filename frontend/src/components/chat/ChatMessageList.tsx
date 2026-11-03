import { useRef, useLayoutEffect, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowDown, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLoadMore, type PageLoader } from "@/hooks/use-load-more";
import { type ModelPublic } from "@/api/types";
import { ChatMessageItem } from "./ChatMessageItem";
import { type UIMessage } from "./types";

interface ChatMessageListProps {
  messages: UIMessage[];
  isLoadingHistory: boolean;
  activeChatId: number | null;
  isStreaming: boolean;
  activeTool: string | null;
  olderMessages: PageLoader;
  models?: ModelPublic[];
  lastPromptHasAttachments?: boolean;
  onRetry?: (targetModelId?: string) => void;
}

export function ChatMessageList({
  messages,
  isLoadingHistory,
  activeChatId,
  isStreaming,
  activeTool,
  olderMessages,
  models,
  lastPromptHasAttachments,
  onRetry,
}: ChatMessageListProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const loadOlderRef = useLoadMore(olderMessages);
  // What the list looked like at the last render, to tell older messages
  // arriving at the top from the conversation moving on at the bottom.
  const previous = useRef<{
    firstId?: string;
    lastId?: string;
    lastPromptId?: string;
    scrollHeight: number;
  }>({ scrollHeight: 0 });
  // Follow the reply only while the reader is at the bottom, so scrolling up to reread isn't undone.
  const pinnedRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const getViewport = () =>
    scrollAreaRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');

  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;
    const onScroll = () => {
      const pinned = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80;
      pinnedRef.current = pinned;
      setShowJump(!pinned);
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;

    const firstId = messages[0]?.id;
    const lastId = messages[messages.length - 1]?.id;
    // A new prompt, whether just sent or from another chat being opened.
    const lastPromptId = messages.findLast((m) => m.role === "user")?.id;
    const olderLoaded =
      previous.current.firstId !== undefined &&
      firstId !== previous.current.firstId &&
      lastId === previous.current.lastId;

    if (olderLoaded) {
      // Keep the reader on the message they were reading.
      viewport.scrollTop += viewport.scrollHeight - previous.current.scrollHeight;
    } else if (pinnedRef.current || lastPromptId !== previous.current.lastPromptId) {
      pinnedRef.current = true;
      viewport.scrollTo({ top: viewport.scrollHeight });
    }
    previous.current = { firstId, lastId, lastPromptId, scrollHeight: viewport.scrollHeight };
  }, [messages, isStreaming, activeTool]);

  const jumpToLatest = () => {
    const viewport = getViewport();
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  };

  return (
    <div className="flex-1 w-full min-w-0 overflow-hidden">
      <ScrollArea className="h-full w-full px-3 sm:px-4" ref={scrollAreaRef}>
        <div className="w-full max-w-3xl mx-auto min-w-0 pb-36 sm:pb-44 pt-4 sm:pt-6">
          {activeChatId !== null && isLoadingHistory && messages.length === 0 ? (
            <div className="flex items-center justify-center py-24 text-zinc-500 dark:text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2 text-blue-600" />
              <span className="text-sm">Loading conversation...</span>
            </div>
          ) : (
            <>
              {activeChatId !== null && (
                <div ref={loadOlderRef} aria-hidden="true" className="flex justify-center h-6">
                  {olderMessages.isFetchingNextPage && (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                  )}
                </div>
              )}
              <AnimatePresence initial={false}>
                {messages.map((msg, index) => {
                  const isLastMessage = index === messages.length - 1;
                  const nextMsg = messages[index + 1];
                  const isFailedPrompt = Boolean(
                    msg.role === "user" &&
                    nextMsg?.role === "ai" &&
                    Boolean(nextMsg.error) &&
                    (index === messages.length - 2 || index === messages.length - 1)
                  );
                  const failedModelId = isFailedPrompt ? nextMsg?.modelId : undefined;

                  return (
                    <ChatMessageItem
                      key={msg.id}
                      message={msg}
                      isStreaming={isStreaming}
                      isLastMessage={isLastMessage}
                      activeTool={isLastMessage ? activeTool : null}
                      models={models}
                      lastPromptHasAttachments={lastPromptHasAttachments}
                      onRetry={onRetry}
                      isFailedPrompt={isFailedPrompt}
                      failedModelId={failedModelId}
                    />
                  );
                })}
              </AnimatePresence>
            </>
          )}
        </div>
      </ScrollArea>
      {showJump && messages.length > 0 && (
        <button
          type="button"
          onClick={jumpToLatest}
          aria-label="Jump to latest message"
          className="absolute z-10 left-1/2 -translate-x-1/2 bottom-36 sm:bottom-44 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-md hover:text-zinc-900 dark:border-white/10 dark:bg-[#171717] dark:text-zinc-300 dark:hover:text-white cursor-pointer"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
