import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';

// Component size via onLayout, with a direct DOM measurement fallback on web
// (react-native-web delivers onLayout through requestAnimationFrame, which
// background/hidden tabs throttle — the fallback keeps maps rendering there).
export function useLayoutSize() {
  const ref = useRef<View>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const update = useCallback((w: number, h: number) => {
    if (w > 0 && h > 0) setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
  }, []);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => update(e.nativeEvent.layout.width, e.nativeEvent.layout.height),
    [update]
  );

  useEffect(() => {
    const node = ref.current as any;
    if (node && typeof node.getBoundingClientRect === 'function') {
      const r = node.getBoundingClientRect();
      update(r.width, r.height);
    }
  });

  return { ref, size, onLayout };
}
