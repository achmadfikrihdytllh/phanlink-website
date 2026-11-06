import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Conversation } from '../../core/models/conversation';
import { SearchResponse } from '../../core/models/phantom';
import { ConversationService } from '../../core/services/conversation';
import { PhantomApi } from '../../core/services/phantom-api';
import { PmIcon } from '../../shared/icon/icon';
import { FrameView, PageFrame } from '../../shared/page-frame/page-frame';

interface Segment {
  text: string;
  hit: boolean;
}

type MessageHit = SearchResponse['messages'][number];

const RECENT_KEY = 'phanlink.recentSearches';

@Component({
  selector: 'app-search',
  imports: [DatePipe, RouterLink, PmIcon, PageFrame],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class Search implements OnInit, OnDestroy {
  private api = inject(PhantomApi);
  private conversationService = inject(ConversationService);
  private route = inject(ActivatedRoute);

  private timer: ReturnType<typeof setTimeout> | null = null;

  conversations = signal<Conversation[]>([]);
  result = signal<SearchResponse | null>(null);
  loading = signal(false);
  failed = signal(false);
  saveState = signal<'idle' | 'saved' | 'error'>('idle');

  query = signal('');
  conversationId = signal<number | null>(null);
  showFiles = signal(true);
  recent = signal<string[]>(this.loadRecent());
  pickedId = signal<number | null>(null);
  view = signal<FrameView>('main');

  messages = computed(() => this.result()?.messages ?? []);
  files = computed(() => this.result()?.files ?? []);
  total = computed(() => this.messages().length + this.files().length);

  focus = computed<MessageHit | undefined>(
    () => this.messages().find((h) => h.message.id === this.pickedId()) ?? this.messages()[0],
  );

  ngOnInit(): void {
    // `/search?c=ID` pre-filters to one conversation (the search icon in a chat header).
    const c = Number(this.route.snapshot.queryParamMap.get('c'));
    if (c) this.conversationId.set(c);

    this.conversationService.list().subscribe({
      next: (r) => this.conversations.set(r.conversations),
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  /** Wait for a pause in typing so each keystroke does not hit the API. */
  onType(value: string): void {
    this.query.set(value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), 300);
  }

  run(): void {
    const q = this.query().trim();

    if (!q) {
      this.result.set(null);
      return;
    }

    this.loading.set(true);
    this.failed.set(false);
    this.saveState.set('idle');

    this.api
      .search({
        q,
        conversation_id: this.conversationId(),
        types: this.showFiles() ? ['messages', 'files'] : ['messages'],
      })
      .subscribe({
        next: (r) => {
          // Drop a response that arrived after the user kept typing.
          if (r.query !== this.query().trim()) return;
          this.result.set(r);
          this.pickedId.set(null);
          this.loading.set(false);
          this.remember(q);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  setConversation(value: string): void {
    this.conversationId.set(value ? Number(value) : null);
    this.run();
  }

  setFiles(checked: boolean): void {
    this.showFiles.set(checked);
    this.run();
  }

  useRecent(term: string): void {
    this.view.set('main');
    this.query.set(term);
    this.run();
  }

  resetFilters(): void {
    this.conversationId.set(null);
    this.showFiles.set(true);
    this.run();
  }

  saveFocused(): void {
    const f = this.focus();
    if (!f) return;

    this.api.saveMessage(f.message.id).subscribe({
      next: () => this.saveState.set('saved'),
      error: () => this.saveState.set('error'),
    });
  }

  /** Split text around each match so the template can highlight it without innerHTML. */
  segments(text: string | null | undefined): Segment[] {
    const source = text ?? '';
    const q = this.query().trim();
    if (!q) return [{ text: source, hit: false }];

    const lower = source.toLowerCase();
    const needle = q.toLowerCase();
    const out: Segment[] = [];
    let from = 0;

    for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, from)) {
      if (at > from) out.push({ text: source.slice(from, at), hit: false });
      out.push({ text: source.slice(at, at + needle.length), hit: true });
      from = at + needle.length;
    }
    if (from < source.length) out.push({ text: source.slice(from), hit: false });
    return out;
  }

  private remember(q: string): void {
    const next = [q, ...this.recent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 5);
    this.recent.set(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Storage can be blocked (private mode); recents just won't persist.
    }
  }

  private loadRecent(): string[] {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }
}
