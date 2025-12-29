import { useEffect, useState } from 'react';

export interface VisualViewportInfo {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
  scale: number;
  keyboardOpen: boolean;
  keyboardHeight: number;
}

const KEYBOARD_OPEN_THRESHOLD_PX = 150;

function readViewport(): VisualViewportInfo {
  const layoutWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const layoutHeight = typeof window !== 'undefined' ? window.innerHeight : 0;

  const vv = typeof window !== 'undefined' ? window.visualViewport : null;

  const width = vv?.width ?? layoutWidth;
  const height = vv?.height ?? layoutHeight;
  const offsetTop = vv?.offsetTop ?? 0;
  const offsetLeft = vv?.offsetLeft ?? 0;
  const scale = vv?.scale ?? 1;

  // Approximation: when the on-screen keyboard opens, visual viewport height shrinks.
  // We ignore small changes (browser chrome) with a threshold.
  const keyboardHeight = Math.max(0, layoutHeight - height);
  const keyboardOpen = keyboardHeight > KEYBOARD_OPEN_THRESHOLD_PX;

  return { width, height, offsetTop, offsetLeft, scale, keyboardOpen, keyboardHeight };
}

export function useVisualViewport(): VisualViewportInfo {
  const [info, setInfo] = useState<VisualViewportInfo>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 0,
        height: 0,
        offsetTop: 0,
        offsetLeft: 0,
        scale: 1,
        keyboardOpen: false,
        keyboardHeight: 0,
      };
    }
    return readViewport();
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => setInfo(readViewport());

    // `visualViewport` is the most reliable way to react to the on-screen keyboard.
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    update();

    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return info;
}
