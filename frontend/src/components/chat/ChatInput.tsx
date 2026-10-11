import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUp,
  ChevronDown,
  Loader2,
  X,
  Paperclip,
  Square,
  FileText,
  AlertCircle,
  Check,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { chatApi } from "@/api/chat";
import { llmApi } from "@/api/llm";
import { type AttachmentPublic } from "@/api/types";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (text: string, attachments: AttachmentPublic[], modelId: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  isInitialState: boolean;
  greetingNode?: React.ReactNode;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  isInitialState,
  greetingNode,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AttachmentPublic[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: modelsData } = useQuery({
    queryKey: ["models"],
    queryFn: () => llmApi.getModels(),
  });

  useEffect(() => {
    if (modelsData && modelsData.length > 0) {
      if (!selectedModel || !modelsData.some((m) => m.id === selectedModel)) {
        setSelectedModel(modelsData[0].id);
      }
    }
  }, [modelsData, selectedModel]);

  const selectedModelObj = modelsData?.find((m) => m.id === selectedModel);
  const currentModelName =
    selectedModelObj?.display_name || (modelsData?.[0]?.display_name ?? "Select Model");
  const modelSupportsFiles = selectedModelObj ? selectedModelObj.supports_files : true;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError(null);
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (!modelSupportsFiles) {
      setAttachmentError(`The selected model (${currentModelName}) does not accept file attachments.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (attachments.length + files.length > 5) {
      setAttachmentError("You can attach at most 5 files per message.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    const maxSizeBytes = 10 * 1024 * 1024; // 10 MiB

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        setAttachmentError(`Unsupported file "${file.name}". Only images (JPEG, PNG, WebP, GIF) and PDFs are allowed.`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size > maxSizeBytes) {
        setAttachmentError(`File "${file.name}" exceeds the 10 MiB size limit.`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }

    setIsUploadingAttachments(true);
    try {
      const uploaded = await chatApi.uploadAttachments(files);
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      console.error("Failed to upload attachments:", err);
      const errorMsg =
        err?.response?.data?.detail?.[0]?.msg ||
        (typeof err?.response?.data?.detail === "string" ? err.response.data.detail : null) ||
        err?.message ||
        "Failed to upload attachments.";
      setAttachmentError(errorMsg);
    } finally {
      setIsUploadingAttachments(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id: number) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setAttachmentError(null);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isStreaming || isUploadingAttachments) return;

    if (attachments.length > 0 && !modelSupportsFiles) {
      setAttachmentError(`Model "${currentModelName}" cannot accept files. Please select a compatible model.`);
      return;
    }

    setAttachmentError(null);
    const sendText = input.trim();
    const sendAttachments = [...attachments];

    setInput("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    onSend(sendText, sendAttachments, selectedModel);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        justifyContent: isInitialState ? "center" : "flex-end",
        paddingBottom: isInitialState ? "0px" : "32px",
      }}
      className="absolute inset-0 pointer-events-none flex flex-col px-4 z-0 pt-12"
    >
      <div className="w-full max-w-2xl mx-auto pointer-events-auto flex flex-col">
        <AnimatePresence>
          {isInitialState && greetingNode}
        </AnimatePresence>

        <motion.div layoutId="input-box" className="relative group w-full">
          <form
            onSubmit={handleSubmit}
            className="relative flex flex-col bg-white dark:bg-[#171717] border border-zinc-200/90 dark:border-white/10 rounded-[24px] focus-within:ring-2 focus-within:ring-blue-500/20 dark:focus-within:ring-1 dark:focus-within:ring-blue-500/40 focus-within:border-blue-500/50 dark:focus-within:border-white/20 transition-all overflow-hidden shadow-xl shadow-zinc-200/50 dark:shadow-2xl"
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
                  className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 ml-2 cursor-pointer shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
                {attachments.map((att) => {
                  const isImage = att.media_type.startsWith("image/");
                  return (
                    <div
                      key={att.id}
                      className="flex items-center gap-1.5 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200/80 dark:hover:bg-white/15 border border-zinc-200 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-200 transition-colors"
                    >
                      {isImage ? (
                        <Paperclip className="h-3 w-3 text-zinc-500 dark:text-zinc-400 shrink-0" />
                      ) : (
                        <FileText className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
                      )}
                      <span className="truncate max-w-[140px]">{att.filename}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white ml-0.5 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              className="min-h-[52px] max-h-[220px] w-full resize-none border-0 shadow-none focus-visible:ring-0 px-4 pt-4 pb-12 text-[15px] bg-transparent text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              rows={1}
            />

            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
              <div className="flex items-center gap-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAttachmentChange}
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  multiple
                  className="hidden"
                />
                <Tooltip>
                  <TooltipTrigger render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAttachments || isStreaming || !modelSupportsFiles}
                      className={cn(
                        "h-8 w-8 rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer",
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
                      {!modelSupportsFiles
                        ? "Selected model does not support file attachments"
                        : "Attach images or PDFs (up to 5 files, max 10MB each)"}
                    </span>
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="flex items-center gap-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isStreaming}
                      className="h-8 px-2.5 rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 text-xs font-normal flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span className="truncate max-w-[140px]">{currentModelName}</span>
                      <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
                    </Button>
                  } />
                  <DropdownMenuContent
                    side="top"
                    align="end"
                    sideOffset={8}
                    className="w-48 bg-white dark:bg-[#1c1c1f] border border-zinc-200 dark:border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-md z-50 text-zinc-900 dark:text-foreground"
                  >
                    {modelsData && modelsData.length > 0 ? (
                      modelsData.map((model) => {
                        const isSelected = model.id === selectedModel;
                        return (
                          <DropdownMenuItem
                            key={model.id}
                            onClick={() => setSelectedModel(model.id)}
                            className={cn(
                              "cursor-pointer flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors",
                              isSelected
                                ? "text-blue-600 dark:text-white bg-blue-50 dark:bg-white/10 font-medium"
                                : "text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 focus:bg-zinc-100 dark:focus:bg-white/10 focus:text-zinc-900 dark:focus:text-white"
                            )}
                          >
                            <span className="truncate">{model.display_name}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                          </DropdownMenuItem>
                        );
                      })
                    ) : (
                      <div className="px-2.5 py-2 text-xs text-zinc-500">
                        {currentModelName}
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {isStreaming ? (
                  <Button
                    type="button"
                    onClick={onStop}
                    className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-500 text-white p-0 flex items-center justify-center transition-all shadow-none cursor-pointer"
                    title="Stop generation"
                  >
                    <Square className="h-3 w-3 fill-current" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
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
