import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { type TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { AlertCircle, ArrowUp, Check, FileText, Loader2, Mic, Paperclip, Square, WifiOff, X } from "lucide-react";

import { chatApi } from "@/api/chat";
import { getErrorMessage } from "@/api/errors";
import { useModels } from "@/api/queries";
import { type AttachmentPublic, type Effort } from "@/api/types";
import { cn } from "@/lib/utils";
import { draftKey, readDraft, saveDraft } from "@/lib/drafts";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOnline } from "@/hooks/use-online";
import { canRecordVoice, useVoiceInput } from "@/hooks/use-voice-input";
import { ChatGreeting } from "./ChatGreeting";
import { ModelPicker } from "./ModelPicker";
import { VoiceWaveform } from "./VoiceWaveform";

// The API's limits for attachments.
const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export interface OutgoingMessage {
  prompt: string;
  attachments: AttachmentPublic[];
  modelId: string;
  effort: Effort | null;
}

interface ChatInputProps {
  // Which chat the composer writes to, so each keeps its own draft; null is a new chat.
  chatId: number | null;
  // The last prompt sent in this chat, which Up in an empty composer brings back.
  lastPrompt?: string;
  onSend: (message: OutgoingMessage) => void;
  onStop: () => void;
  isStreaming: boolean;
  isInitialState: boolean;
  selectedModelId: string | null;
  onSelectModelId: (id: string) => void;
  effort: Effort | null;
  onEffortChange: (effort: Effort | null) => void;
}

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Return why these files can't be attached, or null when they can. */
function attachmentProblem(files: File[], alreadyAttached: number, t: TFunction): string | null {
  if (alreadyAttached + files.length > MAX_ATTACHMENTS) {
    return t("composer.tooManyFiles", { count: MAX_ATTACHMENTS });
  }
  for (const file of files) {
    if (!ATTACHMENT_TYPES.includes(file.type)) {
      return t("composer.unsupportedFile", { name: file.name });
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return t("composer.fileTooLarge", { name: file.name });
    }
  }
  return null;
}

export function ChatInput({
  chatId,
  lastPrompt,
  onSend,
  onStop,
  isStreaming,
  isInitialState,
  selectedModelId,
  onSelectModelId,
  effort,
  onEffortChange,
}: ChatInputProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const draft = draftKey(user?.id, chatId);
  const [input, setInput] = useState(() => readDraft(draft));
  // Swapped during the render that changes chats, so the old chat's text never shows in the new one.
  const [shownDraft, setShownDraft] = useState(draft);
  if (shownDraft !== draft) {
    setShownDraft(draft);
    setInput(readDraft(draft));
  }

  useEffect(() => {
    saveDraft(draft, input);
  }, [draft, input]);
  const [attachments, setAttachments] = useState<AttachmentPublic[]>([]);
  // Names of the files being uploaded, shown as chips until they land in attachments.
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
  const isUploadingAttachments = uploadingNames.length > 0;
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const isMobile = useIsMobile();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: models = [] } = useModels();
  // The user's pick, or the first model until they pick one that is still offered.
  const selectedModel = models.find((m) => m.id === selectedModelId) ?? models[0];
  const modelSupportsFiles = selectedModel?.supports_files ?? true;

  // Before paint, so the box never shows a frame at the old height; the CSS max-height caps it.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Ready to type on opening a chat, with the caret after any restored draft. Skipped on
  // touch screens, where focusing pops the keyboard over the conversation.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [draft]);

  const voice = useVoiceInput((text) => {
    setInput((prev) => (prev.trim() ? `${prev.trimEnd()} ${text}` : text));
    textareaRef.current?.focus();
  });
  const isDictating = voice.state === "recording" || voice.state === "transcribing";
  const error = voice.error ?? attachmentError;
  const isOnline = useOnline();

  const canAttach = !isUploadingAttachments && !isStreaming;

  const attachFiles = async (files: File[]) => {
    if (files.length === 0 || !canAttach) return;

    const problem = modelSupportsFiles
      ? attachmentProblem(files, attachments.length, t)
      : t("composer.modelRejectsFiles", { model: selectedModel?.display_name });
    setAttachmentError(problem);
    if (problem) return;

    setUploadingNames(files.map((f) => f.name));
    try {
      const uploaded = await chatApi.uploadAttachments(files);
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setAttachmentError(getErrorMessage(err, t("composer.uploadFailed")));
    } finally {
      setUploadingNames([]);
    }
  };

  const handleAttachmentChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // Cleared now, so choosing the same file again still fires a change.
    e.target.value = "";
    void attachFiles(files);
  };

  // Text pastes as usual; only pasted files become attachments.
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length === 0) return;
    e.preventDefault();
    void attachFiles(files);
  };

  const handleDragOver = (e: DragEvent<HTMLFormElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setIsDraggingFiles(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLFormElement>) => {
    // Moving onto a child element also fires dragleave on the form.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDraggingFiles(false);
  };

  const handleDrop = (e: DragEvent<HTMLFormElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    // Otherwise the browser navigates away to open the file.
    e.preventDefault();
    setIsDraggingFiles(false);
    void attachFiles(Array.from(e.dataTransfer.files));
  };

  const removeAttachment = (id: number) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setAttachmentError(null);
  };

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isStreaming || isUploadingAttachments || isDictating || !isOnline) return;
    if (!selectedModel) return;

    if (attachments.length > 0 && !modelSupportsFiles) {
      setAttachmentError(t("composer.pickFileModel", { model: selectedModel.display_name }));
      return;
    }

    setAttachmentError(null);
    onSend({ prompt: input.trim(), attachments, modelId: selectedModel.id, effort });
    setInput("");
    setAttachments([]);
  };

  const selectPrompt = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // An IME's Enter confirms the composed word, so it must not send.
    if (e.nativeEvent.isComposing) return;
    // Touch keyboards have no Shift, so Enter adds a line there and the button sends.
    if (e.key === "Enter" && !e.shiftKey && !window.matchMedia("(pointer: coarse)").matches) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape" && isStreaming) {
      e.preventDefault();
      onStop();
    } else if (e.key === "ArrowUp" && !input && lastPrompt) {
      e.preventDefault();
      setInput(lastPrompt);
    }
  };

  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col px-3 sm:px-4 z-0 pt-12 overflow-y-auto",
        isInitialState
          ? cn("pointer-events-auto", isMobile ? "justify-start pb-6" : "justify-center")
          : cn("pointer-events-none justify-end", isMobile ? "pb-3" : "pb-8"),
      )}
    >
      {/* Phones leave only a thin gap under the composer, so cover it instead of showing messages scroll through. */}
      {!isInitialState && isMobile && (
        <div className="absolute inset-x-0 bottom-0 h-12 bg-canvas" />
      )}
      <div className={cn("w-full max-w-2xl mx-auto flex flex-col pointer-events-auto", isInitialState && isMobile ? "mt-4 mb-6" : "")}>
        <AnimatePresence>{isInitialState && <ChatGreeting onSelectPrompt={selectPrompt} />}</AnimatePresence>

        {/* Only the position animates: animating size scales the box and stretches its text while it grows. */}
        <motion.div
          layout="position"
          // Measured only on this switch; otherwise the box would also slide each time it grows a line.
          layoutDependency={isInitialState}
          transition={{ type: "spring", duration: 0.45, bounce: 0 }}
          className="relative group w-full"
        >
          <form
            onSubmit={handleSubmit}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn("relative flex flex-col bg-composer border border-zinc-200/90 dark:border-white/10 rounded-[20px] sm:rounded-[24px] focus-within:ring-2 focus-within:ring-blue-500/20 dark:focus-within:ring-1 dark:focus-within:ring-blue-500/40 focus-within:border-blue-500/50 dark:focus-within:border-white/20 transition-[border-color,box-shadow] duration-200 overflow-hidden shadow-[0_10px_32px_-8px_rgb(24_24_27/0.14),0_2px_8px_-2px_rgb(24_24_27/0.06)] dark:shadow-2xl", isDraggingFiles && "border-blue-500 ring-2 ring-blue-500/30 dark:border-blue-500/60")}
          >
            {isDraggingFiles && (
              // Pointer events off, so drag events keep reaching the form underneath.
              <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-[inherit] bg-blue-500/10 backdrop-blur-[2px] text-sm font-medium text-blue-600 dark:text-blue-400 pointer-events-none">
                <Paperclip className="h-4 w-4" />
                {modelSupportsFiles ? t("composer.dropFiles") : t("composer.dropNotAccepted")}
              </div>
            )}
            {!isOnline && (
              <div role="status" className="flex items-start gap-1.5 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
                <WifiOff className="h-3.5 w-3.5 shrink-0 mt-px" />
                <span className="min-w-0">{t("composer.offline")}</span>
              </div>
            )}
            {error && (
              <div className="flex items-start justify-between bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-xs text-red-500 dark:text-red-400">
                <div className="flex items-start gap-1.5 min-w-0">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
                  <span className="break-words min-w-0">{error}</span>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  {voice.error && voice.canRetry && (
                    <button
                      type="button"
                      onClick={voice.retry}
                      className="font-medium hover:text-red-600 dark:hover:text-red-300 hover:underline underline-offset-2 cursor-pointer"
                    >
                      {t("common.retry")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={voice.error ? voice.dismissError : () => setAttachmentError(null)}
                    aria-label={t("common.dismiss")}
                    className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {(attachments.length > 0 || isUploadingAttachments) && (
              <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-1.5 bg-fill-1 hover:bg-zinc-200/80 dark:hover:bg-white/15 border border-line-1 rounded-lg pl-1 pr-2.5 py-1 text-xs text-fg-3 transition-colors"
                  >
                    {att.media_type.startsWith("image/") ? (
                      <img src={att.url} alt="" className="h-6 w-6 rounded object-cover shrink-0" />
                    ) : (
                      <FileText className="h-6 w-6 p-1 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                    <span className="truncate max-w-[140px]">{att.filename}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      aria-label={t("composer.removeFile", { name: att.filename })}
                      className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white ml-0.5 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {uploadingNames.map((name, i) => (
                  <div
                    key={`uploading-${i}`}
                    className="flex items-center gap-1.5 bg-fill-1 border border-line-1 rounded-lg pl-1 pr-2.5 py-1 text-xs text-fg-7"
                  >
                    <Loader2 className="h-6 w-6 p-1 animate-spin shrink-0" />
                    <span className="truncate max-w-[140px]">{name}</span>
                  </div>
                ))}
              </div>
            )}

            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={t("composer.placeholder")}
              className="min-h-11 max-h-[200px] sm:max-h-[260px] w-full resize-none overflow-y-auto border-0 rounded-none shadow-none focus-visible:ring-0 px-3.5 sm:px-4 pt-3.5 sm:pt-4 pb-1 text-base sm:text-[15px] bg-transparent dark:bg-transparent text-fg-1 placeholder:text-fg-8"
              rows={1}
            />

            {isDictating ? (
              <div className="flex items-center gap-2 px-2 pb-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("composer.cancelDictation")}
                  onClick={voice.cancel}
                  className="h-8 w-8 pointer-coarse:size-11 shrink-0 rounded-full text-fg-7 hover:text-fg-1 hover:bg-fill-1 dark:hover:bg-fill-1 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </Button>
                <VoiceWaveform
                  analyser={voice.analyser}
                  className={cn("h-7 min-w-0 flex-1 text-fg-3 transition-opacity", voice.state === "transcribing" && "opacity-40")}
                />
                <span className="shrink-0 text-xs tabular-nums text-fg-7">
                  {formatElapsed(voice.elapsed)}
                </span>
                <Button
                  type="button"
                  aria-label={voice.state === "transcribing" ? t("composer.transcribing") : t("composer.stopAndTranscribe")}
                  onClick={voice.finish}
                  disabled={voice.state === "transcribing"}
                  // Focused when the bar appears, since the mic button that had focus is gone.
                  autoFocus
                  className="h-8 w-8 pointer-coarse:size-11 shrink-0 rounded-full bg-blue-600 hover:bg-blue-700 text-white p-0 flex items-center justify-center transition-all shadow-sm shadow-blue-500/20 cursor-pointer disabled:opacity-80 disabled:cursor-default"
                >
                  {voice.state === "transcribing" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex justify-between items-center px-2 pb-2">
                <div className="flex items-center gap-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAttachmentChange}
                    accept={ATTACHMENT_TYPES.join(",")}
                    multiple
                    className="hidden"
                  />
                  <Tooltip>
                    <TooltipTrigger render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("composer.attach")}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!canAttach || !modelSupportsFiles}
                        className={cn(
                          "h-8 w-8 pointer-coarse:size-11 rounded-full text-fg-7 hover:text-fg-1 hover:bg-fill-1 dark:hover:bg-fill-1 transition-colors cursor-pointer",
                          !modelSupportsFiles && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-zinc-400"
                        )}
                      >
                        {isUploadingAttachments ? (
                          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                        ) : (
                          <Paperclip className="h-4 w-4" />
                        )}
                      </Button>
                    } />
                    <TooltipContent side="top" align="center">
                      <span>
                        {modelSupportsFiles
                          ? t("composer.attachHint", { count: MAX_ATTACHMENTS })
                          : t("composer.noFilesHint")}
                      </span>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex items-center gap-1.5">
                  <ModelPicker
                    models={models}
                    selected={selectedModel}
                    onSelect={onSelectModelId}
                    effort={effort}
                    onEffortChange={onEffortChange}
                    disabled={isStreaming}
                  />

                  {canRecordVoice && (
                    <Tooltip>
                      <TooltipTrigger render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("composer.dictate")}
                          onClick={voice.start}
                          disabled={voice.state === "starting"}
                          className="h-8 w-8 pointer-coarse:size-11 rounded-full text-fg-7 hover:text-fg-1 hover:bg-fill-1 dark:hover:bg-fill-1 transition-colors cursor-pointer"
                        >
                          {voice.state === "starting" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                          ) : (
                            <Mic className="h-4 w-4" />
                          )}
                        </Button>
                      } />
                      <TooltipContent side="top" align="center">
                        <span>{t("composer.dictate")}</span>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {isStreaming ? (
                    <Button
                      type="button"
                      onClick={onStop}
                      aria-label={t("composer.stop")}
                      aria-keyshortcuts="Escape"
                      title={t("composer.stopHint")}
                      className="h-8 w-8 pointer-coarse:size-11 rounded-full bg-red-600 hover:bg-red-500 text-white p-0 flex items-center justify-center transition-all shadow-none cursor-pointer"
                    >
                      <Square className="h-3 w-3 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      aria-label={t("composer.send")}
                      disabled={(!input.trim() && attachments.length === 0) || isUploadingAttachments || !isOnline}
                      className="h-8 w-8 pointer-coarse:size-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600 p-0 flex items-center justify-center transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </form>
        </motion.div>
      </div>
    </div>
  );
}
