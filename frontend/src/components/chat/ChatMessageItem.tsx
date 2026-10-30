import { memo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Brain, ChevronRight, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormattedMessage } from "./FormattedMessage";
import { type UIMessage } from "./types";

// Named after the API's tool chunks; native and DuckDuckGo search share a label.
const TOOL_LABELS: Record<string, string> = {
  get_weather: "Checking the weather…",
  get_current_time: "Checking the time…",
  web_search: "Searching the web…",
  duckduckgo_search: "Searching the web…",
};

interface ChatMessageItemProps {
  message: UIMessage;
  isStreaming?: boolean;
  isLastMessage?: boolean;
  /** The tool the model is running for this reply, if any. */
  activeTool?: string | null;
}

export const ChatMessageItem = memo(
  function ChatMessageItem({
    message,
    isStreaming = false,
    isLastMessage = false,
    activeTool = null,
  }: ChatMessageItemProps) {
    const [userReasoningOpen, setUserReasoningOpen] = useState<boolean | null>(null);
    const isUser = message.role === "user";
    const isReasoningStreaming = Boolean(
      !isUser && isStreaming && isLastMessage && message.isReasoningStreaming
    );
    // Auto-expand while actively thinking, then auto-collapse once the answer starts unless toggled.
    const isReasoningOpen = userReasoningOpen ?? (isReasoningStreaming && !message.content);

    const showStreamingDots =
      !isUser &&
      isStreaming &&
      isLastMessage &&
      !message.content &&
      !message.reasoning &&
      !activeTool &&
      !message.error;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cn("flex w-full mb-8", isUser ? "justify-end" : "justify-start")}
      >
        {isUser ? (
          <div className="max-w-[75%] bg-blue-600 dark:bg-zinc-800 text-white dark:text-zinc-100 px-5 py-3.5 rounded-[24px] text-[15px] leading-relaxed shadow-sm shadow-blue-500/10 dark:shadow-none border border-transparent dark:border-zinc-700/60 flex flex-col gap-2.5">
            {!!message.attachments?.length && (
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
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 mt-1 dark:border-white/10 dark:bg-zinc-900">
              <img src="/favicon.svg" alt="AI-Hub" className="size-5 object-contain" />
            </span>
            <div className="flex-1 min-w-0 mt-1 text-[15px] text-zinc-800 dark:text-zinc-300 leading-relaxed">
              {message.reasoning && (
                <div className="mb-2.5">
                  <button
                    type="button"
                    onClick={() => setUserReasoningOpen(!isReasoningOpen)}
                    aria-expanded={isReasoningOpen}
                    className="inline-flex items-center gap-1.5 py-1 px-2 -ml-2 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer select-none"
                  >
                    <Brain
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isReasoningStreaming
                          ? "text-blue-600 dark:text-blue-400 animate-pulse"
                          : "text-zinc-400 dark:text-zinc-500"
                      )}
                    />
                    <span>{isReasoningStreaming ? "Thinking…" : "Thought process"}</span>
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 text-zinc-400 transition-transform duration-200",
                        isReasoningOpen && "rotate-90"
                      )}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isReasoningOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1 mb-1.5 border-l-2 border-zinc-200 dark:border-zinc-700/80 pl-3.5 py-1 text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
                          {message.reasoning}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {message.content ? (
                <FormattedMessage
                  content={message.content}
                  isStreaming={isStreaming && isLastMessage}
                />
              ) : showStreamingDots ? (
                <div className="flex space-x-1.5 h-6 items-center px-1">
                  {[0, 0.2, 0.4].map((delay) => (
                    <motion.div
                      key={delay}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay }}
                      className="w-1.5 h-1.5 bg-blue-600 dark:bg-zinc-500 rounded-full"
                    />
                  ))}
                </div>
              ) : null}

              {message.error && (
                <div className="my-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{message.error}</div>
                </div>
              )}

              {activeTool && (
                <div className="flex items-center gap-2 h-6 px-1 text-sm text-zinc-500 dark:text-zinc-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <span>{TOOL_LABELS[activeTool] ?? `Using ${activeTool}…`}</span>
                </div>
              )}
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
      prev.message.reasoning === next.message.reasoning &&
      prev.message.isReasoningStreaming === next.message.isReasoningStreaming &&
      prev.message.error === next.message.error &&
      prev.message.attachments === next.message.attachments &&
      prev.isStreaming === next.isStreaming &&
      prev.isLastMessage === next.isLastMessage &&
      prev.activeTool === next.activeTool
    );
  }
);
