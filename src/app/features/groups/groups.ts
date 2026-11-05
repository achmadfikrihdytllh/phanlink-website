import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Conversation } from '../../core/models/conversation';
import { SharedAttachment } from '../../core/models/phantom';
import { PhantomApi } from '../../core/services/phantom-api';
import { PmIcon } from '../../shared/icon/icon';
import { PageFrame } from '../../shared/page-frame/page-frame';

@Component({
  selector: 'app-groups',
  imports: [DatePipe, RouterLink, PmIcon, PageFrame],
  templateUrl: './groups.html',
  styleUrl: './groups.scss',
})
export class Groups implements OnInit {
  private api = inject(PhantomApi);

  groups = signal<Conversation[]>([]);
  files = signal<SharedAttachment[]>([]);
  selectedId = signal<number | null>(null);
  query = signal('');
  loading = signal(true);
  failed = signal(false);

  selected = computed<Conversation | null>(
    () => this.groups().find((g) => g.id === this.selectedId()) ?? null,
  );

  visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.groups().filter((g) => (g.name ?? '').toLowerCase().includes(q)) : this.groups();
  });

  onlineCount = computed(
    () => this.selected()?.participants.filter((p) => p.status === 'online').length ?? 0,
  );

  ngOnInit(): void {
    this.api.groups().subscribe({
      next: (list) => {
        this.groups.set(list);
        this.loading.set(false);
        if (list.length) this.select(list[0]);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  select(g: Conversation): void {
    this.selectedId.set(g.id);
    this.files.set([]);

    this.api.conversationFiles(g.id).subscribe({
      // Ignore a late response for a group the user has already left.
      next: (f) => this.selectedId() === g.id && this.files.set(f),
    });
  }

  toggleMute(): void {
    const g = this.selected();
    if (g) this.patch(g, { is_muted: !g.is_muted });
  }

  togglePin(): void {
    const g = this.selected();
    if (g) this.patch(g, { is_pinned: !g.is_pinned });
  }

  initial(name: string | null | undefined): string {
    return (name ?? '?').charAt(0).toUpperCase();
  }

  size(bytes: number): string {
    return bytes >= 1_048_576
      ? `${(bytes / 1_048_576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  private patch(g: Conversation, prefs: { is_muted?: boolean; is_pinned?: boolean }): void {
    this.api.setConversationPrefs(g.id, prefs).subscribe({
      next: (updated) =>
        this.groups.update((list) => list.map((x) => (x.id === updated.id ? updated : x))),
    });
  }
}
