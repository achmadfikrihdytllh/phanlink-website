import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { Contact, ContactDetail } from '../../core/models/phantom';
import { ConversationService } from '../../core/services/conversation';
import { PhantomApi } from '../../core/services/phantom-api';
import { assetUrl } from '../../core/util/asset-url';
import { PmAvatar } from '../../shared/avatar/avatar';
import { PmIcon } from '../../shared/icon/icon';
import { DialogResult, NewDialog } from '../../shared/new-dialog/new-dialog';
import { FrameView, PageFrame } from '../../shared/page-frame/page-frame';

type Filter = 'all' | 'online';

@Component({
  selector: 'app-contacts',
  imports: [DatePipe, RouterLink, PmIcon, PmAvatar, PageFrame, NewDialog],
  templateUrl: './contacts.html',
  styleUrl: './contacts.scss',
})
export class Contacts implements OnInit {
  private api = inject(PhantomApi);
  private conversations = inject(ConversationService);
  private router = inject(Router);

  readonly tabs = ['Profile', 'Media'];

  contacts = signal<Contact[]>([]);
  detail = signal<ContactDetail | null>(null);
  loading = signal(true);
  failed = signal(false);

  filter = signal<Filter>('all');
  query = signal('');
  selectedId = signal<number | null>(null);
  tab = signal('Profile');
  noteDraft = signal('');
  view = signal<FrameView>('list');
  adding = signal(false);
  opening = signal(false);

  onlineCount = computed(() => this.contacts().filter((c) => c.status === 'online').length);

  visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.contacts().filter(
      (c) =>
        (this.filter() === 'all' || c.status === 'online') &&
        (!q || `${c.name} ${c.codename}`.toLowerCase().includes(q)),
    );
  });

  selected = computed<Contact | null>(
    () => this.contacts().find((c) => c.id === this.selectedId()) ?? null,
  );

  ngOnInit(): void {
    this.api.contacts().subscribe({
      next: (list) => {
        this.contacts.set(list);
        this.loading.set(false);
        if (list.length && !this.isPhone()) this.select(list[0], false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  select(c: Contact, show = true): void {
    if (show) this.view.set('main');
    this.selectedId.set(c.id);
    this.noteDraft.set(c.note ?? '');
    this.detail.set(null);

    this.api.contactDetail(c.id).subscribe({
      // Ignore a late response for a contact the user has already moved away from.
      next: (d) => this.selectedId() === c.id && this.detail.set(d),
    });
  }

  onAdded(result: DialogResult): void {
    this.adding.set(false);
    if (result.mode !== 'contact') return;

    const added = result.contact;
    this.contacts.update((list) => [added, ...list.filter((x) => x.id !== added.id)]);
    this.select(added);
  }

  /** Open the chat with this contact, creating the private conversation if there is none yet. */
  message(): void {
    const c = this.selected();
    if (!c || this.opening()) return;

    const existing = this.detail()?.conversation_id;
    if (existing) {
      this.router.navigate(['/messages'], { queryParams: { c: existing } });
      return;
    }

    this.opening.set(true);
    this.conversations.startPrivate(c.id).subscribe({
      next: (r) => this.router.navigate(['/messages'], { queryParams: { c: r.conversation.id } }),
      error: () => this.opening.set(false),
    });
  }

  remove(): void {
    const c = this.selected();
    if (!c || !confirm(`Remove ${c.name} from your contacts?`)) return;

    this.api.removeContact(c.id).subscribe({
      next: () => {
        const rest = this.contacts().filter((x) => x.id !== c.id);
        this.contacts.set(rest);
        this.selectedId.set(null);
        this.detail.set(null);
        this.view.set('list');
        if (rest.length && !this.isPhone()) this.select(rest[0], false);
      },
    });
  }

  isPhone(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches;
  }

  url(path: string | null | undefined): string | null {
    return assetUrl(path);
  }

  saveNote(): void {
    const c = this.selected();
    if (!c || this.noteDraft() === (c.note ?? '')) return;
    this.patch(c, { note: this.noteDraft() });
  }

  toggleMute(): void {
    const c = this.selected();
    if (c) this.patch(c, { is_muted: !c.is_muted });
  }

  toggleBlock(): void {
    const c = this.selected();
    if (c) this.patch(c, { is_blocked: !c.is_blocked });
  }

  statusText(c: Contact): string {
    if (c.status === 'online') return 'Online';
    if (!c.last_seen_at) return 'Offline';
    return `Last seen ${new Date(c.last_seen_at).toLocaleString([], {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    })}`;
  }

  size(bytes: number): string {
    return bytes >= 1_048_576
      ? `${(bytes / 1_048_576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  private patch(c: Contact, data: Parameters<PhantomApi['updateContact']>[1]): void {
    this.api.updateContact(c.id, data).subscribe({
      next: (updated) =>
        this.contacts.update((list) => list.map((x) => (x.id === updated.id ? updated : x))),
    });
  }
}
