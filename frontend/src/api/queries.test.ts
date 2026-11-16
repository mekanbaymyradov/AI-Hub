import { QueryClient, type InfiniteData } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import {
  prependChatToCache,
  queryKeys,
  touchChatInCache,
  updateChatNameInCache,
} from "./queries";
import { type ChatPublic, type PageChatPublic } from "./types";

type ChatPages = InfiniteData<PageChatPublic, string | null>;

const chat = (id: number, name = `Chat ${id}`): ChatPublic => ({
  id,
  name,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

let queryClient: QueryClient;
const ids = () =>
  queryClient.getQueryData<ChatPages>(queryKeys.chats)?.pages.map((page) => page.items.map((c) => c.id));

beforeEach(() => {
  queryClient = new QueryClient();
});

function seed(...pages: number[][]) {
  queryClient.setQueryData<ChatPages>(queryKeys.chats, {
    pages: pages.map((page, index) => ({
      items: page.map((id) => chat(id)),
      next_cursor: index < pages.length - 1 ? `cursor-${index}` : null,
    })),
    pageParams: pages.map((_, index) => (index === 0 ? null : `cursor-${index - 1}`)),
  });
}

describe("prependChatToCache", () => {
  it("puts a new chat first", () => {
    seed([1, 2], [3]);
    prependChatToCache(queryClient, chat(9));
    expect(ids()).toEqual([[9, 1, 2], [3]]);
  });

  it("moves a chat that is already listed instead of repeating it", () => {
    seed([1, 2], [3]);
    prependChatToCache(queryClient, chat(3));
    expect(ids()).toEqual([[3, 1, 2], []]);
  });

  it("starts the list when nothing is cached", () => {
    prependChatToCache(queryClient, chat(9));
    expect(ids()).toEqual([[9]]);
  });
});

describe("touchChatInCache", () => {
  it("moves the chat to the top and bumps its update time", () => {
    seed([1, 2], [3]);
    touchChatInCache(queryClient, 3);
    expect(ids()).toEqual([[3, 1, 2], []]);
    const touched = queryClient.getQueryData<ChatPages>(queryKeys.chats)!.pages[0].items[0];
    expect(Date.parse(touched.updated_at)).toBeGreaterThan(Date.parse("2026-01-01T00:00:00Z"));
  });

  it("leaves the list alone for a chat it doesn't hold", () => {
    seed([1, 2]);
    touchChatInCache(queryClient, 9);
    expect(ids()).toEqual([[1, 2]]);
  });
});

describe("updateChatNameInCache", () => {
  it("renames the chat wherever it is", () => {
    seed([1], [2]);
    updateChatNameInCache(queryClient, 2, "Renamed");
    const pages = queryClient.getQueryData<ChatPages>(queryKeys.chats)!.pages;
    expect(pages[1].items[0].name).toBe("Renamed");
    expect(pages[0].items[0].name).toBe("Chat 1");
  });
});
