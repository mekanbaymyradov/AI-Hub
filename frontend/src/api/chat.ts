import { apiClient, getAccessToken } from './axiosInstance';
import { 
  PageChatPublic, 
  ChatRename, 
  ChatPublic, 
  PageMessagePublic, 
  AttachmentPublic,
  MessageRequest
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
    }
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

      const response = await fetch(`${baseURL}/chats/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail?.[0]?.msg || 'Failed to start stream');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          callbacks.onComplete?.();
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        
        const messages = buffer.split(/\r?\n\r?\n/);
        buffer = messages.pop() || ''; 

        for (const message of messages) {
          if (!message.trim()) continue;

          let eventType = 'message';
          let dataStr = '';

          const lines = message.split(/\r?\n/);
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.substring(7);
            } else if (line.startsWith('data: ')) {
              dataStr += line.substring(6);
            }
          }

          if (eventType === 'chat') {
            try {
              const parsed = JSON.parse(dataStr);
              callbacks.onChatId?.(parsed.id);
            } catch (e) {
              
            }
          } else if (eventType === 'error') {
            callbacks.onError?.(dataStr);
          } else {
            
            try {
              const parsed = JSON.parse(dataStr);
              callbacks.onChunk?.(parsed);
            } catch (e) {
              callbacks.onChunk?.(dataStr);
            }
          }
        }
      }
    } catch (err: any) {
      callbacks.onError?.(err.message || 'Unknown error');
    }
  }
};
