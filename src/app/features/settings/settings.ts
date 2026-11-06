import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { UserPrefs } from '../../core/models/phantom';
import { Appearance } from '../../core/services/appearance';
import { AuthService } from '../../core/services/auth';
import { PhantomApi } from '../../core/services/phantom-api';
import { PmAvatar } from '../../shared/avatar/avatar';
import { PmIcon, PmIconName } from '../../shared/icon/icon';
import { FrameView, PageFrame } from '../../shared/page-frame/page-frame';

type Theme = UserPrefs['theme'];
type Prefs = UserPrefs;

const STORAGE_KEY = 'phanlink.prefs';

const DEFAULTS: Prefs = {
  theme: 'phantom',
  density: 'comfortable',
  desktopNotifications: true,
  messagePreviews: false,
  whoCanMessage: 'contacts',
  readReceipts: true,
  showOnline: true,
};

@Component({
  selector: 'app-settings',
  imports: [FormsModule, RouterLink, PmIcon, PmAvatar, PageFrame],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private auth = inject(AuthService);
  private api = inject(PhantomApi);
  private appearance = inject(Appearance);

  readonly nav: { id: string; label: string; icon: PmIconName }[] = [
    { id: 'account', label: 'Your account', icon: 'user' },
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'privacy', label: 'Privacy & security', icon: 'lock' },
    { id: 'storage', label: 'Storage & data', icon: 'storage' },
  ];

  view = signal<FrameView>('list');
  filter = signal('');
  active = signal('account');
  cleared = signal(false);

  navVisible = computed(() => {
    const q = this.filter().trim().toLowerCase();
    return q ? this.nav.filter((n) => n.label.toLowerCase().includes(q)) : this.nav;
  });

  /** Open a section: on phones this swaps to the main pane, everywhere it scrolls to the card. */
  go(id: string): void {
    this.active.set(id);
    this.view.set('main');
    // Wait a tick so the main pane is visible before scrolling to the card.
    setTimeout(() => document.getElementById('set-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  /** Forget everything this browser cached: recent searches and the saved look. */
  clearLocal(): void {
    try {
      localStorage.removeItem('phanlink.recentSearches');
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be blocked; nothing to clear then.
    }
    this.cleared.set(true);
  }

  readonly themes: { id: Theme; label: string; swatch: string }[] = [
    { id: 'phantom', label: 'Phantom', swatch: '#e4182c' },
    { id: 'midnight', label: 'Midnight', swatch: '#3b4a8c' },
    { id: 'paper', label: 'Paper', swatch: '#8a5a2b' },
  ];

  prefs = signal<Prefs>(this.load());
  saved = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);

  constructor() {
    // Server copy wins over the local cache; the cache only covers the first paint.
    this.api.settings().subscribe({
      next: (p) => {
        this.prefs.set({ ...DEFAULTS, ...p });
        this.cache();
      },
      error: () => {
        /* offline or logged out: keep the cached values */
      },
    });
  }

  user = this.auth.currentUser;
  displayName = computed(() => this.user()?.name ?? '');
  username = computed(() => this.user()?.username ?? '');

  set<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
    this.prefs.update((p) => ({ ...p, [key]: value }));
    this.saved.set(false);
    // Theme and density preview straight away; Save makes them stick on the server.
    if (key === 'theme' || key === 'density') this.appearance.apply(this.prefs());
  }

  toggle(key: 'desktopNotifications' | 'messagePreviews' | 'readReceipts' | 'showOnline'): void {
    this.set(key, !this.prefs()[key]);
  }

  save(): void {
    this.saving.set(true);
    this.error.set(null);
    this.cache();

    this.api.saveSettings(this.prefs()).subscribe({
      next: (p) => {
        this.prefs.set({ ...DEFAULTS, ...p });
        this.cache();
        this.appearance.apply(this.prefs());
        this.saved.set(true);
        this.saving.set(false);
      },
      error: () => {
        this.error.set('Could not save. Check your connection and try again.');
        this.saving.set(false);
      },
    });
  }

  reset(): void {
    this.prefs.set({ ...DEFAULTS });
    this.saved.set(false);
    this.appearance.apply(this.prefs());
  }

  signOut(): void {
    this.auth.logout().subscribe();
  }

  private cache(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs()));
    } catch {
      // Storage can be blocked (private mode); the server copy is what matters.
    }
  }

  private load(): Prefs {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  }
}