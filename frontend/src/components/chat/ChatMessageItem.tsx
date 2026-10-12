import React, { memo } from "react";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FormattedMessage } from "./FormattedMessage";
import { type UIMessage } from "./types";

interface ChatMessageItemProps {
  message: UIMessage;
  isStreaming?: boolean;
  isLastMessage?: boolean;
}

export const ChatMessageItem = memo(
  function ChatMessageItem({
    message,
    isStreaming = false,
    isLastMessage = false,
  }: ChatMessageItemProps) {
    const isUser = message.role === "user";
    const showStreamingDots = !isUser && isStreaming && isLastMessage && !message.content;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`flex w-full mb-8 ${isUser ? "justify-end" : "justify-start"}`}
      >
        {isUser ? (
          <div className="max-w-[75%] bg-blue-600 dark:bg-zinc-800 text-white dark:text-zinc-100 px-5 py-3.5 rounded-[24px] text-[15px] leading-relaxed shadow-sm shadow-blue-500/10 dark:shadow-none border border-transparent dark:border-zinc-700/60 flex flex-col gap-2.5">
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-0.5">
                {message.attachments.map((att) => {
                  const isImage = att.media_type.startsWith("image/");
                  return isImage ? (
                    <a
                      key={att.id}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative group/att block rounded-xl overflow-hidden border border-white/20 hover:border-white/40 transition-all max-w-[220px] max-h-[160px] bg-black/40"
                      title={att.filename}
                    >
                      <img
                        src={att.url}
                        alt={att.filename}
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <span className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur-xs text-[10px] text-zinc-200 px-2 py-0.5 truncate opacity-0 group-hover/att:opacity-100 transition-opacity">
                        {att.filename}
                      </span>
                    </a>
                  ) : (
                    <a
                      key={att.id}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl px-3 py-2 text-xs text-white transition-colors"
                      title={att.filename}
                    >
                      <FileText className="h-4 w-4 text-blue-200 dark:text-blue-400 shrink-0" />
                      <span className="truncate max-w-[160px] font-medium">{att.filename}</span>
                    </a>
                  );
                })}
              </div>
            )}
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>
        ) : (
          <div className="flex gap-4 w-full">
            <Avatar className="bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-white/10 mt-1 shrink-0 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <AvatarImage src="/favicon.svg" alt="AI-Hub" className="p-1.5 object-contain" />
              <AvatarFallback className="flex items-center justify-center size-full">
                <img src="/favicon.svg" alt="AI-Hub" className="h-4 w-4 object-contain" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 mt-1 text-[15px] text-zinc-800 dark:text-zinc-300 leading-relaxed">
              {message.content ? (
                <FormattedMessage
                  content={message.content}
                  isStreaming={isStreaming && isLastMessage}
                />
              ) : showStreamingDots ? (
                <div className="flex space-x-1.5 h-6 items-center px-1">
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                    className="w-1.5 h-1.5 bg-blue-600 dark:bg-zinc-500 rounded-full"
                  />
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                    className="w-1.5 h-1.5 bg-blue-600 dark:bg-zinc-500 rounded-full"
                  />
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                    className="w-1.5 h-1.5 bg-blue-600 dark:bg-zinc-500 rounded-full"
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </motion.div>
    );
  },
  (prev, next) => {
    return (
      prev.message.id === next.message.id &&
      prev.message.content === next.message.content &&
      prev.message.attachments === next.message.attachments &&
      prev.isStreaming === next.isStreaming &&
      prev.isLastMessage === next.isLastMessage
    );
  }
);
