import { describe, it, expect } from 'vitest';
import { SHARE_DOMAINS, SHARE_PRESETS, grantLine, type ShareGrant } from './sharing';

const base: ShareGrant = {
  id: 'g1', ownerId: 'o', granteeId: null, role: 'coach',
  domains: ['training', 'activity'], inviteCode: 'ABC12345',
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  revokedAt: null, createdAt: new Date(0).toISOString(),
};

describe('the domain registry', () => {
  it('cycle is a first-class domain', () => {
    expect(SHARE_DOMAINS.map((d) => d.key)).toContain('cycle');
  });

  it('NO preset ever bundles cycle — separately granted or not at all', () => {
    for (const domains of Object.values(SHARE_PRESETS)) {
      expect(domains).not.toContain('cycle');
    }
  });

  it('activity says out loud that routes are stripped', () => {
    const activity = SHARE_DOMAINS.find((d) => d.key === 'activity')!;
    expect(activity.includes).toMatch(/without routes/i);
  });

  it('sleep says stages stay private', () => {
    expect(SHARE_DOMAINS.find((d) => d.key === 'sleep')!.includes).toMatch(/stages stay private/i);
  });
});

describe('presets', () => {
  it('coach is training-shaped, caregiver is health-shaped', () => {
    expect(SHARE_PRESETS.coach).toEqual(['training', 'activity', 'body']);
    expect(SHARE_PRESETS.caregiver).toEqual(['body', 'sleep', 'vitals']);
  });

  it('nutrition is in no preset — an explicit opt-in extra', () => {
    for (const domains of Object.values(SHARE_PRESETS)) {
      expect(domains).not.toContain('nutrition');
    }
  });
});

describe('grantLine', () => {
  it('unclaimed grant shows the code and waits', () => {
    expect(grantLine(base)).toBe('coach · training, activity · waiting · code ABC12345');
  });

  it('claimed grant says so and hides nothing about its scope', () => {
    expect(grantLine({ ...base, granteeId: 'x' })).toBe('coach · training, activity · claimed');
  });

  it('revoked and expired states are stated plainly', () => {
    expect(grantLine({ ...base, revokedAt: new Date(0).toISOString() })).toContain('revoked');
    expect(grantLine({ ...base, expiresAt: new Date(0).toISOString() })).toContain('code expired');
  });
});
