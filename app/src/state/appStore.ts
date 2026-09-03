import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { getProfile, getTargetsFor, type ProfileRecord, type TargetsRecord } from '@basalt/core-data';
import { supabase } from '../lib/supabase';

// App-level state: auth session + the two records nearly every screen needs
// (profile, current targets). Screen data stays in the screens — this store
// is deliberately small.

// Pending refreshCore retry after a failed profile fetch (module-level so
// overlapping auth events don't stack timers).
let coreRetry: ReturnType<typeof setTimeout> | null = null;

type AppState = {
  session: Session | null;
  sessionLoaded: boolean;
  profile: ProfileRecord | null;
  targets: TargetsRecord | null;
  /** True once profile/targets have been fetched for the current session. */
  bootstrapped: boolean;
  quickLogOpen: boolean;
  /** Bumped after quick-log writes so open screens refetch. */
  todayVersion: number;

  init: () => void;
  refreshCore: () => Promise<void>;
  setQuickLogOpen: (open: boolean) => void;
  bumpToday: () => void;
  signOut: () => Promise<void>;
};

export const useAppStore = create<AppState>((set, get) => ({
  session: null,
  sessionLoaded: false,
  profile: null,
  targets: null,
  bootstrapped: false,
  quickLogOpen: false,
  todayVersion: 0,

  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session ?? null, sessionLoaded: true });
      if (data.session) void get().refreshCore();
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session: session ?? null, sessionLoaded: true });
      if (session) {
        void get().refreshCore();
      } else {
        set({ profile: null, targets: null, bootstrapped: false });
      }
    });
  },

  refreshCore: async () => {
    // Runs on every auth event, including routine token refreshes. A
    // transient fetch failure must not clobber known-good records with
    // null — that briefly showed "no targets yet" to onboarded users.
    // Sign-out is the only path that clears these (see onAuthStateChange).
    const [p, t] = await Promise.all([getProfile(supabase), getTargetsFor(supabase)]);
    set((s) => ({
      profile: p.ok ? p.data : s.profile,
      targets: t.ok ? t.data : s.targets,
      // Only authoritative once a profile fetch has actually SUCCEEDED.
      // Marking a failed fetch as bootstrapped routed onboarded users into
      // onboarding on cold starts with a slow network (profile null ≠
      // profile unknown). ok-with-null stays honest: that user really has
      // no profile row and belongs in onboarding.
      bootstrapped: s.bootstrapped || p.ok,
    }));
    if (!p.ok) {
      if (coreRetry !== null) clearTimeout(coreRetry);
      coreRetry = setTimeout(() => {
        coreRetry = null;
        void get().refreshCore();
      }, 4000);
    }
  },

  setQuickLogOpen: (open) => set({ quickLogOpen: open }),

  bumpToday: () => set((s) => ({ todayVersion: s.todayVersion + 1 })),

  signOut: async () => {
    await supabase.auth.signOut();
  },
}));
