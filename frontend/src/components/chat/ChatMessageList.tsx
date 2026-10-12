import { useRef, useLayoutEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLoadMore, type PageLoader } from "@/hooks/use-load-more";
import { ChatMessageItem } from "./ChatMessageItem";
import { type UIMessage } from "./types";

interface ChatMessageListProps {
  messages: UIMessage[];
  isLoadingHistory: boolean;
  activeChatId: number | null;
  isStreaming: boolean;
  activeTool: string | null;
  olderMessages: PageLoader;
}

export function ChatMessageList({
  messages,
  isLoadingHistory,
  activeChatId,
  isStreaming,
  activeTool,
  olderMessages,
}: ChatMessageListProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const loadOlderRef = useLoadMore(olderMessages);
  // What the list looked like at the last render, to tell older messages
  // arriving at the top from the conversation moving on at the bottom.
  const previous = useRef<{ firstId?: string; lastId?: string; scrollHeight: number }>({
    scrollHeight: 0,
  });

  useLayoutEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    if (!viewport) return;

    const firstId = messages[0]?.id;
    const lastId = messages[messages.length - 1]?.id;
    const olderLoaded =
      previous.current.firstId !== undefined &&
      firstId !== previous.current.firstId &&
      lastId === previous.current.lastId;

    if (olderLoaded) {
      // Keep the reader on the message they were reading.
      viewport.scrollTop += viewport.scrollHeight - previous.current.scrollHeight;
    } else {
      viewport.scrollTo({ top: viewport.scrollHeight });
    }
    previous.current = { firstId, lastId, scrollHeight: viewport.scrollHeight };
  }, [messages, isStreaming, activeTool]);

  return (
    <div className="flex-1 overflow-hidden">
      <ScrollArea className="h-full px-4" ref={scrollAreaRef}>
        <div className="max-w-3xl mx-auto pb-44 pt-6">
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
                  return (
                    <ChatMessageItem
                      key={msg.id}
                      message={msg}
                      isStreaming={isStreaming}
                      isLastMessage={isLastMessage}
                      activeTool={isLastMessage ? activeTool : null}
                    />
                  );
                })}
              </AnimatePresence>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
