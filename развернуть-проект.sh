#!/usr/bin/env bash
# Разворачивает проект монтажа из этого репозитория: шаблон + инструменты + шрифт + звуки.
# Запуск: ./развернуть-проект.sh <папка-проекта> <путь-к-видео>
# Имена переменных латиницей: bash 3.2 на macOS кириллицу в идентификаторах не принимает.
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="${1:?Укажите папку проекта: развернуть-проект.sh <папка> <видео>}"
video="${2:?Укажите путь к исходному видео}"

[ -f "$video" ] || { echo "Нет такого файла: $video" >&2; exit 1; }
command -v node >/dev/null || { echo "Нужен Node.js 20+: https://nodejs.org" >&2; exit 1; }
command -v npm  >/dev/null || { echo "npm не найден — он ставится вместе с Node.js" >&2; exit 1; }
case "$project_dir" in
  # Пробел в пути ломает бандлер уже на npm run studio — лучше упасть сейчас,
  # чем после пяти минут установки зависимостей.
  *" "*) echo "Путь проекта — без пробелов, латиницей: его читает бандлер. Пример: ~/video/moy-vypusk" >&2; exit 1 ;;
esac
if [ -e "$project_dir" ]; then
  echo "Папка $project_dir уже существует — ничего не трогаю." >&2
  echo "Если это обломок прошлого запуска (сеть оборвалась и т.п.) — удалите её и запустите снова:" >&2
  echo "  rm -rf \"$project_dir\"" >&2
  exit 1
fi

mkdir -p "$project_dir"/{src,tools,public/fonts,public/clips,public/sounds,public/music,out}
cp "$repo_dir"/шаблон/src/*.ts "$repo_dir"/шаблон/src/*.tsx "$project_dir/src/"
cp "$repo_dir"/шаблон/package.json "$repo_dir"/шаблон/tsconfig.json \
   "$repo_dir"/шаблон/remotion.config.ts "$repo_dir"/шаблон/edit-plan.json "$project_dir/"
cp "$repo_dir"/инструменты/проверка-листа.mjs "$repo_dir"/инструменты/субтитры-из-whisper.mjs \
   "$repo_dir"/инструменты/вырезать-паузы.mjs "$repo_dir"/инструменты/сцены-по-области.py \
   "$repo_dir"/инструменты/контрольный-лист.py "$repo_dir"/инструменты/эскизы.mjs \
   "$repo_dir"/инструменты/паспорт-исходника.mjs \
   "$repo_dir"/инструменты/проверить-окружение.mjs "$project_dir/tools/"

# Агенты конвейера и канон — в проект. Claude Code подхватит .claude/agents/ сам,
# любой другой агент найдёт те же файлы через AGENTS.md проекта: это обычные плейбуки.
mkdir -p "$project_dir/.claude/agents" "$project_dir/монтажёр"
cp "$repo_dir"/агенты/*.md "$project_dir/.claude/agents/"
cp "$repo_dir"/монтажёр/жанры.json "$repo_dir"/монтажёр/правила-текста.md "$project_dir/монтажёр/"

# AGENTS.md — стандарт, который читают Codex, Cursor, Gemini CLI и другие агенты.
# В проект кладётся копия контракта с указанием, где лежит репозиторий системы.
{
  echo "> Репозиторий системы: $repo_dir"
  echo "> README с порядком работы — там. Плейбуки конвейера — .claude/agents/ этой папки."
  echo
  cat "$repo_dir/AGENTS.md"
} > "$project_dir/AGENTS.md"
cp "$repo_dir"/звуки/music/pad-calm.wav "$project_dir/public/music/" 2>/dev/null || true

# Шрифт Oswald — с серверов Google Fonts, лицензия OFL. На рендере в сеть не ходим,
# поэтому файлы кладутся в проект заранее.
echo "Скачиваю Oswald…"
base="https://fonts.gstatic.com/s/oswald/v57"
curl -fsS -o "$project_dir/public/fonts/oswald-cyrillic.woff2" \
  "$base/TK3IWkUHHAIjg75cFRf3bXL8LICs1_Fv40pKlN4NNSeSASz7FmlSHYjMdZwlou4.woff2"
curl -fsS -o "$project_dir/public/fonts/oswald-latin.woff2" \
  "$base/TK3IWkUHHAIjg75cFRf3bXL8LICs1_Fv40pKlN4NNSeSASz7FmlWHYjMdZwl.woff2"

# Звуки: база Remotion качается с remotion.media, наши синтезированные берутся из репо.
echo "Готовлю звуки…"
node "$repo_dir/звуки/скачать-базу.mjs" "$repo_dir/звуки/sounds" || true
cp "$repo_dir"/звуки/sounds/*.wav "$project_dir/public/sounds/" 2>/dev/null || \
  echo "Звуки не скопировались полностью — проверьте вывод выше" >&2

echo "Копирую исходник в public/clips/full.mp4…"
cp "$video" "$project_dir/public/clips/full.mp4"

echo "Ставлю зависимости…"
(cd "$project_dir" && npm install --no-audit --no-fund)

# Длительность — через ffprobe из пакета Remotion: системный ffmpeg не нужен.
duration=$(cd "$project_dir" && npx remotion ffprobe -v error -show_entries format=duration -of csv=p=0 public/clips/full.mp4)
dims=$(cd "$project_dir" && npx remotion ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 public/clips/full.mp4)
node -e "
const fs = require('fs');
const p = process.argv[1];
const plan = JSON.parse(fs.readFileSync(p, 'utf8'));
const d = Number(process.argv[2]);
plan.source = process.argv[3];
const [w, h] = process.argv[4].split(',').map(Number);
plan.width = w; plan.height = h;
// Геометрия шаблона задана для высоты 1080 — масштаб от фактической высоты.
// Пропуск этого шага = элементы криво лежат на «не том» соотношении сторон.
const k = h / 1080;
const м = (x) => Math.round(x * k);
for (const блок of ['textA', 'textB', 'sub']) {
  if (!plan.layout[блок]) continue;
  for (const [кл, з] of Object.entries(plan.layout[блок])) {
    if (typeof з === 'number' && кл !== 'maxLines') plan.layout[блок][кл] = м(з);
  }
}
if (w < h) {
  // Вертикаль: масштаб от высоты даёт текст шире кадра — профиль канона
  // (центральные 75% ширины, зона 60–75% высоты; числа из монтажёр/жанры.json).
  const кв = h / 1920;
  const м2 = (x) => Math.round(x * кв);
  plan.layout.textA = { x: Math.round(w * 0.125), bottom: м2(600), size: м2(68),
    maxWidth: Math.round(w * 0.75), maxLines: 2, accentSize: м2(88) };
  plan.layout.sub = { bottom: м2(620), size: м2(48), maxWidth: Math.round(w * 0.75) };
  console.log('ВЕРТИКАЛЬ: применён профиль канона (числа помечены «уточнить» — проверьте кадрами).');
}
plan.modes = [{ mode: 'A', from: 0, to: Math.round(d * 100) / 100,
  note: 'ЗАПОЛНИТЬ по выводу сцены-по-области.py, если в записи есть сплит' }];
plan.fragments[0].to = Math.round(d * 100) / 100;
fs.writeFileSync(p, JSON.stringify(plan, null, 2) + '\n');
" "$project_dir/edit-plan.json" "$duration" "$video" "$dims"

cat <<END

Готово: $project_dir  (исходник $duration с)

Дальше — по README репозитория, раздел «Порядок работы»:
  1. пословный транскрипт и субтитры
  2. надписи-выводы в edit-plan.json
  3. node tools/вырезать-паузы.mjs — вырезание пауз
  4. npm run check && npm run studio
END

node "$project_dir/tools/проверить-окружение.mjs" || true
