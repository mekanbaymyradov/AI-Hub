import {
  DefaultChatTransport,
  isTextUIPart,
  type ChatTransport,
  type UIMessageChunk,
} from "ai";
import { API_BASE_URL } from "@/config";
import {
  type ChatUIMessage,
  type SendRequestMetadata,
} from "@/components/chat/types";
import { apiClient, getAccessToken, refreshAccessToken } from "./axiosInstance";
import { getErrorMessage } from "./errors";
import {
  type AttachmentPublic,
  type ChatPublic,
  type ChatRename,
  type Effort,
  type MessageRequest,
  type PageChatPublic,
  type PageMessagePublic,
  type RetryRequest,
} from "./types";

interface AttemptRequestMetadata {
  chatId: number;
  modelId: string;
  attachmentIds: number[];
  effort: Effort | null;
  trigger?: "submit-message" | "regenerate-message";
}

async function chatFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const makeRequest = (token: string | null) => {
    const headers = new Headers(init?.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } else {
      headers.delete("Authorization");
    }
    return fetch(input, { ...init, credentials: "include", headers });
  };

  let response = await makeRequest(getAccessToken());
  if (response.status === 401) {
    try {
      const newToken = await refreshAccessToken();
      response = await makeRequest(newToken);
    } catch (error) {
      throw new Error("Authentication expired. Please log in again.", { cause: error });
    }
  }
  return response;
}

type SendMessagesOptions = Parameters<ChatTransport<ChatUIMessage>["sendMessages"]>[0];
type ChatStreamChunk = UIMessageChunk;

class AppChatTransport extends DefaultChatTransport<ChatUIMessage> {
  constructor() {
    super({
      api: `${API_BASE_URL}/chats`,
      credentials: "include",
      fetch: chatFetch,
      // The server keeps the chat's history, so send only the new user message or a retry request.
      prepareSendMessagesRequest: ({ id, messages, requestMetadata, trigger, messageId }) => {
        const meta = requestMetadata as AttemptRequestMetadata;
        const effectiveTrigger = meta.trigger ?? trigger;

        if (effectiveTrigger === "regenerate-message") {
          const body: RetryRequest = {
            trigger: "regenerate-message",
            id,
            messages: [],
            ...(messageId ? { messageId } : {}),
            modelId: meta.modelId,
            ...(meta.effort ? { effort: meta.effort } : {}),
          };

          return {
            api: `${API_BASE_URL}/chats/${meta.chatId}/retry`,
            body,
          };
        }

        const lastUserMessage =
          [...messages].reverse().find((m) => m.role === "user") ??
          messages[messages.length - 1];

        const textParts = lastUserMessage
          ? lastUserMessage.parts
              .filter(isTextUIPart)
              .map((p) => ({ type: "text" as const, text: p.text }))
          : [];

        const body: MessageRequest = {
          trigger: "submit-message",
          id,
          messages: [
            {
              id: lastUserMessage?.id ?? id,
              role: "user",
              parts: textParts.length > 0 ? textParts : [{ type: "text", text: "Attached files" }],
            },
          ],
          modelId: meta.modelId,
          attachmentIds: meta.attachmentIds,
          ...(meta.effort ? { effort: meta.effort } : {}),
        };

        return {
          api: `${API_BASE_URL}/chats/${meta.chatId}/messages`,
          body,
        };
      },
    });
  }

  override async sendMessages(
    options: SendMessagesOptions
  ): Promise<ReadableStream<ChatStreamChunk>> {
    const meta = options.metadata as SendRequestMetadata | undefined;
    if (!meta) {
      return super.sendMessages(options);
    }

    let resolvedChatId = meta.chatId;
    if (resolvedChatId === null) {
      if (options.trigger === "regenerate-message") {
        throw new Error("Cannot regenerate reply without an active chat.");
      }
      try {
        const created = await chatApi.createChat();
        resolvedChatId = created.id;
        if (!options.abortSignal?.aborted) {
          meta.onChatCreated?.(created);
        }
      } catch (error) {
        throw new Error(getErrorMessage(error, "Failed to start a new chat."), {
          cause: error,
        });
      }
    }

    const attemptMeta: AttemptRequestMetadata = {
      chatId: resolvedChatId,
      modelId: meta.modelId,
      attachmentIds: meta.attachmentIds,
      effort: meta.effort,
      trigger: options.trigger,
    };

    return super.sendMessages({
      ...options,
      metadata: attemptMeta,
    });
  }
}

export const chatTransport = new AppChatTransport();

export const chatApi = {
  getChats: async (params?: { limit?: number; cursor?: string | null }): Promise<PageChatPublic> => {
    const response = await apiClient.get<PageChatPublic>("/chats", { params });
    return response.data;
  },

  createChat: async (): Promise<ChatPublic> => {
    const response = await apiClient.post<ChatPublic>("/chats");
    return response.data;
  },

  deleteChat: async (chatId: number): Promise<void> => {
    await apiClient.delete("/chats", { params: { chat_ids: [chatId] } });
  },

  deleteChats: async (chatIds: number[]): Promise<void> => {
    if (chatIds.length === 0) return;
    await apiClient.delete("/chats", { params: { chat_ids: chatIds } });
  },

  getChatMessages: async (
    chatId: number,
    params?: { limit?: number; cursor?: string | null }
  ): Promise<PageMessagePublic> => {
    const response = await apiClient.get<PageMessagePublic>(`/chats/${chatId}/messages`, {
      params,
    });
    return response.data;
  },

  uploadAttachments: async (files: File[]): Promise<AttachmentPublic[]> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    const response = await apiClient.post<AttachmentPublic[]>("/chats/attachments", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  renameChat: async (chatId: number, data: ChatRename): Promise<ChatPublic> => {
    const response = await apiClient.patch<ChatPublic>(`/chats/${chatId}/rename`, data);
    return response.data;
  },
};
