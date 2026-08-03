import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Polyline, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../theme';
import { useLayoutSize } from '../util/useLayoutSize';

// Animated wireframe terrain — ported from the prototype's canvas renderer
// (decorative; production would use Mapbox GL 3D terrain per the proposal).
// The terrain undulates over time; mesh density and frame rate are tuned so
// re-rendering the SVG stays cheap on device.

const LINE = '122,165,216';
const ACCENT = '245,158,11';
const HORIZON = 0.24;
const AMP = 0.8;
const F_SCALE = 0.9;
const CAM_H = 6.2;
const Z_NEAR = 2.2;
const Z_FAR = 34;
const MARKER_X = 1.0;
const MARKER_Z = 9;
const SPEED = 0.8;
const FRAME_MS = 90; // ~11fps — smooth enough for slow terrain waves

const noise = (x: number, z: number, t: number) =>
  Math.sin(x * 0.55 + t * 0.35) * 0.55 +
  Math.sin(z * 0.42 - t * 0.22) * 0.5 +
  Math.sin((x + z) * 0.24 + t * 0.15) * 0.75;

interface Projection {
  proj: (x: number, y: number, z: number) => [number, number];
  hgt: (x: number, z: number, t: number) => number;
}

function makeProjection(w: number, h: number): Projection {
  const f = w * F_SCALE;
  const cy = h * HORIZON;
  const cx = w / 2;
  const hgt = (x: number, z: number, t: number) => {
    const d = Math.hypot(x - MARKER_X, z - MARKER_Z);
    return noise(x, z, t) * AMP * Math.min(1, d / 5);
  };
  const proj = (x: number, y: number, z: number): [number, number] => [
    cx + (x * f) / z,
    cy + ((CAM_H - y) * f) / z,
  ];
  return { proj, hgt };
}

export default function WireframeMap() {
  const { ref, size, onLayout } = useLayoutSize();
  const [t, setT] = useState(0);
  const start = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => setT(((Date.now() - start.current) / 1000) * SPEED), FRAME_MS);
    return () => clearInterval(id);
  }, []);

  const { w, h } = size;
  const P = useMemo(() => (w > 0 && h > 0 ? makeProjection(w, h) : null), [w, h]);

  let content: React.ReactNode = null;
  if (P) {
    const { proj, hgt } = P;

    // Undulating terrain mesh
    const horizontals: { pts: string; a: number }[] = [];
    for (let z = Z_NEAR; z <= Z_FAR; z += 1) {
      const a = Math.max(0.04, 0.55 * (1 - (z - Z_NEAR) / (Z_FAR - Z_NEAR)));
      const pts: string[] = [];
      for (let x = -18; x <= 18; x += 1.5) {
        const [px, py] = proj(x, hgt(x, z, t), z);
        pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      }
      horizontals.push({ pts: pts.join(' '), a });
    }
    const verticals: string[] = [];
    for (let x = -18; x <= 18; x += 2) {
      const pts: string[] = [];
      for (let z = Z_NEAR; z <= Z_FAR; z += 1) {
        const [px, py] = proj(x, hgt(x, z, t), z);
        pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      }
      verticals.push(pts.join(' '));
    }

    // Expanding ground rings around the marker
    const rings: { pts: string; a: number }[] = [];
    for (let k = 0; k < 3; k++) {
      const r = (t * 1.6 + k * 2.4) % 7.2;
      const a = Math.max(0, 0.8 * (1 - r / 7.2));
      const pts: string[] = [];
      for (let i = 0; i <= 40; i++) {
        const ang = (i / 40) * Math.PI * 2;
        const gx = MARKER_X + Math.cos(ang) * r;
        const gz = MARKER_Z + Math.sin(ang) * r;
        if (gz < Z_NEAR + 0.2) continue;
        const [px, py] = proj(gx, 0.02, gz);
        pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      }
      if (pts.length > 1) rings.push({ pts: pts.join(' '), a });
    }

    const [bx, by] = proj(MARKER_X, 0, MARKER_Z);
    const [tx, ty] = proj(MARKER_X, 4.2, MARKER_Z);
    const pulse = 4 + Math.sin(t * 3) * 1.4;

    content = (
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id="beacon" x1={bx} y1={by} x2={tx} y2={ty} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={`rgb(${ACCENT})`} stopOpacity={0.85} />
            <Stop offset="1" stopColor={`rgb(${ACCENT})`} stopOpacity={0} />
          </LinearGradient>
          <RadialGradient id="markerGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={`rgb(${ACCENT})`} stopOpacity={0.9} />
            <Stop offset="1" stopColor={`rgb(${ACCENT})`} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {horizontals.map((l, i) => (
          <Polyline key={`h${i}`} points={l.pts} fill="none" stroke={`rgba(${LINE},${l.a.toFixed(3)})`} strokeWidth={1} />
        ))}
        {verticals.map((pts, i) => (
          <Polyline key={`v${i}`} points={pts} fill="none" stroke={`rgba(${LINE},0.22)`} strokeWidth={1} />
        ))}
        {rings.map((r, i) => (
          <Polyline key={`r${i}`} points={r.pts} fill="none" stroke={`rgba(${ACCENT},${r.a.toFixed(3)})`} strokeWidth={1.6} />
        ))}
        <Line x1={bx} y1={by} x2={tx} y2={ty} stroke="url(#beacon)" strokeWidth={2.5} />
        <Circle cx={bx} cy={by} r={pulse * 4} fill="url(#markerGlow)" />
        <Circle cx={bx} cy={by} r={3.5} fill={`rgb(${ACCENT})`} />
      </Svg>
    );
  }

  return (
    <View
      ref={ref}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.mapDark }}
      onLayout={onLayout}
    >
      {content}
    </View>
  );
}
