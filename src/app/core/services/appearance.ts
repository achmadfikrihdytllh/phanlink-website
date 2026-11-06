import { Injectable, inject } from '@angular/core';

import { UserPrefs } from '../models/phantom';
import { PhantomApi } from './phantom-api';

export const PREFS_KEY = 'phanlink.prefs';

const ACCENTS: Record<UserPrefs['theme'], { red: string; deep: string }> = {
  phantom: { red: '#e4182c', deep: '#8f0f1b' },
  midnight: { red: '#3b4a8c', deep: '#1f2850' },
  paper: { red: '#8a5a2b', deep: '#53351a' },
};

/** Applies the saved theme and density to the whole app and reads notification prefs. */
@Injectable({ providedIn: 'root' })
export class Appearance {
  private api = inject(PhantomApi);
  private started = false;

  /** Call once after login: paint from cache first, then let the server copy win. */
  init(): void {
    if (this.started) return;
    this.started = true;

    this.apply(this.cached());
    this.api.settings().subscribe({
      next: (p) => {
        this.apply(p);
        this.store(p);
      },
      error: () => {
        /* offline or logged out: keep the cached look */
      },
    });
  }

  apply(prefs: Partial<UserPrefs> | null): void {
    const root = document.documentElement;
    const accent = ACCENTS[prefs?.theme ?? 'phantom'] ?? ACCENTS.phantom;

    root.style.setProperty('--pm-red', accent.red);
    root.style.setProperty('--pm-red-deep', accent.deep);
    root.dataset['density'] = prefs?.density ?? 'comfortable';
  }

  store(prefs: UserPrefs): void {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Storage can be blocked (private mode); the server copy is what matters.
    }
  }

  cached(): Partial<UserPrefs> | null {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? (JSON.parse(raw) as Partial<UserPrefs>) : null;
    } catch {
      return null;
    }
  }

  /** Show a desktop notification for a new message when the tab is in the background. */
  notify(title: string, body: string): void {
    const prefs = this.cached();
    if (!prefs?.desktopNotifications) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!document.hidden) return;

    new Notification(title, { body: prefs.messagePreviews ? body : 'New message' });
  }
}
