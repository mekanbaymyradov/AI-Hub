export interface OTPRequest {
  email: string;
}

export interface OTPVerify {
  email: string;
  code: string;
}

export interface Token {
  access_token: string;
  token_type?: string;
  expires_in: number;
}

export interface UserPublic {
  id: number;
  email: string;
  name: string | null;
  instructions: string | null;
  avatar_url: string | null;
  avatar_initial: string;
}

export interface UserUpdate {
  name?: string | null;
  instructions?: string | null;
}

export type Provider = 'anthropic' | 'openai' | 'google' | 'groq';

export interface ModelPublic {
  id: string;
  provider: Provider;
  display_name: string;
  supports_files: boolean;
}

export interface ChatPublic {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface PageChatPublic {
  items: ChatPublic[];
  next_cursor: string | null;
}

export interface ChatRename {
  name: string;
}

export interface AttachmentPublic {
  id: number;
  filename: string;
  media_type: string;
  url: string;
}

export interface MessagePublic {
  id: number;
  kind: 'request' | 'response';
  content: string;
  model_id: string | null;
  created_at: string;
  attachments?: AttachmentPublic[];
}

export interface PageMessagePublic {
  items: MessagePublic[];
  next_cursor: string | null;
}

export interface MessageRequest {
  chat_id?: number | null;
  model_id: string;
  prompt: string;
  attachment_ids?: number[];
}

export interface ErrorDetail {
  loc?: (string | number)[];
  msg: string;
  type: string;
}

export interface ErrorResponse {
  detail: ErrorDetail[];
}
