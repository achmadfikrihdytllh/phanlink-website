import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Message, MessagePaginatedResponse } from '../models/message';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** Newest page, or the page of older messages before `before`. */
  getMessages(conversationId: number, before?: number, after?: number): Observable<MessagePaginatedResponse> {
    const query = before ? `?before=${before}` : after ? `?after=${after}` : '';
    return this.http.get<MessagePaginatedResponse>(
      `${this.apiUrl}/conversations/${conversationId}/messages${query}`
    );
  }

  edit(messageId: number, body: string): Observable<{ data: Message }> {
    return this.http.patch<{ data: Message }>(`${this.apiUrl}/messages/${messageId}`, { body });
  }

  remove(messageId: number): Observable<{ data: Message }> {
    return this.http.delete<{ data: Message }>(`${this.apiUrl}/messages/${messageId}`);
  }

  react(messageId: number, emoji: string): Observable<{ data: Message }> {
    return this.http.post<{ data: Message }>(`${this.apiUrl}/messages/${messageId}/reactions`, { emoji });
  }

  sendText(conversationId: number, body: string, replyToId?: number): Observable<{ data: Message }> {
    return this.http.post<{ data: Message }>(
      `${this.apiUrl}/conversations/${conversationId}/messages`,
      {
        type: 'text',
        body,
        reply_to_id: replyToId ?? null,
      }
    );
  }

  sendFile(conversationId: number, file: File, replyToId?: number): Observable<{ data: Message }> {
    const form = new FormData();
    form.append('type', file.type.startsWith('image/') ? 'image' : 'file');
    form.append('attachment', file);
    if (replyToId) form.append('reply_to_id', String(replyToId));

    return this.http.post<{ data: Message }>(
      `${this.apiUrl}/conversations/${conversationId}/messages`,
      form
    );
  }

  markAsRead(conversationId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/conversations/${conversationId}/read`,
      {}
    );
  }
}