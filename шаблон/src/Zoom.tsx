import React from 'react';
import { AbsoluteFill, Easing, interpolate } from 'remotion';
import { ZOOM } from './layout';
import type { ZoomKey } from './types';

// Ключ с cut — скачок: перед ним вставляется невидимый ключ с прежним масштабом
// за один кадр до, и интерполяция превращается в мгновенный перепад.
const КЛЮЧИ = (ZOOM.keys as ZoomKey[]).flatMap((к, i, все) =>
  к.cut && i > 0 ? [{ at: к.at - 1 / 30, scale: все[i - 1].scale }, к] : [к],
);

/**
 * Крупность кадра по ключам из монтажного листа.
 * Между соседними ключами — плавный переход с замедлением на выходе:
 * наезд должен останавливаться, а не упираться.
 */
export const Zoom: React.FC<{ сейчас: number; children: React.ReactNode }> = ({ сейчас, children }) => {

  const масштаб = interpolate(
    сейчас,
    КЛЮЧИ.map((к) => к.at),
    КЛЮЧИ.map((к) => к.scale),
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  return (
    <AbsoluteFill style={{ transform: `scale(${масштаб})`, transformOrigin: ZOOM.origin }}>
      {children}
    </AbsoluteFill>
  );
};
