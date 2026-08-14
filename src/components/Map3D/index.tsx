import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Poi } from '../../api/overpass';
import { LatLng } from '../../util/geo';
import { map3dUrl, poisToFeatures } from './map3dUrl';

// Native shell for the MapLibre 3D view — a WebView on the hosted map page.
// (Web uses index.web.tsx with an iframe instead.)

export interface Map3DHandle {
  setPois: (pois: Poi[]) => void;
  zoomBy: (delta: number) => void;
  recenter: () => void;
}

export interface Map3DProps {
  initialCenter: LatLng;
  initialZoom: number;
  marker: LatLng;
}

const Map3D = forwardRef<Map3DHandle, Map3DProps>(({ initialCenter, initialZoom, marker }, ref) => {
  const web = useRef<WebView>(null);
  const lastPois = useRef<Poi[]>([]);
  const [url] = useState(() => map3dUrl(initialCenter, initialZoom, marker));

  const send = (msg: object) => web.current?.injectJavaScript(`window.__route(${JSON.stringify(msg)}); true;`);
  const sendPois = () => send({ type: 'pois', features: poisToFeatures(lastPois.current) });

  useImperativeHandle(ref, () => ({
    setPois: (pois) => {
      lastPois.current = pois;
      sendPois();
    },
    zoomBy: (delta) => send({ type: 'zoom', delta }),
    recenter: () => send({ type: 'recenter' }),
  }));

  return (
    <WebView
      ref={web}
      source={{ uri: url }}
      style={styles.web}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      setSupportMultipleWindows={false}
      onLoadEnd={sendPois} // re-deliver POIs once the page is ready
    />
  );
});

export default Map3D;

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#0d1626' },
});
