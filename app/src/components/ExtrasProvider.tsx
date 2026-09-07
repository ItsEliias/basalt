import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { defaultExtras, extraOn, type ExtraId, type ExtrasState } from '@basalt/core-data';
import { getExtras, onExtrasChange, setExtraFlag } from '../lib/extras';

// The gate every Extra surface lives behind. <ExtraSlot id> renders its
// children only while the Extra (and everything it requires) is on — off
// means OFF, and with everything off the tree is identical to core Basalt.
// The lint test pins the rule: extras feature code is only ever imported
// under an ExtraSlot.

type ExtrasContextValue = {
  extras: ExtrasState;
  ready: boolean;
  flip: (id: ExtraId, on: boolean) => Promise<{ turnedOffDependents: ExtraId[]; refused: boolean }>;
};

const ExtrasContext = createContext<ExtrasContextValue>({
  extras: defaultExtras(),
  ready: false,
  flip: async () => ({ turnedOffDependents: [], refused: true }),
});

export function ExtrasProvider({ children }: { children: ReactNode }) {
  const [extras, setExtras] = useState<ExtrasState>(defaultExtras());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void getExtras().then((s) => {
      if (!alive) return;
      setExtras(s);
      setReady(true);
    });
    const off = onExtrasChange((s) => { if (alive) setExtras(s); });
    return () => { alive = false; off(); };
  }, []);

  const flip = async (id: ExtraId, on: boolean) => {
    const r = await setExtraFlag(id, on);
    return { turnedOffDependents: r.turnedOffDependents, refused: r.refused };
  };

  return (
    <ExtrasContext.Provider value={{ extras, ready, flip }}>
      {children}
    </ExtrasContext.Provider>
  );
}

export function useExtras(): ExtrasContextValue {
  return useContext(ExtrasContext);
}

/** True only when the Extra and its whole requires chain are on. */
export function useExtra(id: ExtraId): boolean {
  const { extras, ready } = useExtras();
  return ready && extraOn(extras, id);
}

/** Renders nothing until the Extra is on. Every Extra surface lives here. */
export function ExtraSlot({ id, children }: { id: ExtraId; children: ReactNode }) {
  const on = useExtra(id);
  if (!on) return null;
  return <>{children}</>;
}
