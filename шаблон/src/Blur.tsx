import React from 'react';
import { OffthreadVideo, staticFile } from 'remotion';
import plan from '../edit-plan.json';
import type { Effect } from './types';

// Замазка приватного. Размываем ПОЛНУЮ копию кадра и показываем только окно rect:
// края окна берут пиксели из соседей, поэтому светлой каймы по границе не возникает.
// backdrop-filter здесь не используем — он ведёт себя по-разному в студии и на рендере.
export const Blur: React.FC<{ effect: Effect; clip: string }> = ({ effect, clip }) => {
  const [x, y, w, h] = effect.rect;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        overflow: 'hidden',
        // Скругление под форму закрываемого элемента, чтобы замазка не читалась
        // как цензурная плашка поверх интерфейса.
        borderRadius: effect.round ?? 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: -x,
          top: -y,
          width: plan.width,
          height: plan.height,
          filter: `blur(${effect.radius}px)`,
        }}
      >
        <OffthreadVideo
          src={staticFile(clip)}
          style={{ width: plan.width, height: plan.height }}
          muted
        />
      </div>
    </div>
  );
};
