import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Conversation } from '../../core/models/conversation';
import { SharedAttachment } from '../../core/models/phantom';
import { PhantomApi } from '../../core/services/phantom-api';
import { assetUrl } from '../../core/util/asset-url';
import { PmIcon } from '../../shared/icon/icon';
import { DialogResult, NewDialog } from '../../shared/new-dialog/new-dialog';
import { FrameView, PageFrame } from '../../shared/page-frame/page-frame';

@Component({
  selector: 'app-groups',
  imports: [DatePipe, RouterLink, PmIcon, PageFrame, NewDialog],
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
  view = signal<FrameView>('list');
  dialog = signal<'group' | 'invite' | null>(null);

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
        // On a phone the list is the landing pane; only wider screens preselect a group.
        if (list.length && !this.isPhone()) this.select(list[0], false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  /** A tap on a group in the list. */
  choose(g: Conversation): void {
    this.select(g, true);
  }

  select(g: Conversation, show: boolean): void {
    if (show) this.view.set('main');
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

  memberIds = computed(() => this.selected()?.participants.map((p) => p.id) ?? []);

  onDialogDone(result: DialogResult): void {
    this.dialog.set(null);
    if (result.mode === 'contact') return;

    const g = result.conversation;
    this.groups.update((list) => (list.some((x) => x.id === g.id) ? list.map((x) => (x.id === g.id ? g : x)) : [g, ...list]));
    this.select(g, true);
  }

  isPhone(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches;
  }

  url(path: string | null | undefined): string | null {
    return assetUrl(path);
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
