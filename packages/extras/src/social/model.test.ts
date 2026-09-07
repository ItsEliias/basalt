import { describe, it, expect } from 'vitest';
import {
  makeInviteCode, isValidInviteCode, INVITE_ALPHABET,
  leaderboard, friendsLoggedLine, progressValueFor,
  CHALLENGE_KINDS, SOCIAL_SHARED_COLUMNS_NOTE,
} from './model';

describe('invite codes', () => {
  it('8 chars from the no-lookalike alphabet, round-trips validation', () => {
    const code = makeInviteCode([0.1, 0.9, 0.5, 0.3, 0.7, 0.2, 0.8, 0.4]);
    expect(code).toHaveLength(8);
    expect(isValidInviteCode(code)).toBe(true);
    expect(INVITE_ALPHABET).not.toMatch(/[01OI]/);
  });
  it('rejects wrong length and foreign chars', () => {
    expect(isValidInviteCode('ABC')).toBe(false);
    expect(isValidInviteCode('ABCDEFG0')).toBe(false);
  });
});

describe('leaderboard — sums, order, self mark', () => {
  const members = [
    { userId: 'a', displayName: 'Ari' },
    { userId: 'b', displayName: 'Bo' },
    { userId: 'c', displayName: 'Cy' },
  ];
  const progress = [
    { userId: 'a', day: 'd1', value: 100 },
    { userId: 'a', day: 'd2', value: 50 },
    { userId: 'b', day: 'd1', value: 200 },
  ];
  it('sorts by total desc; a member with no rows shows 0, never disappears', () => {
    const lb = leaderboard(members, progress, 'a');
    expect(lb.map((e) => e.userId)).toEqual(['b', 'a', 'c']);
    expect(lb[2]!.total).toBe(0);
    expect(lb[1]!.isSelf).toBe(true);
  });
  it('ties break by name for stable rendering', () => {
    const lb = leaderboard(members, [], 'x');
    expect(lb.map((e) => e.displayName)).toEqual(['Ari', 'Bo', 'Cy']);
  });
});

describe('facts, not cheer', () => {
  it('friends line is plain and null when nobody logged', () => {
    expect(friendsLoggedLine(0)).toBeNull();
    expect(friendsLoggedLine(1)).toBe('1 friend logged today');
    expect(friendsLoggedLine(3)).toBe('3 friends logged today');
  });
  it('published values are the raw local numbers; no steps source publishes nothing', () => {
    expect(progressValueFor('steps', { steps: null, sessions: 2, loggedAnything: true })).toBeNull();
    expect(progressValueFor('sessions', { steps: null, sessions: 2, loggedAnything: true })).toBe(2);
    expect(progressValueFor('logged_days', { steps: 9000, sessions: 0, loggedAnything: false })).toBe(0);
  });
  it('the shared-columns note names the law and the kinds are the published three', () => {
    expect(SOCIAL_SHARED_COLUMNS_NOTE).toContain('Never your entries');
    expect(CHALLENGE_KINDS).toEqual(['steps', 'sessions', 'logged_days']);
  });
});
