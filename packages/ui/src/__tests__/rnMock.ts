// Minimal react-native mock for the contrast walker (V4.1 §4). Host
// components become string-typed elements so react-test-renderer can build
// a walkable tree; styles pass through untouched so the walker can resolve
// every color/backgroundColor pair exactly as written.

type Style = Record<string, unknown> | Array<unknown> | null | undefined;

export const View = 'View';
export const Text = 'Text';
export const TextInput = 'TextInput';
export const Pressable = 'Pressable';
export const ScrollView = 'ScrollView';
export const Switch = 'Switch';
export const Modal = 'Modal';
export const Image = 'Image';
export const RefreshControl = 'RefreshControl';

export const StyleSheet = {
  create: <T,>(s: T): T => s,
  flatten(style: Style): Record<string, unknown> {
    if (!style) return {};
    if (Array.isArray(style)) {
      return style.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...StyleSheet.flatten(s as Style) }), {});
    }
    return style as Record<string, unknown>;
  },
  hairlineWidth: 0.5,
  absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
};

class AnimatedValue {
  v: number;
  constructor(v: number) { this.v = v; }
  setValue(v: number) { this.v = v; }
  addListener() { return 'id'; }
  removeListener() {}
  interpolate() { return this; }
}
const anim = { start: (cb?: () => void) => cb?.(), stop: () => {} };
export const Animated = {
  Value: AnimatedValue,
  timing: () => anim,
  spring: () => anim,
  parallel: () => anim,
  sequence: () => anim,
  stagger: () => anim,
  loop: () => anim,
  View: 'Animated.View',
  Text: 'Animated.Text',
  createAnimatedComponent: (c: unknown) => c,
};

export const Easing = {
  out: (f: unknown) => f,
  inOut: (f: unknown) => f,
  cubic: (t: number) => t,
  quad: (t: number) => t,
};

export const AccessibilityInfo = {
  isReduceMotionEnabled: () => Promise.resolve(false),
  addEventListener: () => ({ remove: () => {} }),
};

export const PanResponder = {
  create: () => ({ panHandlers: {} }),
};

export const Platform = { OS: 'android', constants: {}, select: (o: { android?: unknown; default?: unknown }) => o.android ?? o.default };
export const Alert = { alert: () => {} };
export const Linking = { openURL: () => Promise.resolve() };
export const useWindowDimensions = () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
export const PixelRatio = { get: () => 3, getFontScale: () => 1, roundToNearestPixel: (n: number) => n };
export const AppState = { currentState: 'active', addEventListener: () => ({ remove: () => {} }) };
export const Keyboard = { dismiss: () => {} };
