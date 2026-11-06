import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Appearance } from '../../core/services/appearance';
import { AuthService } from '../../core/services/auth';
import { UiState } from '../../core/services/ui-state';
import { PmAvatar } from '../../shared/avatar/avatar';
import { PmIcon, PmIconName } from '../../shared/icon/icon';

interface RailItem {
  path: string;
  label: string;
  icon: PmIconName;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PmIcon, PmAvatar],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private auth = inject(AuthService);
  protected ui = inject(UiState);

  readonly items: RailItem[] = [
    { path: '/messages', label: 'Messages', icon: 'chat' },
    { path: '/groups', label: 'Groups', icon: 'groups' },
    { path: '/saved', label: 'Saved', icon: 'saved' },
    { path: '/contacts', label: 'Contacts', icon: 'contacts' },
    { path: '/search', label: 'Search', icon: 'search' },
  ];

  readonly settings: RailItem = { path: '/settings', label: 'Settings', icon: 'settings' };

  /** Phone tab bar: the same six destinations as the desktop rail. */
  readonly tabs: RailItem[] = [...this.items, this.settings];

  user = this.auth.currentUser;
  name = computed(() => this.user()?.name ?? '');

  constructor() {
    inject(Appearance).init();
  }
}
