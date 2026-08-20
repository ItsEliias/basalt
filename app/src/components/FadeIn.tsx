import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

// The one sanctioned view transition: 180 ms fade + 4 px rise. Nothing
// springier exists in this app.

export function FadeIn({ children, viewKey }: { children: React.ReactNode; viewKey: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(4)).current;

  useEffect(() => {
    opacity.setValue(0);
    rise.setValue(4);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [viewKey, opacity, rise]);

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateY: rise }] }}>
      {children}
    </Animated.View>
  );
}
