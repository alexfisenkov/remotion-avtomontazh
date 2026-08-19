import React from 'react';
import { Composition } from 'remotion';
import plan from '../edit-plan.json';
import { Fragment } from './Fragment';
import { toFrames } from './layout';
import { выходнаяДлительность } from './trim';
import type { Fragment as Frag } from './types';

const FRAGMENTS = plan.fragments as unknown as Frag[];

export const RemotionRoot: React.FC = () => (
  <>
    {FRAGMENTS.map((fragment) => (
      <Composition
        key={fragment.id}
        id={fragment.id}
        component={Fragment}
        defaultProps={{ fragment }}
        // Длительность — ВЫХОДНАЯ: после вырезов она короче исходника.
        durationInFrames={Math.max(1, toFrames(выходнаяДлительность(fragment.from, fragment.to), plan.fps))}
        fps={plan.fps}
        width={plan.width}
        height={plan.height}
      />
    ))}
  </>
);
