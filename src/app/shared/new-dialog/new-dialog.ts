import { Component, OnDestroy, computed, inject, input, output, signal } from '@angular/core';

import { Conversation } from '../../core/models/conversation';
import { Contact } from '../../core/models/phantom';
import { User } from '../../core/models/user';
import { ConversationService } from '../../core/services/conversation';
import { PhantomApi } from '../../core/services/phantom-api';
import { PmAvatar } from '../avatar/avatar';
import { PmIcon } from '../icon/icon';

export type DialogMode = 'chat' | 'group' | 'contact' | 'invite';

export type DialogResult =
  | { mode: 'chat' | 'group' | 'invite'; conversation: Conversation }
  | { mode: 'contact'; contact: Contact };

const TITLES: Record<DialogMode, string> = {
  chat: 'New message',
  group: 'New group',
  contact: 'Add a confidant',
  invite: 'Invite to the group',
};

/** One dialog for every "find people, then act" flow: new chat, new group, add contact, invite. */
@Component({
  selector: 'pm-new-dialog',
  imports: [PmAvatar, PmIcon],
  template: `
    <div class="overlay" (click)="closed.emit()">
      <div class="box" role="dialog" aria-modal="true" [attr.aria-label]="title()" (click)="$event.stopPropagation()">
        <header>
          <h2 class="pm-title">{{ title() }}</h2>
          <button type="button" class="x" aria-label="Close" (click)="closed.emit()">
            <pm-icon name="close" [size]="12" />
          </button>
        </header>

        @if (mode() === 'group') {
          <label class="field">
            <span class="pm-label">Group name</span>
            <input
              type="text"
              maxlength="80"
              placeholder="Name your hideout"
              [value]="name()"
              (input)="name.set($any($event.target).value)"
            />
          </label>
        }

        <label class="field">
          <span class="pm-label">Find people</span>
          <input
            type="text"
            placeholder="Name or username"
            autocomplete="off"
            [value]="query()"
            (input)="onType($any($event.target).value)"
          />
        </label>

        @if (picked().length) {
          <ul class="chips">
            @for (u of picked(); track u.id) {
              <li>
                {{ u.name }}
                <button type="button" [attr.aria-label]="'Remove ' + u.name" (click)="toggle(u)">&times;</button>
              </li>
            }
          </ul>
        }

        <ul class="results">
          @for (u of results(); track u.id) {
            <li>
              <button type="button" (click)="pick(u)" [disabled]="busy()">
                <pm-avatar [name]="u.name" [src]="u.avatar" [size]="24" />
                <span>
                  <strong>{{ u.name }}</strong>
                  <small>&#64;{{ u.username }}</small>
                </span>
                @if (multi() && isPicked(u)) {
                  <span class="tick">Added</span>
                }
              </button>
            </li>
          } @empty {
            <li class="none">
              {{ searching() ? 'Searching…' : query().trim() ? 'No one found.' : 'Type a name to start.' }}
            </li>
          }
        </ul>

        @if (error()) {
          <p class="err">{{ error() }}</p>
        }

        @if (multi()) {
          <footer>
            <button type="button" class="pm-btn" [disabled]="!canConfirm() || busy()" (click)="confirm()">
              <span>{{ busy() ? 'Working…' : mode() === 'group' ? 'Create group' : 'Invite' }}</span>
            </button>
          </footer>
        }
      </div>
    </div>
  `,
  styleUrl: './new-dialog.scss',
})
export class NewDialog implements OnDestroy {
  private api = inject(PhantomApi);
  private conversations = inject(ConversationService);
  private timer: ReturnType<typeof setTimeout> | null = null;

  mode = input.required<DialogMode>();
  /** Required for `invite`: the group people are added to. */
  conversationId = input<number | null>(null);
  /** People already in the group, hidden from the results for `invite`. */
  exclude = input<number[]>([]);

  done = output<DialogResult>();
  closed = output<void>();

  query = signal('');
  name = signal('');
  results = signal<User[]>([]);
  picked = signal<User[]>([]);
  searching = signal(false);
  busy = signal(false);
  error = signal<string | null>(null);

  title = computed(() => TITLES[this.mode()]);
  multi = computed(() => this.mode() === 'group' || this.mode() === 'invite');
  canConfirm = computed(
    () => this.picked().length > 0 && (this.mode() !== 'group' || this.name().trim().length > 0),
  );

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  onType(value: string): void {
    this.query.set(value);
    if (this.timer) clearTimeout(this.timer);

    if (!value.trim()) {
      this.results.set([]);
      this.searching.set(false);
      return;
    }

    this.searching.set(true);
    this.timer = setTimeout(() => this.search(value.trim()), 250);
  }

  isPicked(u: User): boolean {
    return this.picked().some((p) => p.id === u.id);
  }

  toggle(u: User): void {
    this.picked.update((list) => (this.isPicked(u) ? list.filter((p) => p.id !== u.id) : [...list, u]));
  }

  pick(u: User): void {
    this.error.set(null);

    if (this.multi()) {
      this.toggle(u);
      return;
    }

    this.busy.set(true);

    if (this.mode() === 'chat') {
      this.conversations.startPrivate(u.id).subscribe({
        next: (r) => this.finish({ mode: 'chat', conversation: r.conversation }),
        error: () => this.fail('Could not start the conversation.'),
      });
    } else {
      this.api.addContact(u.id).subscribe({
        next: (contact) => this.finish({ mode: 'contact', contact }),
        error: () => this.fail('Could not add this contact. They may already be in your list.'),
      });
    }
  }

  confirm(): void {
    if (!this.canConfirm()) return;

    this.error.set(null);
    this.busy.set(true);
    const ids = this.picked().map((u) => u.id);

    if (this.mode() === 'group') {
      this.conversations.createGroup({ name: this.name().trim(), participant_ids: ids }).subscribe({
        next: (r) => this.finish({ mode: 'group', conversation: r.conversation }),
        error: () => this.fail('Could not create the group.'),
      });
      return;
    }

    const id = this.conversationId();
    if (!id) return this.fail('No group selected.');

    this.api.invite(id, ids).subscribe({
      next: (conversation) => this.finish({ mode: 'invite', conversation }),
      error: () => this.fail('Could not invite these people.'),
    });
  }

  private search(q: string): void {
    this.api.searchUsers(q).subscribe({
      next: (users) => {
        // Drop an answer for a query the user has already changed.
        if (q !== this.query().trim()) return;
        const hidden = new Set(this.exclude());
        this.results.set(users.filter((u) => !hidden.has(u.id)));
        this.searching.set(false);
      },
      error: () => {
        this.searching.set(false);
        this.error.set('Search failed. Try again.');
      },
    });
  }

  private finish(result: DialogResult): void {
    this.busy.set(false);
    this.done.emit(result);
  }

  private fail(message: string): void {
    this.busy.set(false);
    this.error.set(message);
  }
}
