import {
  APICallError,
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
import { getErrorMessage, getErrorType } from "./errors";
import {
  type AttachmentPublic,
  type ChatPublic,
  type ChatRename,
  type Effort,
  type MessageRequest,
  type ModelPublic,
  type PageChatPublic,
  type PageMessagePublic,
} from "./types";

interface AttemptRequestMetadata {
  chatId: number;
  modelId: string;
  attachmentIds: number[];
  effort: Effort | null;
}

function getNextModel(
  allModels: ModelPublic[],
  currentModelId: string,
  triedModelIds: Set<string>,
  requireFileSupport: boolean
): ModelPublic | null {
  if (allModels.length <= 1) return null;

  const currentIndex = allModels.findIndex((m) => m.id === currentModelId);
  const reordered =
    currentIndex >= 0
      ? [...allModels.slice(currentIndex + 1), ...allModels.slice(0, currentIndex)]
      : allModels;

  return (
    reordered.find(
      (m) =>
        !triedModelIds.has(m.id) &&
        (!requireFileSupport || m.supports_files !== false)
    ) ?? null
  );
}

/** Whether a failure can be recovered by falling back to another model in the catalog. */
function isRetryableModelFailure(error: unknown): boolean {
  const errorType = getErrorType(error);
  if (
    errorType === "llm.model_error" ||
    errorType === "llm.model_not_found" ||
    errorType === "chat.model_cannot_accept_files" ||
    errorType === "internal_error"
  ) {
    return true;
  }
  if (APICallError.isInstance(error)) {
    return error.statusCode != null && error.statusCode >= 500;
  }
  return false;
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

class ResilientChatTransport extends DefaultChatTransport<ChatUIMessage> {
  constructor() {
    super({
      api: `${API_BASE_URL}/chats`,
      credentials: "include",
      fetch: chatFetch,
      // The server keeps the chat's history, so send only the new user message with text parts.
      prepareSendMessagesRequest: ({ id, messages, requestMetadata }) => {
        const meta = requestMetadata as AttemptRequestMetadata;
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

    const runSuperSend = (attemptMeta: AttemptRequestMetadata) =>
      super.sendMessages({
        ...options,
        metadata: attemptMeta,
      });

    let resolvedChatId = meta.chatId;
    if (resolvedChatId === null) {
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

    const triedModelIds = new Set<string>([meta.modelId]);
    let currentModelId = meta.modelId;
    const hasAttachments = meta.attachmentIds.length > 0;
    let currentAttachmentIds = [...meta.attachmentIds];

    const openModelStream = async (): Promise<ReadableStreamDefaultReader<ChatStreamChunk>> => {
      while (true) {
        try {
          const stream = await runSuperSend({
            chatId: resolvedChatId,
            modelId: currentModelId,
            attachmentIds: currentAttachmentIds,
            effort: meta.effort,
          });
          // Once HTTP 200 headers arrive, the server has stored the prompt and claimed its attachments.
          currentAttachmentIds = [];
          return stream.getReader();
        } catch (error) {
          if (options.abortSignal?.aborted) {
            throw error;
          }
          const nextModel = isRetryableModelFailure(error)
            ? getNextModel(meta.models, currentModelId, triedModelIds, hasAttachments)
            : null;
          if (nextModel) {
            triedModelIds.add(nextModel.id);
            currentModelId = nextModel.id;
            meta.onModelFallback?.(nextModel.id);
            continue;
          }
          throw new Error(
            getErrorMessage(error, "An error occurred during response streaming."),
            { cause: error }
          );
        }
      }
    };

    let activeReader = await openModelStream();
    let hasSentStart = false;

    return new ReadableStream<ChatStreamChunk>({
      async pull(controller) {
        while (true) {
          if (options.abortSignal?.aborted) {
            await activeReader.cancel().catch(() => {});
            controller.close();
            return;
          }

          let readResult: ReadableStreamReadResult<ChatStreamChunk>;
          try {
            readResult = await activeReader.read();
          } catch (error) {
            if (options.abortSignal?.aborted) {
              controller.close();
              return;
            }
            const nextModel = isRetryableModelFailure(error)
              ? getNextModel(meta.models, currentModelId, triedModelIds, hasAttachments)
              : null;
            if (nextModel) {
              triedModelIds.add(nextModel.id);
              currentModelId = nextModel.id;
              meta.onModelFallback?.(nextModel.id);
              controller.enqueue({ type: "reset-step" });
              try {
                activeReader = await openModelStream();
                continue;
              } catch (fallbackError) {
                controller.enqueue({
                  type: "error",
                  errorText: getErrorMessage(
                    fallbackError,
                    "An error occurred during response streaming."
                  ),
                });
                controller.close();
                return;
              }
            }
            controller.enqueue({
              type: "error",
              errorText: getErrorMessage(
                error,
                "An error occurred during response streaming."
              ),
            });
            controller.close();
            return;
          }

          const { value: chunk, done } = readResult;
          if (done) {
            controller.close();
            return;
          }

          if (chunk.type === "start") {
            if (hasSentStart) {
              // Keep the original assistant message ID across fallback attempts.
              continue;
            }
            hasSentStart = true;
            controller.enqueue(chunk);
            return;
          }

          if (chunk.type === "error") {
            const streamError = new Error(chunk.errorText);
            await activeReader.cancel().catch(() => {});

            const nextModel = isRetryableModelFailure(streamError)
              ? getNextModel(meta.models, currentModelId, triedModelIds, hasAttachments)
              : null;

            if (nextModel) {
              triedModelIds.add(nextModel.id);
              currentModelId = nextModel.id;
              meta.onModelFallback?.(nextModel.id);
              controller.enqueue({ type: "reset-step" });
              try {
                activeReader = await openModelStream();
                continue;
              } catch (fallbackError) {
                controller.enqueue({
                  type: "error",
                  errorText: getErrorMessage(
                    fallbackError,
                    "An error occurred during response streaming."
                  ),
                });
                controller.close();
                return;
              }
            }

            controller.enqueue({
              type: "error",
              errorText: getErrorMessage(
                streamError,
                "An error occurred during response streaming."
              ),
            });
            controller.close();
            return;
          }

          controller.enqueue(chunk);
          return;
        }
      },
      async cancel(reason) {
        await activeReader.cancel(reason).catch(() => {});
      },
    });
  }
}

export const chatTransport = new ResilientChatTransport();

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
