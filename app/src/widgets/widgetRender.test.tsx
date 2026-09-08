import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React, { type ReactElement } from 'react';
import { BasaltTodayWidget } from './BasaltTodayWidget';
import { BasaltReadinessWidget } from './BasaltReadinessWidget';

// V4.1 §1 — the widgets shipped blank on a real phone. Guard both layers:
// the render must always produce visible text (even with no snapshot),
// and every receiver the manifest declares must exist as a class — a
// manifest entry with no class dies on the system's own broadcasts
// (placement, periodic update, boot restore) with ClassNotFoundException,
// which is exactly the blank widget we shipped.

type Node = { type: unknown; props: Record<string, unknown> };

/** Expand function components and collect every rendered element. */
function flatten(el: unknown, out: Node[] = []): Node[] {
  if (el == null || typeof el !== 'object') return out;
  if (Array.isArray(el)) {
    for (const c of el) flatten(c, out);
    return out;
  }
  const node = el as ReactElement & { props: { children?: unknown } };
  if (typeof node.type === 'function') {
    flatten((node.type as (p: unknown) => unknown)(node.props), out);
    return out;
  }
  out.push({ type: node.type, props: node.props as Record<string, unknown> });
  flatten(node.props?.children, out);
  return out;
}

function visibleTexts(el: ReactElement): string[] {
  return flatten(el)
    .map((n) => n.props.text)
    .filter((t): t is string => typeof t === 'string' && t.trim() !== '');
}

describe('widget render — never blank', () => {
  const NOW = Date.parse('2026-09-08T12:00:00Z');

  it('Today widget with NO snapshot still says something', () => {
    const texts = visibleTexts(<BasaltTodayWidget snapshot={null} nowMs={NOW} />);
    expect(texts.length).toBeGreaterThan(1);
    expect(texts.join(' ')).toContain('BASALT');
  });

  it('Today widget with a snapshot shows the real numbers', () => {
    const snap = {
      remainingKcal: 640, over: false, waterFilled: 3, waterTotal: 8,
      entryCount: 4, hideNumbers: false, at: '2026-09-08T11:59:00Z',
    };
    const texts = visibleTexts(<BasaltTodayWidget snapshot={snap} nowMs={NOW} />);
    expect(texts.join(' ')).toContain('640 kcal left');
  });

  it('Readiness widget with NO snapshot still says something', () => {
    const texts = visibleTexts(<BasaltReadinessWidget snapshot={null} nowMs={NOW} />);
    expect(texts.length).toBeGreaterThan(0);
  });
});

describe('widget native wiring — manifest receivers exist as classes', () => {
  const ANDROID = resolve(__dirname, '../../android/app/src/main');

  it('every manifest widget receiver has a matching .java class', () => {
    const manifest = readFileSync(resolve(ANDROID, 'AndroidManifest.xml'), 'utf8');
    const receivers = [...manifest.matchAll(/receiver android:name="\.widget\.(\w+)"/g)].map((m) => m[1]!);
    expect(receivers.length).toBeGreaterThanOrEqual(2);
    for (const name of receivers) {
      const cls = resolve(ANDROID, `java/com/itseliias/basalt/widget/${name}.java`);
      const src = readFileSync(cls, 'utf8'); // throws if the class is missing
      expect(src, `${name} must extend RNWidgetProvider`).toContain('extends RNWidgetProvider');
    }
  });

  it('initialLayout is the branded placeholder, not the invisible library default', () => {
    for (const f of ['widgetprovider_basalttoday.xml', 'widgetprovider_basaltreadiness.xml']) {
      const xml = readFileSync(resolve(ANDROID, `res/xml/${f}`), 'utf8');
      expect(xml, f).toContain('android:initialLayout="@layout/basalt_widget_initial"');
    }
    const layout = readFileSync(resolve(ANDROID, 'res/layout/basalt_widget_initial.xml'), 'utf8');
    expect(layout).toContain('BASALT');
  });
});
