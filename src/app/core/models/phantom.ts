import { Conversation } from './conversation';
import { Message } from './message';

/** Row of GET /contacts. `id` is the contact's *user* id. */
export interface Contact {
  id: number;
  name: string;
  username: string;
  handle: string;
  codename: string;
  avatar: string | null;
  bio: string | null;
  status: 'online' | 'offline' | string;
  last_seen_at: string | null;
  note: string | null;
  is_muted: boolean;
  is_blocked: boolean;
  contact_since: string;
}

/** A file shared in a conversation (GET /conversations/{id}/attachments, contact detail, search). */
export interface SharedAttachment {
  id: number;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  thumbnail_path: string | null;
  message_id: number;
  conversation_id: number;
  sender: { id: number; name: string };
  created_at: string;
}

export interface ContactDetail {
  contact: Contact;
  conversation_id: number | null;
  groups_in_common: Conversation[];
  shared_files: SharedAttachment[];
  last_exchange: Message[];
}

export interface SavedCollection {
  id: number;
  name: string;
  count: number;
}

export interface SavedItem {
  id: number;
  saved_at: string;
  collection: { id: number; name: string } | null;
  conversation: { id: number; name: string | null; type: 'private' | 'group' };
  message: Message;
}

export interface SavedResponse {
  saved: SavedItem[];
  collections: SavedCollection[];
  total: number;
}

export interface ConversationRef {
  id: number;
  name: string | null;
  type: 'private' | 'group';
}

export interface SearchResponse {
  query: string;
  messages: { message: Message; conversation: ConversationRef }[];
  files: { attachment: SharedAttachment; conversation: ConversationRef }[];
  counts: { messages: number; files: number };
}

export interface SearchParams {
  q: string;
  conversation_id?: number | null;
  from?: number | null;
  date_from?: string | null;
  date_to?: string | null;
  types?: ('messages' | 'files')[];
}

/** Same keys as the Angular Settings page `Prefs` type. */
export interface UserPrefs {
  theme: 'phantom' | 'midnight' | 'paper';
  density: 'comfortable' | 'compact';
  desktopNotifications: boolean;
  messagePreviews: boolean;
  whoCanMessage: 'contacts' | 'everyone';
  readReceipts: boolean;
  showOnline: boolean;
}
