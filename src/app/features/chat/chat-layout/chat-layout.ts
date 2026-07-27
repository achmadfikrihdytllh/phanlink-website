import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  ViewChildren,
  QueryList,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConversationService } from '../../../core/services/conversation';
import { MessageService } from '../../../core/services/message';
import { EchoService } from '../../../core/services/echo';
import { AuthService } from '../../../core/services/auth';
import { Conversation } from '../../../core/models/conversation';
import { Message } from '../../../core/models/message';

interface Connector {
  key: string;
  d: string;
}

@Component({
  selector: 'app-chat-layout',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-layout.html',
  styleUrl: './chat-layout.scss',
})
export class ChatLayout implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('feedContainer') feedContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('bubblesWrap') bubblesWrap!: ElementRef<HTMLDivElement>;
  @ViewChildren('bubbleEl') bubbleEls!: QueryList<ElementRef<HTMLDivElement>>;

  conversations = signal<Conversation[]>([]);
  selectedConversation = signal<Conversation | null>(null);
  messages = signal<Message[]>([]);
  newMessageText = signal('');
  connectors = signal<Connector[]>([]);
  currentUserId: number;

  private currentConversationId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private viewReady = false;

  constructor(
    private conversationService: ConversationService,
    private messageService: MessageService,
    private echoService: EchoService,
    private authService: AuthService
  ) {
    this.currentUserId = this.authService.currentUser()?.id ?? 0;

    // effect() otomatis jalan ulang setiap kali signal messages() berubah,
    // termasuk saat pertama kali di-set. Ini jaring pengaman utama,
    // tidak bergantung sepenuhnya pada ResizeObserver.
    effect(() => {
      this.messages(); // baca signal supaya effect ini "subscribe" ke perubahannya
      if (this.viewReady) {
        // beri jeda 1 tick supaya DOM benar-benar sudah ter-render dulu
        setTimeout(() => this.recalculateLine(), 0);
      }
    });
  }

  ngOnInit(): void {
    this.loadConversations();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;

    this.resizeObserver = new ResizeObserver(() => {
      this.recalculateLine();
    });

    if (this.bubblesWrap) {
      this.resizeObserver.observe(this.bubblesWrap.nativeElement);
    }

    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => this.recalculateLine());
    }

    this.recalculateLine();
  }

  ngOnDestroy(): void {
    if (this.currentConversationId) {
      this.echoService.leaveConversation(this.currentConversationId);
    }
    this.resizeObserver?.disconnect();
  }

  loadConversations(): void {
    this.conversationService.list().subscribe({
      next: (res) => this.conversations.set(res.conversations),
    });
  }

  selectConversation(conversation: Conversation): void {
    if (this.currentConversationId) {
      this.echoService.leaveConversation(this.currentConversationId);
    }

    this.selectedConversation.set(conversation);
    this.currentConversationId = conversation.id;
    this.messages.set([]);
    this.connectors.set([]);

    this.messageService.getMessages(conversation.id).subscribe({
      next: (res) => {
        this.messages.set([...res.messages].reverse());
      },
    });

    this.messageService.markAsRead(conversation.id).subscribe();

    this.echoService.listenToConversation(conversation.id, (data: { message: Message }) => {
      this.messages.update((msgs) => [...msgs, data.message]);
      this.messageService.markAsRead(conversation.id).subscribe();
    });
  }

  sendMessage(): void {
    const text = this.newMessageText().trim();
    const conversation = this.selectedConversation();

    if (!text || !conversation) {
      return;
    }

    this.messageService.sendText(conversation.id, text).subscribe({
      next: (res) => {
        this.messages.update((msgs) => [...msgs, res.data]);
        this.newMessageText.set('');
      },
    });
  }

  isMyMessage(message: Message): boolean {
    return message.sender.id === this.currentUserId;
  }

  getOtherParticipantInitial(): string {
    const conversation = this.selectedConversation();
    return conversation?.name?.charAt(0)?.toUpperCase() ?? '?';
  }

  get newMessageTextModel(): string {
    return this.newMessageText();
  }

  set newMessageTextModel(value: string) {
    this.newMessageText.set(value);
  }

  private anchorPoint(el: HTMLElement, isMe: boolean, containerRect: DOMRect) {
    const rect = el.getBoundingClientRect();
    const x = isMe ? rect.left - containerRect.left : rect.right - containerRect.left;
    const y = rect.top - containerRect.top + rect.height / 2;
    return { x, y };
  }

  private recalculateLine(): void {
    requestAnimationFrame(() => {
      if (!this.feedContainer || !this.bubbleEls) {
        return;
      }

      const els = this.bubbleEls.toArray();
      if (els.length < 2) {
        this.connectors.set([]);
        return;
      }

      const containerRect = this.feedContainer.nativeElement.getBoundingClientRect();
      const msgs = this.messages();
      const nextConnectors: Connector[] = [];

      for (let i = 1; i < els.length; i++) {
        const prevMsg = msgs[i - 1];
        const currMsg = msgs[i];
        if (!prevMsg || !currMsg) continue;

        const a = this.anchorPoint(els[i - 1].nativeElement, this.isMyMessage(prevMsg), containerRect);
        const b = this.anchorPoint(els[i].nativeElement, this.isMyMessage(currMsg), containerRect);

        const midY = a.y + (b.y - a.y) * 0.5;
        const d = `M ${a.x} ${a.y} L ${a.x} ${midY} L ${b.x} ${midY} L ${b.x} ${b.y}`;

        nextConnectors.push({
          key: `${prevMsg.id}-${currMsg.id}`,
          d,
        });
      }

      this.connectors.set(nextConnectors);
    });
  }
}