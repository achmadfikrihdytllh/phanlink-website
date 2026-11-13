import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth';
import { PhantomApi } from '../../core/services/phantom-api';
import { PmAvatar } from '../../shared/avatar/avatar';
import { PmAvatarCropper } from '../../shared/avatar-cropper/avatar-cropper';
import { PmIcon } from '../../shared/icon/icon';

const MAX_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-profile',
  imports: [FormsModule, RouterLink, PmAvatar, PmAvatarCropper, PmIcon],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnDestroy {
  private auth = inject(AuthService);
  private api = inject(PhantomApi);
  private router = inject(Router);

  user = this.auth.currentUser;

  name = signal(this.user()?.name ?? '');
  username = signal(this.user()?.username ?? '');
  bio = signal(this.user()?.bio ?? '');
  phone = signal(this.user()?.phone_number ?? '');

  /** The picked photo while it is being cropped; becomes `file` once confirmed. */
  cropping = signal<File | null>(null);
  file = signal<File | null>(null);
  preview = signal<string | null>(null);
  saving = signal(false);
  saved = signal(false);
  error = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  /** What the avatar shows: the freshly chosen photo, else the saved one. */
  shownAvatar = computed(() => this.preview() ?? this.user()?.avatar ?? null);

  dirty = computed(() => {
    const u = this.user();
    return (
      !!this.file() ||
      this.name() !== (u?.name ?? '') ||
      this.username() !== (u?.username ?? '') ||
      this.bio() !== (u?.bio ?? '') ||
      this.phone() !== (u?.phone_number ?? '')
    );
  });

  ngOnDestroy(): void {
    this.revoke();
  }

  chooseFile(input: HTMLInputElement): void {
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;

    if (!f.type.startsWith('image/')) return this.error.set('Pick an image file.');
    if (f.size > MAX_BYTES) return this.error.set('That photo is over 5 MB. Pick a smaller one.');

    this.error.set(null);
    this.cropping.set(f);
  }

  /** The cropped square from the dialog replaces the original as the photo to upload. */
  applyCrop(cropped: File): void {
    this.cropping.set(null);
    this.revoke();
    this.file.set(cropped);
    this.preview.set(URL.createObjectURL(cropped));
    this.saved.set(false);
  }

  save(): void {
    if (this.saving() || !this.dirty()) return;

    const form = new FormData();
    form.append('name', this.name().trim());
    form.append('username', this.username().trim());
    form.append('bio', this.bio());
    form.append('phone_number', this.phone().trim());
    const f = this.file();
    if (f) form.append('avatar', f);

    this.saving.set(true);
    this.error.set(null);
    this.fieldErrors.set({});

    this.api.updateProfile(form).subscribe({
      next: (user) => {
        // Merge so fields the profile endpoint does not return (e.g. email) are kept.
        this.auth.updateUser({ ...this.auth.currentUser()!, ...user });
        this.revoke();
        this.file.set(null);
        this.preview.set(null);
        this.saving.set(false);
        this.saved.set(true);
      },
      error: (e: HttpErrorResponse) => {
        const errs: Record<string, string> = {};
        for (const [k, v] of Object.entries(e.error?.errors ?? {})) errs[k] = (v as string[])[0];
        this.fieldErrors.set(errs);
        this.error.set(
          Object.keys(errs).length ? 'Fix the highlighted fields.' : 'Could not save. Try again.',
        );
        this.saving.set(false);
      },
    });
  }

  edited(): void {
    this.saved.set(false);
  }

  signOut(): void {
    this.auth.logout().subscribe();
  }

  close(): void {
    this.router.navigate(['/messages']);
  }

  private revoke(): void {
    const url = this.preview();
    if (url) URL.revokeObjectURL(url);
  }
}
