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
import { MessageService } from '../../core/services/message';
import { Conversation } from '../../core/models/conversation';
import { Message, MessageAttachment } from '../../core/models/message';
import { Appearance } from '../../core/services/appearance';
import { assetUrl } from '../../core/util/asset-url';
import { PmAvatar } from '../../shared/avatar/avatar';
import { PmIcon } from '../../shared/icon/icon';
import { DialogResult, NewDialog } from '../../shared/new-dialog/new-dialog';
import { FrameView, PageFrame } from '../../shared/page-frame/page-frame';

@Component({
  selector: 'app-messages',
  imports: [FormsModule, DatePipe, RouterLink, PmIcon, PmAvatar, PageFrame, NewDialog],
  templateUrl: './messages.html',
  styleUrl: './messages.scss',
})
export class Messages implements OnInit, OnDestroy {
  private conversationService = inject(ConversationService);
  private messageService = inject(MessageService);
  private echo = inject(EchoService);
  private auth = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private appearance = inject(Appearance);

  private feed = viewChild<ElementRef<HTMLElement>>('feed');

  conversations = signal<Conversation[]>([]);
  selected = signal<Conversation | null>(null);
  messages = signal<Message[]>([]);
  draft = signal('');
  query = signal('');
  loading = signal(false);
  sending = signal(false);
  composing = signal(false);
  sendError = signal<string | null>(null);
  view = signal<FrameView>('list');

  currentUserId = this.auth.currentUser()?.id ?? 0;

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

  private activeConversationId: number | null = null;
  private requestedId: number | null = null;

  constructor() {
    // Keep the newest message in view whenever the thread changes.
    effect(() => {
      this.messages();
      queueMicrotask(() => {
        const el = this.feed()?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
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

    this.conversationService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.conversations.set(res.conversations);

          const wanted = res.conversations.find((c) => c.id === this.requestedId);
          if (wanted) this.select(wanted, true);
          // On a phone the list is the landing pane; only desktop and tablet preselect a chat.
          else if (res.conversations.length && !this.isPhone()) this.select(res.conversations[0], false);
        },
      });
  }

  ngOnDestroy(): void {
    if (this.activeConversationId) this.echo.leaveConversation(this.activeConversationId);
  }

  /** A tap on a conversation in the list. */
  choose(conversation: Conversation): void {
    this.select(conversation, true);
  }

  select(conversation: Conversation, show: boolean): void {
    if (show) this.view.set('main');
    if (this.activeConversationId === conversation.id) return;

    if (this.activeConversationId) this.echo.leaveConversation(this.activeConversationId);

    this.activeConversationId = conversation.id;
    this.selected.set(conversation);
    this.messages.set([]);
    this.loading.set(true);
    this.patchConversation(conversation.id, { unread_count: 0 });

    this.messageService
      .getMessages(conversation.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (this.activeConversationId !== conversation.id) return;
          // API returns newest first; the feed reads oldest first.
          this.messages.set([...res.messages].reverse());
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });

    this.messageService.markAsRead(conversation.id).subscribe();

    this.echo.listenToConversation(conversation.id, ({ message }: { message: Message }) => {
      this.append(message);
      if (!this.isMine(message)) {
        this.appearance.notify(message.sender?.name ?? 'Phanlink', message.body ?? 'Sent a file');
      }
      this.messageService.markAsRead(conversation.id).subscribe();
    });
  }

  send(): void {
    const body = this.draft().trim();
    const id = this.selected()?.id;
    if (!body || !id) return;

    this.draft.set('');
    this.messageService.sendText(id, body).subscribe({
      next: (res) => {
        this.append(res.data);
        this.messageService.markAsRead(id).subscribe();
      },
      // Put the text back so a failed send is never silently lost.
      error: () => this.draft.set(body),
    });
  }

  attach(input: HTMLInputElement): void {
    const file = input.files?.[0];
    const id = this.selected()?.id;
    input.value = '';
    if (!file || !id) return;

    this.sending.set(true);
    this.sendError.set(null);
    this.messageService.sendFile(id, file).subscribe({
      next: (res) => {
        this.append(res.data);
        this.sending.set(false);
      },
      error: () => {
        this.sendError.set('Could not send the file (max 10 MB).');
        this.sending.set(false);
      },
    });
  }

  onCreated(result: DialogResult): void {
    this.composing.set(false);
    if (result.mode === 'contact') return;

    const c = result.conversation;
    this.conversations.update((list) => (list.some((x) => x.id === c.id) ? list : [c, ...list]));
    this.select(c, true);
  }

  isPhone(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches;
  }

  url(path: string | null | undefined): string | null {
    return assetUrl(path);
  }

  /** Add a message once (the realtime event and the HTTP reply can both deliver it) and refresh the list row. */
  private append(message: Message): void {
    this.messages.update((list) => (list.some((m) => m.id === message.id) ? list : [...list, message]));

    this.conversations.update((list) => {
      const row = list.find((c) => c.id === message.conversation_id);
      if (!row) return list;
      const updated: Conversation = {
        ...row,
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

  private patchConversation(id: number, patch: Partial<Conversation>): void {
    this.conversations.update((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  isMine(m: Message): boolean {
    return m.sender?.id === this.currentUserId;
  }

  initial(name: string | null | undefined): string {
    return (name ?? '?').charAt(0).toUpperCase();
  }

  previewOf(c: Conversation): string {
    const last = c.latest_message;
    if (!last) return 'No messages yet';
    return last.body ?? (last.type === 'image' ? 'Sent a photo' : 'Sent a file');
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
