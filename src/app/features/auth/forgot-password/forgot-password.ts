import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { PhantomApi } from '../../../core/services/phantom-api';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: '../login/login.scss',
})
export class ForgotPassword {
  private api = inject(PhantomApi);

  email = '';
  loading = signal(false);
  sent = signal(false);
  error = signal<string | null>(null);

  submit(): void {
    if (!this.email.trim()) {
      this.error.set('Masukkan email kamu.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.api.forgotPassword(this.email.trim()).subscribe({
      // The server answers the same way whether or not the email exists.
      next: () => {
        this.sent.set(true);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.status === 429 ? 'Terlalu banyak percobaan. Coba lagi sebentar.' : 'Tidak bisa mengirim tautan. Coba lagi.');
      },
    });
  }
}
