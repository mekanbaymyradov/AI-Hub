import { EventSourceParserStream } from 'eventsource-parser/stream';
import { API_BASE_URL } from '@/config';
import { apiClient, getAccessToken, refreshAccessToken } from './axiosInstance';
import {
  type PageChatPublic,
  type ChatRename,
  type ChatPublic,
  type PageMessagePublic,
  type AttachmentPublic,
  type MessageRequest,
  type ErrorResponse,
} from './types';

interface StreamCallbacks {
  onChatId?: (chatId: number) => void;
  onChunk?: (chunk: string) => void;
  onTool?: (name: string) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
}

function postMessage(data: MessageRequest, signal?: AbortSignal): Promise<Response> {
  const token = getAccessToken();
  return fetch(`${API_BASE_URL}/chats/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
    signal,
  });
}

async function responseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as ErrorResponse | null;
  return body?.detail?.[0]?.msg ?? `Failed to send message (${response.status})`;
}

export const chatApi = {
  getChats: async (params?: { limit?: number; cursor?: string | null }): Promise<PageChatPublic> => {
    const response = await apiClient.get<PageChatPublic>('/chats', { params });
    return response.data;
  },

  deleteChat: async (chatId: number): Promise<void> => {
    await apiClient.delete(`/chats/${chatId}`);
  },

  deleteChats: async (chatIds: number[]): Promise<void> => {
    if (chatIds.length === 0) return;
    try {
      await apiClient.post('/chats/bulk-delete', { chat_ids: chatIds });
    } catch {
      await Promise.all(chatIds.map((id) => apiClient.delete(`/chats/${id}`)));
    }
  },

  getChatMessages: async (chatId: number, params?: { limit?: number; cursor?: string | null }): Promise<PageMessagePublic> => {
    const response = await apiClient.get<PageMessagePublic>(`/chats/${chatId}/messages`, { params });
    return response.data;
  },

  uploadAttachments: async (files: File[]): Promise<AttachmentPublic[]> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await apiClient.post<AttachmentPublic[]>('/chats/attachments', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  renameChat: async (chatId: number, data: ChatRename): Promise<ChatPublic> => {
    const response = await apiClient.patch<ChatPublic>(`/chats/${chatId}/rename`, data);
    return response.data;
  },

  // A POST, so it reads the Server-Sent Events from fetch; EventSource only sends GETs.
  streamMessage: async (data: MessageRequest, callbacks: StreamCallbacks, signal?: AbortSignal) => {
    try {
      let response = await postMessage(data, signal);

      if (response.status === 401) {
        try {
          await refreshAccessToken();
        } catch (error) {
          throw new Error('Authentication expired. Please log in again.', { cause: error });
        }
        response = await postMessage(data, signal);
      }

      if (!response.ok) {
        throw new Error(await responseError(response));
      }
      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        .getReader();

      while (true) {
        const { value: message, done } = await reader.read();
        if (done) break;

        switch (message.event) {
          // Unnamed: the next piece of the reply, as a JSON string.
          case undefined:
          case 'message':
            callbacks.onChunk?.(JSON.parse(message.data) as string);
            break;
          case 'chat':
            callbacks.onChatId?.((JSON.parse(message.data) as { id: number }).id);
            break;
          case 'tool':
            callbacks.onTool?.((JSON.parse(message.data) as { name: string }).name);
            break;
          case 'error':
            callbacks.onError?.(
              (JSON.parse(message.data) as ErrorResponse).detail[0]?.msg ??
                'An error occurred during response streaming',
            );
            return;
          // Any other event is for a newer client; skip it.
        }
      }
      callbacks.onComplete?.();
    } catch (error) {
      if (signal?.aborted) {
        callbacks.onComplete?.();
        return;
      }
      callbacks.onError?.(error instanceof Error ? error.message : 'Unknown error');
    }
  },
};
