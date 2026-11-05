import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SavedCollection, SavedItem } from '../../core/models/phantom';
import { PhantomApi } from '../../core/services/phantom-api';
import { PmIcon } from '../../shared/icon/icon';
import { PageFrame } from '../../shared/page-frame/page-frame';

type Tab = 'all' | 'messages' | 'files';

@Component({
  selector: 'app-saved',
  imports: [DatePipe, RouterLink, PmIcon, PageFrame],
  templateUrl: './saved.html',
  styleUrl: './saved.scss',
})
export class Saved implements OnInit {
  private api = inject(PhantomApi);

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'messages', label: 'Messages' },
    { id: 'files', label: 'Files' },
  ];

  items = signal<SavedItem[]>([]);
  collections = signal<SavedCollection[]>([]);
  total = signal(0);
  loading = signal(true);
  failed = signal(false);

  /** null = every collection. */
  collectionId = signal<number | null>(null);
  tab = signal<Tab>('all');
  query = signal('');
  picked = signal<number | null>(null);
  newName = signal('');
  creating = signal(false);

  /** Items grouped under "Today", "Yesterday" or the calendar date. */
  days = computed(() => {
    const groups = new Map<string, SavedItem[]>();
    for (const s of this.items()) {
      const label = this.dayLabel(s.message.created_at);
      groups.set(label, [...(groups.get(label) ?? []), s]);
    }
    return [...groups].map(([label, items]) => ({ label, items }));
  });

  /** The item shown in the right panel: the one clicked, else the first with a file. */
  focus = computed<SavedItem | undefined>(
    () =>
      this.items().find((s) => s.id === this.picked()) ??
      this.items().find((s) => s.message.attachments.length) ??
      this.items()[0],
  );

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.api
      .saved({
        collection_id: this.collectionId(),
        type: this.tab(),
        q: this.query().trim() || undefined,
      })
      .subscribe({
        next: (r) => {
          this.items.set(r.saved);
          this.collections.set(r.collections);
          this.total.set(r.total);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  chooseCollection(id: number | null): void {
    this.collectionId.set(id);
    this.reload();
  }

  chooseTab(t: Tab): void {
    this.tab.set(t);
    this.reload();
  }

  search(value: string): void {
    this.query.set(value);
    this.reload();
  }

  pick(s: SavedItem): void {
    this.picked.set(s.id);
  }

  unsave(s: SavedItem): void {
    this.api.unsave(s.id).subscribe({ next: () => this.reload() });
  }

  createCollection(): void {
    const name = this.newName().trim();
    if (!name) return;

    this.api.createCollection(name).subscribe({
      next: () => {
        this.newName.set('');
        this.creating.set(false);
        this.reload();
      },
    });
  }

  private dayLabel(iso: string): string {
    const d = new Date(iso);
    const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((start(new Date()) - start(d)) / 86_400_000);

    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
