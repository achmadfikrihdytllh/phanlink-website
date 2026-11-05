import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { UserPrefs } from '../../core/models/phantom';
import { AuthService } from '../../core/services/auth';
import { PhantomApi } from '../../core/services/phantom-api';
import { PmIcon, PmIconName } from '../../shared/icon/icon';
import { PageFrame } from '../../shared/page-frame/page-frame';

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
  imports: [FormsModule, PmIcon, PageFrame],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private auth = inject(AuthService);
  private api = inject(PhantomApi);

  readonly nav: { label: string; icon: PmIconName }[] = [
    { label: 'Your account', icon: 'user' },
    { label: 'Appearance', icon: 'palette' },
    { label: 'Notifications', icon: 'bell' },
    { label: 'Privacy & security', icon: 'lock' },
    { label: 'Storage & data', icon: 'storage' },
    { label: 'Keyboard shortcuts', icon: 'keyboard' },
  ];

  readonly themes: { id: Theme; label: string; swatch: string }[] = [
    { id: 'phantom', label: 'Phantom', swatch: '#e4182c' },
    { id: 'midnight', label: 'Midnight', swatch: '#0d0d0f' },
    { id: 'paper', label: 'Paper', swatch: '#f4f0e9' },
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
  displayName = computed(() => this.user()?.name ?? 'Ren Amamiya');
  username = computed(() => this.user()?.username ?? 'joker');

  set<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
    this.prefs.update((p) => ({ ...p, [key]: value }));
    this.saved.set(false);
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
