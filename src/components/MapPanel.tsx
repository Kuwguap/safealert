import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, Image, PanResponder, PanResponderGestureState, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Defs, Rect, RadialGradient, Stop } from 'react-native-svg';
import { colors, fonts } from '../theme';
import { clamp, LatLng, MAX_ZOOM, MIN_ZOOM, panCenter, screenOffset, TILE_PROVIDERS, tilesForView } from '../util/geo';
import { useLayoutSize } from '../util/useLayoutSize';
import PoiLayer, { MapLegend } from './PoiLayer';
import PulseMarker from './PulseRings';
import WireframeMap from './WireframeMap';

export type MapView = '3d' | 'street' | 'satellite';

const VIEW_LABELS: Record<MapView, string> = { '3d': '3D', street: 'Map', satellite: 'Satellite' };

// Segmented layer toggle (active segment amber, inactive transparent)
export function MapToggle({ view, onChange }: { view: MapView; onChange: (v: MapView) => void }) {
  return (
    <View style={styles.toggle}>
      {(['3d', 'street', 'satellite'] as const).map((v) => (
        <Pressable
          key={v}
          onPress={() => onChange(v)}
          style={[styles.toggleSeg, view === v && { backgroundColor: colors.mapAccent }]}
          hitSlop={8}
        >
          <Text style={[styles.toggleText, { color: view === v ? colors.mapToggleActiveText : colors.mapText }]}>
            {VIEW_LABELS[v]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// Dark translucent badge chip used over the map
export function MapChip({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.chip, style]}>{children}</View>;
}

export const mapChipText = {
  fontFamily: fonts.sans500,
  fontSize: 11.5,
  color: colors.mapText,
} as const;

function RoundButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.roundBtn} onPress={onPress} hitSlop={6}>
      <Text style={styles.roundBtnText}>{label}</Text>
    </Pressable>
  );
}

interface MapPanelProps {
  center: LatLng; // the marker / point of interest
  zoom?: number;
  view?: MapView; // omit to force satellite-only
  onViewChange?: (v: MapView) => void;
  variant: 'amber' | 'flood';
  ringSize?: number;
  style?: ViewStyle;
  children?: React.ReactNode; // chips, positioned absolutely by callers
}

export default function MapPanel({
  center,
  zoom = 14,
  view,
  onViewChange,
  variant,
  ringSize = 150,
  style,
  children,
}: MapPanelProps) {
  const showTiles = view !== '3d';
  const baseLayer: 'street' | 'satellite' = view === 'street' ? 'street' : 'satellite';
  const isFlood = variant === 'flood';
  const { ref, size, onLayout } = useLayoutSize();

  // Pannable/zoomable viewport; recenters when the target coordinate changes
  const [viewport, setViewport] = useState({ center, zoom });
  useEffect(() => {
    setViewport({ center, zoom });
  }, [center.lat, center.lon, zoom]);

  // Live viewport ref so gesture handlers never read stale state
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const touchesRef = useRef<{ x: number; y: number }[]>([]);
  const lastPanRef = useRef({ dx: 0, dy: 0 });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4 || g.numberActiveTouches >= 2,
        onPanResponderGrant: (e, g) => {
          lastPanRef.current = { dx: g.dx, dy: g.dy };
          touchesRef.current = e.nativeEvent.touches.map((t) => ({ x: t.pageX, y: t.pageY }));
        },
        onPanResponderMove: (e: GestureResponderEvent, g: PanResponderGestureState) => {
          const v = viewportRef.current;
          const touches = e.nativeEvent.touches.map((t) => ({ x: t.pageX, y: t.pageY }));
          const prev = touchesRef.current;
          if (touches.length >= 2 && prev.length >= 2) {
            // pinch zoom (native) + two-finger pan
            const d = Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y);
            const dPrev = Math.hypot(prev[0].x - prev[1].x, prev[0].y - prev[1].y);
            const midDx = (touches[0].x + touches[1].x) / 2 - (prev[0].x + prev[1].x) / 2;
            const midDy = (touches[0].y + touches[1].y) / 2 - (prev[0].y + prev[1].y) / 2;
            const nextZoom = dPrev > 0 ? clamp(v.zoom + Math.log2(d / dPrev), MIN_ZOOM, MAX_ZOOM) : v.zoom;
            setViewport({ zoom: nextZoom, center: panCenter(v.center, nextZoom, midDx, midDy) });
          } else {
            // single-pointer drag (gestureState deltas also cover web/mouse)
            const stepX = g.dx - lastPanRef.current.dx;
            const stepY = g.dy - lastPanRef.current.dy;
            setViewport({ zoom: v.zoom, center: panCenter(v.center, v.zoom, stepX, stepY) });
          }
          lastPanRef.current = { dx: g.dx, dy: g.dy };
          touchesRef.current = touches;
        },
        onPanResponderTerminationRequest: () => false,
      }),
    []
  );

  const zoomBy = (dz: number) =>
    setViewport((v) => ({ ...v, zoom: clamp(v.zoom + dz, MIN_ZOOM, MAX_ZOOM) }));
  const recenter = () => setViewport({ center, zoom });

  const tiles = showTiles && size.w > 0 ? tilesForView(viewport.center, viewport.zoom, size.w, size.h) : [];
  // Dark vignette only suits imagery; the street map stays clean. The flood
  // tint keeps its zone wash on either layer.
  const showVignette = baseLayer === 'satellite' || isFlood;
  const marker = size.w > 0 ? screenOffset(center, viewport.center, viewport.zoom) : null;
  const markerVisible =
    marker && Math.abs(marker.dx) < size.w / 2 + ringSize / 2 && Math.abs(marker.dy) < size.h / 2 + ringSize / 2;

  return (
    <View style={[styles.panel, style]}>
      {/* One interactive surface: drag/pinch pans and zooms every view, 3D included */}
      <View ref={ref} style={StyleSheet.absoluteFill} onLayout={onLayout} {...panResponder.panHandlers}>
        {view === '3d' ? (
          <WireframeMap
            viewCenter={viewport.center}
            zoom={viewport.zoom}
            marker={center}
            width={size.w}
            height={size.h}
          />
        ) : (
          <>
            {tiles.map((tile) => (
              <Image
                key={tile.key}
                source={{ uri: TILE_PROVIDERS[baseLayer](tile) }}
                style={{ position: 'absolute', left: tile.left, top: tile.top, width: tile.size + 0.5, height: tile.size + 0.5 }}
              />
            ))}
            {baseLayer === 'satellite'
              ? tiles.map((tile) => (
                  <Image
                    key={`lbl-${tile.key}`}
                    source={{ uri: TILE_PROVIDERS.satelliteLabels(tile) }}
                    style={{ position: 'absolute', left: tile.left, top: tile.top, width: tile.size + 0.5, height: tile.size + 0.5 }}
                  />
                ))
              : null}
            {showVignette ? (
              <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
                <Defs>
                  {!isFlood ? (
                    <RadialGradient id="vig" cx="50%" cy="50%" r="70%">
                      <Stop offset="45%" stopColor={colors.mapDark} stopOpacity={0} />
                      <Stop offset="100%" stopColor={colors.mapDark} stopOpacity={0.5} />
                    </RadialGradient>
                  ) : (
                    <RadialGradient id="vig" cx="50%" cy="50%" r="75%">
                      <Stop offset="0%" stopColor={colors.flood} stopOpacity={0.45} />
                      <Stop offset="34%" stopColor={colors.flood} stopOpacity={0.15} />
                      <Stop offset="100%" stopColor={colors.mapDark} stopOpacity={0.45} />
                    </RadialGradient>
                  )}
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#vig)" />
              </Svg>
            ) : null}
            <PoiLayer viewCenter={viewport.center} zoom={viewport.zoom} width={size.w} height={size.h} baseLayer={baseLayer} />
            {markerVisible ? (
              <PulseMarker
                size={ringSize}
                ringColor={isFlood ? colors.floodRing : colors.mapAccent}
                pinColor={isFlood ? colors.floodPin : colors.mapAccent}
                pinBorderColor={isFlood ? '#eaf2fb' : '#fff7e6'}
                glowColor={isFlood ? colors.floodRing : colors.mapAccent}
                style={{
                  position: 'absolute',
                  left: size.w / 2 + marker!.dx,
                  top: size.h / 2 + marker!.dy,
                }}
              />
            ) : null}
          </>
        )}
      </View>
      <MapLegend style={styles.legendLeft} />
      {view && onViewChange ? (
        <View style={styles.toggleWrap}>
          <MapToggle view={view} onChange={onViewChange} />
        </View>
      ) : null}
      <View style={styles.zoomControls}>
        <RoundButton label="+" onPress={() => zoomBy(1)} />
        <RoundButton label="−" onPress={() => zoomBy(-1)} />
        <RoundButton label="◎" onPress={recenter} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.mapDark,
    borderWidth: 1,
    borderColor: 'rgba(35,26,16,0.1)',
  },
  toggleWrap: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  toggle: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    backgroundColor: colors.mapChipBg,
    borderWidth: 1,
    borderColor: colors.mapChipBorder,
    borderRadius: 9,
  },
  toggleSeg: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 7,
  },
  toggleText: {
    fontFamily: fonts.sans600,
    fontSize: 11,
  },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: colors.mapChipBg,
    borderWidth: 1,
    borderColor: colors.mapChipBorder,
    borderRadius: 9,
  },
  zoomControls: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -54,
    gap: 6,
  },
  legendLeft: { left: 12, top: '50%', marginTop: -52 },
  roundBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.mapChipBg,
    borderWidth: 1,
    borderColor: colors.mapChipBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnText: {
    fontFamily: fonts.sans600,
    fontSize: 15,
    color: colors.mapText,
    marginTop: -1,
  },
});
