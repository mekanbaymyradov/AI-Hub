import { type AttachmentPublic } from "@/api/types";

export interface UIMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  attachments?: AttachmentPublic[];
  created_at?: string;
  model_id?: string | null;
}
