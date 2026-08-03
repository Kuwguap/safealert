import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

// Radius rings: 1.5px circles scaling 0.1→1 over 3.6s, two staggered 1.8s apart.
function Ring({ size, color, delay }: { size: number; color: string; delay: number }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(() => {
      loop = Animated.loop(
        Animated.timing(t, {
          toValue: 1,
          duration: 3600,
          easing: Easing.linear,
          // react-native-web's native-driver path doesn't restart Animated.loop
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      loop.start();
    }, delay);
    return () => {
      clearTimeout(timer);
      loop?.stop();
    };
  }, [t, delay]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: color,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] }) }],
      }}
    />
  );
}

interface PulseMarkerProps {
  size: number; // ring diameter (150 home / 170 flood)
  ringColor: string;
  pinColor: string;
  pinBorderColor: string;
  glowColor: string; // rgba glow around the center pin
  style?: ViewStyle; // positioning (absolute center point)
}

// Pulsing radius rings + glowing center pin, centered on the given point.
export default function PulseMarker({ size, ringColor, pinColor, pinBorderColor, glowColor, style }: PulseMarkerProps) {
  return (
    <View pointerEvents="none" style={[styles.center, style]}>
      <Ring size={size} color={ringColor} delay={0} />
      <Ring size={size} color={ringColor} delay={1800} />
      <Svg width={44} height={44} style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="pinGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={glowColor} stopOpacity={0.8} />
            <Stop offset="100%" stopColor={glowColor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={22} cy={22} r={22} fill="url(#pinGlow)" />
      </Svg>
      <View
        style={{
          position: 'absolute',
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: pinColor,
          borderWidth: 2,
          borderColor: pinBorderColor,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 0,
    height: 0,
  },
});
