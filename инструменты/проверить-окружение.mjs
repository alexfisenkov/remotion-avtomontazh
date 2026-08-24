#!/usr/bin/env node
// Проверяет, что стоит на машине, а чего не хватает — и говорит, что без этого работает.
// Ничего не ставит и не ломает: только диагноз. Запускать можно из любой папки.

import {execFileSync} from 'node:child_process';

const есть = (команда, аргументы = ['--version']) => {
  try {
    execFileSync(команда, аргументы, {stdio: 'ignore'});
    return true;
  } catch {
    return false;
  }
};

const ос = process.platform;

// Windows часто ставит команду python или py, а не python3 — принимаем любую живую.
const вариантыПитона = [['python3'], ['python'], ['py', '-3']];
const питон = вариантыПитона.find((в) => есть(в[0], [...в.slice(1), '--version'])) ?? null;
const подсказка = ({mac, win, linux}) =>
  ос === 'darwin' ? mac : ос === 'win32' ? win : linux;

const проверки = [
  {
    имя: 'Node.js 20+',
    ок: Number(process.versions.node.split('.')[0]) >= 20,
    зачем: 'весь конвейер и рендер',
    без: 'ничего не работает',
    как: 'https://nodejs.org — кнопка LTS',
  },
  {
    имя: 'whisper-cli',
    ок: есть('whisper-cli', ['--help']),
    зачем: 'пословный транскрипт → субтитры и смысловой разбор',
    без: 'рендер, паузы и крупность работают; субтитров и смыслового разбора не будет',
    как: подсказка({
      mac: 'brew install whisper-cpp   (модель — README, раздел «Транскрипт»)',
      win: 'сборка whisper.cpp — README, раздел «Транскрипт»',
      linux: 'сборка whisper.cpp — README, раздел «Транскрипт»',
    }),
  },
  {
    имя: 'ffmpeg (системный)',
    ок: есть('ffmpeg', ['-version']),
    зачем: 'только два инструмента для записей со сплитом',
    без: 'рендер и вырезание пауз работают: у Remotion свой ffmpeg',
    как: подсказка({
      mac: 'brew install ffmpeg',
      win: 'winget install ffmpeg',
      linux: 'sudo apt install ffmpeg',
    }),
  },
  {
    имя: 'python3 (или python / py)',
    ок: Boolean(питон),
    зачем: 'те же два инструмента для сплита',
    без: 'всё остальное работает',
    как: подсказка({
      mac: 'уже есть в macOS',
      win: 'winget install Python.Python.3.12',
      linux: 'sudo apt install python3',
    }),
  },
  {
    имя: 'Pillow',
    ок: Boolean(питон) && есть(питон[0], [...питон.slice(1), '-c', 'import PIL']),
    зачем: 'контрольный лист кадров для поиска приватного на сплите',
    без: 'всё остальное работает',
    как: 'pip3 install Pillow',
  },
];

console.log('Проверка окружения автомонтажа:\n');
let нехватка = 0;
for (const п of проверки) {
  console.log(`  ${п.ок ? '✓' : '✗'} ${п.имя} — ${п.зачем}`);
  if (!п.ок) {
    нехватка += 1;
    console.log(`      без него: ${п.без}`);
    console.log(`      поставить: ${п.как}`);
  }
}

console.log(
  нехватка === 0
    ? '\nВсё на месте. Модель whisper (ggml-*.bin) качается отдельно — README, раздел «Транскрипт».'
    : `\nНе хватает: ${нехватка}. Выше написано, что работает и без них. ИИ-агент может\n` +
      'доустановить недостающее сам — командами выше, версией под вашу систему.',
);
