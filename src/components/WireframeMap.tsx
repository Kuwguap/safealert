import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Line, LinearGradient, Polygon, Polyline, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme';
import { LatLng, latToTileY, lonToTileX } from '../util/geo';
import { POI_KEYS, usePois } from './PoiLayer';

// Geo-anchored 3D wireframe map: a true perspective projection of the same
// Web-Mercator plane the tile layers use. The shared viewport (pan / pinch /
// zoom in MapPanel) moves the camera, the world-anchored terrain scrolls
// underneath, and live data — POIs, place names and the alert/user beacon —
// renders in scene at its real position with depth scaling and atmosphere.

const LINE = '122,165,216';
const ACCENT = '245,158,11';
const FRAME_MS = 90; // ~11fps — enough for the slow wave + radar motion
const SPEED = 0.8;
const REF_Z = 15; // world coordinates are zoom-15 Mercator pixels

const KEY_BY_KIND = Object.fromEntries(POI_KEYS.map((k) => [k.kind, k]));

const world15 = (p: LatLng) => ({
  x: lonToTileX(p.lon, REF_Z) * 256,
  y: latToTileY(p.lat, REF_Z) * 256,
});

interface WireframeMapProps {
  viewCenter: LatLng; // pannable viewport center (camera target)
  zoom: number;
  marker: LatLng; // alert / user position — gets the beacon + radar rings
  width: number;
  height: number;
}

export default function WireframeMap({ viewCenter, zoom, marker, width: w, height: h }: WireframeMapProps) {
  const [t, setT] = useState(0);
  const start = useRef(Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(((Date.now() - start.current) / 1000) * SPEED), FRAME_MS);
    return () => clearInterval(id);
  }, []);

  const pois = usePois(viewCenter, zoom, w, h);

  let content: React.ReactNode = null;
  if (w > 0 && h > 0) {
    // ---- camera ------------------------------------------------------------
    const k = 2 ** (zoom - REF_Z); // world px -> on-screen ground px
    const c = world15(viewCenter);
    const ground = (p: LatLng) => {
      const wp = world15(p);
      return { gx: (wp.x - c.x) * k, gy: (wp.y - c.y) * k };
    };
    const f = w * 1.0; // focal length
    const camH = w * 0.5; // camera height above the ground plane
    const z0 = w * 0.9; // depth of the viewport center
    const horizonY = h * 0.26;
    const zn = w * 0.16; // near clip
    const zf = z0 + w * 1.9; // far fade-out
    const depth = (gy: number) => z0 - gy; // north (gy<0) recedes into the scene
    const proj = (x: number, y: number, z: number): [number, number] => [
      w / 2 + (x * f) / z,
      horizonY + ((camH - y) * f) / z,
    ];

    // ---- terrain grid (anchored to world coordinates) ----------------------
    const zq = Math.round(zoom);
    const G15 = 64 * 2 ** (REF_Z - zq); // grid spacing in world px (~45–90 screen px)
    const mg = ground(marker);
    const amp = camH * 0.08;
    const noise = (u: number, v: number) =>
      Math.sin(u * 1.7 + t * 0.35) * 0.55 + Math.sin(v * 1.3 - t * 0.22) * 0.5 + Math.sin((u + v) * 0.8 + t * 0.15) * 0.75;
    const hgt = (gx: number, gy: number) => {
      const flat = Math.min(1, Math.hypot(gx - mg.gx, gy - mg.gy) / (G15 * k * 2)); // flatten near the beacon
      return noise((c.x + gx / k) / G15, (c.y + gy / k) / G15) * amp * flat;
    };

    const gxMin = -w * 1.6;
    const gxMax = w * 1.6;
    const gyMin = z0 - zf; // far (north)
    const gyMax = z0 - zn; // near (south)

    // east-west lines: constant world y; every 4th world line is a brighter major
    const horizontals: { pts: string; a: number; width: number }[] = [];
    for (let wy = Math.ceil((c.y + gyMin / k) / G15) * G15; wy <= c.y + gyMax / k; wy += G15) {
      const gy = (wy - c.y) * k;
      const z = depth(gy);
      if (z < zn || z > zf) continue;
      const major = Math.abs(Math.round(wy / G15)) % 4 === 0;
      const fade = 1 - (z - zn) / (zf - zn);
      const a = Math.max(0.05, (major ? 0.85 : 0.5) * fade);
      const pts: string[] = [];
      for (let gx = gxMin; gx <= gxMax; gx += w * 0.09) {
        const [px, py] = proj(gx, hgt(gx, gy), z);
        pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      }
      horizontals.push({ pts: pts.join(' '), a, width: major ? 1.3 : 0.9 });
    }
    // north-south lines: constant world x
    const verticals: { pts: string; a: number; width: number }[] = [];
    for (let wx = Math.ceil((c.x + gxMin / k) / G15) * G15; wx <= c.x + gxMax / k; wx += G15) {
      const gx = (wx - c.x) * k;
      const major = Math.abs(Math.round(wx / G15)) % 4 === 0;
      const pts: string[] = [];
      for (let gy = gyMax; gy >= gyMin; gy -= w * 0.1) {
        const z = depth(gy);
        if (z < zn) continue;
        const [px, py] = proj(gx, hgt(gx, gy), z);
        pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      }
      if (pts.length > 1) verticals.push({ pts: pts.join(' '), a: major ? 0.3 : 0.16, width: major ? 1.2 : 0.9 });
    }

    // ---- radar rings around the marker -------------------------------------
    const rings: { pts: string; a: number }[] = [];
    const Rmax = w * 0.55;
    for (let i = 0; i < 3; i++) {
      const r = (t * w * 0.12 + (i * Rmax) / 3) % Rmax;
      const a = Math.max(0, 0.9 * (1 - r / Rmax));
      const pts: string[] = [];
      for (let j = 0; j <= 44; j++) {
        const ang = (j / 44) * Math.PI * 2;
        const gy = mg.gy + Math.sin(ang) * r;
        const z = depth(gy);
        if (z < zn + 1) continue;
        const [px, py] = proj(mg.gx + Math.cos(ang) * r, 1, z);
        pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      }
      if (pts.length > 1) rings.push({ pts: pts.join(' '), a });
    }

    // ---- the beacon: alert / user position ----------------------------------
    const mz = depth(mg.gy);
    const beaconVisible = mz > zn + 1 && mz < zf && Math.abs(mg.gx) < w * 2;
    let beaconDefs: React.ReactNode = null;
    let beacon: React.ReactNode = null;
    if (beaconVisible) {
      const s = z0 / mz; // depth scale
      const [bx, by] = proj(mg.gx, 0, mz);
      const [tx, ty] = proj(mg.gx, camH * 0.72, mz);
      const pulse = 1 + 0.25 * Math.sin(t * 3);
      const bob = Math.sin(t * 2.2) * 4 * s;
      const dSize = 7 * s;
      const dy = ty - dSize - 4 + bob; // floating diamond above the beam
      // NOTE: gradients on <Line> need userSpaceOnUse — a line's bounding box
      // has zero width, so objectBoundingBox gradients render nothing.
      beaconDefs = (
        <LinearGradient id="beam" x1={bx} y1={by} x2={tx} y2={ty} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={`rgb(${ACCENT})`} stopOpacity={0.95} />
          <Stop offset="1" stopColor={`rgb(${ACCENT})`} stopOpacity={0} />
        </LinearGradient>
      );
      beacon = (
        <>
          <Ellipse cx={bx} cy={by} rx={16 * s * pulse} ry={5.5 * s * pulse} fill="url(#markerGlow)" />
          <Line x1={bx} y1={by} x2={tx} y2={ty} stroke="url(#beam)" strokeWidth={6 * s} strokeOpacity={0.25} />
          <Line x1={bx} y1={by} x2={tx} y2={ty} stroke="url(#beam)" strokeWidth={2.4 * s} />
          <Circle cx={bx} cy={by} r={4.5 * s * pulse} fill={`rgb(${ACCENT})`} stroke="#fff7e6" strokeWidth={1.6} />
          <Polygon
            points={`${tx},${dy - dSize} ${tx + dSize * 0.7},${dy} ${tx},${dy + dSize} ${tx - dSize * 0.7},${dy}`}
            fill={`rgb(${ACCENT})`}
            stroke="#fff7e6"
            strokeWidth={1.2}
          />
        </>
      );
    }

    // ---- data: POIs + place names, projected onto the plane ----------------
    const markers: { p: (typeof pois)[number]; gx: number; z: number }[] = [];
    const places: { p: (typeof pois)[number]; px: number; py: number; z: number }[] = [];
    for (const p of pois) {
      const g = ground(p);
      const z = depth(g.gy);
      if (z < zn + 2 || z > zf * 0.9) continue;
      const [px, py] = proj(g.gx, 0, z);
      if (px < -30 || px > w + 30) continue;
      if (p.kind === 'place') {
        if (places.length < 5) places.push({ p, px, py, z });
      } else {
        markers.push({ p, gx: g.gx, z });
      }
    }
    markers.sort((a, b) => b.z - a.z); // painter's order: far first
    const shown = markers.slice(-14);
    const labelFrom = Math.max(0, shown.length - 6); // name chips on the 6 nearest
    const stemH = camH * 0.2;

    content = (
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id="horizonGlow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={`rgb(${LINE})`} stopOpacity={0.3} />
            <Stop offset="1" stopColor={`rgb(${LINE})`} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="groundFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#16294a" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#16294a" stopOpacity={0} />
          </LinearGradient>
          <RadialGradient id="markerGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={`rgb(${ACCENT})`} stopOpacity={0.85} />
            <Stop offset="1" stopColor={`rgb(${ACCENT})`} stopOpacity={0} />
          </RadialGradient>
          {beaconDefs}
        </Defs>

        {/* atmosphere: sky, horizon glow, ground depth */}
        <Rect x={0} y={0} width={w} height={horizonY} fill="#0a1120" />
        <Rect x={0} y={horizonY} width={w} height={26} fill="url(#horizonGlow)" />
        <Line x1={0} y1={horizonY} x2={w} y2={horizonY} stroke={`rgba(${LINE},0.5)`} strokeWidth={1} />
        <Rect x={0} y={horizonY} width={w} height={(h - horizonY) * 0.55} fill="url(#groundFade)" />

        {/* compass — the 3D view is always north-up */}
        <Polyline
          points={`${w / 2 - 4},${horizonY - 20} ${w / 2},${horizonY - 25} ${w / 2 + 4},${horizonY - 20}`}
          fill="none"
          stroke="rgba(215,227,245,0.45)"
          strokeWidth={1.2}
        />
        <SvgText x={w / 2} y={horizonY - 8} fill="rgba(215,227,245,0.5)" fontSize={10} fontFamily={fonts.sans600} textAnchor="middle">
          N
        </SvgText>

        {horizontals.map((l, i) => (
          <Polyline key={`h${i}`} points={l.pts} fill="none" stroke={`rgba(${LINE},${l.a.toFixed(3)})`} strokeWidth={l.width} />
        ))}
        {verticals.map((l, i) => (
          <Polyline key={`v${i}`} points={l.pts} fill="none" stroke={`rgba(${LINE},${l.a.toFixed(3)})`} strokeWidth={l.width} />
        ))}
        {rings.map((r, i) => (
          <Polyline key={`r${i}`} points={r.pts} fill="none" stroke={`rgba(${ACCENT},${r.a.toFixed(3)})`} strokeWidth={1.8} />
        ))}
        {places.map((pl) => {
          const fs = Math.min(12, Math.max(8, 11 * (z0 / pl.z)));
          return (
            <SvgText
              key={pl.p.id}
              x={pl.px}
              y={pl.py}
              fill="rgba(215,227,245,0.7)"
              fontSize={fs}
              fontFamily={fonts.sans600}
              letterSpacing="2"
              textAnchor="middle"
            >
              {pl.p.name.toUpperCase()}
            </SvgText>
          );
        })}
        {shown.map((m, i) => {
          const key = KEY_BY_KIND[m.p.kind as keyof typeof KEY_BY_KIND];
          if (!key) return null;
          const [bx, by] = proj(m.gx, 0, m.z);
          const [hx, hy] = proj(m.gx, stemH, m.z);
          const s = z0 / m.z;
          const r = Math.min(9, Math.max(3.5, 7 * s));
          const name = m.p.name.length > 18 ? `${m.p.name.slice(0, 17)}…` : m.p.name;
          const fs = Math.min(11, Math.max(8, 10 * s));
          const chipW = name.length * fs * 0.58 + 18;
          return (
            <React.Fragment key={m.p.id}>
              <Ellipse cx={bx} cy={by} rx={r * 1.5} ry={r * 0.5} fill={key.color} opacity={0.22} />
              <Line x1={bx} y1={by} x2={hx} y2={hy} stroke={key.color} strokeWidth={1.5} strokeOpacity={0.8} />
              <Circle cx={hx} cy={hy} r={r * 1.9} fill={key.color} opacity={0.16} />
              <Circle cx={hx} cy={hy} r={r} fill={key.color} stroke="rgba(255,255,255,0.92)" strokeWidth={1.4} />
              <Circle cx={hx} cy={hy} r={r * 0.35} fill="#fff" opacity={0.9} />
              {i >= labelFrom ? (
                <>
                  <Rect
                    x={hx - chipW / 2}
                    y={hy - r - fs - 15}
                    width={chipW}
                    height={fs + 10}
                    rx={5}
                    fill="rgba(13,22,38,0.85)"
                    stroke="rgba(122,165,216,0.35)"
                    strokeWidth={1}
                  />
                  <Circle cx={hx - chipW / 2 + 8} cy={hy - r - 10 - fs / 2 + 2} r={2.5} fill={key.color} />
                  <SvgText
                    x={hx + 5}
                    y={hy - r - 8}
                    fill={colors.mapText}
                    fontSize={fs}
                    fontFamily={fonts.sans500}
                    textAnchor="middle"
                  >
                    {name}
                  </SvgText>
                </>
              ) : null}
            </React.Fragment>
          );
        })}
        {beacon}
      </Svg>
    );
  }

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.mapDark }]}>
      {content}
    </View>
  );
}
