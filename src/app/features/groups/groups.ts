import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Conversation } from '../../core/models/conversation';
import { GroupEvent, Poll, RsvpStatus, SharedAttachment } from '../../core/models/phantom';
import { AuthService } from '../../core/services/auth';
import { PhantomApi } from '../../core/services/phantom-api';
import { assetUrl } from '../../core/util/asset-url';
import { PmIcon } from '../../shared/icon/icon';
import { DialogResult, NewDialog } from '../../shared/new-dialog/new-dialog';
import { FrameView, PageFrame } from '../../shared/page-frame/page-frame';

@Component({
  selector: 'app-groups',
  imports: [DatePipe, FormsModule, RouterLink, PmIcon, PageFrame, NewDialog],
  templateUrl: './groups.html',
  styleUrl: './groups.scss',
})
export class Groups implements OnInit {
  private api = inject(PhantomApi);
  private auth = inject(AuthService);

  readonly rsvp: { id: RsvpStatus; label: string }[] = [
    { id: 'going', label: 'Going' },
    { id: 'maybe', label: 'Maybe' },
    { id: 'declined', label: 'No' },
  ];

  readonly meId = this.auth.currentUser()?.id ?? 0;

  groups = signal<Conversation[]>([]);
  files = signal<SharedAttachment[]>([]);
  selectedId = signal<number | null>(null);
  query = signal('');
  loading = signal(true);
  failed = signal(false);
  view = signal<FrameView>('list');
  dialog = signal<'group' | 'invite' | null>(null);

  events = signal<GroupEvent[]>([]);
  polls = signal<Poll[]>([]);
  planError = signal<string | null>(null);

  showEventForm = signal(false);
  eventForm = { title: '', location: '', description: '', startsAt: '' };

  showPollForm = signal(false);
  pollQuestion = '';
  pollOptions = ['', ''];

  editingGroup = signal(false);
  groupForm = { name: '', description: '' };

  isAdmin = computed(() => !!this.selected()?.participants.some((p) => p.id === this.meId && p.role === 'admin'));

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
    this.events.set([]);
    this.polls.set([]);
    this.planError.set(null);
    this.showEventForm.set(false);
    this.showPollForm.set(false);
    this.editingGroup.set(false);

    this.api.events(g.id).subscribe({ next: (e) => this.selectedId() === g.id && this.events.set(e) });
    this.api.polls(g.id).subscribe({ next: (p) => this.selectedId() === g.id && this.polls.set(p) });

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

  // ---- events ----
  createEvent(): void {
    const g = this.selected();
    const f = this.eventForm;
    if (!g || !f.title.trim() || !f.startsAt) {
      this.planError.set('Give the event a title and a start time.');
      return;
    }

    this.planError.set(null);
    this.api
      .createEvent(g.id, {
        title: f.title.trim(),
        location: f.location.trim() || null,
        description: f.description.trim() || null,
        // datetime-local has no zone; going through Date stores it as the right instant.
        starts_at: new Date(f.startsAt).toISOString(),
      })
      .subscribe({
        next: (e) => {
          this.events.update((list) => [...list, e].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
          this.eventForm = { title: '', location: '', description: '', startsAt: '' };
          this.showEventForm.set(false);
        },
        error: (err) => this.planError.set(err?.error?.errors?.starts_at?.[0] ?? 'Could not create the event.'),
      });
  }

  respond(e: GroupEvent, status: RsvpStatus): void {
    this.api.respondToEvent(e.id, status).subscribe({
      next: (u) => this.events.update((list) => list.map((x) => (x.id === u.id ? u : x))),
    });
  }

  deleteEvent(e: GroupEvent): void {
    if (!confirm(`Delete "${e.title}"?`)) return;
    this.api.deleteEvent(e.id).subscribe({ next: () => this.events.update((l) => l.filter((x) => x.id !== e.id)) });
  }

  canManage(createdBy: number): boolean {
    return createdBy === this.meId || this.isAdmin();
  }

  // ---- polls ----
  addOption(): void {
    if (this.pollOptions.length < 8) this.pollOptions = [...this.pollOptions, ''];
  }

  createPoll(): void {
    const g = this.selected();
    const options = this.pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!g || !this.pollQuestion.trim() || options.length < 2) {
      this.planError.set('Ask a question and give at least two options.');
      return;
    }

    this.planError.set(null);
    this.api.createPoll(g.id, this.pollQuestion.trim(), options).subscribe({
      next: (p) => {
        this.polls.update((list) => [p, ...list]);
        this.pollQuestion = '';
        this.pollOptions = ['', ''];
        this.showPollForm.set(false);
      },
      error: () => this.planError.set('Could not create the poll.'),
    });
  }

  vote(p: Poll, optionId: number): void {
    this.api.vote(p.id, optionId).subscribe({
      next: (u) => this.polls.update((list) => list.map((x) => (x.id === u.id ? u : x))),
    });
  }

  deletePoll(p: Poll): void {
    if (!confirm('Delete this poll?')) return;
    this.api.deletePoll(p.id).subscribe({ next: () => this.polls.update((l) => l.filter((x) => x.id !== p.id)) });
  }

  percent(p: Poll, votes: number): number {
    return p.total_votes ? Math.round((votes / p.total_votes) * 100) : 0;
  }

  // ---- group management ----
  startEditGroup(): void {
    const g = this.selected();
    if (!g) return;
    this.groupForm = { name: g.name ?? '', description: g.description ?? '' };
    this.editingGroup.set(true);
  }

  saveGroup(): void {
    const g = this.selected();
    if (!g || !this.groupForm.name.trim()) return;

    this.api.updateGroup(g.id, { name: this.groupForm.name.trim(), description: this.groupForm.description.trim() || null }).subscribe({
      next: (u) => {
        this.groups.update((list) => list.map((x) => (x.id === u.id ? u : x)));
        this.editingGroup.set(false);
      },
    });
  }

  removeMember(userId: number, name: string): void {
    const g = this.selected();
    if (!g || !confirm(`Remove ${name} from the group?`)) return;

    this.api.removeMember(g.id, userId).subscribe({
      next: (u) => u && this.groups.update((list) => list.map((x) => (x.id === u.id ? u : x))),
    });
  }

  leave(): void {
    const g = this.selected();
    if (!g || !confirm(`Leave "${g.name}"?`)) return;

    this.api.removeMember(g.id, this.meId).subscribe({
      next: () => {
        this.groups.update((list) => list.filter((x) => x.id !== g.id));
        this.selectedId.set(null);
        this.view.set('list');
      },
    });
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
