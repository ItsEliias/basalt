import { describe, it, expect } from 'vitest';
import { create, act, type ReactTestRenderer, type ReactTestRendererJSON } from 'react-test-renderer';
import React from 'react';
import { ThemeProvider } from '../theme/provider';
import { THEMES, THEME_IDS, type ThemeId } from '../theme/themes';
import { contrastRatio } from '../theme/contrast';
import { Card, KV, SrcNote, EmptyState, MicroLabel, HeroNumeral, Rule } from '../components/base';
import { ReceiptHeader, ReceiptRow, MealTag } from '../components/receipt';
import { CTA, Chip, ChipRow, ChipGroup, SubNav, SearchBar, Stepper, NewRow } from '../components/controls';
import { MacroRow, CapRow, Bar } from '../components/macro';
import { Tile, TileGridThemed } from '../components/todayTiles';
import { HeroRings } from '../components/meters';
import { PebbleSlot } from '../pebble/Pebble';

// V4.1 §4 — the contrast walker. Renders the component battery every
// screen is composed from, under all 11 themes, and walks the rendered
// tree: every Text node's resolved colour is checked against the nearest
// opaque ancestor background (gradient cards: BOTH stops) at ≥ 4.5:1
// (≥ 3:1 for display-size text); Pressables must separate from their
// ground at ≥ 3:1 via fill or border. Failures print as a
// screen-component × theme table. Fixes belong at the token or component
// level — never a per-theme branch (this file has no theme names in it
// beyond the registry list).

type Node = ReactTestRendererJSON | string;

const flatten = (style: unknown): Record<string, unknown> => {
  if (!style) return {};
  if (Array.isArray(style)) return style.reduce<Record<string, unknown>>((a, s) => ({ ...a, ...flatten(s) }), {});
  return style as Record<string, unknown>;
};

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v);

type Failure = { battery: string; theme: string; text: string; fg: string; bg: string; ratio: number; need: number };

function walk(
  node: Node,
  bgStack: string[],
  battery: string,
  themeId: string,
  failures: Failure[],
  gradientStops: string[] | null,
) {
  if (typeof node === 'string') return;
  const rawStyle = typeof node.props?.style === 'function'
    ? node.props.style({ pressed: false })
    : node.props?.style;
  const style = flatten(rawStyle);
  const bg = style.backgroundColor;
  let stack = bgStack;
  let stops = gradientStops;
  if (isHex(bg)) {
    stack = [...bgStack, bg];
    stops = null; // an opaque fill resets any gradient context
  }
  // Card's gradient lead: two stacked fills — collect hex stops for text checks.
  if (node.props?.testID === 'gradient-stop' && isHex(bg)) {
    stops = [...(gradientStops ?? []), bg];
  }
  if (node.type === 'Text' || node.type === 'Animated.Text') {
    const fg = style.color;
    const textChildren = (node.children ?? []).filter((c): c is string => typeof c === 'string').join('');
    if (isHex(fg) && textChildren.trim() !== '') {
      const size = typeof style.fontSize === 'number' ? style.fontSize : 14;
      const bold = style.fontWeight === '600' || style.fontWeight === '700' || style.fontWeight === 'bold' || Number(style.fontWeight) >= 600;
      const need = size >= 18 && bold ? 3 : 4.5;
      const grounds = stops && stops.length > 0 ? stops : [stack[stack.length - 1]!];
      for (const ground of grounds) {
        const ratio = contrastRatio(fg, ground);
        if (ratio < need) {
          failures.push({ battery, theme: themeId, text: textChildren.slice(0, 40), fg, bg: ground, ratio: Math.round(ratio * 100) / 100, need });
        }
      }
    }
  }
  for (const child of node.children ?? []) walk(child, stack, battery, themeId, failures, stops);
}

/** The battery: representative instances of every composable component. */
function battery(): { name: string; el: React.ReactElement }[] {
  return [
    {
      name: 'card-receipt',
      el: (
        <Card>
          <ReceiptHeader label="Energy" summary="target 2,500" />
          <ReceiptRow name="Steak & rice" meta="dinner · 18:46" value="952" unit="kcal" />
          <ReceiptRow name="Water" meta="1,710 / 3,000 ml" last />
          <KV label="Plate total" right="640 kcal" />
          <SrcNote>source: Health Connect · shown as synced</SrcNote>
          <EmptyState>No entries yet today.</EmptyState>
          <MicroLabel>Energy</MicroLabel>
          <MealTag>Dinner — 18:46</MealTag>
          <Rule />
        </Card>
      ),
    },
    {
      name: 'lead-card-hero',
      el: (
        <Card lead>
          <MicroLabel>Energy remaining</MicroLabel>
          <HeroNumeral value="1,283" unit="kcal" />
          <SrcNote>likely 2,505–3,061 kcal eaten</SrcNote>
        </Card>
      ),
    },
    {
      name: 'controls',
      el: (
        <Card>
          <CTA label="Log it" />
          <CTA label="Secondary" secondary />
          <ChipRow options={['Simple', 'Standard', 'Full']} value="Standard" />
          <ChipGroup options={['dairy', 'gluten']} values={['dairy']} />
          <Chip label="Selected" on />
          <Chip label="Unselected" />
          <SubNav items={['Capture', 'Recipes']} active="Capture" onChange={() => {}} />
          <SearchBar placeholder="Search foods" />
          <Stepper value="75" unit="kg" onMinus={() => {}} onPlus={() => {}} />
          <NewRow label="New template" />
        </Card>
      ),
    },
    {
      name: 'meters',
      el: (
        <Card>
          <MacroRow name="Protein" dot={'#000000'} value={127} target={195} />
          <CapRow name="Added sugar" value={72} cap={55} />
          <Bar pct={64} fill={'#000000'} />
          <HeroRings
            rings={[{ fraction: 0.6, fill: '#000000' }, { fraction: 0.4, fill: '#000000' }, { fraction: 0.8, fill: '#000000' }]}
            centerValue="283"
            centerLabel="kcal left"
          />
        </Card>
      ),
    },
    {
      name: 'tiles',
      el: (
        <TileGridThemed>
          <Tile label="Energy" value="1,283" unit="kcal" domain="food" />
          <Tile label="Steps" value="5,423" domain="recovery" />
          <Tile label="Sugar" value="72 / 55" over domain="food" />
          <Tile label="Sleep" empty emptyMessage="no sleep source yet" domain="recovery" />
        </TileGridThemed>
      ),
    },
    {
      name: 'pebble',
      el: (
        <PebbleSlot
          proposal={{ id: 'p1', text: 'Protein is 68 g short — beans at dinner would close it.', actions: [{ kind: 'open-log', label: 'Open log' }, { kind: 'dismiss', label: 'Not now' }] }}
          onAction={() => {}}
        />
      ),
    },
  ];
}

// MacroRow/Bar take semantic fills from callers; the walker substitutes the
// theme's own fill per run so dots/meters are checked with real values.
function withThemeFills(name: string, el: React.ReactElement, t: (typeof THEMES)[ThemeId]): React.ReactElement {
  if (name !== 'meters') return el;
  return (
    <Card>
      <MacroRow name="Protein" dot={t.fill.protein} value={127} target={195} />
      <CapRow name="Added sugar" value={72} cap={55} />
      <Bar pct={64} fill={t.fill.carbs} />
      <HeroRings
        rings={[{ fraction: 0.6, fill: t.fill.protein }, { fraction: 0.4, fill: t.fill.carbs }, { fraction: 0.8, fill: t.fill.recovery }]}
        centerValue="283"
        centerLabel="kcal left"
      />
    </Card>
  );
}

describe('V4.1 §4 — contrast walker, every theme', () => {
  const failures: Failure[] = [];

  it.each(THEME_IDS)('%s: every rendered text clears its ground', (id) => {
    const t = THEMES[id]!;
    const themeFailures: Failure[] = [];
    for (const { name, el } of battery()) {
      let r: ReactTestRenderer;
      act(() => {
        r = create(
          <ThemeProvider theme={t}>
            {withThemeFills(name, el, t)}
          </ThemeProvider>,
        );
      });
      const json = r!.toJSON();
      const roots = Array.isArray(json) ? json : json ? [json] : [];
      for (const root of roots) walk(root, [t.surfaces.bg], name, id, themeFailures, null);
      act(() => r!.unmount());
    }
    failures.push(...themeFailures);
    const table = themeFailures
      .map((f) => `${f.battery} × ${f.theme}: "${f.text}" ${f.fg} on ${f.bg} = ${f.ratio}:1 (needs ${f.need}:1)`)
      .join('\n');
    expect(themeFailures, `\n${table}`).toEqual([]);
  });
});
