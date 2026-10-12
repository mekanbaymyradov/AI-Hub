import { type AttachmentPublic } from "@/api/types";

export interface UIMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  // Why the reply stopped early; shown under whatever content arrived.
  error?: string;
  attachments?: AttachmentPublic[];
}
