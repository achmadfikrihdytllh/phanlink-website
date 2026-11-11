import { User } from './user';

export interface MessageAttachment {
  id: number;
  file_path: string;
  file_type: string;
  file_size: number;
  thumbnail_path: string | null;
}

export interface ReplyToMessage {
  id: number;
  body: string | null;
  sender_id: number;
}

export interface MessageReaction {
  emoji: string;
  user_ids: number[];
}

export interface Message {
  id: number;
  conversation_id: number;
  sender: Pick<User, 'id' | 'name' | 'username' | 'avatar'>;
  type: 'text' | 'image' | 'file' | 'system';
  body: string | null;
  deleted?: boolean;
  reactions?: MessageReaction[];
  reply_to: ReplyToMessage | null;
  attachments: MessageAttachment[];
  edited_at: string | null;
  created_at: string;
}

/** Messages come newest first; pass `before` (the oldest id you have) to get the page before it. */
export interface MessagePaginatedResponse {
  messages: Message[];
  meta: {
    has_more: boolean;
    oldest_id: number | null;
  };
}
