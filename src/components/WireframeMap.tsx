import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Polyline, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme';
import { LatLng, latToTileY, lonToTileX } from '../util/geo';
import { POI_KEYS, usePois } from './PoiLayer';

// Geo-anchored 3D wireframe map. Unlike the old decorative version, this is a
// real perspective projection of the same Web-Mercator plane the tile layers
// use: the shared viewport (pan/pinch/zoom in MapPanel) moves the camera, and
// live data — landmark POIs, place names and the alert/user beacon — is
// projected into the scene at its true position. The undulating grid is
// anchored to world coordinates, so terrain scrolls under you as you pan.

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
    const amp = camH * 0.1;
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

    // east-west lines: constant world y, alpha fades with depth
    const horizontals: { pts: string; a: number }[] = [];
    for (let wy = Math.ceil((c.y + gyMin / k) / G15) * G15; wy <= c.y + gyMax / k; wy += G15) {
      const gy = (wy - c.y) * k;
      const z = depth(gy);
      if (z < zn || z > zf) continue;
      const a = Math.max(0.05, 0.55 * (1 - (z - zn) / (zf - zn)));
      const pts: string[] = [];
      for (let gx = gxMin; gx <= gxMax; gx += w * 0.13) {
        const [px, py] = proj(gx, hgt(gx, gy), z);
        pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      }
      horizontals.push({ pts: pts.join(' '), a });
    }
    // north-south lines: constant world x
    const verticals: string[] = [];
    for (let wx = Math.ceil((c.x + gxMin / k) / G15) * G15; wx <= c.x + gxMax / k; wx += G15) {
      const gx = (wx - c.x) * k;
      const pts: string[] = [];
      for (let gy = gyMax; gy >= gyMin; gy -= w * 0.11) {
        const z = depth(gy);
        if (z < zn) continue;
        const [px, py] = proj(gx, hgt(gx, gy), z);
        pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      }
      if (pts.length > 1) verticals.push(pts.join(' '));
    }

    // ---- radar rings around the marker -------------------------------------
    const rings: { pts: string; a: number }[] = [];
    const Rmax = w * 0.55;
    for (let i = 0; i < 3; i++) {
      const r = (t * w * 0.12 + (i * Rmax) / 3) % Rmax;
      const a = Math.max(0, 0.8 * (1 - r / Rmax));
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

    // ---- marker beacon ------------------------------------------------------
    const mz = depth(mg.gy);
    let beacon: React.ReactNode = null;
    if (mz > zn + 1 && mz < zf && Math.abs(mg.gx) < w * 2) {
      const [bx, by] = proj(mg.gx, 0, mz);
      const [tx, ty] = proj(mg.gx, camH * 0.6, mz);
      const pulse = (4 + Math.sin(t * 3) * 1.4) * (z0 / mz);
      beacon = (
        <>
          <Line x1={bx} y1={by} x2={tx} y2={ty} stroke="url(#beacon)" strokeWidth={2.5} />
          <Circle cx={bx} cy={by} r={pulse * 4} fill="url(#markerGlow)" />
          <Circle cx={bx} cy={by} r={3.5 * (z0 / mz)} fill={`rgb(${ACCENT})`} />
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
          <LinearGradient id="beacon" x1="0" y1="1" x2="0" y2="0">
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
          <Polyline key={`v${i}`} points={pts} fill="none" stroke={`rgba(${LINE},0.2)`} strokeWidth={1} />
        ))}
        {rings.map((r, i) => (
          <Polyline key={`r${i}`} points={r.pts} fill="none" stroke={`rgba(${ACCENT},${r.a.toFixed(3)})`} strokeWidth={1.6} />
        ))}
        {places.map((pl) => {
          const fs = Math.min(12, Math.max(8, 11 * (z0 / pl.z)));
          return (
            <SvgText
              key={pl.p.id}
              x={pl.px}
              y={pl.py}
              fill="rgba(215,227,245,0.75)"
              fontSize={fs}
              fontFamily={fonts.sans600}
              letterSpacing="2"
              textAnchor="middle"
            >
              {pl.p.name.toUpperCase()}
            </SvgText>
          );
        })}
        {beacon}
        {shown.map((m, i) => {
          const key = KEY_BY_KIND[m.p.kind as keyof typeof KEY_BY_KIND];
          if (!key) return null;
          const [bx, by] = proj(m.gx, 0, m.z);
          const [hx, hy] = proj(m.gx, stemH, m.z);
          const s = z0 / m.z; // depth scale
          const r = Math.min(9, Math.max(3.5, 7 * s));
          const name = m.p.name.length > 18 ? `${m.p.name.slice(0, 17)}…` : m.p.name;
          const fs = Math.min(11, Math.max(8, 10 * s));
          const chipW = name.length * fs * 0.58 + 12;
          return (
            <React.Fragment key={m.p.id}>
              <Line x1={bx} y1={by} x2={hx} y2={hy} stroke={key.color} strokeWidth={1.4} strokeOpacity={0.75} />
              <Circle cx={bx} cy={by} r={2.2 * s} fill={key.color} opacity={0.55} />
              <Circle cx={hx} cy={hy} r={r * 1.9} fill={key.color} opacity={0.16} />
              <Circle cx={hx} cy={hy} r={r} fill={key.color} stroke="rgba(255,255,255,0.9)" strokeWidth={1.4} />
              {i >= labelFrom ? (
                <>
                  <Rect
                    x={hx - chipW / 2}
                    y={hy - r - fs - 14}
                    width={chipW}
                    height={fs + 9}
                    rx={5}
                    fill="rgba(13,22,38,0.82)"
                    stroke="rgba(122,165,216,0.3)"
                    strokeWidth={1}
                  />
                  <SvgText
                    x={hx}
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
      </Svg>
    );
  }

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.mapDark }]}>
      {content}
    </View>
  );
}
