import { describe, it, expect, vi, beforeEach } from 'vitest';

// The store pulls in the real supabase client (native storage) — stub it.
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() } },
}));
vi.mock('@basalt/core-data', () => ({
  getProfile: vi.fn(),
  getTargetsFor: vi.fn(),
}));

import { getProfile, getTargetsFor } from '@basalt/core-data';
import { useAppStore } from './appStore';

const PROFILE = { id: 'p1', hideNumbers: false } as any;
const TARGETS = { calories: 2794 } as any;

function reset() {
  useAppStore.setState({ profile: null, targets: null, bootstrapped: false });
}

describe('refreshCore — fetch failure must never impersonate an answer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reset();
    vi.mocked(getProfile).mockReset();
    vi.mocked(getTargetsFor).mockReset();
  });

  it('a failed profile fetch does not mark the session bootstrapped (that routed onboarded users into onboarding)', async () => {
    vi.mocked(getProfile).mockResolvedValue({ ok: false, error: 'network' } as any);
    vi.mocked(getTargetsFor).mockResolvedValue({ ok: false, error: 'network' } as any);
    await useAppStore.getState().refreshCore();
    expect(useAppStore.getState().bootstrapped).toBe(false);
  });

  it('ok-with-null stays honest: no profile row → bootstrapped, onboarding is correct', async () => {
    vi.mocked(getProfile).mockResolvedValue({ ok: true, data: null } as any);
    vi.mocked(getTargetsFor).mockResolvedValue({ ok: true, data: null } as any);
    await useAppStore.getState().refreshCore();
    const s = useAppStore.getState();
    expect(s.bootstrapped).toBe(true);
    expect(s.profile).toBeNull();
  });

  it('a transient failure keeps last-known-good profile and targets instead of clobbering them with null', async () => {
    vi.mocked(getProfile).mockResolvedValue({ ok: true, data: PROFILE } as any);
    vi.mocked(getTargetsFor).mockResolvedValue({ ok: true, data: TARGETS } as any);
    await useAppStore.getState().refreshCore();

    vi.mocked(getProfile).mockResolvedValue({ ok: false, error: 'network' } as any);
    vi.mocked(getTargetsFor).mockResolvedValue({ ok: false, error: 'network' } as any);
    await useAppStore.getState().refreshCore();

    const s = useAppStore.getState();
    expect(s.profile).toEqual(PROFILE);
    expect(s.targets).toEqual(TARGETS);
    expect(s.bootstrapped).toBe(true);
  });

  it('a failed fetch schedules a retry that recovers when the network returns', async () => {
    vi.mocked(getProfile).mockResolvedValue({ ok: false, error: 'network' } as any);
    vi.mocked(getTargetsFor).mockResolvedValue({ ok: false, error: 'network' } as any);
    await useAppStore.getState().refreshCore();
    expect(useAppStore.getState().bootstrapped).toBe(false);

    vi.mocked(getProfile).mockResolvedValue({ ok: true, data: PROFILE } as any);
    vi.mocked(getTargetsFor).mockResolvedValue({ ok: true, data: TARGETS } as any);
    await vi.advanceTimersByTimeAsync(4000);

    const s = useAppStore.getState();
    expect(s.bootstrapped).toBe(true);
    expect(s.profile).toEqual(PROFILE);
  });
});
