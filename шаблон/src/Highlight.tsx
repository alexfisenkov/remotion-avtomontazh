import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ACCENT, FONT, LAYOUT, MOTION, STRETCH_Y, обводка } from './layout';
import type { Cue } from './types';

// Разбивает строку на обычные и акцентные куски. Красится только ПЕРВОЕ вхождение:
// split() при повторе акцента в строке молча терял хвост текста.
const parts = (line: string, accent?: string) => {
  const где = accent ? line.indexOf(accent) : -1;
  if (!accent || где === -1) return [{ t: line, hot: false }];
  return [
    { t: line.slice(0, где), hot: false },
    { t: accent, hot: true },
    { t: line.slice(где + accent.length), hot: false },
  ].filter((p) => p.t !== '');
};

/** start/end — кадры внутри фрагмента, уже пересчитанные из абсолютных секунд. */
export const Highlight: React.FC<{ cue: Cue; start: number; end: number }> = ({
  cue,
  start,
  end,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    fps,
    frame: frame - start,
    config: { damping: MOTION.damping },
    durationInFrames: MOTION.enterFrames,
  });
  // До end - 1, а не до end: кадр end уже не рендерится (Fragment показывает
  // надпись при frame < end), и затухание до end обрывалось скачком.
  const exit = interpolate(frame, [end - MOTION.exitFrames, end - 1], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const strip = cue.place === 'B-strip';
  const size = cue.size ?? (strip ? LAYOUT.textB.size : LAYOUT.textA.size);

  const box: React.CSSProperties = strip
    ? {
        left: LAYOUT.textB.x,
        top: LAYOUT.textB.y,
        width: LAYOUT.textB.width,
        textAlign: 'center',
        transformOrigin: 'center top',
      }
    : {
        left: LAYOUT.textA.x,
        bottom: LAYOUT.textA.bottom,
        width: LAYOUT.textA.maxWidth,
        textAlign: 'left',
        transformOrigin: 'left bottom',
      };

  return (
    <div
      style={{
        position: 'absolute',
        ...box,
        opacity: exit,
        fontFamily: FONT,
        fontWeight: strip ? 600 : 700,
        fontSize: size,
        lineHeight: strip ? 1.15 : 1.14,
        letterSpacing: strip ? '0.04em' : '0.015em',
        textTransform: 'uppercase',
        color: '#FFFFFF',
        // Обводка считается от кегля: готовая строка из ТЗ рассчитана на кегль 80
        // и при меньшем кегле читалась размытым пятном. В полосе B обводка не нужна.
        textShadow: strip ? 'none' : обводка(size),
        transform: `translateY(${(1 - enter) * MOTION.enterRise}px) scaleY(${STRETCH_Y})`,
      }}
    >
      {cue.lines.map((line, i) => (
        <div key={i}>
          {parts(line, cue.accent).map((p, j) => (
            <span key={j} style={{ color: p.hot ? ACCENT : undefined }}>
              {p.t}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};
