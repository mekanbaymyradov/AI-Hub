import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowUp, FileText, Loader2, Paperclip, Square, X } from "lucide-react";

import { chatApi } from "@/api/chat";
import { getErrorMessage } from "@/api/errors";
import { useModels } from "@/api/queries";
import { type AttachmentPublic, type Effort } from "@/api/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatGreeting } from "./ChatGreeting";
import { EffortPicker } from "./EffortPicker";
import { ModelPicker } from "./ModelPicker";

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
  onSend: (message: OutgoingMessage) => void;
  onStop: () => void;
  isStreaming: boolean;
  isInitialState: boolean;
  selectedModelId?: string | null;
  onSelectModelId?: (id: string) => void;
  effort: Effort | null;
  onEffortChange: (effort: Effort | null) => void;
}

/** Return why these files can't be attached, or null when they can. */
function attachmentProblem(files: File[], alreadyAttached: number): string | null {
  if (alreadyAttached + files.length > MAX_ATTACHMENTS) {
    return `You can attach at most ${MAX_ATTACHMENTS} files per message.`;
  }
  for (const file of files) {
    if (!ATTACHMENT_TYPES.includes(file.type)) {
      return `Unsupported file "${file.name}". Only images (JPEG, PNG, WebP, GIF) and PDFs are allowed.`;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return `File "${file.name}" exceeds the 10 MiB size limit.`;
    }
  }
  return null;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  isInitialState,
  selectedModelId: controlledModelId,
  onSelectModelId,
  effort,
  onEffortChange,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AttachmentPublic[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [uncontrolledModelId, setUncontrolledModelId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const selectedModelId = controlledModelId !== undefined ? controlledModelId : uncontrolledModelId;
  const setSelectedModelId = onSelectModelId ?? setUncontrolledModelId;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: models = [] } = useModels();
  // The user's pick, or the first model until they pick one that is still offered.
  const selectedModel = models.find((m) => m.id === selectedModelId) ?? models[0];
  const modelSupportsFiles = selectedModel?.supports_files ?? true;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const canAttach = !isUploadingAttachments && !isStreaming;

  const attachFiles = async (files: File[]) => {
    if (files.length === 0 || !canAttach) return;

    const problem = modelSupportsFiles
      ? attachmentProblem(files, attachments.length)
      : `The selected model (${selectedModel?.display_name}) does not accept file attachments.`;
    setAttachmentError(problem);
    if (problem) return;

    setIsUploadingAttachments(true);
    try {
      const uploaded = await chatApi.uploadAttachments(files);
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setAttachmentError(getErrorMessage(err, "Failed to upload attachments."));
    } finally {
      setIsUploadingAttachments(false);
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
    if ((!input.trim() && attachments.length === 0) || isStreaming || isUploadingAttachments) return;
    if (!selectedModel) return;

    if (attachments.length > 0 && !modelSupportsFiles) {
      setAttachmentError(`Model "${selectedModel.display_name}" cannot accept files. Please select a compatible model.`);
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      layout
      initial={false}
      animate={{
        justifyContent: isInitialState ? (isMobile ? "flex-start" : "center") : "flex-end",
        paddingBottom: isInitialState ? (isMobile ? "24px" : "0px") : isMobile ? "12px" : "32px",
      }}
      className={cn("absolute inset-0 flex flex-col px-3 sm:px-4 z-0 pt-12 overflow-y-auto", isInitialState ? "pointer-events-auto" : "pointer-events-none")}
    >
      {/* Phones leave only a thin gap under the composer, so cover it instead of showing messages scroll through. */}
      {!isInitialState && isMobile && (
        <div className="absolute inset-x-0 bottom-0 h-12 bg-canvas" />
      )}
      <div className={cn("w-full max-w-2xl mx-auto flex flex-col pointer-events-auto", isInitialState && isMobile ? "mt-4 mb-6" : "")}>
        <AnimatePresence>{isInitialState && <ChatGreeting onSelectPrompt={selectPrompt} />}</AnimatePresence>

        <motion.div layoutId="input-box" className="relative group w-full">
          <form
            onSubmit={handleSubmit}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn("relative flex flex-col bg-composer border border-zinc-200/90 dark:border-white/10 rounded-[20px] sm:rounded-[24px] focus-within:ring-2 focus-within:ring-blue-500/20 dark:focus-within:ring-1 dark:focus-within:ring-blue-500/40 focus-within:border-blue-500/50 dark:focus-within:border-white/20 transition-all overflow-hidden shadow-xl shadow-zinc-200/50 dark:shadow-2xl", isDraggingFiles && "border-blue-500 ring-2 ring-blue-500/30 dark:border-blue-500/60")}
          >
            {attachmentError && (
              <div className="flex items-center justify-between bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-xs text-red-500 dark:text-red-400">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{attachmentError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachmentError(null)}
                  aria-label="Dismiss"
                  className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 ml-2 cursor-pointer shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-1.5 bg-fill-1 hover:bg-zinc-200/80 dark:hover:bg-white/15 border border-line-1 rounded-lg px-2.5 py-1 text-xs text-fg-3 transition-colors"
                  >
                    {att.media_type.startsWith("image/") ? (
                      <Paperclip className="h-3 w-3 text-fg-7 shrink-0" />
                    ) : (
                      <FileText className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                    <span className="truncate max-w-[140px]">{att.filename}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      aria-label={`Remove ${att.filename}`}
                      className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white ml-0.5 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
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
              placeholder="Send a message..."
              className="min-h-[50px] sm:min-h-[52px] max-h-[200px] sm:max-h-[220px] w-full resize-none border-0 shadow-none focus-visible:ring-0 px-3.5 sm:px-4 pt-3.5 sm:pt-4 pb-12 text-base sm:text-[15px] bg-transparent text-fg-1 placeholder:text-fg-8"
              rows={1}
            />

            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
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
                      aria-label="Attach files"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!canAttach || !modelSupportsFiles}
                      className={cn(
                        "h-8 w-8 rounded-full text-fg-7 hover:text-fg-1 hover:bg-fill-1 dark:hover:bg-fill-1 transition-colors cursor-pointer",
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
                        ? `Attach images or PDFs (up to ${MAX_ATTACHMENTS} files, max 10MB each)`
                        : "Selected model does not support file attachments"}
                    </span>
                  </TooltipContent>
                </Tooltip>
                <EffortPicker value={effort} onChange={onEffortChange} disabled={isStreaming} />
              </div>

              <div className="flex items-center gap-1.5">
                <ModelPicker
                  models={models}
                  selected={selectedModel}
                  onSelect={setSelectedModelId}
                  disabled={isStreaming}
                />

                {isStreaming ? (
                  <Button
                    type="button"
                    onClick={onStop}
                    aria-label="Stop generation"
                    title="Stop generation"
                    className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-500 text-white p-0 flex items-center justify-center transition-all shadow-none cursor-pointer"
                  >
                    <Square className="h-3 w-3 fill-current" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    aria-label="Send message"
                    disabled={(!input.trim() && attachments.length === 0) || isUploadingAttachments}
                    className="h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600 p-0 flex items-center justify-center transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </motion.div>
  );
}
