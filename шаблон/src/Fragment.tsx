import React from 'react';
import {
  AbsoluteFill, OffthreadVideo, Series, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import plan from '../edit-plan.json';
import './font';
import { Blur } from './Blur';
import { Highlight } from './Highlight';
import { Sounds } from './Sounds';
import { Subtitles } from './Subtitles';
import { Vignette } from './Vignette';
import { Zoom } from './Zoom';
import { toFrames } from './layout';
import { вВыход, вИсходник, сегментыФрагмента } from './trim';
import type { Cue, Effect, Fragment as Frag } from './types';

const CUES = plan.cues as unknown as Cue[];
const EFFECTS = plan.effects as unknown as Effect[];

export const Fragment: React.FC<{ fragment: Frag }> = ({ fragment }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Текущая секунда ИСХОДНИКА для этого выходного кадра. Все слои считают
  // видимость по ней, а анимации входа-выхода — по выходным кадрам.
  const срс = вИсходник(frame / fps, fragment.from, fragment.to);
  const выхКадр = (секИсходника: number) =>
    toFrames(вВыход(секИсходника, fragment.from, fragment.to), fps);

  const cues = CUES.map((cue) => ({
    cue,
    start: выхКадр(cue.at),
    end: выхКадр(cue.until),
  })).filter((c) => frame >= c.start && frame < c.end);

  const effects = EFFECTS.filter((e) => срс >= e.from && срс < e.to);

  const сегменты = сегментыФрагмента(fragment.from, fragment.to);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {/* Крупность двигает только картинку: текст поверх остаётся на месте. */}
      <Zoom сейчас={срс}>
        {/* Вырезы: видео играет оставленными кусками подряд. На границах куска —
            рампа громкости в один кадр: стыки лежат в тихих местах (паддинги
            это гарантируют), а рампа добивает щелчок нулевого перехода. */}
        <Series>
          {сегменты.map((с) => {
            const длина = Math.max(1, toFrames(с.to - с.from, fps));
            return (
              <Series.Sequence key={с.from} durationInFrames={длина} premountFor={fps}>
                <OffthreadVideo
                  src={staticFile(fragment.clip)}
                  trimBefore={toFrames(с.from, fps)}
                  volume={(f) =>
                    Math.min(1, Math.min(f, Math.max(0, длина - 1 - f)) + 0.35)
                  }
                />
              </Series.Sequence>
            );
          })}
        </Series>
        {effects.map((e, i) => (
          <Blur key={i} effect={e} clip={fragment.clip} />
        ))}
      </Zoom>

      <Vignette />

      <Subtitles сейчас={срс} выхКадр={выхКадр} visible={cues.length === 0} />

      {cues.map((c) => (
        <Highlight key={c.cue.id} cue={c.cue} start={c.start} end={c.end} />
      ))}

      <Sounds выхКадр={выхКадр} окно={[fragment.from, fragment.to]} />
    </AbsoluteFill>
  );
};
