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
    как: подсказка({
      mac: 'brew install node',
      win: 'winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements',
      linux: 'установи Node 20+ пакетным менеджером дистрибутива',
    }),
  },
  {
    имя: 'whisper-cli',
    ок: есть('whisper-cli', ['--help']),
    зачем: 'пословный транскрипт → субтитры и смысловой разбор',
    без: 'рендер, паузы и крупность работают; субтитров и смыслового разбора не будет',
    как: подсказка({
      mac: 'node инструменты/установить-окружение.mjs — поставит через brew сам',
      win: 'node инструменты/установить-окружение.mjs — скачает готовый бинарь из релизов, cmake не нужен',
      linux: 'node инструменты/установить-окружение.mjs — готовый бинарь, запасной путь — сборка',
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
    как: подсказка({
      mac: 'python3 -m pip install --user Pillow   (или установить-окружение.mjs)',
      win: 'py -3 -m pip install Pillow',
      linux: 'python3 -m pip install --user Pillow   (PEP 668: при отказе — venv или --break-system-packages)',
    }),
  },
];

// Модель — полноценная проверка: 24.08.2026 агент ученицы поставил движок,
// модель не скачал, и проверка молчала — субтитры были мертвы при полном «всё ок».
import {existsSync, readdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
const папкаМоделей = join(homedir(), 'whisper-models');
const модели = existsSync(папкаМоделей)
  ? readdirSync(папкаМоделей).filter((f) => f.startsWith('ggml-') && f.endsWith('.bin'))
  : [];
проверки.push({
  имя: 'модель whisper (ggml-*.bin в ~/whisper-models)',
  ок: модели.length > 0,
  зачем: 'без модели движок whisper нем — субтитров не будет',
  без: 'рендер, паузы и крупность работают; субтитров и смыслового разбора не будет',
  как: 'node инструменты/установить-окружение.mjs — задаст человеку один вопрос про 1,6 ГБ и скачает',
});

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
    ? '\nВсё на месте — включая модель. Можно монтировать.'
    : `\nНе хватает: ${нехватка}. ИИ-агент ставит недостающее САМ — человека не просит:\n` +
      'node инструменты/установить-окружение.mjs закрывает всё разом. После установки\n' +
      'через winget команда видна только новому окну терминала — перезапусти шелл.',
);
process.exitCode = нехватка === 0 ? 0 : 1;
