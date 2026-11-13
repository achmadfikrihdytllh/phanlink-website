const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number): string => String(n).padStart(2, '0');

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * "Last seen" wording for someone who is not online:
 * under a minute -> "just now", under an hour -> "12 min ago", earlier today -> "today 14:05",
 * yesterday -> "yesterday 21:10", older -> "Mon, 9 Nov" (with the year once it is not this year).
 */
export function lastSeenText(iso: string | null | undefined, nowMs: number = Date.now()): string {
  if (!iso) return 'offline';

  const then = new Date(iso);
  const diff = nowMs - then.getTime();
  if (Number.isNaN(diff)) return 'offline';

  if (diff < 60_000) return 'last seen just now';
  if (diff < 3_600_000) return `last seen ${Math.floor(diff / 60_000)} min ago`;

  const clock = `${pad(then.getHours())}:${pad(then.getMinutes())}`;
  const dayGap = Math.round((startOfDay(new Date(nowMs)) - startOfDay(then)) / 86_400_000);

  if (dayGap <= 0) return `last seen today ${clock}`;
  if (dayGap === 1) return `last seen yesterday ${clock}`;

  const year = then.getFullYear() === new Date(nowMs).getFullYear() ? '' : ` ${then.getFullYear()}`;
  return `last seen ${DAYS[then.getDay()]}, ${then.getDate()} ${MONTHS[then.getMonth()]}${year}`;
}
