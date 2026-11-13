export interface ActiveMention {
  /** Index of the "@" in the text. */
  start: number;
  /** What was typed after it, without the "@". */
  query: string;
}

export interface MentionPart {
  text: string;
  /** Username when this part is a tag of a real member. */
  mention?: string;
}

/** A tag is typed right after the "@" (start of text or after whitespace) and made of username characters. */
export function activeMention(text: string, caret: number): ActiveMention | null {
  const before = text.slice(0, caret);
  const m = /(^|\s)@([\w.]{0,30})$/.exec(before);
  if (!m) return null;

  return { start: before.length - m[2].length - 1, query: m[2] };
}

/** Replaces the half-typed "@que" with "@username " and says where the caret goes. */
export function applyMention(
  text: string,
  mention: ActiveMention,
  caret: number,
  username: string,
): { text: string; caret: number } {
  const insert = `@${username} `;
  const next = text.slice(0, mention.start) + insert + text.slice(caret);

  return { text: next, caret: mention.start + insert.length };
}

/** Splits a message into plain text and tags of known usernames, so tags can be highlighted. */
export function splitMentions(body: string, usernames: string[]): MentionPart[] {
  if (!body.includes('@') || !usernames.length) return [{ text: body }];

  const known = new Map(usernames.map((u) => [u.toLowerCase(), u]));
  const parts: MentionPart[] = [];
  const re = /(^|\s)(@[\w.]{1,30})/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(body))) {
    // Trailing dots belong to the sentence, not the username ("hi @joker.").
    const raw = m[2].replace(/\.+$/, '');
    const user = known.get(raw.slice(1).toLowerCase());
    if (!user) continue;

    const start = m.index + m[1].length;
    if (start > last) parts.push({ text: body.slice(last, start) });
    parts.push({ text: raw, mention: user });
    last = start + raw.length;
  }

  if (last < body.length) parts.push({ text: body.slice(last) });
  return parts.length ? parts : [{ text: body }];
}

export function mentionsUser(body: string | null | undefined, username: string | null | undefined): boolean {
  if (!body || !username) return false;
  return splitMentions(body, [username]).some((p) => !!p.mention);
}
