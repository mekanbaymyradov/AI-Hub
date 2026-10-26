import { skipToken, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { chatApi } from "./chat";
import { llmApi } from "./llm";

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
    // A missing chat won't appear on a retry, so the chat page can fall back right away.
    retry: (failureCount, error) =>
      !(isAxiosError(error) && error.response && error.response.status < 500) && failureCount < 3,
  });
}

export function useRenameChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => chatApi.renameChat(id, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.chats }),
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
