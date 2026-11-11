import { User } from './user';

export interface ConversationParticipant
  extends Pick<User, 'id' | 'name' | 'username' | 'avatar' | 'status'> {
  role: 'member' | 'admin';
  /** Null when the person hides read receipts. */
  last_read_at?: string | null;
}

export interface LatestMessagePreview {
  id: number;
  body: string | null;
  type: string;
  sender_id: number;
  created_at: string;
}

export interface Conversation {
  id: number;
  type: 'private' | 'group';
  name: string | null;
  avatar: string | null;
  description?: string | null;
  created_by: number;
  unread_count?: number;
  pinned_message?: { id: number; body: string | null; sender_id: number } | null;
  is_muted?: boolean;
  is_pinned?: boolean;
  participants: ConversationParticipant[];
  latest_message: LatestMessagePreview | null;
  created_at: string;
  updated_at: string;
}