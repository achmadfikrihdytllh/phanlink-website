import {
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth';
import { ConversationService } from '../../core/services/conversation';
import { EchoService } from '../../core/services/echo';
import { environment } from '../../../environments/environment';
import { MessageService } from '../../core/services/message';
import { PhantomApi } from '../../core/services/phantom-api';
import { Conversation } from '../../core/models/conversation';
import { Message, MessageAttachment } from '../../core/models/message';
import { Appearance } from '../../core/services/appearance';
import { assetUrl } from '../../core/util/asset-url';
import { lastSeenText } from '../../core/util/last-seen';
import { PmAvatar } from '../../shared/avatar/avatar';
import { PmIcon } from '../../shared/icon/icon';
import { DialogResult, NewDialog } from '../../shared/new-dialog/new-dialog';
import { FrameView, PageFrame } from '../../shared/page-frame/page-frame';

/** How long a "typing" signal stays on screen without a fresh one, and how often we send our own. */
const TYPING_SHOW_MS = 4000;
const TYPING_SEND_MS = 2500;

@Component({
  selector: 'app-messages',
  imports: [FormsModule, DatePipe, RouterLink, PmIcon, PmAvatar, PageFrame, NewDialog],
  templateUrl: './messages.html',
  styleUrl: './messages.scss',
})
export class Messages implements OnInit, OnDestroy {
  private conversationService = inject(ConversationService);
  private messageService = inject(MessageService);
  private api = inject(PhantomApi);
  private echo = inject(EchoService);
  private auth = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private appearance = inject(Appearance);

  private feed = viewChild<ElementRef<HTMLElement>>('feed');

  readonly reactionChoices = ['👍', '❤️', '😂', '😮', '🙏'];

  conversations = signal<Conversation[]>([]);
  selected = signal<Conversation | null>(null);
  messages = signal<Message[]>([]);
  draft = signal('');
  query = signal('');
  loading = signal(false);
  loadingMore = signal(false);
  hasMore = signal(false);
  sending = signal(false);
  composing = signal(false);
  sendError = signal<string | null>(null);
  view = signal<FrameView>('list');

  /** The message whose action bar is open (tap a bubble to open it). */
  menuFor = signal<number | null>(null);
  replyTo = signal<Message | null>(null);
  editing = signal<Message | null>(null);

  /** Ticks every 30s so "last seen 5 min ago" keeps moving without any request. */
  private now = signal(Date.now());

  /** First unread message when the chat was opened, and how many there were (drives the divider). */
  unreadFromId = signal<number | null>(null);
  unreadCount = signal(0);
  private pendingUnreadId: number | null = null;

  /** conversationId -> userId -> name, for people typing right now. */
  typing = signal<Record<number, Record<number, string>>>({});

  currentUserId = this.auth.currentUser()?.id ?? 0;
  private myName = this.auth.currentUser()?.name ?? '';

  filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.conversations();
    return this.conversations().filter((c) => (c.name ?? '').toLowerCase().includes(q));
  });

  /** Files seen in the loaded thread, shown in the "Shared intel" panel. */
  sharedFiles = computed<MessageAttachment[]>(() =>
    this.messages()
      .flatMap((m) => m.attachments ?? [])
      .slice(-4)
      .reverse(),
  );

  onlineCount = computed(
    () => this.selected()?.participants.filter((p) => p.status === 'online').length ?? 0,
  );

  /** Header line for a private chat: "online" or when they were last active. Groups keep the member count. */
  presence = computed(() => {
    const c = this.selected();
    if (!c || c.type !== 'private') return null;

    const other = c.participants.find((p) => p.id !== this.currentUserId);
    if (!other) return null;
    if (other.status === 'online') return { online: true, text: 'online' };

    return { online: false, text: lastSeenText(other.last_seen_at, this.now()) };
  });

  /** Pinning in a group is for admins; in a private chat either person may pin. */
  canPin = computed(() => {
    const c = this.selected();
    if (!c) return false;
    if (c.type === 'private') return true;
    return c.participants.some((p) => p.id === this.currentUserId && p.role === 'admin');
  });

  private activeConversationId: number | null = null;
  private requestedId: number | null = null;
  private lastTypingSent = 0;
  private typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Set while older messages are being prepended, so the feed keeps its place instead of jumping down. */
  private anchorHeight: number | null = null;
  private lastKey = 0;

  constructor() {
    const tick = setInterval(() => this.now.set(Date.now()), 30_000);
    this.destroyRef.onDestroy(() => clearInterval(tick));

    effect(() => {
      const list = this.messages();
      const key = list.length ? list[list.length - 1].id : 0;

      queueMicrotask(() => {
        const el = this.feed()?.nativeElement;
        if (!el) return;

        if (this.anchorHeight !== null) {
          el.scrollTop = el.scrollHeight - this.anchorHeight;
          this.anchorHeight = null;
        } else if (key !== this.lastKey) {
          // Only a new newest message pulls the feed down; edits and reactions leave it where it is.
          el.scrollTop = el.scrollHeight;

          // Opening a chat with unread messages: land on the divider instead of the very bottom.
          if (this.pendingUnreadId !== null && this.unreadFromId() === this.pendingUnreadId) {
            this.pendingUnreadId = null;
            setTimeout(() => this.feed()?.nativeElement.querySelector('.unread')?.scrollIntoView({ block: 'center' }));
          }
        }
        this.lastKey = key;
      });
    });
  }

  ngOnInit(): void {
    // `/messages?c=ID` opens that conversation (used by Saved, Search and Contacts).
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = Number(params.get('c'));
      this.requestedId = id || null;
      const wanted = this.conversations().find((c) => c.id === this.requestedId);
      if (wanted) this.select(wanted, true);
    });

    this.loadConversations(true);

    // No websocket server (free deploy): fall back to a light poll so new messages still show up.
    if (!environment.reverbHost) this.pollTimer = setInterval(() => this.poll(), 6000);
  }

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  /** True while a poll round is still running, so slow responses never pile up or arrive out of order. */
  private polling = false;
  private pollRound = 0;

  /**
   * Cheap poll: every round asks only for messages newer than the newest one we have (one small request).
   * Every 5th round also refreshes the conversation list and the latest page (edits, reactions).
   */
  private poll(): void {
    if (document.hidden || this.polling) return;
    this.polling = true;
    this.pollRound++;

    const id = this.activeConversationId;
    const full = this.pollRound % 5 === 0;
    const done = (): void => {
      this.polling = false;
    };

    const fetchMessages = (): void => {
      if (!id) {
        done();
        return;
      }
      const newest = this.messages()
        .map((m) => m.id)
        .filter((n) => n > 0)
        .reduce((a, b) => Math.max(a, b), 0);

      this.messageService
        .getMessages(id, undefined, full || !newest ? undefined : newest)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            if (this.activeConversationId !== id) return;
            const known = new Set(this.messages().map((m) => m.id));
            for (const m of [...res.messages].reverse()) {
              if (known.has(m.id)) this.replaceMessage(m);
              else this.append(m);
            }
          },
          error: done,
          complete: done,
        });
    };

    if (!full) {
      fetchMessages();
      return;
    }

    this.conversationService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.conversations.set(
            res.conversations.map((c) => (c.id === this.activeConversationId ? { ...c, unread_count: 0 } : c)),
          );
        },
        error: done,
        complete: fetchMessages,
      });
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    for (const c of this.conversations()) this.echo.leaveConversation(c.id);
    this.typingTimers.forEach((t) => clearTimeout(t));
  }

  private loadConversations(first: boolean): void {
    this.conversationService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const prev = this.conversations();
          // Keep the unread count we already cleared locally for the open chat.
          this.conversations.set(
            res.conversations.map((c) => (c.id === this.activeConversationId ? { ...c, unread_count: 0 } : c)),
          );
          // Listen to every conversation so the list updates live, not just the open chat.
          res.conversations.forEach((c) => this.watch(c.id));

          if (!first) return;
          const wanted = res.conversations.find((c) => c.id === this.requestedId);
          if (wanted) this.select(wanted, true);
          // On a phone the list is the landing pane; only desktop and tablet preselect a chat.
          else if (res.conversations.length && !this.isPhone() && !prev.length) this.select(res.conversations[0], false);
        },
      });
  }

  private watch(id: number): void {
    this.echo.watch(id, {
      sent: ({ message }: { message: Message }) => this.onIncoming(message),
      changed: ({ message }: { message: Message }) => this.onChanged(message),
      typing: (e: { id: number; name: string }) => this.onTyping(id, e),
      read: (e: { id: number; at: string }) => this.onRead(id, e),
    });
  }

  /** A tap on a conversation in the list. */
  choose(conversation: Conversation): void {
    this.select(conversation, true);
  }

  select(conversation: Conversation, show: boolean): void {
    if (show) this.view.set('main');
    if (this.activeConversationId === conversation.id) return;

    this.activeConversationId = conversation.id;
    const opened = this.conversations().find((c) => c.id === conversation.id) ?? conversation;
    this.selected.set(opened);

    // Remember where I stopped reading before the read marker moves, so the divider can sit there.
    const readAt = opened.participants.find((p) => p.id === this.currentUserId)?.last_read_at;
    const unread = opened.unread_count ?? 0;
    this.unreadFromId.set(null);
    this.unreadCount.set(0);
    this.pendingUnreadId = null;
    this.messages.set([]);
    this.hasMore.set(false);
    this.menuFor.set(null);
    this.replyTo.set(null);
    this.cancelEdit();
    this.loading.set(true);
    this.lastKey = 0;
    this.patchConversation(conversation.id, { unread_count: 0 });
    this.watch(conversation.id);

    this.messageService
      .getMessages(conversation.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (this.activeConversationId !== conversation.id) return;
          // API returns newest first; the feed reads oldest first.
          const thread = [...res.messages].reverse();

          if (unread > 0) {
            const since = readAt ? new Date(readAt).getTime() : 0;
            const first = thread.find((m) => m.sender?.id !== this.currentUserId && m.id > 0 && new Date(m.created_at).getTime() > since);
            if (first) {
              this.unreadFromId.set(first.id);
              this.unreadCount.set(unread);
              this.pendingUnreadId = first.id;
            }
          }

          this.messages.set(thread);
          this.hasMore.set(res.meta.has_more);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });

    this.markRead(conversation.id);
  }

  /** Scrolling to the top loads the page of older messages. */
  onScroll(): void {
    const el = this.feed()?.nativeElement;
    if (el && el.scrollTop < 60) this.loadOlder();
  }

  loadOlder(): void {
    const id = this.activeConversationId;
    const oldest = this.messages()[0]?.id;
    if (!id || !oldest || !this.hasMore() || this.loadingMore()) return;

    this.loadingMore.set(true);
    this.messageService.getMessages(id, oldest).subscribe({
      next: (res) => {
        if (this.activeConversationId !== id) return;
        this.anchorHeight = this.feed()?.nativeElement.scrollHeight ?? null;
        const older = [...res.messages].reverse();
        // Never show a message twice, even if a page overlaps what we already have.
        this.messages.update((list) => [...older.filter((o) => !list.some((m) => m.id === o.id)), ...list]);
        this.hasMore.set(res.meta.has_more);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  // ---- sending, editing, replying ----

  onDraft(value: string): void {
    this.draft.set(value);
    this.sendTyping(value);
  }

  send(): void {
    const body = this.draft().trim();
    const id = this.selected()?.id;
    if (!body || !id) return;

    const editing = this.editing();
    if (editing) {
      this.draft.set('');
      this.editing.set(null);
      this.messageService.edit(editing.id, body).subscribe({
        next: (res) => this.replaceMessage(res.data),
        error: () => {
          this.draft.set(body);
          this.editing.set(editing);
        },
      });
      return;
    }

    const reply = this.replyTo();
    this.draft.set('');
    this.replyTo.set(null);

    // Show the message right away (negative temporary id); swap it for the real one when the server answers.
    const me = this.auth.currentUser();
    const tempId = -Date.now();
    const temp: Message = {
      id: tempId,
      conversation_id: id,
      sender: { id: this.currentUserId, name: me?.name ?? '', username: me?.username ?? '', avatar: me?.avatar ?? null },
      type: 'text',
      body,
      reply_to: reply ? { id: reply.id, body: reply.body, sender_id: reply.sender?.id ?? 0 } : null,
      attachments: [],
      edited_at: null,
      created_at: new Date().toISOString(),
    };
    this.messages.update((list) => [...list, temp]);

    this.messageService.sendText(id, body, reply?.id).subscribe({
      next: (res) => {
        this.messages.update((list) => list.filter((m) => m.id !== tempId));
        this.append(res.data);
        this.markRead(id);
      },
      // Take the temporary bubble away and put the text back so a failed send is never silently lost.
      error: () => {
        this.messages.update((list) => list.filter((m) => m.id !== tempId));
        this.draft.set(body);
        this.replyTo.set(reply);
      },
    });
  }

  attach(input: HTMLInputElement): void {
    const file = input.files?.[0];
    const id = this.selected()?.id;
    input.value = '';
    if (!file || !id) return;

    this.sending.set(true);
    this.sendError.set(null);
    this.messageService.sendFile(id, file, this.replyTo()?.id).subscribe({
      next: (res) => {
        this.append(res.data);
        this.replyTo.set(null);
        this.sending.set(false);
      },
      error: () => {
        this.sendError.set('Could not send the file (max 10 MB).');
        this.sending.set(false);
      },
    });
  }

  startReply(m: Message): void {
    this.cancelEdit();
    this.replyTo.set(m);
    this.menuFor.set(null);
  }

  startEdit(m: Message): void {
    this.replyTo.set(null);
    this.editing.set(m);
    this.draft.set(m.body ?? '');
    this.menuFor.set(null);
  }

  cancelEdit(): void {
    if (this.editing()) this.draft.set('');
    this.editing.set(null);
  }

  remove(m: Message): void {
    this.menuFor.set(null);
    if (!confirm('Delete this message for everyone?')) return;

    this.messageService.remove(m.id).subscribe({ next: (res) => this.replaceMessage(res.data) });
  }

  react(m: Message, emoji: string): void {
    this.menuFor.set(null);
    this.messageService.react(m.id, emoji).subscribe({ next: (res) => this.replaceMessage(res.data) });
  }

  togglePin(m: Message | null): void {
    const c = this.selected();
    if (!c) return;
    this.menuFor.set(null);

    this.api.pinMessage(c.id, m?.id ?? null).subscribe({
      next: (updated) => {
        this.conversations.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
        this.selected.set(updated);
      },
    });
  }

  toggleMenu(m: Message): void {
    if (m.deleted) return;
    this.menuFor.update((id) => (id === m.id ? null : m.id));
  }

  onCreated(result: DialogResult): void {
    this.composing.set(false);
    if (result.mode === 'contact') return;

    const c = result.conversation;
    this.conversations.update((list) => (list.some((x) => x.id === c.id) ? list : [c, ...list]));
    this.watch(c.id);
    this.select(c, true);
  }

  // ---- realtime ----

  private onIncoming(message: Message): void {
    const active = message.conversation_id === this.activeConversationId;
    this.clearTyping(message.conversation_id, message.sender?.id);

    if (!this.conversations().some((c) => c.id === message.conversation_id)) {
      // A chat someone just started with us: fetch the list so it appears.
      this.loadConversations(false);
      return;
    }

    if (active) {
      this.append(message);
      this.markRead(message.conversation_id);
    } else {
      this.touchList(message, !this.isMine(message));
    }

    if (!this.isMine(message)) {
      this.appearance.notify(message.sender?.name ?? 'Phanlink', message.body ?? 'Sent a file');
    }
  }

  private onChanged(message: Message): void {
    this.replaceMessage(message);
  }

  private onTyping(conversationId: number, e: { id: number; name: string }): void {
    if (!e || e.id === this.currentUserId) return;

    this.typing.update((t) => ({ ...t, [conversationId]: { ...(t[conversationId] ?? {}), [e.id]: e.name } }));

    const key = `${conversationId}:${e.id}`;
    clearTimeout(this.typingTimers.get(key));
    this.typingTimers.set(key, setTimeout(() => this.clearTyping(conversationId, e.id), TYPING_SHOW_MS));
  }

  private clearTyping(conversationId: number, userId: number | undefined): void {
    if (userId === undefined || !this.typing()[conversationId]?.[userId]) return;

    this.typing.update((t) => {
      const { [userId]: _gone, ...rest } = t[conversationId] ?? {};
      return { ...t, [conversationId]: rest };
    });
  }

  /** Someone opened the chat: move their read marker so our ticks turn to "seen". */
  private onRead(conversationId: number, e: { id: number; at: string }): void {
    if (!e || e.id === this.currentUserId) return;

    const bump = (c: Conversation): Conversation =>
      c.id !== conversationId
        ? c
        : { ...c, participants: c.participants.map((p) => (p.id === e.id ? { ...p, last_read_at: e.at } : p)) };

    this.conversations.update((list) => list.map(bump));
    this.selected.update((c) => (c ? bump(c) : c));
  }

  /** Text shown in the header and the list row, e.g. "Ann is typing…". */
  typingText(conversationId: number): string {
    const names = Object.values(this.typing()[conversationId] ?? {});
    if (!names.length) return '';
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return `${names[0]} and ${names.length - 1} others are typing…`;
  }

  private sendTyping(value: string): void {
    const id = this.activeConversationId;
    if (!id || !value.trim() || this.editing()) return;
    // Hiding your online status hides your typing too.
    if (this.appearance.cached()?.showOnline === false) return;

    const now = Date.now();
    if (now - this.lastTypingSent < TYPING_SEND_MS) return;

    this.lastTypingSent = now;
    this.echo.whisper(id, 'typing', { id: this.currentUserId, name: this.myName });
  }

  private markRead(id: number): void {
    this.messageService.markAsRead(id).subscribe({
      next: () => {
        if (this.appearance.cached()?.readReceipts === false) return;
        this.echo.whisper(id, 'read', { id: this.currentUserId, at: new Date().toISOString() });
      },
    });
  }

  // ---- list and thread bookkeeping ----

  isPhone(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches;
  }

  url(path: string | null | undefined): string | null {
    return assetUrl(path);
  }

  /** Add a message once (the realtime event and the HTTP reply can both deliver it) and refresh the list row. */
  private append(message: Message): void {
    if (message.conversation_id === this.activeConversationId) {
      this.messages.update((list) => (list.some((m) => m.id === message.id) ? list : [...list, message]));
    }
    this.touchList(message, false);
  }

  /** Put the conversation at the top with the new preview; optionally count it as unread. */
  private touchList(message: Message, unread: boolean): void {
    this.conversations.update((list) => {
      const row = list.find((c) => c.id === message.conversation_id);
      if (!row) return list;

      const updated: Conversation = {
        ...row,
        unread_count: unread && !row.is_muted ? (row.unread_count ?? 0) + 1 : row.unread_count,
        latest_message: {
          id: message.id,
          body: message.body,
          type: message.type,
          sender_id: message.sender?.id ?? 0,
          created_at: message.created_at,
        },
      };
      return [updated, ...list.filter((c) => c.id !== row.id)];
    });
  }

  /** An edit, delete or reaction: swap the message in place. */
  private replaceMessage(message: Message): void {
    this.messages.update((list) => list.map((m) => (m.id === message.id ? message : m)));

    this.conversations.update((list) =>
      list.map((c) =>
        c.latest_message?.id === message.id
          ? { ...c, latest_message: { ...c.latest_message, body: message.deleted ? null : message.body } }
          : c,
      ),
    );
  }

  private patchConversation(id: number, patch: Partial<Conversation>): void {
    this.conversations.update((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  isMine(m: Message): boolean {
    return m.sender?.id === this.currentUserId;
  }

  /** True when every other member has read past this message. Unknown (hidden receipts) counts as not seen. */
  seen(m: Message): boolean {
    const c = this.selected();
    if (!c || !this.isMine(m)) return false;

    const others = c.participants.filter((p) => p.id !== this.currentUserId);
    const at = new Date(m.created_at).getTime();

    return others.length > 0 && others.every((p) => !!p.last_read_at && new Date(p.last_read_at).getTime() >= at);
  }

  reactionCount(m: Message): { emoji: string; count: number; mine: boolean }[] {
    return (m.reactions ?? []).map((r) => ({
      emoji: r.emoji,
      count: r.user_ids.length,
      mine: r.user_ids.includes(this.currentUserId),
    }));
  }

  /** Who wrote the message being replied to. */
  replyAuthor(senderId: number): string {
    if (senderId === this.currentUserId) return 'You';
    return this.selected()?.participants.find((p) => p.id === senderId)?.name ?? 'Someone';
  }

  initial(name: string | null | undefined): string {
    return (name ?? '?').charAt(0).toUpperCase();
  }

  previewOf(c: Conversation): string {
    const last = c.latest_message;
    if (!last) return 'No messages yet';
    return last.body ?? (last.type === 'image' ? 'Sent a photo' : last.type === 'file' ? 'Sent a file' : 'Message deleted');
  }

  fileName(path: string): string {
    return path.split('/').pop() ?? path;
  }

  size(bytes: number): string {
    return bytes >= 1_048_576
      ? `${(bytes / 1_048_576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
}
