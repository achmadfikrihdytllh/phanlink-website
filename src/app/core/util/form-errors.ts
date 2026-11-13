/** Shape of Angular's ValidationErrors, kept structural so this file has no framework dependency. */
export type FieldErrors = Record<string, any> | null | undefined;

/** The first problem with a field as a short English sentence, or null when it is fine. */
export function fieldErrorText(label: string, errors: FieldErrors): string | null {
  if (!errors) return null;

  if (errors['required']) return `${label} is required.`;
  if (errors['email']) return 'Enter a valid email address.';
  if (errors['pattern']) return `${label} can only use letters, numbers, - and _.`;
  if (errors['minlength']) return `${label} must be at least ${errors['minlength'].requiredLength} characters.`;
  if (errors['maxlength']) return `${label} must be at most ${errors['maxlength'].requiredLength} characters.`;
  if (errors['mismatch']) return "Passwords don't match.";

  return null;
}

/** Turns the server's validation answer ({ errors: { field: [msg] } }) into one short message per field. */
export function serverFieldErrors(
  body: unknown,
  labels: Record<string, string>,
): Record<string, string> {
  const raw = (body as { errors?: Record<string, unknown> } | null)?.errors;
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;

  for (const [field, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
    if (!first) continue;

    out[field] = /already been taken/i.test(first) ? `${labels[field] ?? 'That value'} is already taken.` : first;
  }
  return out;
}
