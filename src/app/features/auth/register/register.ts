import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { fieldErrorText, serverFieldErrors } from '../../../core/util/form-errors';

const LABELS: Record<string, string> = {
  name: 'Name',
  username: 'Username',
  email: 'Email',
  password: 'Password',
  password_confirmation: 'Password confirmation',
};

/** Fields in the order they appear, so the first broken one can be focused. */
const ORDER = ['name', 'username', 'email', 'password', 'password_confirmation'];

/** "required" that also rejects a value made only of spaces. */
const notBlank: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  String(c.value ?? '').trim() ? null : { required: true };

/** The confirmation has to equal the password typed above it. */
const matchesPassword: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const password = c.parent?.get('password')?.value;
  return c.value && password !== c.value ? { mismatch: true } : null;
};

@Component({
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  /** Set after the first press of DAFTAR, so untouched fields show their problem too. */
  submitted = signal(false);
  /** Messages the server sent for a field (e.g. "Username is already taken."). */
  serverErrors = signal<Record<string, string>>({});
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      name: ['', [notBlank, Validators.maxLength(255)]],
      username: ['', [notBlank, Validators.maxLength(50), Validators.pattern(/^[A-Za-z0-9_-]+$/)]],
      email: ['', [notBlank, Validators.email, Validators.maxLength(255)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', [Validators.required, matchesPassword]],
    });

    // Editing a field clears what the server said about it; changing the password re-checks the confirmation.
    for (const name of ORDER) {
      this.form.get(name)!.valueChanges.subscribe(() => {
        if (this.serverErrors()[name]) this.serverErrors.update(({ [name]: _gone, ...rest }) => rest);
        if (name === 'password') this.form.get('password_confirmation')!.updateValueAndValidity({ emitEvent: false });
      });
    }
  }

  /** The message to show under a field, or null. Server messages win; local ones wait until the field was touched. */
  fieldError(name: string): string | null {
    const server = this.serverErrors()[name];
    if (server) return server;

    const control = this.form.get(name);
    if (!control || !(control.touched || this.submitted())) return null;

    return fieldErrorText(LABELS[name], control.errors);
  }

  onSubmit(): void {
    this.submitted.set(true);
    this.errorMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstProblem();
      return;
    }

    this.loading.set(true);
    this.serverErrors.set({});

    this.authService.register(this.form.value as any).subscribe({
      next: () => {
        this.router.navigate(['/messages']);
      },
      error: (err) => {
        this.loading.set(false);

        const fields = serverFieldErrors(err?.error, LABELS);
        this.serverErrors.set(fields);

        if (Object.keys(fields).length) {
          this.focusFirstProblem();
        } else if (err?.status === 0) {
          this.errorMessage.set("Can't reach the server. Check your connection and try again.");
        } else if (err?.status === 429) {
          this.errorMessage.set('Too many attempts. Wait a minute and try again.');
        } else {
          this.errorMessage.set('Registration failed. Please try again.');
        }
      },
    });
  }

  private focusFirstProblem(): void {
    // Wait a tick so the error styles are rendered before looking for them.
    setTimeout(() => {
      const first = ORDER.find((n) => this.fieldError(n));
      if (first) document.querySelector<HTMLInputElement>(`[formControlName="${first}"]`)?.focus();
    });
  }
}
