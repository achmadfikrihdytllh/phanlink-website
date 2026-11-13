import { fieldErrorText, serverFieldErrors } from './form-errors';

describe('form errors', () => {
  it('says nothing when the field is fine', () => {
    expect(fieldErrorText('Email', null)).toBeNull();
    expect(fieldErrorText('Email', {})).toBeNull();
  });

  it('words each rule', () => {
    expect(fieldErrorText('Name', { required: true })).toBe('Name is required.');
    expect(fieldErrorText('Email', { email: true })).toBe('Enter a valid email address.');
    expect(fieldErrorText('Username', { pattern: {} })).toBe('Username can only use letters, numbers, - and _.');
    expect(fieldErrorText('Password', { minlength: { requiredLength: 8, actualLength: 3 } })).toBe(
      'Password must be at least 8 characters.',
    );
    expect(fieldErrorText('Username', { maxlength: { requiredLength: 50 } })).toBe('Username must be at most 50 characters.');
    expect(fieldErrorText('Confirmation', { mismatch: true })).toBe("Passwords don't match.");
  });

  it('shows a required field before any other rule', () => {
    expect(fieldErrorText('Email', { required: true, email: true })).toBe('Email is required.');
  });

  it('keeps one message per field from the server', () => {
    const body = {
      errors: {
        username: ['The username has already been taken.'],
        email: ['The email field must be a valid email address.', 'second'],
      },
    };
    expect(serverFieldErrors(body, { username: 'Username', email: 'Email' })).toEqual({
      username: 'Username is already taken.',
      email: 'The email field must be a valid email address.',
    });
  });

  it('ignores answers without field errors', () => {
    expect(serverFieldErrors(null, {})).toEqual({});
    expect(serverFieldErrors({ message: 'boom' }, {})).toEqual({});
  });
});
