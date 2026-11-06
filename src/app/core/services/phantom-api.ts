import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Conversation } from '../models/conversation';
import { User } from '../models/user';
import {
  Contact,
  ContactDetail,
  SavedCollection,
  SavedItem,
  SavedResponse,
  SearchParams,
  SearchResponse,
  SharedAttachment,
  UserPrefs,
} from '../models/phantom';

/**
 * Endpoints added for the Phantom Messenger pages: groups, contacts, saved,
 * search and settings. Conversations/messages live in their own services.
 */
@Injectable({ providedIn: 'root' })
export class PhantomApi {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  // ---- profile & users ----
  updateProfile(data: FormData): Observable<User> {
    return this.http.post<{ user: User }>(`${this.api}/profile`, data).pipe(map((r) => r.user));
  }

  searchUsers(query: string): Observable<User[]> {
    return this.http
      .get<{ users: User[] }>(`${this.api}/users/search`, { params: { query } })
      .pipe(map((r) => r.users));
  }

  // ---- groups ----
  groups(): Observable<Conversation[]> {
    return this.http.get<{ groups: Conversation[] }>(`${this.api}/groups`).pipe(map((r) => r.groups));
  }

  conversationFiles(conversationId: number): Observable<SharedAttachment[]> {
    return this.http
      .get<{ attachments: SharedAttachment[] }>(`${this.api}/conversations/${conversationId}/attachments`)
      .pipe(map((r) => r.attachments));
  }

  setConversationPrefs(
    conversationId: number,
    prefs: { is_muted?: boolean; is_pinned?: boolean },
  ): Observable<Conversation> {
    return this.http
      .patch<{ conversation: Conversation }>(`${this.api}/conversations/${conversationId}/preferences`, prefs)
      .pipe(map((r) => r.conversation));
  }

  invite(conversationId: number, userIds: number[]): Observable<Conversation> {
    return this.http
      .post<{ conversation: Conversation }>(`${this.api}/conversations/${conversationId}/participants`, {
        user_ids: userIds,
      })
      .pipe(map((r) => r.conversation));
  }

  // ---- contacts ----
  contacts(): Observable<Contact[]> {
    return this.http.get<{ contacts: Contact[] }>(`${this.api}/contacts`).pipe(map((r) => r.contacts));
  }

  contactDetail(userId: number): Observable<ContactDetail> {
    return this.http.get<ContactDetail>(`${this.api}/contacts/${userId}`);
  }

  addContact(userId: number, nickname?: string): Observable<Contact> {
    return this.http
      .post<{ contact: Contact }>(`${this.api}/contacts`, { user_id: userId, nickname: nickname ?? null })
      .pipe(map((r) => r.contact));
  }

  removeContact(userId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/contacts/${userId}`);
  }

  updateContact(
    userId: number,
    data: Partial<Pick<Contact, 'note' | 'is_muted' | 'is_blocked'>> & { nickname?: string | null },
  ): Observable<Contact> {
    return this.http
      .patch<{ contact: Contact }>(`${this.api}/contacts/${userId}`, data)
      .pipe(map((r) => r.contact));
  }

  // ---- saved ----
  saved(filters: { collection_id?: number | null; type?: 'all' | 'messages' | 'files'; q?: string } = {}): Observable<SavedResponse> {
    let params = new HttpParams();
    if (filters.collection_id) params = params.set('collection_id', filters.collection_id);
    if (filters.type) params = params.set('type', filters.type);
    if (filters.q) params = params.set('q', filters.q);
    return this.http.get<SavedResponse>(`${this.api}/saved`, { params });
  }

  saveMessage(messageId: number, collectionId?: number | null): Observable<SavedItem> {
    return this.http
      .post<{ saved: SavedItem }>(`${this.api}/saved`, { message_id: messageId, collection_id: collectionId ?? null })
      .pipe(map((r) => r.saved));
  }

  unsave(savedId: number): Observable<unknown> {
    return this.http.delete(`${this.api}/saved/${savedId}`);
  }

  createCollection(name: string): Observable<SavedCollection> {
    return this.http
      .post<{ collection: SavedCollection }>(`${this.api}/saved/collections`, { name })
      .pipe(map((r) => r.collection));
  }

  // ---- search ----
  search(p: SearchParams): Observable<SearchResponse> {
    let params = new HttpParams().set('q', p.q);
    if (p.conversation_id) params = params.set('conversation_id', p.conversation_id);
    if (p.from) params = params.set('from', p.from);
    if (p.date_from) params = params.set('date_from', p.date_from);
    if (p.date_to) params = params.set('date_to', p.date_to);
    (p.types ?? []).forEach((t) => (params = params.append('types[]', t)));
    return this.http.get<SearchResponse>(`${this.api}/search`, { params });
  }

  // ---- settings ----
  settings(): Observable<UserPrefs> {
    return this.http.get<{ settings: UserPrefs }>(`${this.api}/settings`).pipe(map((r) => r.settings));
  }

  saveSettings(prefs: Partial<UserPrefs>): Observable<UserPrefs> {
    return this.http.put<{ settings: UserPrefs }>(`${this.api}/settings`, prefs).pipe(map((r) => r.settings));
  }
}
