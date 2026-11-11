import { Injectable } from '@angular/core';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { environment } from '../../../environments/environment';

export interface ConversationHandlers {
  sent: (e: any) => void;
  changed: (e: any) => void;
  typing: (e: any) => void;
  read: (e: any) => void;
}

@Injectable({
  providedIn: 'root',
})
export class EchoService {
  private echo: Echo<any> | null = null;

  connect(): Echo<any> {
    if (this.echo) {
      return this.echo;
    }

    (window as any).Pusher = Pusher;

    const token = localStorage.getItem('token');
    const broadcastAuthUrl = environment.apiUrl.replace('/api', '') + '/broadcasting/auth';

    this.echo = new Echo({
      broadcaster: 'reverb',
      key: environment.reverbAppKey,
      wsHost: environment.reverbHost,
      wsPort: environment.reverbPort,
      wssPort: environment.reverbPort,
      forceTLS: environment.reverbScheme === 'https',
      enabledTransports: ['ws', 'wss'],
      authEndpoint: broadcastAuthUrl,
      auth: {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      },
    });

    return this.echo;
  }

  /** Conversations we already listen to, so a second subscribe never doubles the handlers. */
  private watching = new Set<number>();

  /**
   * Listen to one conversation: new messages, edits/deletes/reactions, and the
   * "typing" and "read" whispers (client events sent straight between members).
   */
  watch(conversationId: number, handlers: ConversationHandlers): void {
    // No websocket host configured (e.g. a free demo deploy): chat works, just without live updates.
    if (!environment.reverbHost) return;
    if (this.watching.has(conversationId)) return;
    this.watching.add(conversationId);

    this.connect()
      .private(`conversation.${conversationId}`)
      .listen('.message.sent', handlers.sent)
      .listen('.message.changed', handlers.changed)
      .listenForWhisper('typing', handlers.typing)
      .listenForWhisper('read', handlers.read);
  }

  /** Tell the other members something small (typing, read) without touching the server. */
  whisper(conversationId: number, event: 'typing' | 'read', payload: Record<string, unknown>): void {
    try {
      this.echo?.private(`conversation.${conversationId}`).whisper(event, payload);
    } catch {
      // Realtime is optional: a failed whisper must never break the chat.
    }
  }

  leaveConversation(conversationId: number): void {
    this.watching.delete(conversationId);
    this.echo?.leave(`conversation.${conversationId}`);
  }

  disconnect(): void {
    this.watching.clear();
    this.echo?.disconnect();
    this.echo = null;
  }
}