import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { widgetLines, type WidgetSnapshot } from './widgetModel';

// The home-screen widget — Basalt's tokens, mono numerals, and the same
// honesty as the app: the snapshot's age is always stated, hide-the-numbers
// carries through, and an empty state says "open Basalt" instead of zeroes.

const BG = '#16181D';
const INK = '#F4F5F6';
const MUTE = '#8A909B';
const FAINT = '#565D69';
const RECOVERY = '#5E72E4';

export function BasaltTodayWidget({ snapshot, nowMs }: { snapshot: WidgetSnapshot | null; nowMs: number }) {
  const lines = widgetLines(snapshot, nowMs);
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: BG,
        borderRadius: 14,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <TextWidget
        text="BASALT"
        style={{ fontSize: 9, color: FAINT, letterSpacing: 0.24, fontFamily: 'monospace' }}
      />
      <TextWidget
        text={lines.headline}
        style={{ fontSize: 20, color: INK, fontFamily: 'monospace', marginTop: 4 }}
      />
      <TextWidget
        text={lines.sub}
        style={{ fontSize: 9, color: MUTE, fontFamily: 'monospace', marginTop: 2 }}
      />
      {lines.water !== '' ? (
        <TextWidget
          text={lines.water}
          style={{ fontSize: 12, color: RECOVERY, fontFamily: 'monospace', marginTop: 6 }}
        />
      ) : null}
    </FlexWidget>
  );
}
