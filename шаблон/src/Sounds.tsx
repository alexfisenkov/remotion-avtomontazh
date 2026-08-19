import React from 'react';
import { Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import plan from '../edit-plan.json';
import { toFrames } from './layout';
import type { Cue, ZoomKey } from './types';

const CUES = plan.cues as unknown as Cue[];

/** Зеркало таблицы соответствий библиотеки звуков (звуки/ПРАВИЛА.md). */
const ПО_ТИПУ: Record<NonNullable<Cue['тип']>, { файл: string; громкость: number }> = {
  скриншот:    { файл: 'shutter-modern.wav', громкость: 0.15 },
  успех:       { файл: 'ding.wav',          громкость: 0.15 },
  ошибка:      { файл: 'error-soft.wav',    громкость: 0.15 },
  уведомление: { файл: 'snapchat-notification.wav', громкость: 0.15 },
  пометка:     { файл: 'pencil.wav',        громкость: 0.15 },
  акцент:      { файл: 'vine-boom.wav',     громкость: 0.3 },
};
const СКЛЕЙКИ = (plan.zoom.keys as ZoomKey[]).filter((к) => к.cut);

/**
 * Автоматическая озвучка монтажного листа по правилам библиотеки звуков
 * (../../библиотека-звуков/README.md). Звуки не расставляются руками — они
 * выводятся из событий листа, поэтому правка листа сама двигает звук.
 *
 * Правила, зашитые здесь:
 * - появление надписи-вывода → switch.wav на кадре появления, volume 0.15;
 * - резкая склейка крупности (ключ zoom с cut: true) → whip.wav, volume 0.2;
 * - плавный наезд камеры — БЕЗ звука (свист на каждом зуме — болезнь перегруза);
 * - исчезновение — без звука;
 * - один звук в один момент: выводы в листе не пересекаются, чеклист это сторожит.
 */
export const Sounds: React.FC<{
  выхКадр: (секИсходника: number) => number;
  окно: [number, number];
}> = ({ выхКадр, окно }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {CUES.map((cue) => {
        if (cue.at < окно[0] || cue.at >= окно[1]) return null;
        const кадр = выхКадр(cue.at);
        return (
          <Sequence key={cue.id} from={кадр} durationInFrames={fps * 2}>
            {cue.тип ? (
              <Audio src={staticFile(`sounds/${ПО_ТИПУ[cue.тип].файл}`)}
                volume={ПО_ТИПУ[cue.тип].громкость} />
            ) : (
              <Audio src={staticFile('sounds/switch.wav')} volume={0.15} />
            )}
          </Sequence>
        );
      })}
      {СКЛЕЙКИ.map((к) => {
        if (к.at < окно[0] || к.at >= окно[1]) return null;
        const кадр = выхКадр(к.at);
        return (
          <Sequence key={`cut-${к.at}`} from={кадр} durationInFrames={fps}>
            <Audio src={staticFile('sounds/whip.wav')} volume={0.2} />
          </Sequence>
        );
      })}
    </>
  );
};
