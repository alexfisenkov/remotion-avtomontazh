#!/usr/bin/env node
// Скачивает базовую библиотеку из 32 звуков @remotion/sfx с их родного сервера
// remotion.media. Файлы принадлежат Remotion и в этом репозитории НЕ лежат —
// принцип простой: чужое качаем у хозяина, своё держим у себя.
// Запуск: node звуки/скачать-базу.mjs [папка]   (по умолчанию — звуки/sounds)
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ЗДЕСЬ = dirname(fileURLToPath(import.meta.url));
const куда = process.argv[2] ?? join(ЗДЕСЬ, 'sounds');
mkdirSync(куда, { recursive: true });

const манифест = JSON.parse(readFileSync(join(ЗДЕСЬ, 'манифест.json'), 'utf8'));
const внешние = Object.entries(манифест.звуки)
  .filter(([, з]) => з.category !== 'синтез');

let скачано = 0, было = 0, провалов = 0;
for (const [имя, з] of внешние) {
  const файл = join(куда, з.file);
  try {
    if (statSync(файл).size > 0) { было += 1; continue; }
  } catch { /* нет файла — качаем */ }
  const url = `https://remotion.media/${з.file}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    writeFileSync(файл, Buffer.from(await r.arrayBuffer()));
    скачано += 1;
    console.log(`  + ${з.file}`);
  } catch (e) {
    провалов += 1;
    console.error(`  ! ${имя}: ${String(e.message ?? e)}`);
  }
}
console.log(`Скачано: ${скачано}, уже было: ${было}, провалов: ${провалов} (всего внешних: ${внешние.length})`);
if (провалов) {
  console.error('Часть не скачалась — обычно это сеть. Запустите ещё раз: готовые файлы не перекачиваются.');
  process.exit(1);
}
