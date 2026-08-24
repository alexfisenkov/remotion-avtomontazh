#!/usr/bin/env node
// Разворачивает проект монтажа: шаблон + инструменты + агенты + шрифт + звуки.
// Кроссплатформенный: одинаково работает на macOS, Windows и Linux — поэтому
// Node, а не bash (24.08.2026 у учеников на Windows bash-скрипт был тупиком).
//
// Запуск: node развернуть-проект.mjs <папка-проекта> <путь-к-видео> [--заново]

import {execFileSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, createWriteStream} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const repoDir = dirname(fileURLToPath(import.meta.url));
// Смешанный вид пути (прямые слэши) понимают bash, PowerShell и Node разом.
const смешанный = (p) => resolve(p).replaceAll('\\', '/');

const [папкаАрг, видеоАрг] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const заново = process.argv.includes('--заново');

const стоп = (текст) => { console.error(`✗ ${текст}`); process.exit(1); };

if (!папкаАрг || !видеоАрг)
  стоп('Запуск: node развернуть-проект.mjs <папка-проекта> <путь-к-видео> [--заново]');
const projectDir = смешанный(папкаАрг);
const видео = resolve(видеоАрг);

if (Number(process.versions.node.split('.')[0]) < 20)
  стоп(`Node.js ${process.versions.node} слишком старый — нужен 20+. Агент: обнови Node сам (brew install node / winget install OpenJS.NodeJS.LTS) и запусти меня снова.`);
if (!existsSync(видео)) стоп(`Нет такого файла: ${видео}`);
// Не-ASCII и пробелы в пути проекта ломают бандлер и npm. Агент, работающий
// по-русски, легко создаёт «~/видео/мой-выпуск» — отсекаем до установки.
if (!/^[\x21-\x7E]+$/.test(projectDir))
  стоп(`Путь проекта — только латиница, цифры и дефисы, без пробелов: ${projectDir}\nПример: ${смешанный(join(process.env.HOME || process.env.USERPROFILE || '~', 'video', 'moy-vypusk'))}`);
if (existsSync(projectDir)) {
  if (!заново) стоп(`Папка ${projectDir} уже существует — ничего не трогаю.\nЭто обломок прошлого запуска (оборвалась сеть и т.п.)? Запусти меня с флагом --заново, я пересоберу её сам. Человека просить ничего удалять не нужно.`);
  rmSync(projectDir, {recursive: true, force: true});
}

const выполнить = (кмд, арг, опции = {}) => execFileSync(кмд, арг, {stdio: 'inherit', ...опции});
const тихо = (кмд, арг, опции = {}) => execFileSync(кмд, арг, {encoding: 'utf8', ...опции}).trim();

// ── раскладка ────────────────────────────────────────────────────────────────
for (const d of ['src', 'tools', 'public/fonts', 'public/clips', 'public/sounds', 'public/music', 'out', '.claude/agents', 'монтажёр'])
  mkdirSync(join(projectDir, d), {recursive: true});

const скопировать = (из, в) => cpSync(join(repoDir, из), join(projectDir, в), {recursive: true});
for (const f of readdirSync(join(repoDir, 'шаблон/src'))) скопировать(`шаблон/src/${f}`, `src/${f}`);
for (const f of ['package.json', 'tsconfig.json', 'remotion.config.ts', 'edit-plan.json']) скопировать(`шаблон/${f}`, f);
for (const f of ['check-plan.mjs', 'субтитры-из-whisper.mjs', 'вырезать-паузы.mjs', 'сцены-по-области.py',
                 'контрольный-лист.py', 'эскизы.mjs', 'паспорт-исходника.mjs', 'проверить-окружение.mjs',
                 'установить-окружение.mjs'])
  скопировать(`инструменты/${f}`, `tools/${f}`);
for (const f of readdirSync(join(repoDir, 'агенты'))) скопировать(`агенты/${f}`, `.claude/agents/${f}`);
for (const f of ['жанры.json', 'правила-текста.md']) скопировать(`монтажёр/${f}`, `монтажёр/${f}`);

writeFileSync(join(projectDir, 'AGENTS.md'),
  `> Репозиторий системы: ${смешанный(repoDir)}\n> README с порядком работы — там. Плейбуки конвейера — .claude/agents/ этой папки.\n\n` +
  readFileSync(join(repoDir, 'AGENTS.md'), 'utf8'));
if (existsSync(join(repoDir, 'звуки/music/pad-calm.wav'))) скопировать('звуки/music/pad-calm.wav', 'public/music/pad-calm.wav');

// ── шрифт: с серверов Google Fonts (OFL), на рендере в сеть не ходим ─────────
console.log('Скачиваю Oswald…');
const base = 'https://fonts.gstatic.com/s/oswald/v57';
const скачать = async (url, куда) => {
  const res = await fetch(url);
  if (!res.ok) стоп(`Шрифт не скачался (${res.status}): ${url} — проверь сеть и запусти меня снова с --заново`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(куда));
};
await скачать(`${base}/TK3IWkUHHAIjg75cFRf3bXL8LICs1_Fv40pKlN4NNSeSASz7FmlSHYjMdZwlou4.woff2`, join(projectDir, 'public/fonts/oswald-cyrillic.woff2'));
await скачать(`${base}/TK3IWkUHHAIjg75cFRf3bXL8LICs1_Fv40pKlN4NNSeSASz7FmlWHYjMdZwl.woff2`, join(projectDir, 'public/fonts/oswald-latin.woff2'));

// ── звуки: база Remotion + наши; недобор — это провал, а не предупреждение ───
console.log('Готовлю звуки…');
try {
  выполнить(process.execPath, [join(repoDir, 'звуки/скачать-базу.mjs'), join(repoDir, 'звуки/sounds')]);
} catch {
  стоп('База звуков не скачалась с remotion.media — без неё автозвук монтажа нем. Проверь сеть и запусти меня снова с --заново.');
}
const манифест = JSON.parse(readFileSync(join(repoDir, 'звуки/манифест.json'), 'utf8'));
const ожидаемо = Array.isArray(манифест) ? манифест.length : (манифест.звуки?.length ?? 40);
for (const f of readdirSync(join(repoDir, 'звуки/sounds')).filter((f) => f.endsWith('.wav')))
  скопировать(`звуки/sounds/${f}`, `public/sounds/${f}`);
const наМесте = readdirSync(join(projectDir, 'public/sounds')).filter((f) => f.endsWith('.wav')).length;
if (наМесте < ожидаемо)
  стоп(`Звуков ${наМесте} из ${ожидаемо} по манифесту — недобор. Смотри вывод выше, чини сеть и запускай с --заново.`);

console.log('Копирую исходник в public/clips/full.mp4…');
cpSync(видео, join(projectDir, 'public/clips/full.mp4'));

console.log('Ставлю зависимости…');
выполнить(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund'], {cwd: projectDir, shell: process.platform === 'win32'});

// ── длительность и геометрия — через ffprobe из пакета Remotion ──────────────
const remotionCli = join(projectDir, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const пробить = (...арг) => тихо(process.execPath, [remotionCli, 'ffprobe', '-v', 'error', ...арг, 'public/clips/full.mp4'], {cwd: projectDir});
const длит = Number(пробить('-show_entries', 'format=duration', '-of', 'csv=p=0'));
const [ширина, высота] = пробить('-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0').split(',').map(Number);

const план = JSON.parse(readFileSync(join(projectDir, 'edit-plan.json'), 'utf8'));
план.source = смешанный(видео);
план.width = ширина; план.height = высота;
// Геометрия шаблона задана для высоты 1080 — масштаб от фактической высоты.
const k = высота / 1080;
const м = (x) => Math.round(x * k);
for (const блок of ['textA', 'textB', 'sub']) {
  if (!план.layout[блок]) continue;
  for (const [кл, з] of Object.entries(план.layout[блок]))
    if (typeof з === 'number' && кл !== 'maxLines') план.layout[блок][кл] = м(з);
}
if (ширина < высота) {
  // Вертикаль: профиль канона (центральные 75% ширины, зона 60–75% высоты).
  const кв = высота / 1920;
  const м2 = (x) => Math.round(x * кв);
  план.layout.textA = {x: Math.round(ширина * 0.125), bottom: м2(600), size: м2(68),
    maxWidth: Math.round(ширина * 0.75), maxLines: 2, accentSize: м2(88)};
  план.layout.sub = {bottom: м2(620), size: м2(48), maxWidth: Math.round(ширина * 0.75)};
  console.log('ВЕРТИКАЛЬ: применён профиль канона — проверь кадрами.');
}
план.modes = [{mode: 'A', from: 0, to: Math.round(длит * 100) / 100,
  note: 'ЗАПОЛНИТЬ по выводу сцены-по-области.py, если в записи есть сплит'}];
план.fragments[0].to = Math.round(длит * 100) / 100;
writeFileSync(join(projectDir, 'edit-plan.json'), JSON.stringify(план, null, 2) + '\n');

console.log(`
Готово: ${projectDir}  (исходник ${длит.toFixed(2)} с)

Дальше — по README репозитория, раздел «Порядок работы»:
  1. пословный транскрипт и субтитры
  2. надписи-выводы в edit-plan.json
  3. node tools/вырезать-паузы.mjs — вырезание пауз
  4. npm run check && npm run studio`);

try { выполнить(process.execPath, [join(projectDir, 'tools/проверить-окружение.mjs')]); } catch {}
