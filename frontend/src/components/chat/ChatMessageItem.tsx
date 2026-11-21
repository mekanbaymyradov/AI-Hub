import { lazy, memo, Suspense, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCopy } from "@/hooks/use-copy";
import { type ModelPublic } from "@/api/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MENU_CONTENT, MENU_ITEM } from "./menu-styles";
import { type UIMessage } from "./types";

// Its own chunk, since KaTeX, highlight.js and the Markdown parser outweigh the
// rest of the chat page. Requested as soon as this module loads, so it downloads
// alongside the chat's history instead of after it.
const formattedMessageModule = import("./FormattedMessage");
const FormattedMessage = lazy(() =>
  formattedMessageModule.then((m) => ({ default: m.FormattedMessage }))
);

// Named after the API's tool chunks; the provider's native search and our fallback share a label.
const TOOL_LABELS = {
  get_weather: "message.tools.get_weather",
  get_current_time: "message.tools.get_current_time",
  web_search: "message.tools.web_search",
  search_web: "message.tools.search_web",
} as const;

// Its own useCopy, so copying the ID doesn't flip the message's Copy button.
function ErrorId({ id }: { id: string }) {
  const [copyState, copy] = useCopy();
  const { t } = useTranslation();
  const label =
    copyState === "copied"
      ? t("message.copied")
      : copyState === "failed"
        ? t("message.copyFailed")
        : t("message.copy");

  return (
    <div className="flex items-center gap-1 mt-1.5 text-xs text-fg-8">
      <span className="min-w-0 break-all">
        {t("message.errorId")}: <code className="font-mono select-all">{id}</code>
      </span>
      <button
        type="button"
        onClick={() => void copy(id)}
        className="inline-flex shrink-0 items-center justify-center size-6 pointer-coarse:size-10 rounded-md hover:text-fg-5 hover:bg-fill-3 transition-colors cursor-pointer select-none"
        title={label}
        aria-label={label}
      >
        {copyState === "copied" ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : copyState === "failed" ? (
          <X className="h-3.5 w-3.5 text-red-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

interface ChatMessageItemProps {
  message: UIMessage;
  isStreaming?: boolean;
  isLastMessage?: boolean;
  /** The tool the model is running for this reply, if any. */
  activeTool?: string | null;
  models?: ModelPublic[];
  lastPromptHasAttachments?: boolean;
  onRetry?: (targetModelId?: string) => void;
  isFailedPrompt?: boolean;
  failedModelId?: string | null;
}

export const ChatMessageItem = memo(
  function ChatMessageItem({
    message,
    isStreaming = false,
    isLastMessage = false,
    activeTool = null,
    models,
    lastPromptHasAttachments = false,
    onRetry,
    isFailedPrompt = false,
    failedModelId = null,
  }: ChatMessageItemProps) {
    const [isReasoningOpen, setIsReasoningOpen] = useState(false);
    const [copyState, copy] = useCopy();
    const { t } = useTranslation();
    const isUser = message.role === "user";
    const isReasoningStreaming = Boolean(
      !isUser && isStreaming && isLastMessage && message.isReasoningStreaming
    );

    const handleCopy = useCallback(() => {
      if (message.content) void copy(message.content);
    }, [message.content, copy]);

    const modelDisplayName = message.modelId
      ? models?.find((m) => m.id === message.modelId)?.display_name
      : undefined;

    const targetModelId = isUser ? failedModelId : message.modelId;
    const otherModels = models ? models.filter((m) => m.id !== targetModelId) : [];

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
          <div className="group/user flex flex-col items-end max-w-[90%] sm:max-w-[80%] md:max-w-[75%] min-w-0">
            <div className="w-fit max-w-full min-w-0 self-end bg-blue-600 dark:bg-zinc-800 text-white dark:text-zinc-100 px-4 py-3 sm:px-5 sm:py-3.5 rounded-[20px] sm:rounded-[24px] text-[14px] sm:text-[15px] leading-relaxed shadow-sm shadow-blue-500/10 dark:shadow-none border border-transparent dark:border-zinc-700/60 flex flex-col gap-2.5">
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
                        className="relative group/att block rounded-xl overflow-hidden border border-white/20 hover:border-white/40 transition-all max-w-[180px] sm:max-w-[220px] max-h-[160px] bg-black/40"
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
              <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</div>
            </div>

            <div
              className={cn(
                "flex flex-wrap items-center gap-1.5 mt-1.5 mr-1",
                !isFailedPrompt && "opacity-0 pointer-coarse:opacity-100 group-hover/user:opacity-100 transition-opacity"
              )}
            >
              {isFailedPrompt && onRetry && (
                <>
                  <button
                    type="button"
                    onClick={() => onRetry(failedModelId || undefined)}
                    disabled={isStreaming}
                    className="inline-flex items-center justify-center size-7 pointer-coarse:size-10 rounded-lg border border-line-2 bg-tile hover:bg-zinc-50 dark:hover:bg-zinc-800 text-fg-6 hover:text-fg-2 transition-colors disabled:opacity-50 cursor-pointer select-none shadow-2xs"
                    title={t("message.retry")}
                    aria-label={t("message.retry")}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>

                  {otherModels.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        openOnHover
                        delay={80}
                        closeDelay={150}
                        render={
                          <button
                            type="button"
                            disabled={isStreaming}
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-line-2 bg-tile hover:bg-zinc-50 dark:hover:bg-zinc-800 text-fg-4 font-medium text-xs transition-colors cursor-pointer disabled:opacity-50 select-none shadow-2xs"
                          >
                            <span>{t("message.tryAnotherModel")}</span>
                            <ChevronDown className="h-3 w-3 opacity-60" />
                          </button>
                        }
                      />
                      <DropdownMenuContent side="bottom" align="end" sideOffset={6} className={cn(MENU_CONTENT, "w-52 p-1")}>
                        <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          {t("message.retryWith")}
                        </div>
                        {otherModels.map((model) => {
                          const fileIncompatible = Boolean(lastPromptHasAttachments && !model.supports_files);
                          return (
                            <DropdownMenuItem
                              key={model.id}
                              disabled={fileIncompatible}
                              onClick={() => onRetry(model.id)}
                              className={cn(
                                MENU_ITEM,
                                "justify-between py-1.5 text-xs",
                                fileIncompatible && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <span className="truncate">{model.display_name}</span>
                              {fileIncompatible && (
                                <span className="text-[10px] text-fg-8 shrink-0">{t("message.noFiles")}</span>
                              )}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              )}

              {message.content && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center justify-center size-7 pointer-coarse:size-10 rounded-lg text-zinc-400 hover:text-fg-5 hover:bg-fill-3 transition-colors cursor-pointer select-none"
                  title={copyState === "failed" ? t("message.copyFailed") : t("message.copyMessage")}
                >
                  {copyState === "copied" ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : copyState === "failed" ? (
                    <X className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-2.5 sm:gap-4 w-full min-w-0 max-w-full overflow-clip">
            <span className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 mt-1 dark:border-white/10 dark:bg-zinc-900">
              <img src="/favicon.svg" alt="AI-Hub" className="size-4 sm:size-5 object-contain" />
            </span>
            <div className="flex-1 min-w-0 max-w-full overflow-clip mt-1 text-[14px] sm:text-[15px] text-zinc-800 dark:text-zinc-300 leading-relaxed">
              {message.reasoning && (
                <div className="mb-2.5">
                  <button
                    type="button"
                    onClick={() => setIsReasoningOpen((open) => !open)}
                    aria-expanded={isReasoningOpen}
                    className="inline-flex items-center gap-1.5 py-1 px-2 -ml-2 rounded-lg text-xs font-medium text-fg-7 hover:text-fg-3 hover:bg-fill-2 transition-colors cursor-pointer select-none"
                  >
                    <Brain
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isReasoningStreaming
                          ? "text-blue-600 dark:text-blue-400 animate-pulse"
                          : "text-fg-8"
                      )}
                    />
                    <span>{isReasoningStreaming ? t("message.thinking") : t("message.thoughtProcess")}</span>
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
                        <div className="mt-1 mb-1.5 border-l-2 border-zinc-200 dark:border-zinc-700/80 pl-3.5 py-1 text-[13px] text-fg-6 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                          {message.reasoning}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {message.content ? (
                <Suspense
                  fallback={
                    <p className="my-1.5 leading-relaxed text-[14px] sm:text-[15px] text-fg-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {message.content}
                    </p>
                  }
                >
                  <FormattedMessage
                    content={message.content}
                    isStreaming={isStreaming && isLastMessage}
                  />
                </Suspense>
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
                <div className={cn("flex flex-wrap items-center gap-2", message.content && "mt-2.5")}>
                  <div className="inline-flex items-start gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 dark:bg-red-500/15 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium shadow-2xs max-w-full">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span className="break-words leading-relaxed">
                      {message.error}
                    </span>
                  </div>

                  {modelDisplayName && (
                    <span className="ml-auto text-xs text-fg-8 select-none font-normal">
                      {modelDisplayName}
                    </span>
                  )}
                </div>
              )}

              {message.error && message.errorId && <ErrorId id={message.errorId} />}

              {activeTool && (
                <div className="flex items-center gap-2 h-6 px-1 text-sm text-fg-7">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <span>
                    {activeTool in TOOL_LABELS
                      ? t(TOOL_LABELS[activeTool as keyof typeof TOOL_LABELS])
                      : t("message.tools.other", { tool: activeTool })}
                  </span>
                </div>
              )}

              {!isStreaming && !message.error && message.content && (
                <div className="flex flex-wrap items-center gap-2 mt-2 text-fg-8">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 pointer-coarse:min-h-10 rounded-lg hover:bg-fill-1 hover:text-fg-4 transition-colors text-xs font-medium cursor-pointer select-none"
                    title={t("message.copyResponse")}
                  >
                    {copyState === "copied" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-500" />
                        <span className="text-xs text-green-500">{t("message.copied")}</span>
                      </>
                    ) : copyState === "failed" ? (
                      <>
                        <X className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-xs text-red-500">{t("message.copyFailed")}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span className="text-xs">{t("message.copy")}</span>
                      </>
                    )}
                  </button>

                  {modelDisplayName && (
                    <span className="ml-auto text-xs text-fg-8 select-none font-normal">
                      {modelDisplayName}
                    </span>
                  )}
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
      prev.message.errorId === next.message.errorId &&
      prev.message.attachments === next.message.attachments &&
      prev.message.modelId === next.message.modelId &&
      prev.isStreaming === next.isStreaming &&
      prev.isLastMessage === next.isLastMessage &&
      prev.activeTool === next.activeTool &&
      prev.models === next.models &&
      prev.lastPromptHasAttachments === next.lastPromptHasAttachments &&
      prev.onRetry === next.onRetry &&
      prev.isFailedPrompt === next.isFailedPrompt &&
      prev.failedModelId === next.failedModelId
    );
  }
);
