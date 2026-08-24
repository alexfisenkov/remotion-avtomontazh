#!/usr/bin/env node
// Доустанавливает окружение конвейера: whisper, ffmpeg, python/Pillow, модель.
// Запускает ИИ-агент, не человек. Человек не видит этот файл и не должен.
//
// Почему скрипт, а не инструкция: 24 августа 2026 агент ученицы бросил установку
// на полпути — whisper, ffmpeg и Pillow остались непоставленными, потому что
// инструкция была текстом и разрешала спрашивать. Скрипт детерминирован.
//
// Правила:
//   - всё ставится молча, человека НИ О ЧЁМ не спрашиваем — кроме одного:
//     скачивание модели (~1,6 ГБ) агент подтверждает у человека САМ, словами
//     без терминов, и передаёт сюда флагом --модель;
//   - без флага --модель скрипт ставит движок и утилиты, а про модель печатает
//     готовую фразу для человека — агент её задаёт и перезапускает с флагом;
//   - ничего не сломано, если что-то уже стоит: каждый шаг сначала проверяет.
//
// Запуск (агентом):
//   node инструменты/установить-окружение.mjs                  # движок + утилиты
//   node инструменты/установить-окружение.mjs --модель large   # + модель 1,6 ГБ
//   node инструменты/установить-окружение.mjs --модель small   # + модель 0,5 ГБ

import {execFileSync, execSync} from 'node:child_process';
import {existsSync, mkdirSync, statSync, readdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';

const ос = process.platform;
const дом = homedir();
const папкаМоделей = join(дом, 'whisper-models');
const папкаВиспера = join(дом, 'whisper-cpp');

// Размеры моделей — критерий подлинности, сверены с API Hugging Face 24.08.2026.
const МОДЕЛИ = {
  large: {файл: 'ggml-large-v3-turbo.bin', байт: 1_624_555_275, гб: '1,6'},
  small: {файл: 'ggml-small.bin', байт: 487_601_967, гб: '0,5'},
};

const флаг = (имя) => {
  const i = process.argv.indexOf(`--${имя}`);
  return i >= 0 ? (process.argv[i + 1] ?? true) : null;
};

const есть = (кмд, арг = ['--version']) => {
  try { execFileSync(кмд, арг, {stdio: 'ignore'}); return true; } catch { return false; }
};

const шаг = (текст) => console.log(`\n== ${текст}`);
const ок = (текст) => console.log(`   ✓ ${текст}`);
const внимание = (текст) => console.log(`   ! ${текст}`);
let провалы = 0;
const провал = (текст) => { провалы += 1; console.error(`   ✗ ${текст}`); };

// Свежепоставленные winget-пакеты видны только новому шеллу. Дополняем PATH
// типовыми местами прямо в этом процессе, чтобы проверки после установки работали.
const освежитьPath = () => {
  if (ос !== 'win32') return;
  const кандидаты = [
    join(дом, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links'),
    'C:/Program Files/nodejs',
    'C:/Program Files/Git/cmd',
    папкаВиспера,
  ];
  process.env.PATH = [...кандидаты, process.env.PATH].join(';');
};

const выполнить = (команда, описание) => {
  try {
    console.log(`   $ ${команда}`);
    execSync(команда, {stdio: 'inherit', timeout: 20 * 60_000});
    освежитьPath();
    return true;
  } catch {
    провал(`${описание}: команда не прошла — читай вывод выше, чини и повторяй этот шаг`);
    return false;
  }
};

const скачать = (url, файл, ожидаемоБайт) => {
  // curl есть на macOS, Windows 10+ и почти любом Linux. -C - докачивает после обрыва.
  if (existsSync(файл) && statSync(файл).size === ожидаемоБайт) { ок(`уже скачан: ${файл}`); return true; }
  if (!выполнить(`curl -L -C - --fail -o "${файл}" "${url}"`, `скачивание ${url}`)) return false;
  const размер = existsSync(файл) ? statSync(файл).size : 0;
  if (ожидаемоБайт && размер !== ожидаемоБайт) {
    провал(`размер ${размер} ≠ ${ожидаемоБайт} — файл битый или подменён, удали и скачай заново`);
    return false;
  }
  return true;
};

// ── whisper-cli ──────────────────────────────────────────────────────────────
шаг('Движок распознавания речи (whisper-cli)');
const висперГотов = () => есть('whisper-cli', ['--help']) ||
  (ос === 'win32' && existsSync(join(папкаВиспера, 'whisper-cli.exe')));

if (висперГотов()) {
  ок('whisper-cli уже стоит');
} else if (ос === 'darwin') {
  if (!есть('brew')) {
    провал('нет Homebrew. Поставь его сам: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" — и запусти меня снова');
  } else {
    выполнить('brew install whisper-cpp', 'установка whisper');
  }
} else if (ос === 'win32') {
  // Готовые официальные бинарники. Собирать через cmake НЕ нужно.
  // Ассеты лежат в релизах вида b4938; у тегов вида v1.9.3 ассетов нет.
  mkdirSync(папкаВиспера, {recursive: true});
  const zip = join(папкаВиспера, 'whisper-bin.zip');
  const базы = [
    'https://github.com/ggml-org/whisper.cpp/releases/download/b4938/whisper-blas-bin-x64.zip',
    'https://github.com/ggml-org/whisper.cpp/releases/download/b4938/whisper-bin-x64.zip',
  ];
  let встал = false;
  for (const url of базы) {
    if (!скачать(url, zip, 0)) continue;
    if (выполнить(`powershell -NoProfile -Command "Expand-Archive -Force '${zip}' '${папкаВиспера}'"`, 'распаковка whisper')) { встал = true; break; }
  }
  if (встал && !existsSync(join(папкаВиспера, 'whisper-cli.exe'))) {
    // В старых сборках бинарь звался main.exe и мог лежать в подпапке Release.
    внимание('whisper-cli.exe не в корне — найди его в подпапках (возможно, main.exe) и зови полным путём');
  }
  внимание(`зови полным путём: ${папкаВиспера}\\whisper-cli.exe`);
  внимание('ошибка про VCRUNTIME140.dll → winget install Microsoft.VCRedist.2015+.x64 — и повтори');
} else {
  const tar = '/tmp/whisper-bin.tar.gz';
  if (скачать('https://github.com/ggml-org/whisper.cpp/releases/download/b4938/whisper-bin-ubuntu-x64.tar.gz', tar, 0)) {
    выполнить(`mkdir -p "${папкаВиспера}" && tar -xzf "${tar}" -C "${папкаВиспера}" --strip-components=1`, 'распаковка whisper');
    внимание(`бинарь: ${папкаВиспера}/whisper-cli — не завёлся (glibc) → собери: git clone https://github.com/ggml-org/whisper.cpp && cmake -B build && cmake --build build -j --config Release`);
  }
}

// ── ffmpeg (системный — нужен только инструментам сплита) ────────────────────
шаг('Системный ffmpeg');
if (есть('ffmpeg', ['-version'])) {
  ок('ffmpeg уже стоит');
} else if (ос === 'darwin') {
  есть('brew') ? выполнить('brew install ffmpeg', 'установка ffmpeg') : провал('нет Homebrew (см. выше)');
} else if (ос === 'win32') {
  выполнить('winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements', 'установка ffmpeg');
  внимание('после winget команда видна только новому окну терминала — перезапусти шелл, если ffmpeg не найдётся');
} else {
  выполнить('sudo apt-get install -y ffmpeg', 'установка ffmpeg');
}

// ── python + Pillow (нужны только инструментам сплита) ───────────────────────
шаг('python и Pillow');
const питоны = ос === 'win32' ? [['py', '-3'], ['python']] : [['python3'], ['python']];
let питон = питоны.find((в) => есть(в[0], [...в.slice(1), '--version'])) ?? null;
if (!питон) {
  if (ос === 'win32') {
    if (выполнить('winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements', 'установка python')) питон = ['py', '-3'];
  } else if (ос === 'darwin') {
    ок('python3 в macOS есть — если команда не нашлась, что-то нестандартное, разберись сам');
    питон = ['python3'];
  } else {
    if (выполнить('sudo apt-get install -y python3 python3-pip', 'установка python')) питон = ['python3'];
  }
}
if (питон) {
  const п = питон.join(' ');
  try {
    execSync(`${п} -c "import PIL"`, {stdio: 'ignore'});
    ок('Pillow уже стоит');
  } catch {
    // PEP 668: на свежих macOS/Ubuntu системный pip требует --user или venv.
    выполнить(`${п} -m pip install --user Pillow || ${п} -m pip install --break-system-packages --user Pillow`, 'установка Pillow');
  }
}

// ── модель ───────────────────────────────────────────────────────────────────
шаг('Модель распознавания');
mkdirSync(папкаМоделей, {recursive: true});
const лежит = readdirSync(папкаМоделей).filter((f) => f.startsWith('ggml-') && f.endsWith('.bin'));
const выбор = флаг('модель');

if (лежит.length && !выбор) {
  ок(`модель уже на месте: ${папкаМоделей}/${лежит[0]}`);
} else if (!выбор) {
  console.log(`
   Модели ещё нет. Скачивание — единственное, о чём надо спросить человека.
   Задай ему ровно этот вопрос (без терминов, своими словами не пересказывай):

   «Сейчас скачаю словарь распознавания речи — примерно 1,6 ГБ. Это один раз:
   дальше он лежит на диске, и субтитры работают без интернета. Если на диске
   мало места или компьютер слабый — возьму версию поменьше (0,5 ГБ), субтитры
   будут чуть менее точными. Качаю полную?»

   Ответил «да»    → node инструменты/установить-окружение.mjs --модель large
   Ответил «меньше» → node инструменты/установить-окружение.mjs --модель small`);
} else {
  const м = МОДЕЛИ[выбор];
  if (!м) {
    провал(`--модель ${выбор}: вариантов два — large или small`);
  } else {
    const куда = join(папкаМоделей, м.файл);
    const прямой = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${м.файл}`;
    const зеркало = `https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/${м.файл}`;
    // Порядок: прямой → зеркало (24.08.2026 зеркало отвечало 308 обратно на
    // huggingface.co — может не спасти) → ищи источник сам, критерий один: размер.
    if (!скачать(прямой, куда, м.байт)) {
      внимание('прямой источник не прошёл — пробую зеркало');
      провалы -= 1;
      if (!скачать(зеркало, куда, м.байт)) {
        провал(`оба источника не прошли. Ищи файл ${м.файл} сам; подлинность = размер ровно ${м.байт} байт`);
      }
    }
    if (existsSync(куда) && statSync(куда).size === м.байт) ок(`модель на месте: ${куда}`);
  }
}

// ── проверка делом ───────────────────────────────────────────────────────────
шаг('Итог');
if (провалы) {
  console.error(`\nПровалов: ${провалы}. Чини по сообщениям выше и запускай меня снова — я не трогаю то, что уже стоит.`);
  process.exit(1);
}
console.log(`
Всё поставлено. Перед словом «готово» проверь распознавание ДЕЛОМ:
  1) вырежи 10 секунд звука:  ffmpeg -t 10 -i <запись> -ar 16000 -ac 1 тест16.wav -y
     (или npx remotion ffmpeg -t 10 -i <запись> -vn -ar 16000 -ac 1 тест16.wav -y)
  2) прогони:  whisper-cli -m ${папкаМоделей}/<модель> -l ru -np -ml 1 -sow -oj -of test тест16.wav
  3) в test.json у каждой записи text — ОДНО слово с таймингами.
     Слова кусками («тел ег рам») = потерялся -sow, перепроверь команду.`);
