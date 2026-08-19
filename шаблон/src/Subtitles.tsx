import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import plan from '../edit-plan.json';
import { ACCENT, FONT, LAYOUT, MOTION, STRETCH_Y, обводка } from './layout';
import type { Sub } from './types';

const СУБТИТРЫ = plan.subtitles as Sub[];

/**
 * Субтитры под голос: строка целиком, слово под голосом — жёлтым.
 * Это не выводы: выводы решают, что унести с собой, субтитры лишь дают
 * смотреть без звука. Поэтому при появлении вывода субтитры гасятся —
 * две надписи в кадре конкурируют, и зритель не читает ни одну.
 */
export const Subtitles: React.FC<{
  сейчас: number;
  выхКадр: (секИсходника: number) => number;
  visible: boolean;
}> = ({ сейчас, выхКадр, visible }) => {
  const frame = useCurrentFrame();

  const строка = СУБТИТРЫ.find((с) => сейчас >= с.at && сейчас < с.until);
  if (!строка) return null;

  // Гасим и по границам самой строки, и когда пришёл вывод. Края считаются в
  // ВЫХОДНЫХ кадрах: при вырезанной паузе внутри строки затухание не съедается.
  const появление = interpolate(frame, [выхКадр(строка.at), выхКадр(строка.at) + MOTION.subFade], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const уход = interpolate(frame, [выхКадр(строка.until) - MOTION.subFade, выхКадр(строка.until)], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: LAYOUT.sub.bottom,
        display: 'flex',
        justifyContent: 'center',
        gap: '0.34em',
        opacity: visible ? Math.min(появление, уход) : 0,
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: LAYOUT.sub.size,
        letterSpacing: '0.02em',
        color: '#FFFFFF',
        textShadow: обводка(LAYOUT.sub.size),
        transform: `scaleY(${STRETCH_Y})`,
      }}
    >
      {строка.words.map((слово, i) => {
        const следующее = строка.words[i + 1];
        const звучит = сейчас >= слово.t && (!следующее || сейчас < следующее.t);
        return (
          <span key={i} style={{ color: звучит ? ACCENT : undefined }}>
            {слово.w}
          </span>
        );
      })}
    </div>
  );
};
