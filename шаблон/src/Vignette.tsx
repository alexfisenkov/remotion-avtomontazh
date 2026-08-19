import React from 'react';
import { AbsoluteFill } from 'remotion';

/**
 * Затемнение по краям. Нужно не для красоты: белый текст с обводкой на светлой
 * футболке и стене читается хуже, чем на приглушённом крае кадра.
 */
export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(ellipse 78% 68% at 50% 42%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.42) 100%)',
      pointerEvents: 'none',
    }}
  />
);
