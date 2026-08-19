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
  *" "*) echo "Путь проекта без пробелов, папки внутри него — латиницей: их читает бандлер" >&2 ;;
esac
if [ -e "$project_dir" ]; then
  echo "Папка $project_dir уже существует — ничего не трогаю." >&2
  exit 1
fi

mkdir -p "$project_dir"/{src,tools,public/fonts,public/clips,public/sounds,out}
cp "$repo_dir"/шаблон/src/*.ts "$repo_dir"/шаблон/src/*.tsx "$project_dir/src/"
cp "$repo_dir"/шаблон/package.json "$repo_dir"/шаблон/tsconfig.json \
   "$repo_dir"/шаблон/remotion.config.ts "$repo_dir"/шаблон/edit-plan.json "$project_dir/"
cp "$repo_dir"/инструменты/проверка-листа.mjs "$repo_dir"/инструменты/субтитры-из-whisper.mjs \
   "$repo_dir"/инструменты/вырезать-паузы.mjs "$repo_dir"/инструменты/сцены-по-области.py \
   "$repo_dir"/инструменты/контрольный-лист.py "$project_dir/tools/"

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
node -e "
const fs = require('fs');
const p = process.argv[1];
const plan = JSON.parse(fs.readFileSync(p, 'utf8'));
const d = Number(process.argv[2]);
plan.source = process.argv[3];
plan.modes = [{ mode: 'A', from: 0, to: Math.round(d * 100) / 100,
  note: 'ЗАПОЛНИТЬ по выводу сцены-по-области.py, если в записи есть сплит' }];
plan.fragments[0].to = Math.round(d * 100) / 100;
fs.writeFileSync(p, JSON.stringify(plan, null, 2) + '\n');
" "$project_dir/edit-plan.json" "$duration" "$video"

cat <<END

Готово: $project_dir  (исходник $duration с)

Дальше — по README репозитория, раздел «Порядок работы»:
  1. пословный транскрипт и субтитры
  2. надписи-выводы в edit-plan.json
  3. node tools/вырезать-паузы.mjs — вырезание пауз
  4. npm run check && npm run studio
END
