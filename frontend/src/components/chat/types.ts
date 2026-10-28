import {
  getToolName,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type UIMessage as AIUIMessage,
} from "ai";
import { type AttachmentPublic, type Effort, type MessagePublic, type ModelPublic, type ChatPublic } from "@/api/types";

export interface ChatMessageMetadata {
  attachments?: AttachmentPublic[];
  modelId?: string | null;
}

export type ChatDataParts = {
  "chat-name": { name: string };
};

export type ChatUIMessage = AIUIMessage<ChatMessageMetadata, ChatDataParts>;

export interface SendRequestMetadata {
  chatId: number | null;
  modelId: string;
  attachmentIds: number[];
  effort: Effort | null;
  models: ModelPublic[];
  onChatCreated?: (chat: ChatPublic) => void;
  onModelFallback?: (nextModelId: string) => void;
}

export interface UIMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  /** Streamed reasoning / thinking text from the model, if any. */
  reasoning?: string;
  /** Whether the model is currently streaming its reasoning phase. */
  isReasoningStreaming?: boolean;
  // Why the reply stopped early; shown under whatever content arrived.
  error?: string;
  attachments?: AttachmentPublic[];
}

/** Convert a stored API message into a Vercel AI SDK ChatUIMessage. */
export function messagePublicToChatUIMessage(msg: MessagePublic): ChatUIMessage {
  return {
    id: msg.id.toString(),
    role: msg.kind === "response" ? "assistant" : "user",
    parts: [{ type: "text", text: msg.content, state: "done" }],
    metadata: {
      attachments: msg.attachments ?? [],
      modelId: msg.model_id,
    },
  };
}

/** Extract the currently running tool name from a streaming assistant message, if any. */
export function getActiveToolName(msg: ChatUIMessage | undefined): string | null {
  if (!msg || msg.role !== "assistant") return null;
  for (let i = msg.parts.length - 1; i >= 0; i--) {
    const part = msg.parts[i];
    if (
      isToolUIPart(part) &&
      (part.state === "input-streaming" || part.state === "input-available")
    ) {
      return getToolName(part);
    }
  }
  return null;
}

/** Convert a Vercel AI SDK ChatUIMessage into the UI view-model for rendering. */
export function toRenderableUIMessage(
  msg: ChatUIMessage,
  errorText?: string
): UIMessage {
  let content = "";
  for (const part of msg.parts) {
    if (isTextUIPart(part) && part.text) {
      if (content && !content.endsWith("\n")) {
        content += "\n\n";
      }
      content += part.text;
    }
  }

  const reasoningParts = msg.parts.filter(isReasoningUIPart);
  const reasoning = reasoningParts
    .map((p) => p.text)
    .filter(Boolean)
    .join("\n\n");
  const isReasoningStreaming = reasoningParts.some((p) => p.state === "streaming");

  return {
    id: msg.id,
    role: msg.role === "assistant" ? "ai" : "user",
    content,
    reasoning: reasoning || undefined,
    isReasoningStreaming,
    error: errorText,
    attachments: msg.metadata?.attachments,
  };
}
