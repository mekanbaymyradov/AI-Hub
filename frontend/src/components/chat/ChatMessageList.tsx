import React, { useRef, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessageItem } from "./ChatMessageItem";
import { type UIMessage } from "./types";

interface ChatMessageListProps {
  messages: UIMessage[];
  isLoadingHistory: boolean;
  activeChatId: number | null;
  isStreaming: boolean;
}

export function ChatMessageList({
  messages,
  isLoadingHistory,
  activeChatId,
  isStreaming,
}: ChatMessageListProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (smooth = false) => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"], [data-radix-scroll-area-viewport]'
      );
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: smooth ? "smooth" : "auto",
        });
        return;
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [messages, isStreaming]);

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
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => (
                <ChatMessageItem
                  key={msg.id}
                  message={msg}
                  isStreaming={isStreaming}
                  isLastMessage={index === messages.length - 1}
                />
              ))}
            </AnimatePresence>
          )}

          <div ref={messagesEndRef} className="h-px" />
        </div>
      </ScrollArea>
    </div>
  );
}
