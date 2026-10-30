import {
  skipToken,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { chatApi } from "./chat";
import { llmApi } from "./llm";
import { type ChatPublic, type PageChatPublic, type PageMessagePublic } from "./types";

export const queryKeys = {
  models: ["models"],
  chats: ["chats"],
  chatMessages: (chatId: number | null) => ["chat-messages", chatId],
};

export function useModels() {
  return useQuery({ queryKey: queryKeys.models, queryFn: llmApi.getModels });
}

// Both lists page with the API's opaque cursor; `next_cursor` is null on the last page.

export function useChats() {
  return useInfiniteQuery({
    queryKey: queryKeys.chats,
    queryFn: ({ pageParam }) => chatApi.getChats({ cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
  });
}

/** Load a chat's messages; the first page is the newest, so later pages are older. */
export function useChatMessages(chatId: number | null) {
  return useInfiniteQuery({
    queryKey: queryKeys.chatMessages(chatId),
    queryFn:
      chatId === null
        ? skipToken
        : ({ pageParam }) => chatApi.getChatMessages(chatId, { cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    staleTime: 30_000,
    // A missing chat won't appear on a retry, so the chat page can fall back right away.
    retry: (failureCount, error) =>
      !(isAxiosError(error) && error.response && error.response.status < 500) && failureCount < 3,
  });
}

/** Prepend a newly created chat to the top of the cached chat list without waiting for a refetch. */
export function prependChatToCache(queryClient: QueryClient, chat: ChatPublic): void {
  queryClient.setQueryData<InfiniteData<PageChatPublic, string | null>>(
    queryKeys.chats,
    (old) => {
      if (!old || old.pages.length === 0) {
        return {
          pages: [{ items: [chat], next_cursor: null }],
          pageParams: [null],
        };
      }
      const filteredPages = old.pages.map((page) => ({
        ...page,
        items: page.items.filter((item) => item.id !== chat.id),
      }));
      filteredPages[0] = {
        ...filteredPages[0],
        items: [chat, ...filteredPages[0].items],
      };
      return { ...old, pages: filteredPages };
    }
  );
}

/** Move an active chat to the top of the cached chat list when a message is sent. */
export function touchChatInCache(queryClient: QueryClient, chatId: number): void {
  queryClient.setQueryData<InfiniteData<PageChatPublic, string | null>>(
    queryKeys.chats,
    (old) => {
      if (!old || old.pages.length === 0) return old;
      const existing = old.pages.flatMap((p) => p.items).find((c) => c.id === chatId);
      if (!existing) return old;

      const updatedChat: ChatPublic = {
        ...existing,
        updated_at: new Date().toISOString(),
      };
      const filteredPages = old.pages.map((page) => ({
        ...page,
        items: page.items.filter((item) => item.id !== chatId),
      }));
      filteredPages[0] = {
        ...filteredPages[0],
        items: [updatedChat, ...filteredPages[0].items],
      };
      return { ...old, pages: filteredPages };
    }
  );
}

/** Instantly update a chat's title in the cached chat list (e.g. from `data-chat-name` or rename). */
export function updateChatNameInCache(
  queryClient: QueryClient,
  chatId: number,
  name: string
): void {
  queryClient.setQueryData<InfiniteData<PageChatPublic, string | null>>(
    queryKeys.chats,
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((chat) =>
            chat.id === chatId ? { ...chat, name } : chat
          ),
        })),
      };
    }
  );
}

/** Seed an empty message list for a brand-new chat so navigating to its URL skips a redundant fetch. */
export function seedEmptyChatMessagesCache(
  queryClient: QueryClient,
  chatId: number
): void {
  queryClient.setQueryData<InfiniteData<PageMessagePublic, string | null>>(
    queryKeys.chatMessages(chatId),
    {
      pages: [{ items: [], next_cursor: null }],
      pageParams: [null],
    }
  );
}

export function useRenameChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => chatApi.renameChat(id, { name }),
    onSuccess: (updated) => {
      updateChatNameInCache(queryClient, updated.id, updated.name);
      queryClient.invalidateQueries({ queryKey: queryKeys.chats });
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: chatApi.deleteChat,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.chats }),
  });
}

export function useDeleteChats() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chatIds: number[]) => chatApi.deleteChats(chatIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.chats }),
  });
}
