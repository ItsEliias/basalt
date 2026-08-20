import { Platform, type TextStyle } from 'react-native';

// Typography contract (design spec §2): system neo-grotesque for prose, mono
// for EVERY numeral, timestamp, unit and micro-label — no exceptions. Columns
// of numbers use tabular figures.

/** System sans — RN's default resolves to SF/Roboto; leave undefined. */
export const sans = undefined;

/** Platform mono stack per the design contract's RN implementation note. */
export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Base style for any numeral, unit, timestamp or micro-label. */
export const monoStyle: TextStyle = {
  fontFamily: mono,
};

/** Mono with tabular figures — for columns of numbers (sets tables, ratios). */
export const monoTabular: TextStyle = {
  fontFamily: mono,
  fontVariant: ['tabular-nums'],
};
