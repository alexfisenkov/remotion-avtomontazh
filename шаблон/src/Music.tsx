import React from 'react';
import { Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import plan from '../edit-plan.json';

type Музыка = { file: string; volume?: number };
const МУЗЫКА = (plan as unknown as { music?: Музыка | null }).music;

/**
 * Фоновая музыка под речью. Уровень по канону библиотеки: музыка на 18–25 дБ
 * ниже голоса — при пике трека −3 дБFS и голосе −5 дБFS это volume ≈ 0.05–0.1;
 * дефолт 0.07 (~22 дБ отступа). Дакинг не нужен: уровень уже «под речью» весь
 * ролик, а не приглушается местами. Края — фейды, чтобы не было щелчков и
 * обрыва: вход 0.5 с, выход 1 с.
 */
export const Music: React.FC<{ выходКадров: number }> = ({ выходКадров }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!МУЗЫКА?.file) return null;

  const огибающая = interpolate(
    frame,
    [0, fps * 0.5, Math.max(fps, выходКадров - fps), Math.max(fps + 1, выходКадров - 1)],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <Audio
      src={staticFile(`music/${МУЗЫКА.file}`)}
      loop
      volume={(МУЗЫКА.volume ?? 0.07) * огибающая}
    />
  );
};
