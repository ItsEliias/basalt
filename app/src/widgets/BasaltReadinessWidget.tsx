import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { parseReadinessSnapshot, readinessAgeText, type ReadinessSnapshot } from './widgetModel';
export { parseReadinessSnapshot, type ReadinessSnapshot };

// Readiness widget (widgets Extra) — the last readiness the app computed,
// with its age. No number without components — same law as Recover.

const BG = '#16181D';
const INK = '#F4F5F6';
const MUTE = '#8A909B';
const FAINT = '#565D69';

export function BasaltReadinessWidget({ snapshot, nowMs }: { snapshot: ReadinessSnapshot | null; nowMs: number }) {
  const ageText = snapshot ? readinessAgeText(snapshot.at, nowMs) : '';
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG, borderRadius: 14, padding: 14, flexDirection: 'column', justifyContent: 'center' }}
    >
      <TextWidget text="READINESS" style={{ fontSize: 9, color: FAINT, letterSpacing: 0.24, fontFamily: 'monospace' }} />
      <TextWidget
        text={snapshot?.score != null ? String(Math.round(snapshot.score)) : 'No number'}
        style={{ fontSize: 22, color: INK, fontFamily: 'monospace', marginTop: 4 }}
      />
      <TextWidget
        text={snapshot ? (snapshot.score != null ? `as of ${ageText}` : snapshot.note || 'components missing') : 'open Basalt — fills after Recover computes'}
        style={{ fontSize: 9, color: MUTE, fontFamily: 'monospace', marginTop: 2 }}
      />
    </FlexWidget>
  );
}
