import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Contact, ContactDetail } from '../../core/models/phantom';
import { PhantomApi } from '../../core/services/phantom-api';
import { PmIcon } from '../../shared/icon/icon';
import { PageFrame } from '../../shared/page-frame/page-frame';

type Filter = 'all' | 'online';

@Component({
  selector: 'app-contacts',
  imports: [DatePipe, RouterLink, PmIcon, PageFrame],
  templateUrl: './contacts.html',
  styleUrl: './contacts.scss',
})
export class Contacts implements OnInit {
  private api = inject(PhantomApi);

  readonly tabs = ['Profile', 'Media', 'Links'];

  contacts = signal<Contact[]>([]);
  detail = signal<ContactDetail | null>(null);
  loading = signal(true);
  failed = signal(false);

  filter = signal<Filter>('all');
  query = signal('');
  selectedId = signal<number | null>(null);
  tab = signal('Profile');
  noteDraft = signal('');

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
        if (list.length) this.select(list[0]);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  select(c: Contact): void {
    this.selectedId.set(c.id);
    this.noteDraft.set(c.note ?? '');
    this.detail.set(null);

    this.api.contactDetail(c.id).subscribe({
      // Ignore a late response for a contact the user has already moved away from.
      next: (d) => this.selectedId() === c.id && this.detail.set(d),
    });
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
