import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { fetchPois, Poi, PoiKind } from '../api/overpass';
import { colors, fonts } from '../theme';
import { LatLng, screenOffset } from '../util/geo';

// Landmark markers + place-name labels over the satellite map.
// Markers drop in with a staggered spring and carry a soft pulsing halo.

export const POI_KEYS: { kind: Exclude<PoiKind, 'place'>; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { kind: 'school', label: 'School', color: '#a78bfa', icon: 'school' },
  { kind: 'hospital', label: 'Hospital', color: '#f0655c', icon: 'medkit' },
  { kind: 'police', label: 'Police', color: '#6ea3d8', icon: 'shield-checkmark' },
  { kind: 'fire', label: 'Fire', color: '#f59e0b', icon: 'flame' },
];

const KEY_BY_KIND = Object.fromEntries(POI_KEYS.map((k) => [k.kind, k])) as Record<
  Exclude<PoiKind, 'place'>,
  (typeof POI_KEYS)[number]
>;

const USE_NATIVE = Platform.OS !== 'web';
const MAX_MARKERS = 14;
const MAX_LABELED = 6;
const MAX_PLACES = 5;

function Halo({ color }: { color: string }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE })
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <Animated.View
      style={[
        styles.halo,
        {
          borderColor: color,
          opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.9] }) }],
        },
      ]}
    />
  );
}

function Marker({ poi, x, y, index, showLabel }: { poi: Poi; x: number; y: number; index: number; showLabel: boolean }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.spring(t, {
      toValue: 1,
      delay: index * 70,
      friction: 6,
      tension: 90,
      useNativeDriver: USE_NATIVE,
    });
    anim.start();
    return () => anim.stop();
  }, [t, index]);

  const key = KEY_BY_KIND[poi.kind as Exclude<PoiKind, 'place'>];
  if (!key) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.markerWrap,
        {
          left: x,
          top: y,
          opacity: t,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
            { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
          ],
        },
      ]}
    >
      <View style={styles.markerCenter}>
        <Halo color={key.color} />
        <View style={[styles.markerDot, { backgroundColor: key.color }]}>
          <Ionicons name={key.icon} size={10} color="#fff" />
        </View>
        {showLabel ? (
          <View style={styles.markerLabel}>
            <Text style={styles.markerLabelText} numberOfLines={1}>
              {poi.name}
            </Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function PlaceLabel({ poi, x, y, index, light }: { poi: Poi; x: number; y: number; index: number; light: boolean }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(t, { toValue: 1, duration: 500, delay: 200 + index * 90, useNativeDriver: USE_NATIVE });
    anim.start();
    return () => anim.stop();
  }, [t, index]);
  return (
    <Animated.View pointerEvents="none" style={[styles.placeWrap, { left: x, top: y, opacity: t }]}>
      <Text style={[styles.placeText, light && styles.placeTextLight]} numberOfLines={1}>
        {poi.name}
      </Text>
    </Animated.View>
  );
}

// Legend ("keys") shown alongside the map
export function MapLegend({ style }: { style?: object }) {
  return (
    <View style={[styles.legend, style]} pointerEvents="none">
      {POI_KEYS.map((k) => (
        <View key={k.kind} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: k.color }]}>
            <Ionicons name={k.icon} size={8} color="#fff" />
          </View>
          <Text style={styles.legendText}>{k.label}</Text>
        </View>
      ))}
    </View>
  );
}

interface PoiLayerProps {
  viewCenter: LatLng;
  zoom: number;
  width: number;
  height: number;
  baseLayer?: 'street' | 'satellite';
}

export default function PoiLayer({ viewCenter, zoom, width, height, baseLayer = 'satellite' }: PoiLayerProps) {
  const [pois, setPois] = useState<Poi[]>([]);
  const seq = useRef(0);

  // Debounced fetch keyed on the (rounded) viewport
  useEffect(() => {
    if (zoom < 12 || width === 0) {
      setPois([]);
      return;
    }
    const mySeq = ++seq.current;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const load = async (attempt: number) => {
      const metersPerPx = (156543 * Math.cos((viewCenter.lat * Math.PI) / 180)) / 2 ** zoom;
      const radius = (metersPerPx * Math.hypot(width, height)) / 2;
      try {
        const found = await fetchPois(viewCenter, radius);
        if (seq.current === mySeq) setPois(found);
      } catch {
        // Overpass rate-limits bursts — retry once before giving up
        if (seq.current === mySeq && attempt === 0) retryTimer = setTimeout(() => load(1), 4000);
        else if (seq.current === mySeq) setPois([]);
      }
    };
    const timer = setTimeout(() => load(0), 600);
    return () => {
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [Math.round(viewCenter.lat * 200) / 200, Math.round(viewCenter.lon * 200) / 200, Math.round(zoom), width, height]);

  if (zoom < 12 || width === 0) return null;

  const placed: { poi: Poi; x: number; y: number }[] = [];
  const placeLabels: { poi: Poi; x: number; y: number }[] = [];
  for (const poi of pois) {
    const { dx, dy } = screenOffset(poi, viewCenter, zoom);
    const x = width / 2 + dx;
    const y = height / 2 + dy;
    if (x < 10 || x > width - 10 || y < 14 || y > height - 14) continue;
    if (poi.kind === 'place') {
      if (placeLabels.length < MAX_PLACES) placeLabels.push({ poi, x, y });
    } else if (placed.length < MAX_MARKERS) {
      placed.push({ poi, x, y });
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {placeLabels.map((p, i) => (
        <PlaceLabel key={p.poi.id} poi={p.poi} x={p.x} y={p.y} index={i} light={baseLayer === 'street'} />
      ))}
      {placed.map((p, i) => (
        <Marker key={p.poi.id} poi={p.poi} x={p.x} y={p.y} index={i} showLabel={i < MAX_LABELED} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  markerWrap: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  markerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 0,
    height: 0,
  },
  halo: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
  },
  markerDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  markerLabel: {
    position: 'absolute',
    top: 12,
    paddingVertical: 2,
    paddingHorizontal: 7,
    backgroundColor: colors.mapChipBg,
    borderWidth: 1,
    borderColor: colors.mapChipBorder,
    borderRadius: 7,
    maxWidth: 130,
  },
  markerLabelText: {
    fontFamily: fonts.sans500,
    fontSize: 9.5,
    color: colors.mapText,
  },
  placeWrap: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeText: {
    fontFamily: fonts.sans600,
    fontSize: 10.5,
    color: 'rgba(215,227,245,0.85)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(13,22,38,0.9)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
    width: 150,
    textAlign: 'center',
  },
  placeTextLight: {
    color: 'rgba(61,51,36,0.9)',
    textShadowColor: 'rgba(255,255,255,0.9)',
  },
  legend: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 9,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.mapChipBg,
    borderWidth: 1,
    borderColor: colors.mapChipBorder,
    borderRadius: 9,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendText: {
    fontFamily: fonts.sans500,
    fontSize: 10,
    color: colors.mapText,
  },
});
