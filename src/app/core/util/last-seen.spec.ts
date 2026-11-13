import { lastSeenText } from './last-seen';

describe('lastSeenText', () => {
  // Wed 11 Nov 2026, 15:00 local time
  const now = new Date(2026, 10, 11, 15, 0, 0).getTime();
  const ago = (ms: number): string => new Date(now - ms).toISOString();

  it('handles missing values', () => {
    expect(lastSeenText(null, now)).toBe('offline');
    expect(lastSeenText('nope', now)).toBe('offline');
  });

  it('counts minutes for the first hour', () => {
    expect(lastSeenText(ago(20_000), now)).toBe('last seen just now');
    expect(lastSeenText(ago(5 * 60_000), now)).toBe('last seen 5 min ago');
  });

  it('uses the clock for earlier today and yesterday', () => {
    expect(lastSeenText(new Date(2026, 10, 11, 9, 5).toISOString(), now)).toBe('last seen today 09:05');
    expect(lastSeenText(new Date(2026, 10, 10, 21, 10).toISOString(), now)).toBe('last seen yesterday 21:10');
  });

  it('uses weekday and date after that', () => {
    expect(lastSeenText(new Date(2026, 10, 7, 12, 0).toISOString(), now)).toBe('last seen Sat, 7 Nov');
    expect(lastSeenText(new Date(2025, 11, 31, 12, 0).toISOString(), now)).toBe('last seen Wed, 31 Dec 2025');
  });
});
