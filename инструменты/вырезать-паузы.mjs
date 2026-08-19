#!/usr/bin/env node
// Ищет паузы в звуке исходника и пишет в монтажный лист раздел trims —
// сегменты, которые ОСТАЮТСЯ. Всё остальное в листе продолжает жить в секундах
// исходника: пересчёт выходного времени делает src/trim.ts.
//
// Запуск: node tools/вырезать-паузы.mjs [edit-plan.json]
// Паузы ищутся в самом звуке (silencedetect), а не по транскрипту: whisper
// растягивает конец слова до начала следующего, и пауз в его таймингах не видно.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const КОРЕНЬ = join(dirname(fileURLToPath(import.meta.url)), '..');
const путьПлана = process.argv[2] ?? join(КОРЕНЬ, 'edit-plan.json');
const план = JSON.parse(readFileSync(путьПлана, 'utf8'));

// Настройки поиска — из разведки по практике монтажа (TimeBolt, auto-editor, Descript):
// порог −30 дБ для комнаты без студийной тишины; пауза от 0.5 с — короче это
// естественное дыхание речи, его не трогаем; паддинги НЕсимметричные и это важно:
// хвосту слова (затухающая гласная, шипящая) нужно 0.15 с, а атаке следующей
// согласной хватает 0.10 с. Сумма 0.25 с — ровно столько паузы остаётся на стыке.
const ПОРОГ_ДБ = план.trimsParams?.noiseDb ?? -30;
const МИН_ПАУЗА = план.trimsParams?.minSilence ?? 0.5;
const ПАДДИНГ_ПОСЛЕ = план.trimsParams?.padAfter ?? 0.15;
const ПАДДИНГ_ДО = план.trimsParams?.padBefore ?? 0.10;
const МИН_СЕГМЕНТ = план.trimsParams?.minSegment ?? 1.0;
const ПАНЧ = план.trimsParams?.punchIn ?? 0.07;

const видео = join(КОРЕНЬ, 'public', план.fragments[0].clip);
const длит = план.fragments.find((f) => f.id === 'Full')?.to ?? план.fragments[0].to;

// ffmpeg берём из пакета Remotion — работает без системного ffmpeg.
const CLI = join(dirname(require.resolve('@remotion/cli/package.json')), 'remotion-cli.js');
const r = spawnSync(process.execPath,
  // -vn обязателен: в урезанной сборке ffmpeg внутри Remotion нет кодировщика
  // для нулевого видео-потока, и без -vn команда падает на «Encoder not found».
  [CLI, 'ffmpeg', '-vn', '-i', видео, '-af', `silencedetect=noise=${ПОРОГ_ДБ}dB:d=${МИН_ПАУЗА}`, '-f', 'null', '-'],
  { encoding: 'utf8' });
const лог = (r.stdout || '') + (r.stderr || '');

const паузы = [];
const начала = [...лог.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
const концы = [...лог.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
for (let i = 0; i < начала.length; i += 1) {
  паузы.push({ from: начала[i], to: концы[i] ?? длит });
}

// Пауза превращается в вырез со срезанными паддингами. Слишком узкое после
// паддингов — не трогаем.
let вырезы = паузы
  .map((п) => ({ from: п.from + ПАДДИНГ_ПОСЛЕ, to: п.to - ПАДДИНГ_ДО }))
  .filter((в) => в.to - в.from > 0.05);

// Надпись, стоящая в паузе, важнее сжатия: вырез, задевающий cue, отступает.
const защищено = (план.cues ?? []).map((c) => ({ from: c.at, to: c.until, id: c.id }));
вырезы = вырезы.map((в) => {
  for (const з of защищено) {
    if (в.from < з.to && в.to > з.from) {
      console.log(`  вырез ${в.from.toFixed(2)}–${в.to.toFixed(2)} задевает надпись ${з.id} — пропущен`);
      return null;
    }
  }
  return в;
}).filter(Boolean);

// Из вырезов — оставляемые сегменты.
const сегменты = [];
let курсор = 0;
for (const в of вырезы) {
  if (в.from - курсор > 0) сегменты.push({ from: курсор, to: в.from });
  курсор = в.to;
}
if (длит - курсор > 0) сегменты.push({ from: курсор, to: длит });

// Короткий сегмент между двумя вырезами рубит ритм — вклеиваем его назад,
// сливая с соседним вырезом (то есть НЕ режем предыдущую паузу).
const итог = [];
for (const с of сегменты) {
  if (с.to - с.from < МИН_СЕГМЕНТ && итог.length > 0) {
    итог[итог.length - 1].to = с.to;
  } else {
    итог.push({ ...с });
  }
}

// Маскировка склеек: «после выреза меняется хотя бы один параметр кадра».
// Если крупность в листе не размечена руками — ставим панч-ин: чередуем
// масштаб 1.0 и 1.0+ПАНЧ скачком (cut) на каждой склейке. Если ручные ключи
// есть — не лезем: два хозяина у крупности хуже, чем голый jump cut.
const склейки = [];
for (let i = 1; i < итог.length; i += 1) склейки.push(итог[i].from);
if ((план.zoom?.keys ?? []).length > 1) {
  if (склейки.length) console.log('  крупность размечена руками — панч-ин на склейках не ставлю');
} else if (склейки.length && ПАНЧ > 0) {
  const ключи = [{ at: 0, scale: 1.0 }];
  склейки.forEach((т, i) => {
    ключи.push({ at: Number(т.toFixed(3)), scale: i % 2 === 0 ? 1 + ПАНЧ : 1.0, cut: true,
      note: 'панч-ин на вырезе паузы, поставлен автоматически' });
  });
  план.zoom = { origin: '50% 38%', keys: ключи };
  console.log(`  панч-ин ±${Math.round(ПАНЧ * 100)}% на ${склейки.length} склейках (крупности в листе не было)`);
}

const было = длит;
const стало = итог.reduce((н, с) => н + (с.to - с.from), 0);
план.trims = итог.map((с) => ({ from: Number(с.from.toFixed(3)), to: Number(с.to.toFixed(3)) }));
план.trimsParams = { noiseDb: ПОРОГ_ДБ, minSilence: МИН_ПАУЗА, padAfter: ПАДДИНГ_ПОСЛЕ,
  padBefore: ПАДДИНГ_ДО, minSegment: МИН_СЕГМЕНТ };
writeFileSync(путьПлана, JSON.stringify(план, null, 2) + '\n', 'utf8');

console.log(`Пауз найдено: ${паузы.length}, вырезов после защиты надписей: ${вырезы.length}`);
console.log(`Сегментов: ${итог.length}`);
console.log(`Хронометраж: ${было.toFixed(1)} с → ${стало.toFixed(1)} с (−${(было - стало).toFixed(1)} с)`);
console.log(`Раздел trims записан в ${путьПлана}`);
