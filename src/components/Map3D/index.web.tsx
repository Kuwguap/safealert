import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Poi } from '../../api/overpass';
import { LatLng } from '../../util/geo';
import { map3dUrl, poisToFeatures } from './map3dUrl';
import type { Map3DHandle, Map3DProps } from './index';

// Web shell for the MapLibre 3D view — an iframe on the hosted map page,
// driven via postMessage (the page accepts any origin and routes by type).

const Map3D = forwardRef<Map3DHandle, Map3DProps>(({ initialCenter, initialZoom, marker }, ref) => {
  const frame = useRef<any>(null);
  const lastPois = useRef<Poi[]>([]);
  const [url] = useState(() => map3dUrl(initialCenter, initialZoom, marker));

  const send = (msg: object) => {
    try {
      frame.current?.contentWindow?.postMessage(msg, '*');
    } catch {
      // frame not ready yet — onLoad re-delivers
    }
  };
  const sendPois = () => send({ type: 'pois', features: poisToFeatures(lastPois.current) });

  useImperativeHandle(ref, () => ({
    setPois: (pois) => {
      lastPois.current = pois;
      sendPois();
    },
    zoomBy: (delta) => send({ type: 'zoom', delta }),
    recenter: () => send({ type: 'recenter' }),
  }));

  return React.createElement('iframe' as any, {
    ref: frame,
    src: url,
    title: 'SafeAlert 3D map',
    onLoad: sendPois,
    allow: 'fullscreen',
    style: { border: 0, width: '100%', height: '100%', display: 'block', background: '#0d1626' },
  });
});

export default Map3D;
