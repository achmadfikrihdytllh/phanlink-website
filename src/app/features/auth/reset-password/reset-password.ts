import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PhantomApi } from '../../../core/services/phantom-api';

@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: '../login/login.scss',
})
export class ResetPassword {
  private api = inject(PhantomApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // The email link carries both values: /reset-password?token=...&email=...
  token = this.route.snapshot.queryParamMap.get('token') ?? '';
  email = this.route.snapshot.queryParamMap.get('email') ?? '';
  password = '';
  confirm = '';

  loading = signal(false);
  done = signal(false);
  error = signal<string | null>(null);

  submit(): void {
    if (!this.token || !this.email) {
      this.error.set('Tautan tidak lengkap. Minta tautan reset yang baru.');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('Password minimal 8 karakter.');
      return;
    }
    if (this.password !== this.confirm) {
      this.error.set('Konfirmasi password tidak sama.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.api
      .resetPassword({
        token: this.token,
        email: this.email,
        password: this.password,
        password_confirmation: this.confirm,
      })
      .subscribe({
        next: () => {
          this.done.set(true);
          this.loading.set(false);
          setTimeout(() => this.router.navigate(['/login']), 1800);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.errors?.email?.[0] ?? 'Tidak bisa mengubah password. Minta tautan baru.');
        },
      });
  }
}
