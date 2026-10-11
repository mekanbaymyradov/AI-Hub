import { apiClient, getAccessToken } from './axiosInstance';
import { 
  type PageChatPublic, 
  type ChatRename, 
  type ChatPublic, 
  type PageMessagePublic, 
  type AttachmentPublic,
  type MessageRequest
} from './types';

export const chatApi = {
  getChats: async (params?: { limit?: number; cursor?: string | null }): Promise<PageChatPublic> => {
    const response = await apiClient.get<PageChatPublic>('/chats', { params });
    return response.data;
  },

  deleteChat: async (chatId: number): Promise<void> => {
    await apiClient.delete(`/chats/${chatId}`);
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

  
  streamMessage: async (
    data: MessageRequest,
    callbacks: {
      onChatId?: (chatId: number) => void;
      onChunk?: (chunk: string) => void;
      onError?: (error: string) => void;
      onComplete?: () => void;
    },
    signal?: AbortSignal
  ) => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const token = getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const baseURL = apiClient.defaults.baseURL || 'http://localhost:8000';

      let response = await fetch(`${baseURL}/chats/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        signal,
      });

      if (response.status === 401) {
        try {
          const axios = (await import('axios')).default;
          const { data: tokenData } = await axios.post('/auth/token/refresh', {}, {
            baseURL: apiClient.defaults.baseURL,
            withCredentials: true
          });
          const newToken = tokenData.access_token;
          const { setAccessToken } = await import('./axiosInstance');
          setAccessToken(newToken);
          
          headers['Authorization'] = `Bearer ${newToken}`;
          response = await fetch(`${baseURL}/chats/messages`, {
            method: 'POST',
            headers,
            body: JSON.stringify(data),
            signal,
          });
        } catch (refreshErr) {
          const { setAccessToken } = await import('./axiosInstance');
          setAccessToken(null);
          throw new Error('Authentication expired. Please log in again.');
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg =
          errorData.detail?.[0]?.msg ||
          (typeof errorData.detail === 'string' ? errorData.detail : null) ||
          errorData.message ||
          `Failed to send message (${response.status})`;
        throw new Error(msg);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      let buffer = '';

      const processBlock = (block: string) => {
        const lines = block.split(/\r?\n/);
        let eventType = 'message';
        const dataLines: string[] = [];

        for (const line of lines) {
          if (!line || line.startsWith(':')) {
            continue;
          }
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data: ')) {
            dataLines.push(line.slice(6));
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5));
          }
        }

        const dataStr = dataLines.join('\n');

        if (eventType === 'chat') {
          try {
            const parsed = JSON.parse(dataStr);
            if (typeof parsed?.id === 'number') {
              callbacks.onChatId?.(parsed.id);
            }
          } catch (e) {
            console.error('Failed to parse chat event data:', e);
          }
        } else if (eventType === 'error') {
          let errorMsg = dataStr;
          try {
            const parsed = JSON.parse(dataStr);
            if (Array.isArray(parsed?.detail) && parsed.detail[0]?.msg) {
              errorMsg = parsed.detail[0].msg;
            } else if (typeof parsed?.detail === 'string') {
              errorMsg = parsed.detail;
            } else if (parsed?.message) {
              errorMsg = parsed.message;
            }
          } catch {
            // keep raw dataStr
          }
          callbacks.onError?.(errorMsg || 'An error occurred during response streaming');
        } else {
          // Unnamed event (text chunk)
          let chunk = dataStr;
          try {
            const parsed = JSON.parse(dataStr);
            if (typeof parsed === 'string') {
              chunk = parsed;
            }
          } catch {
            // chunk is raw dataStr
          }
          callbacks.onChunk?.(chunk);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            processBlock(buffer);
          }
          callbacks.onComplete?.();
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (part.trim()) {
            processBlock(part);
          }
        }
      }
    } catch (err: any) {
      if (signal?.aborted || err.name === 'AbortError') {
        callbacks.onComplete?.();
        return;
      }
      callbacks.onError?.(err.message || 'Unknown error');
    }
  }
};
