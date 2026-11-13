import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { fieldErrorText } from '../../../core/util/form-errors';

const LABELS: Record<string, string> = {
  login: 'Email or username',
  password: 'Password',
};
const ORDER = ['login', 'password'];

/** "required" that also rejects a value made only of spaces. */
const notBlank: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  String(c.value ?? '').trim() ? null : { required: true };

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  submitted = signal(false);
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      login: ['', notBlank],
      password: ['', notBlank],
    });

    // A wrong-password message should disappear as soon as the person starts correcting it.
    this.form.valueChanges.subscribe(() => {
      if (this.errorMessage()) this.errorMessage.set(null);
    });
  }

  fieldError(name: string): string | null {
    const control = this.form.get(name);
    if (!control || !(control.touched || this.submitted())) return null;

    return fieldErrorText(LABELS[name], control.errors);
  }

  onSubmit(): void {
    this.submitted.set(true);
    this.errorMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // Wait a tick so the error styles are rendered before looking for them.
      setTimeout(() => {
        const first = ORDER.find((n) => this.fieldError(n));
        if (first) document.querySelector<HTMLInputElement>(`[formControlName="${first}"]`)?.focus();
      });
      return;
    }

    this.loading.set(true);

    this.authService.login(this.form.value as { login: string; password: string }).subscribe({
      next: () => {
        this.router.navigate(['/messages']);
      },
      error: (err) => {
        this.loading.set(false);

        if (err?.status === 0) {
          this.errorMessage.set("Can't reach the server. Check your connection and try again.");
        } else if (err?.status === 429) {
          this.errorMessage.set('Too many attempts. Wait a minute and try again.');
        } else {
          this.errorMessage.set(err?.error?.errors?.login?.[0] || 'Login failed. Check your details and try again.');
        }
      },
    });
  }
}
