#!/usr/bin/env node
// Паспорт исходника: всё, что нужно знать о файле ДО решений о монтаже.
// Именно отсутствие этого шага когда-то приводило к наложению элементов
// не под то соотношение сторон — и кривому рендеру.
//
// Запуск: node паспорт-исходника.mjs <видео> [выход.json]
// ffmpeg/ffprobe берутся из пакета Remotion — системные не нужны; если пакета
// рядом нет, откатываемся на системный ffprobe.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const видео = process.argv[2];
if (!видео) {
  console.error('Укажите видео: node паспорт-исходника.mjs <файл> [выход.json]');
  process.exit(1);
}
const выход = process.argv[3] ?? 'паспорт.json';

const require = createRequire(resolve(process.cwd(), 'noop.js'));
let ffmpeg = ['ffmpeg'];
let ffprobe = ['ffprobe'];
try {
  const cli = join(dirname(require.resolve('@remotion/cli/package.json')), 'remotion-cli.js');
  ffmpeg = [process.execPath, cli, 'ffmpeg'];
  ffprobe = [process.execPath, cli, 'ffprobe'];
} catch { /* системный ffmpeg */ }

const зов = (базовая, аргументы) => {
  const r = spawnSync(базовая[0], [...базовая.slice(1), ...аргументы], { encoding: 'utf8' });
  return (r.stdout || '') + (r.stderr || '');
};

// Потоки и контейнер
const сырое = зов(ffprobe, ['-v', 'error', '-show_entries',
  'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels',
  '-of', 'json', видео]);
let данные;
try {
  данные = JSON.parse(сырое.slice(сырое.indexOf('{')));
} catch {
  console.error('ffprobe не разобрал файл:\n' + сырое.slice(0, 400));
  process.exit(1);
}
const в = (данные.streams ?? []).find((s) => s.codec_type === 'video');
const а = (данные.streams ?? []).find((s) => s.codec_type === 'audio');
if (!в) { console.error('В файле нет видеопотока'); process.exit(1); }

const [чис, знам] = (в.r_frame_rate ?? '30/1').split('/').map(Number);
const fps = знам ? чис / знам : чис;
const длит = Number(данные.format?.duration ?? 0);
const ориентация = в.width > в.height ? 'горизонталь' : в.width < в.height ? 'вертикаль' : 'квадрат';

// Звук: уровни, LUFS, паузы (плотность речи)
let звук = null;
if (а) {
  // volumedetect в урезанной сборке ffmpeg внутри Remotion отсутствует —
  // пик берём истинный (dBTP) из loudnorm, его сборка знает.
  const ln = зов(ffmpeg, ['-vn', '-i', видео, '-af', 'loudnorm=print_format=summary', '-f', 'null', '-']);
  const sd = зов(ffmpeg, ['-vn', '-i', видео, '-af', 'silencedetect=noise=-30dB:d=0.5', '-f', 'null', '-']);
  const число = (текст, ш) => { const m = текст.match(ш); return m ? Number(m[1]) : null; };
  const пауз = (sd.match(/silence_start/g) ?? []).length;
  const тишина = [...sd.matchAll(/silence_duration: ([\d.]+)/g)]
    .reduce((н, m) => н + Number(m[1]), 0);
  звук = {
    codec: а.codec_name,
    sampleRate: Number(а.sample_rate),
    channels: Number(а.channels),
    peakDbtp: число(ln, /Input True Peak:\s+([-\d.]+) dBTP/),
    lufs: число(ln, /Input Integrated:\s+([-\d.]+) LUFS/),
    пауз_от_полсекунды: пауз,
    тишины_всего_сек: Number(тишина.toFixed(1)),
    доля_речи: длит ? Number((1 - тишина / длит).toFixed(2)) : null,
  };
}

const паспорт = {
  файл: видео,
  видео: {
    width: в.width,
    height: в.height,
    ориентация,
    соотношение: `${в.width}:${в.height}`,
    fps: Number(fps.toFixed(2)),
    codec: в.codec_name,
    длительность_сек: Number(длит.toFixed(2)),
  },
  звук,
  note: ориентация === 'вертикаль'
    ? 'ВЕРТИКАЛЬ: геометрия горизонтальных шаблонов не годится — брать вертикальный профиль жанра.'
    : null,
};

writeFileSync(выход, JSON.stringify(паспорт, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(паспорт.видео));
if (звук) console.log(`звук: пик ${звук.peakDbtp} дБTP, ${звук.lufs} LUFS, пауз ≥0.5с: ${звук.пауз_от_полсекунды}, доля речи ${звук.доля_речи}`);
console.log(`Паспорт: ${выход}`);
