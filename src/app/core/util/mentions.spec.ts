import { activeMention, applyMention, mentionsUser, splitMentions } from './mentions';

describe('mentions', () => {
  it('finds the tag being typed', () => {
    expect(activeMention('@', 1)).toEqual({ start: 0, query: '' });
    expect(activeMention('hi @sk', 6)).toEqual({ start: 3, query: 'sk' });
    expect(activeMention('hi @sk and more', 6)).toEqual({ start: 3, query: 'sk' });
  });

  it('ignores an @ that is not a tag', () => {
    expect(activeMention('mail me@site', 12)).toBeNull();
    expect(activeMention('hi @sk ', 7)).toBeNull();
    expect(activeMention('no tag', 6)).toBeNull();
  });

  it('completes the tag and moves the caret', () => {
    const text = 'hi @sk and more';
    const out = applyMention(text, activeMention(text, 6)!, 6, 'skull');
    expect(out.text).toBe('hi @skull  and more');
    expect(out.caret).toBe(10);
  });

  it('splits only real members', () => {
    expect(splitMentions('hey @Skull, ok? @nobody', ['skull'])).toEqual([
      { text: 'hey ' },
      { text: '@Skull', mention: 'skull' },
      { text: ', ok? @nobody' },
    ]);
    expect(splitMentions('plain', ['skull'])).toEqual([{ text: 'plain' }]);
  });

  it('keeps a sentence dot out of the username', () => {
    expect(splitMentions('ping @joker.', ['joker'])).toEqual([
      { text: 'ping ' },
      { text: '@joker', mention: 'joker' },
      { text: '.' },
    ]);
  });

  it('knows when I was tagged', () => {
    expect(mentionsUser('look @joker', 'joker')).toBe(true);
    expect(mentionsUser('look joker', 'joker')).toBe(false);
    expect(mentionsUser(null, 'joker')).toBe(false);
  });
});
