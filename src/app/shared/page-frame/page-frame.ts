import { Component, DestroyRef, computed, effect, inject, input, model, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth';
import { UiState } from '../../core/services/ui-state';
import { PmAvatar } from '../avatar/avatar';
import { PmIcon } from '../icon/icon';

export type FrameView = 'list' | 'main' | 'aside';

const PHONE = '(max-width: 720px)';

/**
 * Frame shared by every page: list | main | aside.
 * Pages project content with `slot="list"`, `slot="main"` and `slot="aside"`.
 *
 * Desktop shows all three columns. Tablet shows list + main and slides the aside in as a drawer.
 * Phones show one pane at a time, driven by `view` (list -> main -> aside).
 */
@Component({
  selector: 'pm-page-frame',
  imports: [PmIcon, PmAvatar, RouterLink],
  template: `
    <section class="list" [class.list--dark]="listTone() === 'dark'" [class.show]="view() === 'list'">
      <ng-content select="[slot=list]" />

      <a class="me" routerLink="/profile" aria-label="Edit your profile">
        <pm-avatar [name]="displayName()" [src]="avatar()" [size]="24" />
        <span class="me__text">
          <strong>{{ displayName() }}</strong>
          <small>&#64;{{ username() }}</small>
        </span>
        <pm-icon name="edit" [size]="12" />
      </a>
    </section>

    <section class="main" [class.show]="view() === 'main'">
      <ng-content select="[slot=main]" />
    </section>

    @if (drawer()) {
      <button type="button" class="scrim" aria-label="Close panel" (click)="drawer.set(false)"></button>
    }
    <aside class="aside" [class.show]="view() === 'aside'" [class.open]="drawer()">
      <button type="button" class="aside__close" aria-label="Close panel" (click)="closeInfo()">
        <pm-icon name="close" [size]="12" /> Close
      </button>
      <div class="aside__body pm-scroll">
        <ng-content select="[slot=aside]" />
      </div>

      <footer class="brand">
        <span class="brand__title pm-title">Take your heart.</span>
        <span class="brand__sub">Stay connected. Stay rebellious.</span>
      </footer>
    </aside>
  `,
  styleUrl: './page-frame.scss',
})
export class PageFrame {
  private auth = inject(AuthService);
  private ui = inject(UiState);

  listTone = input<'paper' | 'dark'>('paper');

  /** Which pane a phone shows. Pages bind this with `[(view)]`. */
  view = model<FrameView>('list');
  /** Tablet drawer for the aside. */
  drawer = signal(false);

  displayName = computed(() => this.auth.currentUser()?.name ?? 'You');
  username = computed(() => this.auth.currentUser()?.username ?? '');
  avatar = computed(() => this.auth.currentUser()?.avatar ?? null);

  constructor() {
    effect(() => this.ui.hideTabs.set(this.view() !== 'list' && this.isPhone()));
    inject(DestroyRef).onDestroy(() => this.ui.hideTabs.set(false));
  }

  isPhone(): boolean {
    return typeof matchMedia === 'function' && matchMedia(PHONE).matches;
  }

  /** The "info" button in a pane header: full pane on phones, drawer on tablets. */
  openInfo(): void {
    if (this.isPhone()) this.view.set('aside');
    else this.drawer.update((open) => !open);
  }

  /** Reveal the aside without toggling it (for taps on an item in the main pane). */
  showInfo(): void {
    if (this.isPhone()) this.view.set('aside');
    else this.drawer.set(true);
  }

  closeInfo(): void {
    if (this.isPhone()) this.view.set('main');
    this.drawer.set(false);
  }

  /** Back from a detail pane to the list (phones only; harmless elsewhere). */
  back(): void {
    this.view.set('list');
  }
}
