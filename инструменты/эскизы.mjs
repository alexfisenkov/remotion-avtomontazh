#!/usr/bin/env node
// Эскизы стилей: рендерит один фрагмент выпуска в трёх вариантах слоёв,
// чтобы человек выбрал глазами, а не по описанию. Полный рендер стоит минуты,
// эскиз по 8–15 секунд — копейки.
//
// Запуск из папки проекта: node tools/эскизы.mjs --from 30 --to 38.5
// Диапазон — секунды ИСХОДНИКА (как всё в листе); обычно вокруг кульминации.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const require = createRequire(resolve(process.cwd(), 'noop.js'));
const аргументы = process.argv.slice(2);
const парам = (имя, дефолт) => {
  const i = аргументы.indexOf(`--${имя}`);
  return i >= 0 ? Number(аргументы[i + 1]) : дефолт;
};

const ПЛАН = resolve('edit-plan.json');
const план = JSON.parse(readFileSync(ПЛАН, 'utf8'));
const полный = план.fragments.find((f) => f.id === 'Full') ?? план.fragments[0];

const от = парам('from', Math.max(полный.from, полный.to - 12));
const до = парам('to', полный.to);

// Пересчёт src-секунд в выходные кадры с учётом вырезов — та же логика, что в src/trim.ts.
const сегменты = (план.trims?.length ? план.trims : [{ from: полный.from, to: полный.to }])
  .map((с) => ({ from: Math.max(с.from, полный.from), to: Math.min(с.to, полный.to) }))
  .filter((с) => с.to - с.from > 1e-6)
  .sort((а, б) => а.from - б.from);
const вВыход = (срс) => {
  let н = 0;
  for (const с of сегменты) {
    if (срс < с.from) return н;
    if (срс <= с.to) return н + (срс - с.from);
    н += с.to - с.from;
  }
  return н;
};
const кадр = (сек) => Math.round(вВыход(сек) * план.fps);
const диапазон = `${кадр(от)}-${Math.max(кадр(от) + 1, кадр(до) - 1)}`;

const ВАРИАНТЫ = [
  { имя: 'сдержанный', слои: { субтитры: false, звук: false },
    описание: 'только выводы и крупность' },
  { имя: 'полный', слои: {},
    описание: 'субтитры + выводы + звук — как задумано жанром' },
  { имя: 'чистовик', слои: { субтитры: false, выводы: false, звук: false },
    описание: 'голый монтаж: только склейки и крупность' },
];

const CLI = join(dirname(require.resolve('@remotion/cli/package.json')), 'remotion-cli.js');
mkdirSync('out/эскизы', { recursive: true });
copyFileSync(ПЛАН, ПЛАН + '.эскизы-бэкап');

console.log(`Фрагмент ${от}–${до} с исходника → выходные кадры ${диапазон}\n`);
const итоги = [];
try {
  for (const в of ВАРИАНТЫ) {
    const вариант = { ...план, layers: { ...(план.layers ?? {}), ...в.слои } };
    writeFileSync(ПЛАН, JSON.stringify(вариант, null, 2) + '\n', 'utf8');
    const файл = `out/эскизы/${в.имя}.mp4`;
    const r = spawnSync(process.execPath,
      [CLI, 'render', 'src/index.ts', полный.id, файл, `--frames=${диапазон}`],
      { encoding: 'utf8' });
    const ок = r.status === 0;
    итоги.push({ ...в, файл, ок });
    console.log(`${ок ? '  OK ' : 'СБОЙ '} ${в.имя.padEnd(12)} ${в.описание}`);
    if (!ок) console.error((r.stderr || r.stdout).split('\n').slice(-6).join('\n'));
  }
} finally {
  copyFileSync(ПЛАН + '.эскизы-бэкап', ПЛАН);
}
console.log('\nЛист восстановлен. Эскизы в out/эскизы/ — покажите человеку, пусть выберет.');
process.exit(итоги.every((и) => и.ок) ? 0 : 1);
