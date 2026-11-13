import { chatApi } from "@/api/chat";
import { type MessagePublic, type ModelPublic } from "@/api/types";

export function chatToMarkdown(
  title: string,
  messages: MessagePublic[],
  models: ModelPublic[]
): string {
  const sections = messages.map((msg) => {
    const author =
      msg.kind === "request"
        ? "You"
        : (models.find((m) => m.id === msg.model_id)?.display_name ?? msg.model_id ?? "Assistant");
    const files = msg.attachments?.map((a) => a.filename) ?? [];
    // Attachment URLs can expire, so only the names are kept.
    const attachments = files.length > 0 ? `\n\n_Attachments: ${files.join(", ")}_` : "";
    return `## ${author}\n\n${msg.content.trim()}${attachments}`;
  });
  return `# ${title}\n\n${sections.join("\n\n---\n\n")}\n`;
}

/** Return `title` as a file name that every OS accepts. */
export function markdownFileName(title: string): string {
  const name = title.replace(/[\\/:*?"<>|]+/g, "-").trim();
  return `${name || "chat"}.md`;
}

/** Fetch every page of a chat's history and download it as a Markdown file. */
export async function downloadChatAsMarkdown(
  chatId: number,
  title: string,
  models: ModelPublic[]
): Promise<void> {
  // The first page holds the newest messages, and each page reads oldest first.
  const pages: MessagePublic[][] = [];
  let cursor: string | null = null;
  do {
    const page = await chatApi.getChatMessages(chatId, { cursor });
    pages.push(page.items);
    cursor = page.next_cursor;
  } while (cursor);

  const markdown = chatToMarkdown(title, pages.toReversed().flat(), models);
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = markdownFileName(title);
  link.click();
  URL.revokeObjectURL(url);
}
